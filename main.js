const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const database = require('./src/db/database');
const pdfParser = require('./src/utils/pdf-parser');
const wordParser = require('./src/utils/word-parser');

const driveApi = require('./src/drive/api');

// Añadir manejo de errores global
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
});

// Crear carpeta para la base de datos si no existe
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Directorio de datos creado en:', dataDir);
}

// Variables para la detección automática de documentos
let ultimaVerificacion = new Date();
const INTERVALO_VERIFICACION = 300000; // 5 minutos en milisegundos
let verificacionAutomaticaActiva = true;
let timerVerificacion = null;

// Mantener referencia global
let mainWindow;

// Función auxiliar para verificar si un archivo es válido (PDF o Word)
function esArchivoValido(rutaArchivo) {
  const extension = path.extname(rutaArchivo).toLowerCase();
  return ['.pdf', '.doc', '.docx'].includes(extension);
}

// Función auxiliar para procesar un documento (PDF o Word)
async function procesarArchivo(rutaArchivo) {
  const extension = path.extname(rutaArchivo).toLowerCase();
  
  try {
    if (extension === '.pdf') {
      console.log(`Procesando PDF: ${rutaArchivo}`);
      return await pdfParser.extraerTextoPDF(rutaArchivo);
    } else if (['.doc', '.docx'].includes(extension)) {
      console.log(`Procesando Word: ${rutaArchivo}`);
      return await wordParser.extraerTextoWord(rutaArchivo);
    } else {
      throw new Error(`Tipo de archivo no soportado: ${extension}`);
    }
  } catch (error) {
    console.error(`Error al procesar archivo ${rutaArchivo}: ${error.message}`);
    return { 
      texto: '', 
      asunto: 'Error al procesar',
      error: error.message
    };
  }
}

function createWindow() {
  console.log('Creando ventana principal...');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true // Asegurar que DevTools esté disponible
    }
  });

  // Verificar que el archivo HTML exista
  const htmlPath = path.join(__dirname, 'renderer', 'index.html');
  console.log('Ruta al archivo HTML:', htmlPath);
  
  if (fs.existsSync(htmlPath)) {
    console.log('El archivo HTML existe, cargando...');
    // Cargar la interfaz HTML
    mainWindow.loadFile(htmlPath);
  } else {
    console.error('ERROR: El archivo HTML no existe en la ruta:', htmlPath);
    console.log('Directorio actual:', __dirname);
    console.log('Contenido de la carpeta renderer:');
    
    try {
      const rendererDir = path.join(__dirname, 'renderer');
      if (fs.existsSync(rendererDir)) {
        console.log(fs.readdirSync(rendererDir));
      } else {
        console.error('La carpeta renderer no existe');
      }
    } catch (err) {
      console.error('Error al listar directorio:', err);
    }
  }
  
  // Abrir DevTools para depuración
  mainWindow.webContents.openDevTools();
  
  // Detectar errores al cargar la página
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Error al cargar la página:', errorCode, errorDescription);
  });

  // Confirmar cuando la página se ha cargado correctamente
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Página cargada correctamente');
  });
  
  // Detectar cuando la ventana se cierre
  mainWindow.on('closed', () => {
    mainWindow = null;
    console.log('Ventana cerrada');
  });
}

// Función para verificar documentos nuevos (ACTUALIZADA para incluir Word)
async function verificarDocumentosNuevos() {
  try {
    console.log('Iniciando verificación de documentos nuevos...');
    
    // Obtener lista actual de documentos desde el drive/sistema de archivos
    const documentosActuales = await driveApi.listarTodosLosDocumentos();
    console.log(`Se encontraron ${documentosActuales.length} documentos en total.`);
    
    // Filtrar para encontrar solo documentos nuevos (PDF y Word)
    const documentosNuevos = [];
    
    for (const doc of documentosActuales) {
      try {
        // Verificar si ya existe en la base de datos
        const existe = await database.documentoExiste(doc.ruta);
        if (!existe && esArchivoValido(doc.ruta)) {
          console.log(`Documento nuevo encontrado: ${doc.nombre}`);
          documentosNuevos.push(doc);
        }
      } catch (error) {
        console.error(`Error al verificar si existe el documento ${doc.nombre}:`, error);
      }
    }
    
    // Actualizar la última verificación
    ultimaVerificacion = new Date();
    
    // Si se encontraron documentos nuevos, notificar al frontend
    if (documentosNuevos.length > 0) {
      console.log(`Se encontraron ${documentosNuevos.length} documentos nuevos.`);
      
      // Verificar que mainWindow existe antes de enviar el mensaje
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('documentos-nuevos-detectados', documentosNuevos);
      } else {
        console.log('La ventana principal no está disponible para notificar.');
      }
    } else {
      console.log('No se encontraron documentos nuevos.');
    }
    
    return documentosNuevos;
  } catch (error) {
    console.error('Error durante la verificación de documentos nuevos:', error);
    return [];
  }
}

// Función para procesar un documento nuevo con asunto personalizado (ACTUALIZADA)
async function procesarDocumentoNuevo(documento, asuntoPersonalizado) {
  try {
    console.log(`Procesando documento nuevo con asunto personalizado: ${documento.nombre}`);
    
    // Extraer texto del documento (PDF o Word)
    let documentoInfo;
    try {
      const infoPromise = procesarArchivo(documento.ruta);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Tiempo límite excedido al procesar documento')), 15000);
      });
      
      documentoInfo = await Promise.race([infoPromise, timeoutPromise]);
    } catch (docError) {
      console.error(`Error o tiempo límite al procesar documento ${documento.nombre}: ${docError.message}`);
      documentoInfo = { texto: '', asunto: 'Error al procesar' };
    }
    
    // Guardar en la base de datos con el asunto personalizado
    await database.agregarDocumento({
      nombre: documento.nombre,
      ruta: documento.ruta,
      tipo: documento.tipo,
      fecha: documento.fecha,
      asunto: asuntoPersonalizado || documentoInfo.asunto || 'Sin asunto',
      contenido: documentoInfo.texto || ''
    });
    
    console.log(`Documento procesado y guardado correctamente: ${documento.nombre}`);
    return { success: true };
  } catch (error) {
    console.error(`Error al procesar documento ${documento.nombre}:`, error);
    return { success: false, error: error.message };
  }
}

// FUNCIÓN PARA INDEXAR CARPETA ESPECÍFICA (ACTUALIZADA para incluir Word)
async function indexarCarpetaEspecifica(rutaCarpeta) {
  try {
    console.log(`Iniciando indexación de carpeta específica: ${rutaCarpeta}`);
    
    // Verificar que la carpeta existe
    if (!fs.existsSync(rutaCarpeta)) {
      throw new Error('La carpeta especificada no existe');
    }
    
    // Función recursiva para obtener todos los archivos válidos de una carpeta
    function obtenerArchivosValidos(directorio) {
      const archivos = [];
      
      try {
        const elementos = fs.readdirSync(directorio);
        
        for (const elemento of elementos) {
          const rutaCompleta = path.join(directorio, elemento);
          const stats = fs.statSync(rutaCompleta);
          
          if (stats.isDirectory()) {
            // Si es un directorio, procesar recursivamente
            archivos.push(...obtenerArchivosValidos(rutaCompleta));
          } else if (stats.isFile() && esArchivoValido(rutaCompleta)) {
            // Si es un archivo válido (PDF o Word), agregarlo a la lista
            const extension = path.extname(rutaCompleta).toLowerCase();
            console.log(`Encontrado archivo ${extension.toUpperCase()}: ${elemento}`);
            
            archivos.push({
              nombre: elemento,
              ruta: rutaCompleta,
              tipo: determinarTipoDocumento(elemento),
              fecha: stats.mtime.toISOString().split('T')[0],
              extension: extension
            });
          }
        }
      } catch (error) {
        console.error(`Error al leer directorio ${directorio}:`, error);
      }
      
      return archivos;
    }
    
    // Función auxiliar para determinar el tipo de documento
    function determinarTipoDocumento(nombre) {
      nombre = nombre.toLowerCase();
      
      if (nombre.includes('carta') || nombre.startsWith('carta')) {
        return 'carta';
      } else if (nombre.includes('informe')) {
        return 'informe';
      } else if (nombre.includes('contrato')) {
        return 'contrato';
      } else if (nombre.includes('memo') || nombre.includes('memorando')) {
        return 'memorando';
      } else if (nombre.includes('acta')) {
        return 'acta';
      } else if (nombre.includes('resolucion') || nombre.includes('resolución')) {
        return 'resolución';
      } else {
        return 'otro';
      }
    }
    
    // Obtener todos los archivos válidos de la carpeta
    const documentos = obtenerArchivosValidos(rutaCarpeta);
    console.log(`Se encontraron ${documentos.length} documentos válidos en la carpeta.`);
    
    let indexados = 0;
    let errores = 0;
    let yaExisten = 0;
    
    // Procesar cada documento
    for (const doc of documentos) {
      try {
        // Verificar si ya existe en la base de datos
        const existe = await database.documentoExiste(doc.ruta);
        if (existe) {
          console.log(`El documento ya existe en la base de datos: ${doc.nombre}`);
          yaExisten++;
          continue;
        }
        
        // Extraer texto y asunto del documento
        console.log(`Procesando documento ${doc.extension.toUpperCase()}: ${doc.nombre}`);
        
        const infoPromise = procesarArchivo(doc.ruta);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Tiempo límite excedido al procesar documento')), 15000);
        });
        
        let documentoInfo;
        try {
          documentoInfo = await Promise.race([infoPromise, timeoutPromise]);
        } catch (docError) {
          console.error(`Error o tiempo límite al procesar documento ${doc.nombre}: ${docError.message}`);
          documentoInfo = { texto: '', asunto: 'Error al procesar' };
        }
        
        // Guardar en la base de datos
        await database.agregarDocumento({
          nombre: doc.nombre,
          ruta: doc.ruta,
          tipo: doc.tipo,
          fecha: doc.fecha,
          asunto: documentoInfo.asunto || 'Sin asunto',
          contenido: documentoInfo.texto || ''
        });
        
        indexados++;
        
        // Informar progreso cada 5 documentos
        if (indexados % 5 === 0) {
          console.log(`Progreso: ${indexados} documentos indexados hasta ahora...`);
        }
        
      } catch (docError) {
        console.error(`Error al procesar documento ${doc.nombre}:`, docError);
        errores++;
      }
    }
    
    const mensaje = `Indexación de carpeta completada. ${indexados} documentos nuevos indexados. ${yaExisten} ya existían. ${errores} errores.`;
    console.log(mensaje);
    return { 
      success: true, 
      message: mensaje,
      documentosIndexados: indexados,
      documentosExistentes: yaExisten,
      errores: errores,
      total: documentos.length
    };
  } catch (error) {
    console.error('Error durante la indexación de carpeta específica:', error);
    return { success: false, error: error.message };
  }
}

// Iniciar aplicación cuando Electron esté listo
app.whenReady().then(() => {
  console.log('Electron está listo, creando ventana...');
  createWindow();
  
  // Iniciar verificación automática de documentos nuevos
  if (verificacionAutomaticaActiva) {
    timerVerificacion = setInterval(() => {
      if (verificacionAutomaticaActiva) {
        verificarDocumentosNuevos().catch(err => {
          console.error('Error en la verificación automática:', err);
        });
      }
    }, INTERVALO_VERIFICACION);
    
    console.log(`Verificación automática iniciada. Intervalo: ${INTERVALO_VERIFICACION/1000} segundos`);
  }
  
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      console.log('Activando aplicación, creando nueva ventana...');
      createWindow();
    }
  });
}).catch(err => {
  console.error('Error al iniciar la aplicación:', err);
});

app.on('window-all-closed', function () {
  console.log('Todas las ventanas cerradas');
  
  // Detener el timer de verificación automática
  if (timerVerificacion) {
    clearInterval(timerVerificacion);
    timerVerificacion = null;
    console.log('Verificación automática detenida.');
  }
  
  if (process.platform !== 'darwin') {
    console.log('Cerrando la aplicación');
    app.quit();
  }
});

// Manejadores IPC existentes
ipcMain.handle('buscar-documentos', async (event, criterios) => {
  console.log('Búsqueda solicitada con criterios:', criterios);
  
  try {
    // Utilizar la base de datos para buscar documentos
    const resultados = await database.buscarDocumentos(criterios);
    console.log(`Se encontraron ${resultados.length} resultados en la base de datos.`);
    return resultados;
  } catch (error) {
    console.error('Error durante la búsqueda:', error);
    return [];
  }
});

ipcMain.handle('abrir-documento', async (event, ruta) => {
  try {
    console.log('Intentando abrir documento:', ruta);
    // Verificar si el archivo existe
    if (fs.existsSync(ruta)) {
      console.log('El archivo existe, abriéndolo...');
      // Abrir el documento con la aplicación predeterminada
      await shell.openPath(ruta);
      return { success: true };
    } else {
      console.error('El archivo no existe en la ruta especificada');
      return { success: false, error: 'Archivo no encontrado' };
    }
  } catch (error) {
    console.error('Error al abrir el documento:', error);
    return { success: false, error: error.message };
  }
});

// INDEXAR CARPETA COMPLETA (ACTUALIZADA para incluir Word)
ipcMain.handle('indexar-carpeta', async (event) => {
  try {
    console.log('Iniciando indexación completa de documentos...');
    
    // Obtener lista de documentos desde el drive/sistema de archivos
    const documentos = await driveApi.listarTodosLosDocumentos();
    console.log(`Se encontraron ${documentos.length} documentos en total.`);
    
    let indexados = 0;
    let errores = 0;
    
    // Procesar cada documento válido
    for (const doc of documentos) {
      try {
        // Verificar si ya existe en la base de datos
        const existe = await database.documentoExiste(doc.ruta);
        if (existe) {
          console.log(`El documento ya existe en la base de datos: ${doc.nombre}`);
          continue;
        }
        
        // Verificar si es un archivo válido (PDF o Word)
        if (esArchivoValido(doc.ruta)) {
          // Extraer texto y asunto del documento
          console.log(`Procesando documento: ${doc.nombre}`);
          
          // Establecer un tiempo límite para procesar cada documento
          const infoPromise = procesarArchivo(doc.ruta);
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Tiempo límite excedido al procesar documento')), 15000);
          });
          
          let documentoInfo;
          try {
            documentoInfo = await Promise.race([infoPromise, timeoutPromise]);
          } catch (docError) {
            console.error(`Error o tiempo límite al procesar documento ${doc.nombre}: ${docError.message}`);
            documentoInfo = { texto: '', asunto: 'Error al procesar' };
          }
          
          // Guardar en la base de datos
          await database.agregarDocumento({
            nombre: doc.nombre,
            ruta: doc.ruta,
            tipo: doc.tipo,
            fecha: doc.fecha,
            asunto: documentoInfo.asunto || 'Sin asunto',
            contenido: documentoInfo.texto || ''
          });
          
          indexados++;
          
          // Informar progreso cada 10 documentos
          if (indexados % 10 === 0) {
            console.log(`Progreso: ${indexados} documentos indexados hasta ahora...`);
          }
        }
      } catch (docError) {
        console.error(`Error al procesar documento ${doc.nombre}:`, docError);
        errores++;
      }
    }
    
    const mensaje = `Indexación completada. ${indexados} documentos indexados. ${errores} errores.`;
    console.log(mensaje);
    return { success: true, message: mensaje };
  } catch (error) {
    console.error('Error durante la indexación:', error);
    return { success: false, error: error.message };
  }
});

// NUEVOS MANEJADORES IPC PARA CAMPO DE RUTA

ipcMain.handle('seleccionar-carpeta', async (event) => {
  try {
    console.log('Abriendo diálogo de selección de carpeta...');
    
    const resultado = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Seleccionar carpeta para indexar',
      buttonLabel: 'Seleccionar'
    });
    
    if (resultado.canceled) {
      console.log('Selección de carpeta cancelada por el usuario');
      return { success: false, canceled: true };
    }
    
    const rutaSeleccionada = resultado.filePaths[0];
    console.log(`Carpeta seleccionada: ${rutaSeleccionada}`);
    
    return { 
      success: true, 
      path: rutaSeleccionada 
    };
  } catch (error) {
    console.error('Error al mostrar diálogo de selección de carpeta:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('indexar-carpeta-especifica', async (event, rutaCarpeta) => {
  try {
    console.log(`Solicitud de indexación de carpeta específica: ${rutaCarpeta}`);
    const resultado = await indexarCarpetaEspecifica(rutaCarpeta);
    return resultado;
  } catch (error) {
    console.error('Error durante la indexación de carpeta específica:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('sincronizar-drive', async (event) => {
  console.log('Sincronización con Google Drive solicitada');
  return { success: true, message: 'Función de sincronización aún no implementada' };
});

// Manejadores IPC para la detección de documentos nuevos
ipcMain.handle('verificar-documentos-nuevos', async (event) => {
  try {
    console.log('Verificación manual de documentos nuevos solicitada');
    const documentosNuevos = await verificarDocumentosNuevos();
    return { 
      success: true, 
      documentos: documentosNuevos,
      cantidad: documentosNuevos.length
    };
  } catch (error) {
    console.error('Error durante la verificación manual:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('procesar-documento-nuevo', async (event, { documento, asunto }) => {
  try {
    console.log(`Procesando documento nuevo: ${documento.nombre} con asunto: "${asunto}"`);
    const resultado = await procesarDocumentoNuevo(documento, asunto);
    return { ...resultado, documento };
  } catch (error) {
    console.error('Error al procesar documento nuevo:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('configurar-verificacion-automatica', async (event, { activa }) => {
  verificacionAutomaticaActiva = !!activa;
  console.log(`Verificación automática ${verificacionAutomaticaActiva ? 'activada' : 'desactivada'}`);
  
  // Si se está activando y no hay timer, iniciarlo
  if (verificacionAutomaticaActiva && !timerVerificacion) {
    timerVerificacion = setInterval(() => {
      if (verificacionAutomaticaActiva) {
        verificarDocumentosNuevos().catch(err => {
          console.error('Error en la verificación automática:', err);
        });
      }
    }, INTERVALO_VERIFICACION);
    console.log('Timer de verificación iniciado');
  } 
  // Si se está desactivando y hay timer, detenerlo
  else if (!verificacionAutomaticaActiva && timerVerificacion) {
    clearInterval(timerVerificacion);
    timerVerificacion = null;
    console.log('Timer de verificación detenido');
  }
  
  return { success: true, activa: verificacionAutomaticaActiva };
});

// NUEVO MANEJADOR IPC PARA ACTUALIZAR ASUNTO
ipcMain.handle('actualizar-asunto-documento', async (event, { ruta, nuevoAsunto }) => {
  try {
    console.log(`Solicitud de actualización de asunto para: ${ruta}`);
    console.log(`Nuevo asunto: "${nuevoAsunto}"`);
    
    const resultado = await database.actualizarAsuntoDocumento(ruta, nuevoAsunto);
    console.log('Asunto actualizado correctamente en la base de datos');
    
    return { 
      success: true, 
      message: 'Asunto actualizado correctamente',
      cambios: resultado.cambios
    };
  } catch (error) {
    console.error('Error al actualizar asunto del documento:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});
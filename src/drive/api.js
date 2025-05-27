const fs = require('fs');
const path = require('path');

// Directorio de prueba - usar uno mucho más pequeño
let driveDirectories = [
  'G:\\.shortcut-targets-by-id\\1EP3NtOSGb4GB-SDAjNy5ogKFley2ZVBL\\CONSORCIO PRESA SULLANA'
];

// Extensiones de archivos soportadas
const extensionesPermitidas = ['.pdf', '.docx', '.doc'];

// Función para verificar si un archivo tiene una extensión válida
function esArchivoValido(nombreArchivo) {
  const extension = path.extname(nombreArchivo).toLowerCase();
  return extensionesPermitidas.includes(extension);
}

// Función simplificada para listar PDFs y Word en el directorio actual (con recursión)
async function listarArchivosEnCarpeta(carpetaPath) {
  try {
    console.log(`Escaneando carpeta: ${carpetaPath}`);
    const archivos = [];
    
    if (!fs.existsSync(carpetaPath)) {
      console.error(`La carpeta no existe: ${carpetaPath}`);
      return archivos;
    }
    
    // Leer todos los elementos del directorio
    const items = fs.readdirSync(carpetaPath, { withFileTypes: true });
    console.log(`Encontrados ${items.length} elementos en ${carpetaPath}`);
    
    for (const item of items) {
      const itemPath = path.join(carpetaPath, item.name);
      
      try {
        if (item.isDirectory()) {
          // Es una carpeta, buscar recursivamente en ella
          console.log(`Entrando a subcarpeta: ${item.name}`);
          const subArchivos = await listarArchivosEnCarpeta(itemPath);
          archivos.push(...subArchivos);
        } else if (item.isFile() && esArchivoValido(item.name)) {
          // Es un archivo válido (PDF o Word), verificar que sea accesible
          try {
            // Comprobar que podemos acceder al archivo
            fs.accessSync(itemPath, fs.constants.R_OK);
            
            // Obtener la extensión para determinar el tipo de archivo
            const extension = path.extname(item.name).toLowerCase();
            
            // Agregar a la lista de archivos
            console.log(`Añadiendo archivo ${extension.toUpperCase()}: ${item.name}`);
            archivos.push({
              nombre: item.name,
              ruta: itemPath,
              tipo: determinarTipoDocumento(item.name),
              fecha: obtenerFechaModificacion(itemPath),
              extension: extension // Añadir información de extensión
            });
          } catch (fileError) {
            console.error(`No se puede acceder al archivo ${itemPath}: ${fileError.message}`);
          }
        }
      } catch (itemError) {
        console.error(`Error al procesar ${itemPath}: ${itemError.message}`);
        // Continuar con el siguiente elemento
      }
    }
    
    console.log(`Total archivos encontrados en ${carpetaPath} y subcarpetas: ${archivos.length}`);
    return archivos;
  } catch (error) {
    console.error(`Error al listar archivos en ${carpetaPath}: ${error.message}`);
    return [];
  }
}

// Función auxiliar para determinar el tipo de documento basado en el nombre
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

// Función para obtener la fecha de modificación de un archivo
function obtenerFechaModificacion(rutaArchivo) {
  try {
    const stats = fs.statSync(rutaArchivo);
    const fecha = stats.mtime;
    
    // Formatear fecha como DD/MM/YYYY
    return fecha.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    console.error(`Error al obtener fecha de ${rutaArchivo}:`, error);
    return '';
  }
}

module.exports = {
  // Listar todos los documentos en las carpetas configuradas
  listarTodosLosDocumentos: async () => {
    let todosLosArchivos = [];
    
    for (const directorio of driveDirectories) {
      try {
        console.log(`Escaneando directorio: ${directorio}`);
        const archivos = await listarArchivosEnCarpeta(directorio);
        console.log(`Se encontraron ${archivos.length} archivos en ${directorio}`);
        todosLosArchivos = todosLosArchivos.concat(archivos);
      } catch (error) {
        console.error(`Error al escanear directorio ${directorio}:`, error);
      }
    }
    
    return todosLosArchivos;
  },
  
  // Configurar las carpetas a indexar
  configurarCarpetas: (carpetas) => {
    if (Array.isArray(carpetas) && carpetas.length > 0) {
      driveDirectories = carpetas;
      return true;
    }
    return false;
  },
  
  // Obtener las carpetas configuradas
  obtenerCarpetasConfiguradas: () => {
    return [...driveDirectories];
  },
  
  // Obtener extensiones soportadas
  obtenerExtensionesPermitidas: () => {
    return [...extensionesPermitidas];
  }
};
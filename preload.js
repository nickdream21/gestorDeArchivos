const { contextBridge, ipcRenderer } = require('electron');

// Exponer funciones seguras al proceso de renderizado
contextBridge.exposeInMainWorld('electronAPI', {
  // Funciones para gestión documental (existentes)
  buscarDocumentos: (criterios) => ipcRenderer.invoke('buscar-documentos', criterios),
  abrirDocumento: (ruta) => ipcRenderer.invoke('abrir-documento', ruta),
  indexarCarpeta: () => ipcRenderer.invoke('indexar-carpeta'),
  sincronizarDrive: () => ipcRenderer.invoke('sincronizar-drive'),
  
  // NUEVAS FUNCIONES PARA CAMPO DE RUTA
  seleccionarCarpeta: () => ipcRenderer.invoke('seleccionar-carpeta'),
  indexarCarpetaEspecifica: (rutaCarpeta) => ipcRenderer.invoke('indexar-carpeta-especifica', rutaCarpeta),
  
  // NUEVA FUNCIÓN PARA EDITAR ASUNTO
  actualizarAsuntoDocumento: (ruta, nuevoAsunto) => ipcRenderer.invoke('actualizar-asunto-documento', { ruta, nuevoAsunto }),
  
  // Funciones para detección y procesamiento de documentos nuevos
  verificarDocumentosNuevos: () => ipcRenderer.invoke('verificar-documentos-nuevos'),
  procesarDocumentoNuevo: (documento, asunto) => 
    ipcRenderer.invoke('procesar-documento-nuevo', { documento, asunto }),
  configurarVerificacionAutomatica: (activa) => 
    ipcRenderer.invoke('configurar-verificacion-automatica', { activa }),
  
  // Receptor de eventos para cuando se detecten documentos nuevos
  onDocumentosNuevosDetectados: (callback) => {
    // Almacenar la referencia para poder eliminarla
    const subscription = (event, documentos) => callback(documentos);
    ipcRenderer.on('documentos-nuevos-detectados', subscription);
    
    // Devolver una función para eliminar el listener cuando ya no sea necesario
    return () => {
      ipcRenderer.removeListener('documentos-nuevos-detectados', subscription);
    };
  }
});
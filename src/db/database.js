const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Ruta a la base de datos en AppData del usuario (donde SÍ tiene permisos)
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'Gestor-Documentos-Sullana');
const dbPath = path.join(userDataPath, 'documentos.json');

// Asegurar que el directorio exista
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
  console.log('Directorio de datos del usuario creado en:', userDataPath);
}

// Crear adaptador y base de datos
const adapter = new FileSync(dbPath);
const db = low(adapter);

// Inicializar la base de datos con datos por defecto
db.defaults({ documentos: [] }).write();

console.log('Base de datos JSON inicializada correctamente con lowdb@1.0.0');

// Métodos para trabajar con la base de datos
module.exports = {
  // Agregar un documento a la base de datos
  agregarDocumento: (documento) => {
    return new Promise((resolve, reject) => {
      try {
        const nuevoDocumento = {
          id: Date.now(), // ID único basado en timestamp
          nombre: documento.nombre,
          ruta: documento.ruta,
          tipo: documento.tipo,
          fecha: documento.fecha,
          asunto: documento.asunto,
          contenido: documento.contenido,
          fecha_indexacion: new Date().toISOString()
        };
        
        db.get('documentos')
          .push(nuevoDocumento)
          .write();
        
        resolve({ id: nuevoDocumento.id });
      } catch (err) {
        reject(err);
      }
    });
  },
  
  // Buscar documentos según criterios
  buscarDocumentos: (criterios) => {
    return new Promise((resolve, reject) => {
      try {
        let resultados = db.get('documentos').value() || [];
        
        // Filtrar por palabra clave
        if (criterios.keyword && criterios.keyword.trim() !== '') {
          const keyword = criterios.keyword.toLowerCase();
          resultados = resultados.filter(doc => 
            (doc.nombre && doc.nombre.toLowerCase().includes(keyword)) ||
            (doc.asunto && doc.asunto.toLowerCase().includes(keyword)) ||
            (doc.contenido && doc.contenido.toLowerCase().includes(keyword))
          );
        }
        
        // Filtrar por fecha desde
        if (criterios.dateFrom && criterios.dateFrom.trim() !== '') {
          resultados = resultados.filter(doc => 
            doc.fecha && doc.fecha >= criterios.dateFrom
          );
        }
        
        // Filtrar por fecha hasta
        if (criterios.dateTo && criterios.dateTo.trim() !== '') {
          resultados = resultados.filter(doc => 
            doc.fecha && doc.fecha <= criterios.dateTo
          );
        }
        
        // Filtrar por tipo de documento
        if (criterios.documentType && criterios.documentType.trim() !== '') {
          resultados = resultados.filter(doc => 
            doc.tipo === criterios.documentType
          );
        }
        
        resolve(resultados);
      } catch (err) {
        console.error('Error en búsqueda:', err);
        resolve([]);
      }
    });
  },
  
  // Verificar si un documento ya existe en la base de datos
  documentoExiste: (ruta) => {
    return new Promise((resolve, reject) => {
      try {
        const documento = db.get('documentos')
          .find({ ruta: ruta })
          .value();
        
        resolve(!!documento);
      } catch (err) {
        reject(err);
      }
    });
  },
  
  // Actualizar el asunto de un documento
  actualizarAsuntoDocumento: (ruta, nuevoAsunto) => {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Actualizando asunto para documento: ${ruta}`);
        console.log(`Nuevo asunto: ${nuevoAsunto}`);
        
        const documento = db.get('documentos')
          .find({ ruta: ruta })
          .value();
        
        if (!documento) {
          console.warn('No se encontró el documento para actualizar');
          reject(new Error('Documento no encontrado'));
          return;
        }
        
        db.get('documentos')
          .find({ ruta: ruta })
          .assign({ asunto: nuevoAsunto })
          .write();
        
        console.log('Asunto actualizado correctamente');
        resolve({ 
          success: true, 
          cambios: 1,
          mensaje: 'Asunto actualizado correctamente'
        });
      } catch (err) {
        console.error('Error al actualizar asunto:', err);
        reject(err);
      }
    });
  },
  
  // Cerrar la conexión a la base de datos (no necesario para lowdb)
  cerrar: () => {
    return new Promise((resolve) => {
      console.log('Base de datos JSON cerrada correctamente');
      resolve();
    });
  }
};
const mammoth = require('mammoth');
const textract = require('textract');
const path = require('path');

// Timeout para procesamiento de documentos (10 segundos)
const TIMEOUT = 10000;

/**
 * Extrae texto de archivos Word (.docx y .doc)
 * @param {string} rutaArchivo - Ruta al archivo Word
 * @returns {Promise<Object>} - Objeto con texto extraído y metadatos
 */
async function extraerTextoWord(rutaArchivo) {
  try {
    console.log(`Procesando archivo Word: ${rutaArchivo}`);
    
    const extension = path.extname(rutaArchivo).toLowerCase();
    let textoExtraido = '';
    let metadatos = {};
    
    if (extension === '.docx') {
      // Usar mammoth para archivos .docx
      const resultado = await Promise.race([
        mammoth.extractRawText({ path: rutaArchivo }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), TIMEOUT)
        )
      ]);
      
      textoExtraido = resultado.value || '';
      metadatos = {
        tipo: 'docx',
        longitud: textoExtraido.length,
        warnings: resultado.messages || []
      };
      
    } else if (extension === '.doc') {
      // Usar textract para archivos .doc legacy
      textoExtraido = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout al procesar archivo .doc'));
        }, TIMEOUT);
        
        textract.fromFileWithPath(rutaArchivo, (error, text) => {
          clearTimeout(timeout);
          if (error) {
            reject(error);
          } else {
            resolve(text || '');
          }
        });
      });
      
      metadatos = {
        tipo: 'doc',
        longitud: textoExtraido.length
      };
    }
    
    // Limpiar texto extraído
    textoExtraido = limpiarTexto(textoExtraido);
    
    // Intentar detectar asunto automáticamente
    const asuntoDetectado = detectarAsunto(textoExtraido);
    
    console.log(`Archivo Word procesado exitosamente: ${rutaArchivo}`);
    console.log(`Texto extraído: ${textoExtraido.length} caracteres`);
    
    return {
      texto: textoExtraido,
      asunto: asuntoDetectado,
      metadatos: metadatos,
      error: null
    };
    
  } catch (error) {
    console.error(`Error al procesar archivo Word ${rutaArchivo}:`, error.message);
    
    return {
      texto: '',
      asunto: '',
      metadatos: {},
      error: error.message
    };
  }
}

/**
 * Limpia el texto extraído removiendo caracteres innecesarios
 * @param {string} texto - Texto a limpiar
 * @returns {string} - Texto limpio
 */
function limpiarTexto(texto) {
  if (!texto) return '';
  
  return texto
    .replace(/\r\n/g, '\n')           // Normalizar saltos de línea
    .replace(/\n{3,}/g, '\n\n')       // Reducir múltiples saltos de línea
    .replace(/\s{2,}/g, ' ')          // Reducir múltiples espacios
    .trim();                          // Eliminar espacios al inicio y final
}

/**
 * Intenta detectar automáticamente el asunto del documento
 * @param {string} texto - Texto del documento
 * @returns {string} - Asunto detectado o cadena vacía
 */
function detectarAsunto(texto) {
  if (!texto) return '';
  
  // Buscar patrones comunes de asunto
  const patrones = [
    /(?:asunto|subject|tema|ref|referencia):\s*(.+)/i,
    /(?:^|\n)(.{10,100}?)(?:\n|$)/m, // First substantial line
  ];
  
  for (const patron of patrones) {
    const match = texto.match(patron);
    if (match && match[1]) {
      let asunto = match[1].trim();
      
      // Limpiar el asunto
      asunto = asunto
        .replace(/[^\w\s\-\.,]/g, ' ')  // Remover caracteres especiales
        .replace(/\s+/g, ' ')           // Normalizar espacios
        .trim();
      
      // Verificar que tenga una longitud razonable
      if (asunto.length >= 10 && asunto.length <= 200) {
        return asunto;
      }
    }
  }
  
  return '';
}

/**
 * Verifica si un archivo es un documento Word válido
 * @param {string} rutaArchivo - Ruta al archivo
 * @returns {boolean} - True si es un archivo Word válido
 */
function esArchivoWordValido(rutaArchivo) {
  const extension = path.extname(rutaArchivo).toLowerCase();
  return ['.doc', '.docx'].includes(extension);
}

module.exports = {
  extraerTextoWord,
  esArchivoWordValido,
  limpiarTexto,
  detectarAsunto
};
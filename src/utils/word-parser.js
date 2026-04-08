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

    // Detectar asunto usando NLP
    const asuntoDetectado = detectingAsuntoNLP(textoExtraido); // Changed name to avoid conflict if any, but I will replace the function definition too.

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

const nlp = require('compromise');

/**
 * Intenta detectar automáticamente el asunto usando NLP
 * @param {string} texto - Texto del documento
 * @returns {string} - Asunto detectado o cadena vacía
 */
/**
 * Intenta detectar automáticamente el asunto usando NLP y regex avanzado
 * @param {string} texto - Texto del documento
 * @returns {string} - Asunto detectado o cadena vacía
 */
function detectingAsuntoNLP(texto) {
  if (!texto) return '';

  // 1. Patrones explícitos mejorados (prioridad máxima)
  // Busca "ASUNTO:" o similar, tolerando espacios y permitiendo contenido multi-linea hasta doble salto
  const patrones = [
    /(?:A\s*S\s*U\s*N\s*T\s*O|A\s*L\s*C\s*A\s*N\s*Z\s*O|S\s*U\s*B\s*J\s*E\s*C\s*T|T\s*E\s*M\s*A|R\s*E\s*F(?:\s*E\s*R\s*E\s*N\s*C\s*I\s*A)?|S\s*U\s*M\s*I\s*L\s*L\s*A)\s*[:.-]\s*((?:.|\n\s+)+?)(?:\n\s*(?:DATE|FECHA|PARA|DE|FROM|TO)|$|\n{2,})/i,
    /(?:VISTOS?|SUMILLA)\s*[:.-]\s*(.+)/i
  ];

  // Analizar primeras 4000 caracteres (suele estar al inicio)
  const inicioTexto = texto.substring(0, 4000);

  for (const patron of patrones) {
    const match = inicioTexto.match(patron);
    if (match && match[1]) {
      let asunto = match[1].replace(/\s+/g, ' ').trim(); // Normalizar espacios
      if (asunto.length > 5 && asunto.length < 500) return asunto;
    }
  }

  // 2. Usar NLP para extraer tópicos como fallback
  const doc = nlp(inicioTexto.substring(0, 2000));
  const topics = doc.topics().out('array');
  if (topics.length > 0) {
    return topics[0];
  }

  // 3. Fallback: Primera línea sustancial
  const lineas = texto.split('\n');
  const primeraLinea = lineas.find(l => l.trim().length > 15 && l.trim().length < 150);
  if (primeraLinea) return primeraLinea.trim();

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
  detectarAsunto: detectingAsuntoNLP
};
const nlp = require('compromise');

// ═══════════════ DETECCIÓN DE ASUNTO (ÚNICA FUENTE DE VERDAD) ═══════════════

// Patrones regex para detectar marcadores de asunto en documentos peruanos/formales
const PATRONES_ASUNTO = [
  // ASUNTO, ALCANZA, REFERENCIA, SUMILLA, TEMA, SUBJECT - tolerando OCR con espacios
  /(?:A\s*S\s*U\s*N\s*T\s*O|A\s*L\s*C\s*A\s*N\s*Z\s*O|S\s*U\s*B\s*J\s*E\s*C\s*T|T\s*E\s*M\s*A|R\s*E\s*F(?:\s*E\s*R\s*E\s*N\s*C\s*I\s*A)?|S\s*U\s*M\s*I\s*L\s*L\s*A)\s*[:.-]\s*((?:.|\n\s+)+?)(?:\n\s*(?:DATE|FECHA|PARA|DE|FROM|TO)|$|\n{2,})/i,
  /(?:VISTOS?|SUMILLA)\s*[:.-]\s*(.+)/i
];

/**
 * Detecta el asunto de un documento usando regex + NLP
 * @param {string} texto - Texto del documento
 * @returns {string} - Asunto detectado
 */
function detectarAsunto(texto) {
  if (!texto) return '';

  const inicioTexto = texto.substring(0, 4000);

  // 1. Patrones explícitos (prioridad máxima)
  for (const patron of PATRONES_ASUNTO) {
    const match = inicioTexto.match(patron);
    if (match && match[1]) {
      const asunto = match[1].replace(/\s+/g, ' ').trim();
      if (asunto.length > 5 && asunto.length < 500) return asunto;
    }
  }

  // 2. NLP con compromise (fallback)
  try {
    const doc = nlp(inicioTexto.substring(0, 2000));
    const topics = doc.topics().out('array');
    if (topics.length > 0) return topics[0];
  } catch (_) {}

  // 3. Primera línea sustancial
  const lineas = texto.split('\n');
  const primeraLinea = lineas.find(l => l.trim().length > 15 && l.trim().length < 150);
  if (primeraLinea) return primeraLinea.trim();

  return 'Sin asunto detectado';
}

// ═══════════════ CLASIFICACIÓN DE TIPO DE DOCUMENTO ═══════════════

/**
 * Determina el tipo de documento basándose en el nombre del archivo
 * @param {string} nombre - Nombre del archivo
 * @returns {string} - Tipo de documento
 */
function determinarTipoDocumento(nombre) {
  nombre = nombre.toLowerCase();

  if (nombre.includes('carta') || nombre.startsWith('carta')) return 'carta';
  if (nombre.includes('informe')) return 'informe';
  if (nombre.includes('contrato')) return 'contrato';
  if (nombre.includes('memo') || nombre.includes('memorando')) return 'memorando';
  if (nombre.includes('acta')) return 'acta';
  if (nombre.includes('resolucion') || nombre.includes('resolución')) return 'resolución';

  return 'otro';
}

// ═══════════════ UTILIDADES DE TEXTO ═══════════════

/**
 * Limpia texto extraído de documentos
 * @param {string} texto - Texto a limpiar
 * @returns {string} - Texto limpio
 */
function limpiarTexto(texto) {
  if (!texto) return '';
  return texto
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

module.exports = {
  detectarAsunto,
  determinarTipoDocumento,
  limpiarTexto
};

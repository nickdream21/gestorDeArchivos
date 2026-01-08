const pdfParse = require('pdf-parse');
const nlp = require('compromise');
const fs = require('fs');

module.exports = {
  // Extraer texto de un archivo PDF
  extraerTextoPDF: async (rutaArchivo) => {
    try {
      // Leer el archivo
      const dataBuffer = fs.readFileSync(rutaArchivo);

      // Parsear el PDF
      const data = await pdfParse(dataBuffer);

      // Extraer información relevante
      return {
        texto: data.text,
        info: data.info,
        numeroPaginas: data.numpages,
        asunto: extraerAsuntoNLP(data.text)
      };
    } catch (error) {
      console.error(`Error al parsear PDF ${rutaArchivo}:`, error);
      return {
        texto: '',
        info: {},
        numeroPaginas: 0,
        asunto: ''
      };
    }
  }
};

// Función auxiliar para extraer el asunto del texto del PDF usando NLP
function extraerAsuntoNLP(texto) {
  if (!texto) return '';

  // 1. Patrones explícitos mejorados
  const patrones = [
    /(?:asunto|subject|tema|ref|referencia):\s*(.+)/i,
    /(?:VISTO|VISTOS):?\s*(.+)/i,
    /(?:SUMILLA):?\s*(.+)/i
  ];

  const lineas = texto.split('\n');

  // Buscar en las primeras 50 líneas para evitar falsos positivos al final
  for (let i = 0; i < Math.min(lineas.length, 50); i++) {
    const linea = lineas[i].trim();
    for (const patron of patrones) {
      const match = linea.match(patron);
      if (match && match[1]) {
        let asunto = match[1].trim();
        if (asunto.length > 5 && asunto.length < 300) return asunto;
      }
    }
  }

  // 2. Usar NLP para extraer tópicos
  const doc = nlp(texto.substring(0, 2000));
  const topics = doc.topics().out('array');

  if (topics.length > 0) {
    return topics[0];
  }

  // 3. Fallback: Primera linea de texto sustancial
  const primeraLinea = lineas.find(l => l.trim().length > 15 && l.trim().length < 150);
  if (primeraLinea) return primeraLinea.trim();

  return 'Sin asunto detectado';
}
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
// Función auxiliar para extraer el asunto del texto del PDF usando NLP
function extraerAsuntoNLP(texto) {
  if (!texto) return '';

  // 1. Patrones explícitos mejorados
  const patrones = [
    /(?:A\s*S\s*U\s*N\s*T\s*O|A\s*L\s*C\s*A\s*N\s*Z\s*O|S\s*U\s*B\s*J\s*E\s*C\s*T|T\s*E\s*M\s*A|R\s*E\s*F(?:\s*E\s*R\s*E\s*N\s*C\s*I\s*A)?|S\s*U\s*M\s*I\s*L\s*L\s*A)\s*[:.-]\s*((?:.|\n\s+)+?)(?:\n\s*(?:DATE|FECHA|PARA|DE|FROM|TO)|$|\n{2,})/i,
    /(?:VISTOS?|SUMILLA)\s*[:.-]\s*(.+)/i
  ];

  // Analizar primeras 4000 caracteres
  const inicioTexto = texto.substring(0, 4000);

  for (const patron of patrones) {
    const match = inicioTexto.match(patron);
    if (match && match[1]) {
      let asunto = match[1].replace(/\s+/g, ' ').trim();
      if (asunto.length > 5 && asunto.length < 500) return asunto;
    }
  }

  // 2. Usar NLP para extraer tópicos
  const doc = nlp(inicioTexto.substring(0, 2000));
  const topics = doc.topics().out('array');

  if (topics.length > 0) {
    return topics[0];
  }

  // 3. Fallback: Primera linea de texto sustancial
  const lineas = texto.split('\n');
  const primeraLinea = lineas.find(l => l.trim().length > 15 && l.trim().length < 150);
  if (primeraLinea) return primeraLinea.trim();

  return 'Sin asunto detectado';
}
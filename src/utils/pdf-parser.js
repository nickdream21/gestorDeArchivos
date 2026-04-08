const pdfParse = require('pdf-parse');
const { detectarAsunto } = require('./doc-utils');
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
        asunto: detectarAsunto(data.text)
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
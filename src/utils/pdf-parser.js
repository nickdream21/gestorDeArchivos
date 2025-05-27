const pdfParse = require('pdf-parse');
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
        asunto: extraerAsunto(data.text)
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

// Función auxiliar para extraer el asunto del texto del PDF
function extraerAsunto(texto) {
  // Esta es una implementación simple, puedes mejorarla según tus necesidades
  // Busca líneas que contengan "Asunto:" o "ASUNTO:"
  const lineas = texto.split('\n');
  
  for (const linea of lineas) {
    const lineaLimpia = linea.trim();
    
    if (lineaLimpia.toLowerCase().startsWith('asunto:')) {
      return lineaLimpia.substring(7).trim();
    }
  }
  
  // Si no encuentra un asunto explícito, usa las primeras palabras del texto
  const palabras = texto.trim().split(/\s+/);
  return palabras.slice(0, 5).join(' ') + '...'; // Primeras 5 palabras
}
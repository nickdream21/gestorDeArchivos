const XLSX = require('xlsx');
const nlp = require('compromise');
const path = require('path');

/**
 * Extrae texto de archivos Excel (.xlsx y .xls)
 * @param {string} rutaArchivo - Ruta al archivo Excel
 * @returns {Promise<Object>} - Objeto con texto extraído y metadatos
 */
async function extraerTextoExcel(rutaArchivo) {
    try {
        console.log(`Procesando archivo Excel: ${rutaArchivo}`);

        // Leer el archivo
        const workbook = XLSX.readFile(rutaArchivo);
        let textoCompleto = '';
        const metadatos = {
            hojas: [],
            tipo: path.extname(rutaArchivo).substring(1)
        };

        // Iterar sobre todas las hojas
        workbook.SheetNames.forEach(nombreHoja => {
            const hoja = workbook.Sheets[nombreHoja];
            // Convertir la hoja a texto (CSV es una buena aproximación para texto plano)
            const textoHoja = XLSX.utils.sheet_to_csv(hoja, { FS: ' ', RS: '\n' });

            if (textoHoja.trim()) {
                textoCompleto += `--- HOJA: ${nombreHoja} ---\n${textoHoja}\n\n`;
                metadatos.hojas.push(nombreHoja);
            }
        });

        // Detectar asunto usando NLP
        const asuntoDetectado = detectarAsunto(textoCompleto);

        console.log(`Archivo Excel procesado: ${rutaArchivo}`);
        return {
            texto: textoCompleto,
            asunto: asuntoDetectado,
            metadatos: metadatos,
            error: null
        };

    } catch (error) {
        console.error(`Error al procesar Excel ${rutaArchivo}:`, error);
        return {
            texto: '',
            asunto: '',
            metadatos: {},
            error: error.message
        };
    }
}

/**
 * Detecta el asunto usando NLP (compromise) y heurísticas
 */
function detectarAsunto(texto) {
    if (!texto) return '';

    // 1. Intentar buscar patrones explícitos de "Asunto:"
    const patronAsunto = /(?:asunto|subject|tema|ref|referencia):\s*(.+)/i;
    const match = texto.match(patronAsunto);
    if (match && match[1]) {
        return match[1].trim();
    }

    // 2. Usar NLP para extraer el primer "Topic" o frase nominal relevante
    const doc = nlp(texto.substring(0, 1000)); // Analizar solo el inicio para eficiencia

    // Buscar frases nominales que no sean fechas ni números
    const topics = doc.topics().out('array');
    if (topics.length > 0) {
        return topics[0]; // Retorna el primer tópico principal encontrado
    }

    // 3. Fallback: Primera línea sustancial
    const primeraLinea = texto.split('\n').find(line => line.trim().length > 10);
    if (primeraLinea) {
        return primeraLinea.substring(0, 100).trim();
    }

    return 'Sin asunto detectado';
}

module.exports = {
    extraerTextoExcel
};

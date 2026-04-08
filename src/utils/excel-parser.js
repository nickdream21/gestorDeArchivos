const XLSX = require('xlsx');
const { detectarAsunto } = require('./doc-utils');
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
            const textoHoja = XLSX.utils.sheet_to_csv(hoja, { FS: ' ', RS: '\n' });

            if (textoHoja.trim()) {
                textoCompleto += `--- HOJA: ${nombreHoja} ---\n${textoHoja}\n\n`;
                metadatos.hojas.push(nombreHoja);
            }
        });

        // Detectar asunto usando módulo centralizado
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

module.exports = {
    extraerTextoExcel
};

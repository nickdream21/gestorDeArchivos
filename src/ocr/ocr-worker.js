const { ipcRenderer } = require('electron');
const pdfjsLib = require('pdfjs-dist/build/pdf');
const Tesseract = require('tesseract.js');
const fs = require('fs');

// Configuración del worker de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/build/pdf.worker.entry');

console.log('OCR Worker inicializado');

ipcRenderer.on('start-ocr', async (event, data) => {
    const { filePath, fileType, jobId } = data;
    console.log(`Iniciando OCR para job ${jobId}: ${filePath}`);

    try {
        let text = '';

        if (fileType === 'pdf') {
            text = await processPdf(filePath);
        } else if (['jpg', 'jpeg', 'png'].includes(fileType)) {
            text = await processImage(filePath);
        }

        console.log(`OCR completado para job ${jobId}. Longitud: ${text.length}`);
        ipcRenderer.send('ocr-result', { jobId, success: true, text });

    } catch (error) {
        console.error(`Error en OCR para job ${jobId}:`, error);
        ipcRenderer.send('ocr-result', { jobId, success: false, error: error.message });
    }
});

async function processImage(filePath) {
    // Para imágenes, pasamos el buffer o path directamente a Tesseract
    // Tesseract.js acepta paths y buffers en node, o Image elements en browser.
    // Al estar en Electron renderer con nodeIntegration, podemos leer el fichero.
    const buffer = fs.readFileSync(filePath);
    const result = await Tesseract.recognize(buffer, 'eng+spa'); // Inglés y Español
    return result.data.text;
}

async function processPdf(filePath) {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfjsLib.getDocument(data);
    const pdf = await loadingTask.promise;

    let fullText = '';
    const maxPages = Math.min(pdf.numPages, 3); // LIMITADO A 3 PAGINAS

    console.log(`PDF cargado. Páginas: ${pdf.numPages}. Procesando primeras ${maxPages}...`);

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const page = await pdf.getPage(pageNum);

        const viewport = page.getViewport({ scale: 1.2 }); // ESCALA OPTIMIZADA (1.2)
        const canvas = document.createElement('canvas'); // Crear canvas en memoria
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        // Convertir canvas a imagen (data URL)
        const dataUrl = canvas.toDataURL('image/png');

        // OCR de la página
        console.log(`Procesando página ${pageNum}...`);
        const result = await Tesseract.recognize(dataUrl, 'eng+spa');
        fullText += `--- PÁGINA ${pageNum} (OCR) ---\n${result.data.text}\n\n`;
    }

    return fullText;
}

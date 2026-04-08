const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');

// ═══════════════ SERVICIO OCR PERSISTENTE ═══════════════
// Worker de tesseract.js que se carga UNA VEZ y se reutiliza para todas las operaciones OCR.
// Elimina la dependencia de Python/EasyOCR.

let worker = null;
let mupdf = null;
let workerReady = false;
let initPromise = null;

// Máximo de páginas a procesar por PDF (balance velocidad/cobertura)
const MAX_PAGES_PDF = 3;
// Factor de zoom para renderizar PDF (2x = 144 DPI, buen balance)
const PDF_ZOOM = 2;

/**
 * Inicializa el worker de tesseract.js (llamar una vez al inicio de la app)
 */
async function inicializar() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('Inicializando worker OCR (tesseract.js)...');

      worker = await createWorker('spa+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            // Log progress only during recognition
          }
        }
      });

      console.log('Worker OCR inicializado correctamente (español + inglés)');
      workerReady = true;

      // Cargar mupdf para renderizar PDFs
      mupdf = await import('mupdf');
      console.log('MuPDF WASM cargado para renderizado de PDFs');

    } catch (err) {
      console.error('Error al inicializar worker OCR:', err);
      workerReady = false;
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Convierte páginas de PDF a buffers PNG usando MuPDF WASM
 * @param {string} pdfPath - Ruta al archivo PDF
 * @returns {Promise<Buffer[]>} - Array de buffers PNG (uno por página)
 */
async function pdfToImages(pdfPath) {
  if (!mupdf) throw new Error('MuPDF no inicializado');

  const fileData = fs.readFileSync(pdfPath);
  const doc = mupdf.Document.openDocument(fileData, 'application/pdf');
  const pageCount = doc.countPages();
  const maxPages = Math.min(pageCount, MAX_PAGES_PDF);
  const images = [];

  for (let i = 0; i < maxPages; i++) {
    const page = doc.loadPage(i);
    const pixmap = page.toPixmap(
      mupdf.Matrix.scale(PDF_ZOOM, PDF_ZOOM),
      mupdf.ColorSpace.DeviceRGB,
      false, // no alpha
      true   // annots
    );
    const pngBuffer = pixmap.asPNG();
    images.push(Buffer.from(pngBuffer));
    pixmap.destroy();
  }

  return images;
}

/**
 * Ejecuta OCR sobre un buffer de imagen
 * @param {Buffer} imageBuffer - Buffer de imagen (PNG, JPG, etc.)
 * @returns {Promise<string>} - Texto reconocido
 */
async function reconocerTexto(imageBuffer) {
  if (!workerReady || !worker) {
    await inicializar();
  }

  const { data } = await worker.recognize(imageBuffer);
  return data.text || '';
}

/**
 * Procesa un archivo con OCR (imágenes o PDFs escaneados)
 * @param {string} filePath - Ruta al archivo
 * @returns {Promise<{text: string, subject: null}>} - Texto extraído
 */
async function processarOCR(filePath) {
  if (!workerReady) {
    await inicializar();
  }

  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.pdf') {
      return await procesarPDFOCR(filePath);
    } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      return await procesarImagenOCR(filePath);
    } else {
      return { text: '', subject: null };
    }
  } catch (err) {
    console.error(`Error OCR para ${filePath}:`, err.message);
    return { text: '', subject: null };
  }
}

/**
 * OCR para PDFs escaneados: renderiza páginas + reconoce texto
 */
async function procesarPDFOCR(pdfPath) {
  console.log(`OCR PDF (tesseract.js + mupdf): ${path.basename(pdfPath)}`);
  const startTime = Date.now();

  const images = await pdfToImages(pdfPath);
  let fullText = '';

  for (let i = 0; i < images.length; i++) {
    const pageText = await reconocerTexto(images[i]);
    fullText += `\n--- Página ${i + 1} ---\n${pageText}\n`;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`OCR PDF completado en ${elapsed}s. ${images.length} páginas, ${fullText.length} caracteres`);

  return { text: fullText, subject: null };
}

/**
 * OCR para imágenes directas
 */
async function procesarImagenOCR(imgPath) {
  console.log(`OCR Imagen (tesseract.js): ${path.basename(imgPath)}`);
  const startTime = Date.now();

  const imageBuffer = fs.readFileSync(imgPath);
  const text = await reconocerTexto(imageBuffer);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`OCR Imagen completado en ${elapsed}s. ${text.length} caracteres`);

  return { text, subject: null };
}

/**
 * Terminar el worker OCR (llamar al cerrar la app)
 */
async function terminar() {
  try {
    if (worker) {
      await worker.terminate();
      worker = null;
      workerReady = false;
      console.log('Worker OCR terminado');
    }
  } catch (err) {
    console.error('Error al terminar worker OCR:', err);
  }
}

module.exports = {
  inicializar,
  processarOCR,
  reconocerTexto,
  terminar
};

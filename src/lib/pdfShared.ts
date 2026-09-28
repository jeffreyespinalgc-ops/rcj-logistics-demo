import type { jsPDF } from 'jspdf';
import logoUrl from '@/assets/images/RCJ-Logistics-Full-Color.png';

export interface PdfLogo {
  dataUrl: string;
  /** alto / ancho */
  ratio: number;
}

export interface BuiltPdf {
  doc: jsPDF;
  filename: string;
}

export const NAVY: [number, number, number] = [16, 32, 95];
export const INK: [number, number, number] = [30, 30, 30];

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
export const formatDateTime = (iso: string) => `${formatDate(iso)} ${formatTime(iso)}`;

/** Logo reducido: el original pesa mucho mas de lo que necesita un encabezado de 30-40 mm */
export async function loadPdfLogo(): Promise<PdfLogo | null> {
  try {
    const img = new Image();
    img.src = logoUrl;
    await img.decode();
    const width = 500;
    const height = Math.round((width * img.naturalHeight) / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
    return { dataUrl: canvas.toDataURL('image/png'), ratio: height / width };
  } catch {
    return null;
  }
}

/**
 * Cada hoja del PDF como imagen, para la vista previa. Se dibuja con pdf.js en lugar de incrustar el PDF
 * porque los navegadores de telefono (y los de empresa con el visor desactivado) no lo muestran.
 */
export async function renderPdfPages(doc: jsPDF, targetWidth = 1400): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;

  // pdf.js toma posesion del buffer, por eso se le pasa una copia
  const task = pdfjs.getDocument({ data: new Uint8Array(doc.output('arraybuffer')) });
  const pages: string[] = [];
  try {
    const pdf = await task.promise;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: targetWidth / page.getViewport({ scale: 1 }).width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      pages.push(canvas.toDataURL('image/png'));
    }
  } finally {
    await task.destroy();
  }
  return pages;
}

import type { jsPDF } from 'jspdf';
import type { OTLine, WorkOrder } from '@/types';
import { isRequisitionComplete, signatureFor, signaturesOf } from '@/lib/requisition';
import logoUrl from '@/assets/images/RCJ-Logistics-Full-Color.png';

export interface RequisitionPdfData {
  code: string;
  date: string;
  department: string;
  items: { qty: number; description: string; code: string; unit: string; notes: string }[];
  requestedBy: string;
  deliveredTo: string;
  /** En el orden en que aparecen al pie del formato */
  signers: { label: string; name: string; at: string }[];
}

export interface PdfLogo {
  dataUrl: string;
  /** alto / ancho */
  ratio: number;
}

const ROWS_PER_PAGE = 10;
const NAVY: [number, number, number] = [16, 32, 95];
const INK: [number, number, number] = [30, 30, 30];

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatDateTime = (iso: string) => `${formatDate(iso)} ${new Date(iso).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })}`;

/** Datos del formato a partir de la linea; null mientras la requisa no tenga las tres firmas */
export function buildRequisitionPdfData(ot: WorkOrder, line: OTLine): RequisitionPdfData | null {
  if (!line.requisition || !isRequisitionComplete(line)) return null;

  const signatures = signaturesOf(line);
  const requester = signatureFor(line, 'solicitante');
  const signer = (step: 'autoriza' | 'despacha' | 'solicitante', label: string) => {
    const s = signatureFor(line, step);
    return { label, name: s?.name ?? '', at: s ? formatDateTime(s.at) : '' };
  };

  return {
    code: line.requisition.code,
    date: formatDate(line.requisition.releasedAt ?? signatures[signatures.length - 1].at),
    department: 'Taller',
    items: line.parts.map(p => ({
      qty: p.quantity,
      description: p.partDescription,
      code: p.partCode,
      unit: 'UND',
      notes: `${ot.code} - ${ot.assetCode}`,
    })),
    requestedBy: requester?.name ?? '',
    deliveredTo: line.technician || requester?.name || '',
    signers: [
      signer('autoriza', 'Jefe de Taller'),
      signer('despacha', 'Control de Inventario'),
      signer('solicitante', 'Técnico'),
    ],
  };
}

/** Logo reducido: el original pesa mucho mas de lo que necesita un encabezado de 40 mm */
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

/** Dibuja el formato "Requisicion de materiales" (hoja carta horizontal), una hoja por cada 10 repuestos */
export function drawRequisition(doc: jsPDF, data: RequisitionPdfData, logo: PdfLogo | null): void {
  const pages = Math.max(1, Math.ceil(data.items.length / ROWS_PER_PAGE));
  for (let page = 0; page < pages; page++) {
    if (page > 0) doc.addPage();
    drawPage(doc, data, data.items.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE), logo, page + 1, pages);
  }
}

function drawPage(
  doc: jsPDF,
  data: RequisitionPdfData,
  items: RequisitionPdfData['items'],
  logo: PdfLogo | null,
  page: number,
  pages: number
) {
  const X = 12.7;
  const Y = 12.7;
  const W = 254;
  const headerH = 30;
  const fieldsH = 11;
  const tableHeadH = 9;
  const rowH = 8.5;
  const signedH = 13;
  const signaturesH = 28;
  const tableTop = Y + headerH + fieldsH;
  const rowsTop = tableTop + tableHeadH;
  const rowsBottom = rowsTop + rowH * ROWS_PER_PAGE;
  const signedTop = rowsBottom;
  const signaturesTop = signedTop + signedH;
  const bottom = signaturesTop + signaturesH;
  const cols = [22, 96, 45, 28, 63];

  doc.setDrawColor(...NAVY);
  doc.setTextColor(...INK);

  // encabezado: logo a la izquierda, titulo a la derecha
  doc.setLineWidth(0.3);
  doc.line(X + 72, Y, X + 72, Y + headerH);
  doc.line(X, Y + headerH, X + W, Y + headerH);
  if (logo) {
    const logoH = 24;
    const logoW = logoH / logo.ratio;
    doc.addImage(logo.dataUrl, 'PNG', X + (72 - logoW) / 2, Y + (headerH - logoH) / 2, logoW, logoH);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...NAVY);
  doc.text('REQUISICIÓN DE MATERIALES', X + 72 + (W - 72) / 2, Y + headerH / 2 + 2.5, { align: 'center' });
  doc.setTextColor(...INK);

  // No. requisicion, fecha y departamento
  const fields: [string, string][] = [
    ['No. Requisición:', pages > 1 ? `${data.code}  (${page}/${pages})` : data.code],
    ['Fecha:', data.date],
    ['Departamento:', data.department],
  ];
  const fieldW = W / 3;
  fields.forEach(([label, value], i) => {
    const fx = X + i * fieldW + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label, fx, Y + headerH + 7.5);
    const lineStart = fx + doc.getTextWidth(label) + 2;
    doc.setLineWidth(0.2);
    doc.line(lineStart, Y + headerH + 8.5, X + (i + 1) * fieldW - 4, Y + headerH + 8.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(value, lineStart + 2, Y + headerH + 7.3);
  });

  // encabezado de la tabla
  doc.setFillColor(...NAVY);
  doc.rect(X, tableTop, W, tableHeadH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const titles = ['CANT.', 'DESCRIPCIÓN', 'CÓDIGO', 'UNIDAD', 'OBSERVACIONES'];
  let cx = X;
  titles.forEach((title, i) => {
    doc.text(title, cx + cols[i] / 2, tableTop + tableHeadH / 2 + 1.3, { align: 'center' });
    cx += cols[i];
  });
  doc.setTextColor(...INK);

  // filas: siempre 10, con los repuestos al inicio y el resto en blanco
  doc.setLineWidth(0.2);
  for (let r = 0; r < ROWS_PER_PAGE; r++) {
    const ry = rowsTop + r * rowH;
    doc.line(X, ry + rowH, X + W, ry + rowH);
    const item = items[r];
    if (!item) continue;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const cells: [string, number, 'center' | 'left'][] = [
      [String(item.qty), 0, 'center'],
      [item.description, 1, 'left'],
      [item.code, 2, 'center'],
      [item.unit, 3, 'center'],
      [item.notes, 4, 'left'],
    ];
    let cellX = X;
    cells.forEach(([text, i, align]) => {
      const lines = (doc.splitTextToSize(text, cols[i] - 4) as string[]).slice(0, 2);
      const textY = ry + rowH / 2 + (lines.length > 1 ? -0.4 : 1.1);
      doc.text(lines, align === 'center' ? cellX + cols[i] / 2 : cellX + 2, textY, { align, lineHeightFactor: 1.15 });
      cellX += cols[i];
    });
  }
  let vx = X;
  cols.slice(0, -1).forEach(w => {
    vx += w;
    doc.line(vx, tableTop + tableHeadH, vx, rowsBottom);
  });

  // solicitado por / entregado a
  const pairs: [string, string, number][] = [
    ['Solicitado por:', data.requestedBy, X + 24],
    ['Entregado a:', data.deliveredTo, X + W * 0.62],
  ];
  pairs.forEach(([label, value, px]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(label, px, signedTop + 8.5);
    const lineStart = px + doc.getTextWidth(label) + 2;
    const lineEnd = label === 'Solicitado por:' ? X + W * 0.55 : X + W - 8;
    doc.line(lineStart, signedTop + 9.5, lineEnd, signedTop + 9.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(value, lineStart + 2, signedTop + 8.3);
  });

  // firmas: linea gruesa y, debajo, quien firmo con fecha y el cargo
  doc.setLineWidth(0.8);
  doc.line(X, signaturesTop, X + W, signaturesTop);
  doc.setLineWidth(0.2);
  const sigW = W / 3;
  data.signers.forEach((s, i) => {
    const sx = X + i * sigW;
    const center = sx + sigW / 2;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.text(s.name, center, signaturesTop + 11, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text(s.at, center, signaturesTop + 15, { align: 'center' });
    doc.setTextColor(...INK);
    doc.line(sx + 14, signaturesTop + 16.5, sx + sigW - 14, signaturesTop + 16.5);
    doc.setFontSize(9.5);
    doc.text(s.label, center, signaturesTop + 21.5, { align: 'center' });
  });

  // marco exterior
  doc.setLineWidth(0.5);
  doc.rect(X, Y, W, bottom - Y);
}

/** Genera y descarga el PDF de la requisa firmada por las tres partes */
export async function downloadRequisitionPdf(ot: WorkOrder, line: OTLine): Promise<void> {
  const data = buildRequisitionPdfData(ot, line);
  if (!data) return;
  // jsPDF se carga solo al exportar para no engordar la carga inicial de la app
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  drawRequisition(doc, data, await loadPdfLogo());
  doc.save(`Requisicion-${data.code}.pdf`);
}

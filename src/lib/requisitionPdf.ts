import type { jsPDF } from 'jspdf';
import type { OTLine, RequisitionStep, WorkOrder } from '@/types';
import { deliveredQuantity, isPartial, requisitionStatus, signatureFor } from '@/lib/requisition';
import { drawSignatureImage, formatDate, formatDateTime, loadPdfLogo, INK, NAVY, type BuiltPdf, type PdfLogo } from '@/lib/pdfShared';

export interface RequisitionSigner {
  /** Nombre del campo del formato: "Solicitado por", "Recibido por", etc. */
  label: string;
  /** Cargo de quien firma */
  role: string;
  name: string;
  at: string;
  /** Firma guardada del usuario (PNG); vacia si aun no firma o si firmo antes de existir la firma guardada */
  signature: string | null;
}

export interface RequisitionPdfData {
  code: string;
  date: string;
  department: string;
  /** Estado de la requisa en este momento, para distinguir una vista previa incompleta de la requisa terminada */
  statusLabel: string;
  /** La cantidad va como "entregado / solicitado" una vez que Control de Inventario entrega */
  items: { qty: string; partial: boolean; description: string; code: string; unit: string; notes: string }[];
  /** En el orden en que aparecen al pie del formato */
  signers: RequisitionSigner[];
}

const ROWS_PER_PAGE = 10;

const statusLabels = {
  sin_solicitar: 'SIN SOLICITAR',
  en_firma: 'EN FIRMA',
  completa: 'COMPLETA',
} as const;

/**
 * Datos del formato: una sola requisa (un solo documento) por OT. `line` da el contexto de firmas (cada linea
 * firma su propio Solicitante->Jefe->Control->Receptor), pero los repuestos que se listan son los de TODAS las
 * lineas de la OT que comparten el mismo codigo de requisa, para que el documento se vea completo sin importar
 * desde que linea se abrio.
 */
export function buildRequisitionPdfData(ot: WorkOrder, line: OTLine): RequisitionPdfData {
  const requester = signatureFor(line, 'solicitante');
  const fromStep = (step: RequisitionStep, label: string, role: string): RequisitionSigner => {
    const s = signatureFor(line, step);
    return { label, role, name: s?.name ?? '', at: s ? formatDateTime(s.at) : '', signature: s?.signature ?? null };
  };
  // "Entregado a" no lleva firma propia: es el tecnico a quien Control le entrego, registrado en el paso de Control
  const dispatch = signatureFor(line, 'despacha');
  const code = line.requisition?.code ?? null;
  const sharedLines = code ? ot.lines.filter(l => l.requisition?.code === code) : [line];

  return {
    code: code ?? 'Sin solicitar',
    date: formatDate(requester?.at ?? line.createdAt),
    department: 'Taller',
    statusLabel: statusLabels[requisitionStatus(line)],
    items: sharedLines.flatMap(l => l.parts.map(p => ({
      // siempre entregado/solicitado (no solo cuando ya se entrego): asi queda registrado incluso si al
      // pedirlo solo habia menos stock del solicitado (ej. "0 / 3" antes de que Control entregue)
      qty: `${deliveredQuantity(l, p)} / ${p.quantity}`,
      partial: isPartial(l, p),
      description: p.partDescription,
      code: p.partCode,
      unit: p.unit,
      // que linea de trabajo pidio este repuesto (la OT ya es una sola para todo el documento)
      notes: l.work,
    }))),
    signers: [
      fromStep('solicitante', 'Solicitado por', ''),
      fromStep('recibe', 'Recibido por', ''),
      fromStep('autoriza', 'Autorizado por', ''),
      fromStep('despacha', 'Aprobado por', ''),
      {
        label: 'Entregado a',
        role: '',
        name: '',
        at: '',
        signature: null,
      },
    ],
  };
}

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
  const signaturesH = 40;
  const tableTop = Y + headerH + fieldsH;
  const rowsTop = tableTop + tableHeadH;
  const rowsBottom = rowsTop + rowH * ROWS_PER_PAGE;
  const signaturesTop = rowsBottom;
  const bottom = signaturesTop + signaturesH;
  const cols = [22, 96, 45, 28, 63];

  doc.setDrawColor(...NAVY);
  doc.setTextColor(...INK);

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
  doc.text('REQUISICIÓN DE MATERIALES', X + 72 + (W - 72) / 2, Y + headerH / 2 + 0.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.setTextColor(...INK);

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

  doc.setLineWidth(0.2);
  for (let r = 0; r < ROWS_PER_PAGE; r++) {
    const ry = rowsTop + r * rowH;
    doc.line(X, ry + rowH, X + W, ry + rowH);
    const item = items[r];
    if (!item) continue;
    doc.setFontSize(8.5);
    const cells: [string, number, 'center' | 'left'][] = [
      [item.qty, 0, 'center'],
      [item.description, 1, 'left'],
      [item.code, 2, 'center'],
      [item.unit, 3, 'center'],
      [item.notes, 4, 'left'],
    ];
    let cellX = X;
    cells.forEach(([text, i, align]) => {
      doc.setFont('helvetica', i === 0 && item.partial ? 'bold' : 'normal');
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

  doc.setLineWidth(0.8);
  doc.line(X, signaturesTop, X + W, signaturesTop);
  doc.setLineWidth(0.2);
  const sigW = W / data.signers.length;
  data.signers.forEach((s, i) => {
    const sx = X + i * sigW;
    const center = sx + sigW / 2;
    drawSignatureImage(doc, s.signature, { x: sx + 6, y: signaturesTop + 3, w: sigW - 12, h: 15 });
    doc.line(sx + 6, signaturesTop + 19, sx + sigW - 6, signaturesTop + 19);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(s.label, center, signaturesTop + 24, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text((doc.splitTextToSize(s.name, sigW - 8) as string[])[0] ?? '', center, signaturesTop + 28.5, { align: 'center' });
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    // doc.text(s.role, center, signaturesTop + 32.5, { align: 'center' });
    // doc.text(s.at, center, signaturesTop + 36, { align: 'center' });
    doc.setTextColor(...INK);
  });

  doc.setLineWidth(0.5);
  doc.rect(X, Y, W, bottom - Y);
}

export async function buildRequisitionPdf(ot: WorkOrder, line: OTLine): Promise<BuiltPdf> {
  const data = buildRequisitionPdfData(ot, line);
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  drawRequisition(doc, data, await loadPdfLogo());
  return { doc, filename: `Requisicion-${data.code}.pdf` };
}

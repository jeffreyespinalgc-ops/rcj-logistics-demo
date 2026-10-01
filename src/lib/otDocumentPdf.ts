import type { jsPDF } from 'jspdf';
import type { AppUser, WorkOrder } from '@/types';
import { usedQuantity } from '@/lib/requisition';
import { drawSignatureImage, formatDate, formatTime, loadPdfLogo, INK, NAVY, type BuiltPdf, type PdfLogo } from '@/lib/pdfShared';

export interface OTDocumentRow {
  fecha: string;
  hora: string;
  actividad: string;
  repuesto: string;
  comentario: string;
}

export interface OTDocumentSigner {
  label: string;
  name: string;
  at: string;
  signature: string | null;
}

export interface OTDocumentData {
  code: string;
  createdAt: string;
  vehicle: string;
  rows: OTDocumentRow[];
  observations: string;
  /** Jefe de Taller, Control de Inventario, Tecnico (en ese orden); solo se llenan cuando las 3 etapas concluyeron */
  signers: OTDocumentSigner[];
}

const ROWS_PER_PAGE = 10;

export function buildOTPdfData(ot: WorkOrder, users: AppUser[]): OTDocumentData {
  // firma guardada del usuario (la que hereda en todo lo que firma), buscada por nombre
  const sigOf = (name: string | null | undefined) => users.find(u => u.name === name)?.signature ?? null;

  const rows: OTDocumentRow[] = ot.lines
    .filter((l): l is typeof l & { finishedAt: string } => Boolean(l.finishedAt))
    .sort((a, b) => a.finishedAt!.localeCompare(b.finishedAt!))
    .map(l => ({
      fecha: formatDate(l.finishedAt!),
      hora: formatTime(l.finishedAt!),
      actividad: (l.activities ?? []).map(a => a.name).join(', ') || l.work,
      repuesto: l.parts.filter(p => usedQuantity(l, p) > 0).map(p => `${p.partCode} x${usedQuantity(l, p)}`).join(', '),
      comentario: l.notes,
    }));

  const finalizedEntry = ot.history.find(h => h.status === 'finalizada');
  const closedEntry = ot.history.find(h => h.status === 'cerrada');
  const entryAt = (entry: { at: string } | undefined) => entry ? formatTime(entry.at) + ' ' + formatDate(entry.at) : '';
  // las 3 firmas solo se muestran (nombre y firma) cuando la OT ya esta completamente terminada: cerrada por
  // el Jefe de Taller Y firmada por Control de Inventario (pueden llegar en cualquier orden, ninguna bloquea
  // a la otra); mientras falte alguna, las 3 casillas quedan en blanco aunque alguna ya se hubiera firmado
  const allConcluded = ot.status === 'cerrada' && Boolean(ot.inventorySignedAt);
  const signerOrBlank = (label: string, name: string, at: string, signature: string | null): OTDocumentSigner =>
    allConcluded ? { label, name, at, signature } : { label, name: '', at: '', signature: null };

  return {
    code: ot.code,
    createdAt: formatDate(ot.createdAt),
    vehicle: `${ot.assetCode} - ${ot.assetName}`,
    rows,
    observations: ot.lines.map(l => l.notes.trim()).filter(Boolean).join(' / '),
    signers: [
      signerOrBlank('Jefe de Taller', closedEntry?.by ?? '', entryAt(closedEntry), closedEntry?.signature ?? sigOf(closedEntry?.by)),
      signerOrBlank('Control de Inventario', ot.inventorySignedBy ?? '', ot.inventorySignedAt ? formatTime(ot.inventorySignedAt) + ' ' + formatDate(ot.inventorySignedAt) : '', sigOf(ot.inventorySignedBy)),
      signerOrBlank('Tecnico', ot.signedBy ?? finalizedEntry?.by ?? '', entryAt(finalizedEntry), finalizedEntry?.signature ?? sigOf(ot.signedBy ?? finalizedEntry?.by)),
    ],
  };
}

export function drawOTDocument(doc: jsPDF, data: OTDocumentData, logo: PdfLogo | null): void {
  const pages = Math.max(1, Math.ceil(data.rows.length / ROWS_PER_PAGE));
  for (let page = 0; page < pages; page++) {
    if (page > 0) doc.addPage();
    drawPage(doc, data, data.rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE), logo);
  }
}

function drawPage(doc: jsPDF, data: OTDocumentData, rows: OTDocumentRow[], logo: PdfLogo | null) {
  const X = 12.7;
  const Y = 12.7;
  const W = 254;
  const headerH = 20;
  const fieldRowH = 9.5;
  const fieldsH = fieldRowH * 2;
  const tableHeadH = 8.5;
  const rowH = 7;
  const obsRowH = fieldRowH;
  const signaturesH = 34;
  const tableTop = Y + headerH + fieldsH;
  const rowsTop = tableTop + tableHeadH;
  const rowsBottom = rowsTop + rowH * ROWS_PER_PAGE;
  const obsTop = rowsBottom;
  const signaturesTop = obsTop + obsRowH;
  const bottom = signaturesTop + signaturesH;
  const cols = [22, 18, 90, 62, 62];
  const colTitles = ['FECHA', 'HORA', 'ACTIVIDAD', 'REPUESTO USADO', 'COMENTARIO'];

  doc.setDrawColor(...NAVY);
  doc.setTextColor(...INK);

  // encabezado: logo a la izquierda, titulo centrado en todo el ancho, sin caja divisoria
  doc.setLineWidth(0.3);
  doc.line(X, Y + headerH, X + W, Y + headerH);
  if (logo) {
    const logoH = 15;
    const logoW = logoH / logo.ratio;
    doc.addImage(logo.dataUrl, 'PNG', X, Y + (headerH - logoH) / 2, logoW, logoH);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text('ORDEN DE TRABAJO', X + W / 2, Y + headerH / 2 + 1.5, { align: 'center' });
  doc.setTextColor(...INK);

  const fieldRows: [string, string][][] = [
    [['No. OT:', data.code], ['Fecha Creación:', data.createdAt]],
    [['Vehículo:', data.vehicle]],
  ];
  fieldRows.forEach((fieldsInRow, r) => {
    const rowY = Y + headerH + r * fieldRowH;
    const fieldW = W / fieldsInRow.length;
    fieldsInRow.forEach(([label, value], i) => {
      const fx = X + i * fieldW + 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(label, fx, rowY + 6.8);
      const lineStart = fx + doc.getTextWidth(label) + 2;
      doc.setLineWidth(0.2);
      doc.line(lineStart, rowY + 7.7, X + (i + 1) * fieldW - 4, rowY + 7.7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const lines = doc.splitTextToSize(value, (X + (i + 1) * fieldW - 4) - (lineStart + 2)) as string[];
      doc.text(lines[0] ?? '', lineStart + 2, rowY + 6.6);
    });
  });

  doc.setFillColor(...NAVY);
  doc.rect(X, tableTop, W, tableHeadH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  let cx = X;
  colTitles.forEach((title, i) => {
    doc.text(title, cx + cols[i] / 2, tableTop + tableHeadH / 2 + 1.2, { align: 'center' });
    cx += cols[i];
  });
  doc.setTextColor(...INK);

  doc.setLineWidth(0.2);
  for (let r = 0; r < ROWS_PER_PAGE; r++) {
    const ry = rowsTop + r * rowH;
    doc.line(X, ry + rowH, X + W, ry + rowH);
    const row = rows[r];
    if (!row) continue;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const cells: [string, number][] = [
      [row.fecha, 0], [row.hora, 1], [row.actividad, 2], [row.repuesto, 3], [row.comentario, 4],
    ];
    cells.forEach(([text, i]) => {
      const cellX = X + cols.slice(0, i).reduce((a, b) => a + b, 0);
      const lines = (doc.splitTextToSize(text, cols[i] - 3) as string[]).slice(0, 2);
      const textY = ry + rowH / 2 + (lines.length > 1 ? -0.3 : 1);
      doc.text(lines, cellX + 1.5, textY, { lineHeightFactor: 1.1 });
    });
  }
  let vx = X;
  cols.slice(0, -1).forEach(w => {
    vx += w;
    doc.line(vx, tableTop + tableHeadH, vx, rowsBottom);
  });

  // Observaciones: mismo estilo de fila que los campos del encabezado (etiqueta + linea + valor)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Observaciones:', X + 4, obsTop + 6.8);
  const obsLineStart = X + 4 + doc.getTextWidth('Observaciones:') + 2;
  doc.setLineWidth(0.2);
  doc.line(obsLineStart, obsTop + 7.7, X + W - 4, obsTop + 7.7);
  if (data.observations) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(data.observations, (X + W - 4) - (obsLineStart + 2)) as string[];
    doc.text(lines[0] ?? '', obsLineStart + 2, obsTop + 6.6);
  }

  // firmas: Jefe de Taller | Control de Inventario | Tecnico, una sola fila -- solo se llenan cuando las
  // 3 etapas concluyeron (ver `allConcluded` en buildOTPdfData); antes de eso quedan solo las lineas en blanco
  doc.setLineWidth(0.8);
  doc.line(X, signaturesTop, X + W, signaturesTop);
  doc.setLineWidth(0.2);
  const sigColW = W / 3;
  data.signers.forEach((s, i) => {
    const sx = X + i * sigColW;
    const center = sx + sigColW / 2;
    const lineStart = sx + 10;
    const lineEnd = sx + sigColW - 10;
    drawSignatureImage(doc, s.signature, { x: lineStart, y: signaturesTop + 2, w: lineEnd - lineStart, h: 16 });
    doc.line(lineStart, signaturesTop + 20, lineEnd, signaturesTop + 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(s.label, center, signaturesTop + 26, { align: 'center' });
    if (s.name) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const lines = doc.splitTextToSize(s.name, sigColW - 14) as string[];
      doc.text(lines[0] ?? '', center, signaturesTop + 30.5, { align: 'center' });
    }
  });

  doc.setLineWidth(0.5);
  doc.rect(X, Y, W, bottom - Y);
}

export async function buildOTPdf(ot: WorkOrder, users: AppUser[]): Promise<BuiltPdf> {
  const data = buildOTPdfData(ot, users);
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  drawOTDocument(doc, data, await loadPdfLogo());
  return { doc, filename: `${data.code}.pdf` };
}

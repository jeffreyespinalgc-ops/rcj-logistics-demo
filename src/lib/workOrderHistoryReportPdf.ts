import type { jsPDF } from 'jspdf';
import type { WorkOrder } from '@/types';
import { formatDate, formatDateTime, loadPdfLogo, INK, NAVY, type BuiltPdf, type PdfLogo } from '@/lib/pdfShared';
import { otCreatedAt, otProgress, priorityLabels, statusLabels, priorityVariants, statusVariants } from '@/components/modules/ordenes/otMeta';
import { otResponsibles } from '@/lib/otTeam';

/** Mismos colores que las insignias (Badge) de la app, en RGB para dibujarlos en el PDF */
const VARIANT_RGB: Record<string, [number, number, number]> = {
  gray: [120, 113, 108],
  blue: [37, 99, 235],
  yellow: [180, 130, 6],
  orange: [217, 90, 10],
  green: [22, 128, 61],
  red: [200, 35, 35],
  purple: [126, 42, 196],
};

export interface WorkOrderHistoryReportRow {
  code: string;
  vehicle: string;
  description: string;
  priorityLabel: string;
  priorityColor: [number, number, number];
  statusLabel: string;
  statusColor: [number, number, number];
  pct: number;
  linesLabel: string;
  assignedTo: string;
  createdAt: string;
}

export function buildWorkOrderHistoryReportRows(orders: WorkOrder[]): WorkOrderHistoryReportRow[] {
  return [...orders]
    .sort((a, b) => otCreatedAt(b).localeCompare(otCreatedAt(a)))
    .map(ot => {
      const progress = otProgress(ot);
      return {
        code: ot.code,
        vehicle: `${ot.assetCode} - ${ot.assetName}`,
        description: ot.description,
        priorityLabel: priorityLabels[ot.priority],
        priorityColor: VARIANT_RGB[priorityVariants[ot.priority]],
        statusLabel: statusLabels[ot.status],
        statusColor: VARIANT_RGB[statusVariants[ot.status]],
        pct: progress.pct,
        linesLabel: `${progress.done}/${progress.total}`,
        assignedTo: otResponsibles(ot) ?? 'Sin asignar',
        createdAt: formatDateTime(otCreatedAt(ot)),
      };
    });
}

const ROWS_PER_PAGE = 18;
const cols = [20, 34, 50, 18, 24, 28, 14, 38, 28];
const colTitles = ['CODIGO', 'VEHICULO', 'DESCRIPCION', 'PRIORIDAD', 'ESTADO', 'AVANCE', 'LINEAS', 'ASIGNADA A', 'CREACION'];

function drawPage(doc: jsPDF, rows: WorkOrderHistoryReportRow[], page: number, totalPages: number, logo: PdfLogo | null) {
  const X = 12.7;
  const Y = 12.7;
  const W = 254;
  const headerH = 20;
  const tableHeadH = 8.5;
  const rowH = 8;
  const tableTop = Y + headerH;
  const rowsTop = tableTop + tableHeadH;
  const rowsBottom = rowsTop + rowH * ROWS_PER_PAGE;

  doc.setDrawColor(...NAVY);
  doc.setTextColor(...INK);
  doc.setLineWidth(0.3);
  doc.line(X, Y + headerH, X + W, Y + headerH);
  if (logo) {
    const logoH = 14;
    const logoW = logoH / logo.ratio;
    doc.addImage(logo.dataUrl, 'PNG', X, Y + (headerH - logoH) / 2, logoW, logoH);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  doc.text('HISTORIAL DE ORDENES DE TRABAJO', X + W / 2, Y + headerH / 2 + 1.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(`${formatDate(new Date().toISOString())}`, X + W, Y + headerH / 2 - 2, { align: 'right' });
  doc.text(`${page + 1} de ${totalPages}`, X + W, Y + headerH / 2 + 4, { align: 'right' });

  // encabezado de la tabla
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
    doc.setTextColor(...INK);
    const textCell = (text: string, i: number, align: 'left' | 'center' = 'left') => {
      const cellX = X + cols.slice(0, i).reduce((a, b) => a + b, 0);
      const lines = (doc.splitTextToSize(text, cols[i] - 3) as string[]).slice(0, 2);
      const textY = ry + rowH / 2 + (lines.length > 1 ? -0.5 : 1);
      doc.text(lines, align === 'center' ? cellX + cols[i] / 2 : cellX + 1.5, textY, { align, lineHeightFactor: 1.1 });
    };
    textCell(row.code, 0);
    textCell(row.vehicle, 1);
    textCell(row.description, 2);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...row.priorityColor);
    textCell(row.priorityLabel, 3, 'center');
    doc.setTextColor(...row.statusColor);
    textCell(row.statusLabel, 4, 'center');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK);

    const barX = X + cols.slice(0, 5).reduce((a, b) => a + b, 0) + 2;
    const barW = cols[5] - 4;
    const barY = ry + rowH / 2 - 1.4;
    doc.setFillColor(228, 228, 224);
    doc.roundedRect(barX, barY, barW, 2.8, 1, 1, 'F');
    if (row.pct > 0) {
      doc.setFillColor(22, 128, 61);
      doc.roundedRect(barX, barY, Math.max(barW * (row.pct / 100), 2.8), 2.8, 1, 1, 'F');
    }
    doc.setFontSize(7);
    doc.text(`${row.pct}%`, barX + barW / 2, barY + 5.2, { align: 'center' });
    doc.setFontSize(7.5);

    textCell(row.linesLabel, 6, 'center');
    textCell(row.assignedTo, 7);
    textCell(row.createdAt, 8);
  }

  let vx = X;
  cols.slice(0, -1).forEach(w => {
    vx += w;
    doc.line(vx, tableTop, vx, rowsBottom);
  });

  if (rows.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(150, 145, 140);
    doc.text('No hay ordenes de trabajo que coincidan con estos filtros.', X + W / 2, rowsTop + rowH * 1.5, { align: 'center' });
    doc.setTextColor(...INK);
  }

  doc.setLineWidth(0.5);
  doc.rect(X, Y, W, rowsBottom - Y);
}

export function drawWorkOrderHistoryReport(doc: jsPDF, rows: WorkOrderHistoryReportRow[], logo: PdfLogo | null): void {
  const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  for (let page = 0; page < totalPages; page++) {
    if (page > 0) doc.addPage();
    drawPage(doc, rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE), page, totalPages, logo);
  }
}

export async function buildWorkOrderHistoryReportPdf(orders: WorkOrder[]): Promise<BuiltPdf> {
  const rows = buildWorkOrderHistoryReportRows(orders);
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  drawWorkOrderHistoryReport(doc, rows, await loadPdfLogo());
  return { doc, filename: `Historial-OT-${formatDate(new Date().toISOString())}.pdf` };
}


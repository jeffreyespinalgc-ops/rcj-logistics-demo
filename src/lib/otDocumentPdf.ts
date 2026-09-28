import type { jsPDF } from 'jspdf';
import type { WorkOrder } from '@/types';
import { statusLabels } from '@/components/modules/ordenes/otMeta';
import { formatDate, formatTime, loadPdfLogo, INK, NAVY, type BuiltPdf, type PdfLogo } from '@/lib/pdfShared';

export interface OTDocumentRow {
  fecha: string;
  hora: string;
  etapa: string;
  responsable: string;
  actividad: string;
  repuesto: string;
  comentario: string;
}

export interface OTDocumentData {
  code: string;
  createdAt: string;
  status: string;
  vehicle: string;
  maintenanceType: string;
  requestedBy: string;
  assignedTo: string;
  approvedBy: string;
  rows: OTDocumentRow[];
  observations: string;
  /** En el orden en que aparecen al pie del formato */
  signers: { label: string; name: string; at: string }[];
}

const ROWS_PER_PAGE = 10;

/**
 * Datos del documento. A diferencia de la requisa, este documento existe desde que se crea la OT:
 * al inicio solo trae el encabezado; al finalizar todas las lineas se completa la tabla de actividades,
 * y las firmas se agregan por separado (tecnico al finalizar, Jefe de Taller y Control de Inventario despues,
 * en cualquier orden entre ellos).
 */
export function buildOTPdfData(ot: WorkOrder): OTDocumentData {
  const maintenanceTypes = [...new Set(ot.lines.map(l => l.workPath[0]).filter(Boolean))];

  const historyRows = ot.history.map(h => ({
    at: h.at,
    etapa: statusLabels[h.status] ?? h.status,
    responsable: h.by,
    actividad: '',
    repuesto: '',
    comentario: '',
  }));
  const lineRows = ot.lines
    .filter((l): l is typeof l & { finishedAt: string } => Boolean(l.finishedAt))
    .map(l => ({
      at: l.finishedAt,
      etapa: 'Linea finalizada',
      responsable: l.technician || '--',
      actividad: (l.activities ?? []).map(a => a.name).join(', ') || l.work,
      repuesto: l.parts.map(p => `${p.partCode} x${p.quantity}`).join(', '),
      comentario: l.notes,
    }));

  const rows: OTDocumentRow[] = [...historyRows, ...lineRows]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map(({ at, ...rest }) => ({ fecha: formatDate(at), hora: formatTime(at), ...rest }));

  const finalizedEntry = ot.history.find(h => h.status === 'finalizada');
  const closedEntry = ot.history.find(h => h.status === 'cerrada');

  return {
    code: ot.code,
    createdAt: formatDate(ot.createdAt),
    status: statusLabels[ot.status] ?? ot.status,
    vehicle: `${ot.assetCode} - ${ot.assetName}`,
    maintenanceType: maintenanceTypes.join(', ') || '--',
    requestedBy: ot.createdBy,
    assignedTo: ot.assignedTo ?? '--',
    approvedBy: ot.approvedBy ?? '--',
    rows,
    observations: ot.lines.map(l => l.notes.trim()).filter(Boolean).join(' / '),
    // la firma de Control de Inventario no tiene espacio en este documento: al cerrar la OT solo cuentan
    // Jefe de Taller y Tecnico (Control de Inventario sigue firmando el documento internamente, pero eso
    // no se imprime aqui)
    signers: [
      { label: 'Jefe de Taller', name: closedEntry?.by ?? '', at: closedEntry ? formatTime(closedEntry.at) + ' ' + formatDate(closedEntry.at) : '' },
      { label: 'Técnico', name: ot.signedBy ?? '', at: finalizedEntry ? formatTime(finalizedEntry.at) + ' ' + formatDate(finalizedEntry.at) : '' },
    ],
  };
}

/** Dibuja "Orden de Trabajo - Registro de Actividades" (hoja carta horizontal), paginando la tabla de a 10 filas */
export function drawOTDocument(doc: jsPDF, data: OTDocumentData, logo: PdfLogo | null): void {
  const pages = Math.max(1, Math.ceil(data.rows.length / ROWS_PER_PAGE));
  for (let page = 0; page < pages; page++) {
    if (page > 0) doc.addPage();
    drawPage(doc, data, data.rows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE), logo, page + 1, pages);
  }
}

function drawPage(doc: jsPDF, data: OTDocumentData, rows: OTDocumentRow[], logo: PdfLogo | null, page: number, pages: number) {
  const X = 12.7;
  const Y = 12.7;
  const W = 254;
  const headerH = 24;
  const fieldRowH = 9.5;
  const fieldsH = fieldRowH * 3;
  const tableHeadH = 8.5;
  const rowH = 7;
  const obsLabelH = 5;
  const obsBoxH = 16;
  const signaturesH = 26;
  const tableTop = Y + headerH + fieldsH;
  const rowsTop = tableTop + tableHeadH;
  const rowsBottom = rowsTop + rowH * ROWS_PER_PAGE;
  const obsTop = rowsBottom;
  const signaturesTop = obsTop + obsLabelH + obsBoxH;
  const bottom = signaturesTop + signaturesH;
  const cols = [22, 18, 34, 38, 60, 45, 37];
  const colTitles = ['FECHA', 'HORA', 'ETAPA', 'RESPONSABLE', 'ACTIVIDAD', 'REPUESTO USADO', 'COMENTARIO'];

  doc.setDrawColor(...NAVY);
  doc.setTextColor(...INK);

  // encabezado: logo a la izquierda, titulo y subtitulo a la derecha
  doc.setLineWidth(0.3);
  doc.line(X + 60, Y, X + 60, Y + headerH);
  doc.line(X, Y + headerH, X + W, Y + headerH);
  if (logo) {
    const logoH = 18;
    const logoW = logoH / logo.ratio;
    doc.addImage(logo.dataUrl, 'PNG', X + (60 - logoW) / 2, Y + (headerH - logoH) / 2, logoW, logoH);
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text('ORDEN DE TRABAJO', X + 60 + (W - 60) / 2, Y + headerH / 2 - 1, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text('REGISTRO DE ACTIVIDADES' + (pages > 1 ? ` (hoja ${page}/${pages})` : ''), X + 60 + (W - 60) / 2, Y + headerH / 2 + 5, { align: 'center' });
  doc.setTextColor(...INK);

  // 3 filas de campos: (No. OT, Fecha Creacion, Estado) / (Vehiculo, Tipo Mantenimiento, Solicitado por) / (Asignado a, Aprobado por)
  const fieldRows: [string, string][][] = [
    [['No. OT:', data.code], ['Fecha Creación:', data.createdAt], ['Estado:', data.status]],
    [['Vehículo:', data.vehicle], ['Tipo Mantenimiento:', data.maintenanceType], ['Solicitado por:', data.requestedBy]],
    [['Asignado a:', data.assignedTo], ['Aprobado por:', data.approvedBy]],
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

  // filas: siempre 10, con las etapas/lineas al inicio y el resto en blanco
  doc.setLineWidth(0.2);
  for (let r = 0; r < ROWS_PER_PAGE; r++) {
    const ry = rowsTop + r * rowH;
    doc.line(X, ry + rowH, X + W, ry + rowH);
    const row = rows[r];
    if (!row) continue;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const cells: [string, number][] = [
      [row.fecha, 0], [row.hora, 1], [row.etapa, 2], [row.responsable, 3],
      [row.actividad, 4], [row.repuesto, 5], [row.comentario, 6],
    ];
    let cellX = X;
    cells.forEach(([text, i]) => {
      const lines = (doc.splitTextToSize(text, cols[i] - 3) as string[]).slice(0, 2);
      const textY = ry + rowH / 2 + (lines.length > 1 ? -0.3 : 1);
      doc.text(lines, cellX + 1.5, textY, { lineHeightFactor: 1.1 });
      cellX += cols[i];
    });
  }
  let vx = X;
  cols.slice(0, -1).forEach(w => {
    vx += w;
    doc.line(vx, tableTop + tableHeadH, vx, rowsBottom);
  });

  // observaciones
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Observaciones:', X + 2, obsTop + obsLabelH - 0.5);
  doc.setLineWidth(0.3);
  doc.rect(X, obsTop + obsLabelH, W, obsBoxH);
  if (data.observations) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const lines = (doc.splitTextToSize(data.observations, W - 6) as string[]).slice(0, 4);
    doc.text(lines, X + 3, obsTop + obsLabelH + 5, { lineHeightFactor: 1.2 });
  }

  // firmas: linea gruesa y, debajo, quien firmo con fecha y el cargo
  doc.setLineWidth(0.8);
  doc.line(X, signaturesTop, X + W, signaturesTop);
  doc.setLineWidth(0.2);
  const sigW = W / data.signers.length;
  data.signers.forEach((s, i) => {
    const sx = X + i * sigW;
    const center = sx + sigW / 2;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.text(s.name, center, signaturesTop + 10, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text(s.at, center, signaturesTop + 14, { align: 'center' });
    doc.setTextColor(...INK);
    doc.line(sx + 14, signaturesTop + 15.5, sx + sigW - 14, signaturesTop + 15.5);
    doc.setFontSize(9.5);
    doc.text(s.label, center, signaturesTop + 20.5, { align: 'center' });
  });

  // marco exterior
  doc.setLineWidth(0.5);
  doc.rect(X, Y, W, bottom - Y);
}

/** Arma el PDF de la OT. Siempre disponible, aunque el encabezado sea lo unico lleno todavia */
export async function buildOTPdf(ot: WorkOrder): Promise<BuiltPdf> {
  const data = buildOTPdfData(ot);
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  drawOTDocument(doc, data, await loadPdfLogo());
  // data.code ya trae el prefijo "OT-" (p.ej. "OT-2026-0001"); no repetirlo en el nombre del archivo
  return { doc, filename: `${data.code}.pdf` };
}

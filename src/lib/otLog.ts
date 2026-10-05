import type { AssetPhoto, OTLine, OTLogEntity, OTLogEntry, OTLinePhoto, RequisitionSignature, UserRole, WorkOrder } from '@/types';
import { findingStatusLabels, lineStatusLabels, priorityLabels, statusLabels } from '@/components/modules/ordenes/otMeta';
import { requisitionStepLabels, signaturesOf } from '@/lib/requisition';

/** Quien hizo el cambio: el usuario en sesion, o el sistema (SAP) */
export interface LogActor {
  by: string;
  role: UserRole | 'sistema';
}

export const entityLabels: Record<OTLogEntity, string> = {
  ot: 'OT',
  linea: 'Linea',
  repuesto: 'Repuesto',
  requisa: 'Requisa',
  evidencia: 'Evidencia',
  hallazgo: 'Hallazgo',
  sap: 'SAP',
};

export const actionLabels: Record<string, string> = {
  creada: 'Creada',
  editada: 'Editada',
  estado: 'Cambio de estado',
  asignada: 'Asignada',
  aprobacion_retroactiva: 'Aprobacion retroactiva',
  agregada: 'Agregada',
  eliminada: 'Eliminada',
  iniciada: 'Iniciada',
  completada: 'Completada',
  revisado: 'Revisado',
  firma: 'Firma',
  entrega: 'Entrega',
  enviada: 'Enviada',
  confirmada: 'Confirmada',
};

type Draft = Pick<OTLogEntry, 'entity' | 'action' | 'summary'> & Partial<Pick<OTLogEntry, 'lineId' | 'field' | 'oldValue' | 'newValue' | 'reason' | 'signatureStep'>>;

/** Responsable de la OT como texto (mismo criterio que la columna "Asignada a") */
const teamText = (ot: WorkOrder): string | null => {
  if (!ot.assignedTo) return null;
  if (ot.assignedToType === 'taller_externo') return ot.assignedTo;
  return ot.assignedTeam.length > 0 ? ot.assignedTeam.join(', ') : ot.assignedTo;
};

/**
 * Compara las OT antes y despues de un cambio y devuelve una fila por cada modificacion encontrada: estado, datos
 * de la OT, responsables, lineas (agregar, editar, quitar, iniciar, completar), repuestos (cantidades, entregas),
 * firmas de la requisa, hallazgos y evidencias. `who` es quien hizo el cambio; las firmas y el envio a SAP
 * llevan su propio actor.
 */
export function diffWorkOrders(prev: WorkOrder[], next: WorkOrder[], who: LogActor, newId: () => string, at: string): OTLogEntry[] {
  const out: OTLogEntry[] = [];
  const add = (ot: WorkOrder, actor: LogActor, d: Draft) => {
    out.push({
      lineId: null, field: null, oldValue: null, newValue: null, reason: null, signatureStep: null,
      ...d,
      id: newId(), otId: ot.id, otCode: ot.code, at, by: actor.by, role: actor.role,
    });
  };
  const sistema: LogActor = { by: 'SAP', role: 'sistema' };

  const addSignature = (ot: WorkOrder, line: OTLine, s: RequisitionSignature) => add(ot, { by: s.name, role: s.role }, {
    entity: 'requisa',
    action: s.step === 'despacha' ? 'entrega' : 'firma',
    lineId: line.id,
    signatureStep: s.step,
    summary: `${requisitionStepLabels[s.step]}: ${s.name}${s.step === 'despacha' && s.deliveredTo ? ` (entregado a ${s.deliveredTo})` : ''}`,
  });

  const addLine = (ot: WorkOrder, line: OTLine) => {
    add(ot, who, { entity: 'linea', action: 'agregada', lineId: line.id, summary: `Linea: ${line.work}` });
    line.parts.forEach(p => add(ot, who, { entity: 'repuesto', action: 'agregada', lineId: line.id, summary: `${p.partDescription} x${p.quantity} ${p.unit}` }));
    if (line.startedAt) add(ot, who, { entity: 'linea', action: 'iniciada', lineId: line.id, summary: `Linea: ${line.work}` });
    signaturesOf(line).forEach(s => addSignature(ot, line, s));
  };

  const diffPhotos = (ot: WorkOrder, lineId: string | null, before: (AssetPhoto | OTLinePhoto)[], after: (AssetPhoto | OTLinePhoto)[]) => {
    after.filter(p => !before.some(b => b.id === p.id))
      .forEach(p => add(ot, who, { entity: 'evidencia', action: 'agregada', lineId, summary: `Foto: ${p.name}` }));
    before.filter(b => !after.some(a => a.id === b.id))
      .forEach(p => add(ot, who, { entity: 'evidencia', action: 'eliminada', lineId, summary: `Foto: ${p.name}` }));
  };

  const diffParts = (ot: WorkOrder, before: OTLine, line: OTLine) => {
    for (const p of line.parts) {
      const old = before.parts.find(x => x.partId === p.partId);
      if (!old) {
        add(ot, who, { entity: 'repuesto', action: 'agregada', lineId: line.id, summary: `${p.partDescription} x${p.quantity} ${p.unit}` });
        continue;
      }
      if (old.quantity !== p.quantity) {
        add(ot, who, { entity: 'repuesto', action: 'editada', lineId: line.id, field: 'cantidad', oldValue: String(old.quantity), newValue: String(p.quantity), summary: `${p.partDescription}: cantidad ${old.quantity} → ${p.quantity}` });
      }
      if ((old.notes ?? '') !== (p.notes ?? '')) {
        add(ot, who, { entity: 'repuesto', action: 'editada', lineId: line.id, field: 'observaciones', oldValue: old.notes ?? '', newValue: p.notes ?? '', summary: `${p.partDescription}: observaciones editadas` });
      }
      if ((old.deliveredQuantity ?? null) !== (p.deliveredQuantity ?? null)) {
        add(ot, who, { entity: 'requisa', action: 'entrega', lineId: line.id, field: 'entregado', oldValue: String(old.deliveredQuantity ?? 0), newValue: String(p.deliveredQuantity ?? 0), summary: `${p.partDescription}: entregado ${p.deliveredQuantity ?? 0} de ${p.quantity}` });
      }
    }
    for (const old of before.parts) {
      if (!line.parts.some(p => p.partId === old.partId)) {
        add(ot, who, { entity: 'repuesto', action: 'eliminada', lineId: line.id, summary: `${old.partDescription} x${old.quantity} ${old.unit}` });
      }
    }
  };

  const diffLines = (before: WorkOrder, ot: WorkOrder) => {
    for (const line of ot.lines) {
      const old = before.lines.find(l => l.id === line.id);
      if (!old) {
        addLine(ot, line);
        continue;
      }
      if (old.work !== line.work) {
        add(ot, who, { entity: 'linea', action: 'editada', lineId: line.id, field: 'trabajo', oldValue: old.work, newValue: line.work, summary: `Trabajo: ${line.work}` });
      }
      if (old.notes !== line.notes) {
        add(ot, who, { entity: 'linea', action: 'editada', lineId: line.id, field: 'observaciones', oldValue: old.notes, newValue: line.notes, summary: `Observaciones de ${line.work} editadas` });
      }
      const oldActivities = old.activities.map(a => a.name).join(', ');
      const newActivities = line.activities.map(a => a.name).join(', ');
      if (oldActivities !== newActivities) {
        add(ot, who, { entity: 'linea', action: 'editada', lineId: line.id, field: 'actividades', oldValue: oldActivities, newValue: newActivities, summary: `Actividades: ${newActivities || '--'}` });
      }
      if (old.status !== line.status) {
        const action = line.status === 'completado' ? 'completada' : line.status === 'en_ejecucion' ? 'iniciada' : 'estado';
        add(ot, who, { entity: 'linea', action, lineId: line.id, field: 'estado', oldValue: lineStatusLabels[old.status], newValue: lineStatusLabels[line.status], summary: `${line.work}: ${lineStatusLabels[old.status]} → ${lineStatusLabels[line.status]}` });
      } else if (!old.startedAt && line.startedAt) {
        add(ot, who, { entity: 'linea', action: 'iniciada', lineId: line.id, summary: `Linea: ${line.work}` });
      }
      if (old.findingStatus !== line.findingStatus) {
        add(ot, who, { entity: 'hallazgo', action: 'revisado', lineId: line.id, field: 'hallazgo', oldValue: findingStatusLabels[old.findingStatus], newValue: findingStatusLabels[line.findingStatus], summary: `${line.work}: hallazgo ${findingStatusLabels[line.findingStatus]}` });
      }
      diffPhotos(ot, line.id, [...old.photosBefore, ...old.photosAfter], [...line.photosBefore, ...line.photosAfter]);
      diffParts(ot, old, line);
      const oldSignatures = signaturesOf(old);
      signaturesOf(line)
        .filter(s => !oldSignatures.some(o => o.step === s.step))
        .forEach(s => addSignature(ot, line, s));
    }
    for (const old of before.lines) {
      if (!ot.lines.some(l => l.id === old.id)) {
        add(ot, who, { entity: 'linea', action: 'eliminada', lineId: old.id, summary: `Linea: ${old.work}` });
      }
    }
  };

  const diffOT = (before: WorkOrder, ot: WorkOrder) => {
    if (before.status !== ot.status) {
      add(ot, who, { entity: 'ot', action: 'estado', field: 'estado', oldValue: statusLabels[before.status], newValue: statusLabels[ot.status], reason: ot.status === 'rechazada' ? ot.rejectedReason : null, summary: `Estado: ${statusLabels[before.status]} → ${statusLabels[ot.status]}` });
    }
    // al finalizar, la OT se manda sola a SAP (ver AppContext)
    if (before.status !== 'finalizada' && ot.status === 'finalizada') {
      add(ot, sistema, { entity: 'sap', action: 'enviada', summary: `${ot.code} enviada a SAP` });
    }
    if (before.priority !== ot.priority) {
      add(ot, who, { entity: 'ot', action: 'editada', field: 'prioridad', oldValue: priorityLabels[before.priority], newValue: priorityLabels[ot.priority], summary: `Prioridad: ${priorityLabels[before.priority]} → ${priorityLabels[ot.priority]}` });
    }
    if (before.description !== ot.description) {
      add(ot, who, { entity: 'ot', action: 'editada', field: 'descripcion', oldValue: before.description, newValue: ot.description, summary: `Descripcion: ${ot.description}` });
    }
    const beforeTeam = teamText(before);
    const newTeam = teamText(ot);
    if (beforeTeam !== newTeam) {
      add(ot, who, { entity: 'ot', action: 'asignada', field: 'responsable', oldValue: beforeTeam, newValue: newTeam, summary: `Responsable: ${newTeam ?? 'sin asignar'}` });
    }
    if (!before.approvedBy && ot.approvedBy && before.status === ot.status) {
      add(ot, who, { entity: 'ot', action: 'aprobacion_retroactiva', summary: `Aprobada retroactivamente por ${ot.approvedBy}` });
    }
    if (!before.sapSentAt && ot.sapSentAt) {
      add(ot, sistema, { entity: 'sap', action: 'confirmada', summary: `SAP confirmo el envio de ${ot.code}` });
    }
    diffPhotos(ot, null, before.photos ?? [], ot.photos ?? []);
    diffLines(before, ot);
  };

  const prevById = new Map(prev.map(o => [o.id, o]));
  for (const ot of next) {
    const before = prevById.get(ot.id);
    if (!before) {
      add(ot, who, { entity: 'ot', action: 'creada', summary: `OT creada: ${ot.description}` });
      ot.lines.forEach(line => addLine(ot, line));
      diffPhotos(ot, null, [], ot.photos ?? []);
      continue;
    }
    diffOT(before, ot);
  }
  return out;
}

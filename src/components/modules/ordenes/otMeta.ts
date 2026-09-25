import type { FindingStatus, OTLine, OTLineStatus, OTPriority, OTStatus, UserRole, WorkOrder } from '@/types';

type BadgeVariant = 'blue' | 'orange' | 'green' | 'red' | 'gray' | 'yellow' | 'purple';

// ===== Flujo de la OT =====

export const otFlow: OTStatus[] = ['creada', 'pendiente_aprobacion', 'aprobada', 'en_ejecucion', 'finalizada', 'cerrada'];

export const statusLabels: Record<OTStatus, string> = {
  creada: 'Creada',
  pendiente_aprobacion: 'Pendiente de aprobacion',
  aprobada: 'Aprobada',
  en_ejecucion: 'En ejecucion',
  finalizada: 'Finalizada',
  cerrada: 'Cerrada',
};

/** Etiqueta corta para tablas y cards */
export const statusShortLabels: Record<OTStatus, string> = {
  creada: 'Creada',
  pendiente_aprobacion: 'Pend. aprobacion',
  aprobada: 'Aprobada',
  en_ejecucion: 'En ejecucion',
  finalizada: 'Finalizada',
  cerrada: 'Cerrada',
};

export const statusVariants: Record<OTStatus, BadgeVariant> = {
  creada: 'gray',
  pendiente_aprobacion: 'orange',
  aprobada: 'blue',
  en_ejecucion: 'yellow',
  finalizada: 'purple',
  cerrada: 'green',
};

/** Rol que debe actuar en cada etapa del flujo */
export const statusOwners: Record<OTStatus, UserRole> = {
  creada: 'jefe_taller',
  pendiente_aprobacion: 'jefe_taller',
  aprobada: 'tecnico',
  en_ejecucion: 'tecnico',
  finalizada: 'jefe_taller',
  cerrada: 'jefe_taller',
};

export const statusOwnerLabels: Record<OTStatus, string> = {
  creada: 'Jefe de Taller',
  pendiente_aprobacion: 'Jefe de Taller',
  aprobada: 'Tecnico asignado',
  en_ejecucion: 'Tecnico asignado',
  finalizada: 'Jefe de Taller',
  cerrada: 'Jefe de Taller',
};

// ===== Prioridad =====

export const priorityLabels: Record<OTPriority, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Critica',
};

export const priorityVariants: Record<OTPriority, BadgeVariant> = {
  baja: 'gray',
  media: 'blue',
  alta: 'orange',
  critica: 'red',
};

// ===== Estados de linea de trabajo =====

export const lineStatusOrder: OTLineStatus[] = [
  'pendiente',
  'en_ejecucion',
  'esperando_repuesto',
  'completado',
  'completado_con_observaciones',
  'no_completado',
  'requiere_seguimiento',
];

export const lineStatusLabels: Record<OTLineStatus, string> = {
  pendiente: 'Pendiente',
  en_ejecucion: 'En ejecucion',
  esperando_repuesto: 'Esperando repuesto',
  completado: 'Completado',
  completado_con_observaciones: 'Completado con observaciones',
  no_completado: 'No completado',
  requiere_seguimiento: 'Requiere seguimiento',
};

export const lineStatusVariants: Record<OTLineStatus, BadgeVariant> = {
  pendiente: 'gray',
  en_ejecucion: 'blue',
  esperando_repuesto: 'yellow',
  completado: 'green',
  completado_con_observaciones: 'orange',
  no_completado: 'red',
  requiere_seguimiento: 'purple',
};

/** Color del punto que precede al estado en la vista contraida */
export const lineStatusDots: Record<OTLineStatus, string> = {
  pendiente: 'bg-stone-400',
  en_ejecucion: 'bg-blue-500',
  esperando_repuesto: 'bg-yellow-500',
  completado: 'bg-green-500',
  completado_con_observaciones: 'bg-orange-500',
  no_completado: 'bg-red-500',
  requiere_seguimiento: 'bg-purple-500',
};

const closedLineStatuses: OTLineStatus[] = ['completado', 'completado_con_observaciones'];

// ===== Helpers =====

export const formatCLP = (n: number) => 'L' + n.toLocaleString('es-HN');

export function formatDateTime(iso: string | null): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function formatHours(h: number): string {
  if (!h) return '--';
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

export const linePartsCost = (line: OTLine) => line.parts.reduce((s, p) => s + p.quantity * p.unitCost, 0);

export const otPartsCost = (ot: WorkOrder) => ot.lines.reduce((s, l) => s + linePartsCost(l), 0);

export const otHours = (ot: WorkOrder) => ot.lines.reduce((s, l) => s + l.hours, 0);

/** Lineas cerradas (completadas con o sin observaciones) sobre el total */
export function otProgress(ot: WorkOrder): { done: number; total: number; pct: number } {
  const total = ot.lines.length;
  const done = ot.lines.filter(l => closedLineStatuses.includes(l.status)).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function otTechnicians(ot: WorkOrder): string[] {
  return [...new Set(ot.lines.map(l => l.technician).filter(Boolean))];
}

export function otNeedsFollowUp(ot: WorkOrder): boolean {
  return ot.lines.some(l => l.status === 'requiere_seguimiento' || l.status === 'no_completado');
}

export function otWaitingParts(ot: WorkOrder): boolean {
  return ot.lines.some(l => l.status === 'esperando_repuesto');
}

// ===== Hallazgos =====

export const findingStatusLabels: Record<FindingStatus, string> = {
  no_aplica: '',
  pendiente: 'Hallazgo pendiente de aprobacion',
  aprobada: 'Hallazgo aprobado',
  rechazada: 'Hallazgo rechazado',
};

export const findingStatusVariants: Record<FindingStatus, BadgeVariant> = {
  no_aplica: 'gray',
  pendiente: 'orange',
  aprobada: 'green',
  rechazada: 'red',
};

export const pendingFindings = (ot: WorkOrder) =>
  ot.lines.filter(l => l.isFinding && l.findingStatus === 'pendiente');

/**
 * Lineas sin desenlace. Una OT no se puede finalizar ni cerrar mientras queden:
 * completado, completado con observaciones y no completado si cuentan como resueltas.
 */
const unresolvedLineStatuses: OTLineStatus[] = ['pendiente', 'en_ejecucion', 'esperando_repuesto', 'requiere_seguimiento'];

export const unresolvedLines = (ot: WorkOrder) =>
  ot.lines.filter(l => unresolvedLineStatuses.includes(l.status));

/** Motivo por el que no se puede cerrar/finalizar la OT, o null si se puede */
export function blockingReason(ot: WorkOrder): string | null {
  if (ot.lines.length === 0) return 'La OT no tiene lineas de trabajo registradas.';
  const unresolved = unresolvedLines(ot);
  if (unresolved.length > 0) {
    return `Hay ${unresolved.length} linea${unresolved.length !== 1 ? 's' : ''} sin resolver.`;
  }
  const pending = pendingFindings(ot);
  if (pending.length > 0) {
    return `Hay ${pending.length} hallazgo${pending.length !== 1 ? 's' : ''} pendiente${pending.length !== 1 ? 's' : ''} de aprobacion.`;
  }
  return null;
}

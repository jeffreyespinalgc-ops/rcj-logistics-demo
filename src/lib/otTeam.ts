import type { WorkOrder } from '@/types';

/**
 * Responsables de una OT: `assignedTo` es el principal y `assignedTeam` el equipo completo de tecnicos.
 * Todo el equipo ve la OT y puede firmar como solicitante de sus requisas.
 */
export function isOTAssignedTo(ot: WorkOrder, user: string): boolean {
  return Boolean(user) && (ot.assignedTo === user || ot.assignedTeam.includes(user));
}

/** Texto con quien esta a cargo de la OT (todo el equipo); null si aun no se asigno a nadie */
export function otResponsibles(ot: WorkOrder): string | null {
  if (!ot.assignedTo) return null;
  if (ot.assignedToType === 'taller_externo') return ot.assignedTo;
  return ot.assignedTeam.length > 0 ? ot.assignedTeam.join(', ') : ot.assignedTo;
}

import type { OTLine, RequisitionSignature, RequisitionStep, WorkOrder } from '@/types';

/** Orden estricto de las firmas: solicita el tecnico, autoriza el Jefe de Taller y despacha Control de Inventario */
export const requisitionSteps: RequisitionStep[] = ['solicitante', 'autoriza', 'despacha'];

export const requisitionStepLabels: Record<RequisitionStep, string> = {
  solicitante: 'Solicitante',
  autoriza: 'Jefe de Taller',
  despacha: 'Control de Inventario',
};

/** Etiquetas cortas para las insignias de la tabla */
export const requisitionStepShortLabels: Record<RequisitionStep, string> = {
  solicitante: 'Solicitante',
  autoriza: 'Jefe',
  despacha: 'Control',
};

export type RequisitionStatus = 'sin_solicitar' | 'en_firma' | 'completa';

/**
 * Antes cualquiera que pudiera ejecutar la linea (incluido el Jefe de Taller) firmaba como solicitante.
 * Reinicia las requisas cuyo solicitante no es tecnico y que aun no salieron del inventario.
 */
export function dropInvalidRequesterRequisitions(orders: WorkOrder[]): WorkOrder[] {
  return orders.map(ot => ({
    ...ot,
    lines: ot.lines.map(line => {
      const requester = line.requisition?.signatures.find(s => s.step === 'solicitante');
      return requester && requester.role !== 'tecnico' && !line.requisition?.releasedAt
        ? { ...line, requisition: null }
        : line;
    }),
  }));
}

/** Toda linea que requiere repuesto y ya tiene repuestos elegidos genera una requisa */
export const requiresRequisition = (line: OTLine): boolean => line.needsPart && line.parts.length > 0;

export const signaturesOf = (line: OTLine): RequisitionSignature[] => line.requisition?.signatures ?? [];

export const signatureFor = (line: OTLine, step: RequisitionStep): RequisitionSignature | undefined =>
  signaturesOf(line).find(s => s.step === step);

export const missingSteps = (line: OTLine): RequisitionStep[] =>
  requisitionSteps.filter(step => !signatureFor(line, step));

export const isRequisitionComplete = (line: OTLine): boolean =>
  requiresRequisition(line) && missingSteps(line).length === 0;

export function requisitionStatus(line: OTLine): RequisitionStatus {
  if (!signatureFor(line, 'solicitante')) return 'sin_solicitar';
  return missingSteps(line).length === 0 ? 'completa' : 'en_firma';
}

/** Primer paso anterior a este que aun no tiene firma; null si ya firmaron todos los previos */
export function firstMissingBefore(line: OTLine, step: RequisitionStep): RequisitionStep | null {
  return requisitionSteps.slice(0, requisitionSteps.indexOf(step)).find(s => !signatureFor(line, s)) ?? null;
}

/** El solicitante es el tecnico de la linea (o al que se asigno la OT); quien solo supervisa no solicita */
export function isRequisitionRequester(line: OTLine, assignedTo: string | null, user: string): boolean {
  return Boolean(user) && (line.technician === user || assignedTo === user);
}

/** Pasos de autorizacion y despacho que un usuario con estos permisos puede firmar ahora, respetando el orden */
export function signableSteps(line: OTLine, can: { autoriza: boolean; despacha: boolean }): RequisitionStep[] {
  const steps: RequisitionStep[] = [];
  if (can.autoriza && !signatureFor(line, 'autoriza') && !firstMissingBefore(line, 'autoriza')) steps.push('autoriza');
  if (can.despacha && !signatureFor(line, 'despacha') && !firstMissingBefore(line, 'despacha')) steps.push('despacha');
  return steps;
}

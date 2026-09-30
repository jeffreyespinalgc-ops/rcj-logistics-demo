import type { OTLine, OTLinePart, RequisitionSignature, RequisitionStep, WorkOrder } from '@/types';

/**
 * Etapas de la requisa, en orden estricto: el tecnico solicita, el Jefe de Taller autoriza, Control de Inventario
 * aprueba y entrega (ahi se descuenta el stock) y el tecnico confirma que recibio.
 */
export const allRequisitionSteps: RequisitionStep[] = ['solicitante', 'autoriza', 'despacha', 'recibe'];

/** Etapa de la requisa por rol: es lo que dicen las insignias de firma y los avisos de lo que falta */
export const requisitionStepLabels: Record<RequisitionStep, string> = {
  solicitante: 'Solicitante',
  autoriza: 'Jefe de Taller',
  despacha: 'Control de Inventario',
  recibe: 'Receptor',
};

/** Etiquetas cortas para las insignias de la tabla */
export const requisitionStepShortLabels: Record<RequisitionStep, string> = {
  solicitante: 'Solicitante',
  autoriza: 'Jefe',
  despacha: 'Control',
  recibe: 'Receptor',
};

/** Nombre del campo de firma en el documento de la requisa */
export const requisitionFieldLabels: Record<RequisitionStep, string> = {
  solicitante: 'Solicitado por',
  autoriza: 'Autorizado por',
  despacha: 'Aprobado por',
  recibe: 'Recibido por',
};

/** Quien firma cada etapa */
export const requisitionStepRoles: Record<RequisitionStep, string> = {
  solicitante: 'Tecnico',
  autoriza: 'Jefe de Taller',
  despacha: 'Control de Inventario',
  recibe: 'Tecnico',
};

/** Texto del boton con el que se firma cada etapa */
export const requisitionSignLabels: Record<RequisitionStep, string> = {
  solicitante: '',
  autoriza: '',
  despacha: '',
  recibe: '',
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

/**
 * La requisa termina con la confirmacion "Recibido por" del tecnico. Las que ya se habian entregado antes de
 * existir ese paso (sin la marca) se quedan como estaban: completas al entregarse.
 */
const needsReceipt = (line: OTLine): boolean => line.requisition?.receiptRequired ?? !line.requisition?.releasedAt;

/** Etapas que aplican a esta requisa */
export const requisitionStepsFor = (line: OTLine): RequisitionStep[] =>
  needsReceipt(line) ? allRequisitionSteps : allRequisitionSteps.filter(s => s !== 'recibe');

export const missingSteps = (line: OTLine): RequisitionStep[] =>
  requisitionStepsFor(line).filter(step => !signatureFor(line, step));

export const isRequisitionComplete = (line: OTLine): boolean =>
  requiresRequisition(line) && missingSteps(line).length === 0;

export function requisitionStatus(line: OTLine): RequisitionStatus {
  if (!signatureFor(line, 'solicitante')) return 'sin_solicitar';
  return missingSteps(line).length === 0 ? 'completa' : 'en_firma';
}

/**
 * Cuantas requisas siguen sin completarse (se usa para el badge del menu y de la pestana
 * "Requisas de Repuestos"). Respeta el mismo alcance que la tabla: todas las OTs si se ve todo, si no
 * solo las asignadas al usuario.
 */
export function pendingRequisitionCount(orders: WorkOrder[], opts: { canSeeAll: boolean; currentUser: string }): number {
  return orders
    .filter(ot => opts.canSeeAll || ot.assignedTo === opts.currentUser)
    .flatMap(ot => ot.lines)
    .filter(requiresRequisition)
    .filter(line => requisitionStatus(line) !== 'completa')
    .length;
}

/** Primer paso anterior a este que aun no tiene firma; null si ya firmaron todos los previos */
export function firstMissingBefore(line: OTLine, step: RequisitionStep): RequisitionStep | null {
  const steps = requisitionStepsFor(line);
  return steps.slice(0, steps.indexOf(step)).find(s => !signatureFor(line, s)) ?? null;
}

/** El solicitante es el tecnico de la linea (o al que se asigno la OT); quien solo supervisa no solicita */
export function isRequisitionRequester(line: OTLine, assignedTo: string | null, user: string): boolean {
  return Boolean(user) && (line.technician === user || assignedTo === user);
}

/**
 * Pasos que un usuario puede firmar ahora, respetando el orden. `requester` es true si el usuario es el
 * tecnico de la linea y su rol puede solicitar (firma tanto "Solicitado por" como "Recibido por").
 */
export function signableSteps(
  line: OTLine,
  can: { requester: boolean; autoriza: boolean; despacha: boolean }
): RequisitionStep[] {
  const allowed: Record<RequisitionStep, boolean> = {
    solicitante: can.requester,
    autoriza: can.autoriza,
    despacha: can.despacha,
    recibe: can.requester,
  };
  return requisitionStepsFor(line).filter(step =>
    allowed[step] && !signatureFor(line, step) && !firstMissingBefore(line, step)
  );
}

// ===== Entrega parcial =====

/** Los repuestos ya salieron del inventario (Control de Inventario firmo su paso) */
export const isDelivered = (line: OTLine): boolean => Boolean(line.requisition?.releasedAt);

/** Cantidad entregada de un repuesto: lo que dijo Control, o todo lo solicitado en requisas anteriores a la entrega parcial */
export const deliveredQuantity = (line: OTLine, part: OTLinePart): number =>
  isDelivered(line) ? (part.deliveredQuantity ?? part.quantity) : 0;

/** Lo que realmente se uso: lo entregado si la requisa ya salio del inventario; en lineas sin requisa, lo registrado */
export const usedQuantity = (line: OTLine, part: OTLinePart): number =>
  isDelivered(line) ? deliveredQuantity(line, part) : part.quantity;

/** "2 / 5" una vez entregado; antes de la entrega solo la cantidad solicitada */
export const quantityLabel = (line: OTLine, part: OTLinePart): string =>
  isDelivered(line) ? `${deliveredQuantity(line, part)} / ${part.quantity}` : String(part.quantity);

/** Se entrego menos de lo solicitado */
export const isPartial = (line: OTLine, part: OTLinePart): boolean =>
  isDelivered(line) && deliveredQuantity(line, part) < part.quantity;

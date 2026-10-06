import type { OTStatus, WorkOrder } from '@/types';
import { Check } from 'lucide-react';
import { requisitionRevisionPending } from '@/lib/requisition';
import { formatDateTime, statusLabels, statusOwnerLabels } from './otMeta';

/**
 * Etapas en orden estricto, con una sola activa a la vez:
 * Creada -> Pendiente de aprobacion -> Aprobada -> Revision de Inventario -> En ejecucion -> Finalizada -> Enviado a SAP.
 * "Revision de Inventario" es la cadena de firmas de las requisas (tecnico, Jefe de Taller, Control de Inventario y
 * tecnico que recibe): mientras falte alguna firma, la OT espera en esa etapa. "Finalizada" tambien es una cadena de
 * dos firmas (tecnico finaliza, Jefe de Taller cierra): queda activa (naranja), no hecha, hasta que el Jefe de
 * Taller firma el cierre. "Enviado a SAP" queda pendiente (naranja) hasta que SAP confirma el envio.
 */
const phases: { key: string; status?: OTStatus; sourceStatus?: OTStatus; label: string; owner: string }[] = [
  { key: 'creada', status: 'creada', label: statusLabels.creada, owner: statusOwnerLabels.creada },
  // "Pendiente de aprobacion" no es una transicion propia: arranca en el mismo instante que "Creada"
  { key: 'pendiente_aprobacion', sourceStatus: 'creada', label: statusLabels.pendiente_aprobacion, owner: statusOwnerLabels.pendiente_aprobacion },
  { key: 'aprobada', status: 'aprobada', label: statusLabels.aprobada, owner: statusOwnerLabels.aprobada },
  // "Revision de Inventario" tampoco es una transicion propia: arranca en el mismo instante que "Aprobada"
  { key: 'revision_inventario', sourceStatus: 'aprobada', label: 'Revision de Inventario', owner: 'Tecnico / Jefe de Taller / Control de Inventario' },
  { key: 'en_ejecucion', status: 'en_ejecucion', label: statusLabels.en_ejecucion, owner: statusOwnerLabels.en_ejecucion },
  { key: 'finalizada', status: 'finalizada', label: statusLabels.finalizada, owner: statusOwnerLabels.finalizada },
  { key: 'enviado_sap', label: 'Enviado a SAP', owner: 'Sistema' },
];

/** Indice de la etapa en curso (la activa); todas las anteriores estan hechas y las siguientes pendientes */
function currentPhaseIndex(ot: WorkOrder): number {
  switch (ot.status) {
    case 'creada':
    case 'pendiente_aprobacion':
    case 'rechazada':
      return 1;
    case 'aprobada':
      return requisitionRevisionPending(ot.lines) ? 3 : 2;
    case 'en_ejecucion':
      return 4;
    // el tecnico ya finalizo, pero la etapa "Finalizada" (la firma del Jefe de Taller que cierra la OT) sigue
    // activa hasta que el Jefe realmente firme (closeWorkOrder); recien ahi pasa a "cerrada"
    case 'finalizada':
      return 5;
    case 'cerrada':
      return ot.sapSentAt ? 7 : 6;
  }
}

/** Arma las 7 etapas con su estado (hecha/activa/pendiente) y cuando ocurrieron; lo usan la linea de tiempo completa y la mini version de la tabla */
function buildOTSteps(ot: WorkOrder) {
  const current = currentPhaseIndex(ot);
  const entryOf = (status: OTStatus) => [...ot.history].reverse().find(h => h.status === status) ?? null;

  return phases.map((phase, idx) => {
    const entry = phase.status ? entryOf(phase.status) : phase.sourceStatus ? entryOf(phase.sourceStatus) : null;
    const isSap = phase.key === 'enviado_sap';
    // mientras "Finalizada" siga activa (falta la firma del Jefe de Taller) "Enviado a SAP" todavia no se
    // considera alcanzada en la linea de tiempo, aunque el envio automatico ya haya ocurrido por detras
    const sapReached = isSap && idx <= current;
    return {
      ...phase,
      done: idx < current,
      active: idx === current,
      at: isSap ? (sapReached ? ot.sapSentAt : null) : entry?.at ?? null,
      by: isSap ? (sapReached && ot.sapSentAt ? 'SAP' : null) : entry?.by ?? null,
    };
  });
}

/** Version compacta de la linea de tiempo para la columna "Estado" de la tabla: solo los circulos, sin titulos ni fechas (el detalle completo de cada etapa esta en el tooltip) */
export function OTTimelineMini({ ot }: { ot: WorkOrder }) {
  const steps = buildOTSteps(ot);

  return (
    <div className="flex items-center">
      {steps.map((step, idx) => {
        const circle = step.done
          ? 'bg-green-500 border-green-500 text-white'
          : step.active
            ? 'bg-orange-500 border-orange-500 text-white ring-2 ring-orange-100'
            : 'bg-white border-stone-300 text-stone-300';
        const tooltip = `${step.label}${step.at ? ` - ${formatDateTime(step.at)}${step.by ? ` (${step.by})` : ''}` : ''}`;

        return (
          <div key={step.key} className="flex items-center" title={tooltip}>
            {idx > 0 && (
              <div className={`h-0.5 w-2.5 flex-shrink-0 ${step.done || step.active ? 'bg-green-400' : 'bg-stone-200'}`} />
            )}
            <div className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${circle}`}>
              {step.done && <Check size={9} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function OTTimeline({ ot }: { ot: WorkOrder }) {
  const steps = buildOTSteps(ot);

  return (
    <div className="flex items-start overflow-x-auto pb-1">
      {steps.map((step, idx) => {
        const circle = step.done
          ? 'bg-green-500 border-green-500 text-white'
          : step.active
            ? 'bg-orange-500 border-orange-500 text-white ring-4 ring-orange-100'
            : 'bg-white border-stone-300 text-stone-400';

        return (
          <div key={step.key} className="flex-1 min-w-[136px] flex flex-col items-center relative">
            {idx > 0 && (
              <div className={`absolute top-3.5 right-1/2 w-full h-0.5 ${step.done || step.active ? 'bg-green-400' : 'bg-stone-200'}`} />
            )}
            <div className={`relative z-10 w-7 h-7 rounded-full border-2 flex items-center justify-center text-content font-bold ${circle}`}>
              {step.done ? <Check size={14} /> : idx + 1}
            </div>
            <div className="mt-1.5 text-center px-1">
              <p className={`text-content font-bold leading-tight ${step.active ? 'text-orange-700' : step.done ? 'text-stone-700' : 'text-stone-400'}`}>
                {step.label}
              </p>
              <p className="text-content text-stone-400 leading-tight mt-0.5">{step.owner}</p>
              {step.at && (
                <p className="text-content text-stone-500 leading-tight mt-0.5">
                  {formatDateTime(step.at)}<br />{step.by}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

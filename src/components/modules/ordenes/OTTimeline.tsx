import type { WorkOrder } from '@/types';
import { Check } from 'lucide-react';
import { requiresRequisition, requisitionStatus } from '@/lib/requisition';
import { formatDateTime, otFlow, statusLabels, statusOwnerLabels } from './otMeta';

interface TimelineStep {
  key: string;
  label: string;
  owner: string;
  done: boolean;
  active: boolean;
  at: string | null;
  by: string | null;
}

/**
 * Linea de tiempo del flujo de la OT:
 * Creada -> Pendiente de aprobacion -> Aprobada -> Revision de Inventario -> En ejecucion -> Finalizada -> Enviado a SAP
 * "Revision de Inventario" y "Enviado a SAP" no son estados reales de la OT (`OTStatus`), son hitos.
 * "Revision de Inventario" representa la CADENA DE FIRMAS de la requisa de repuestos (Tecnico solicita ->
 * Jefe de Taller autoriza -> Control de Inventario entrega -> Tecnico recibe): esta "pendiente" mientras
 * cualquier linea con repuestos tenga alguna de esas firmas sin completar, y "lista" cuando todas las
 * requisas de la OT ya estan completas (o si ninguna linea necesita repuestos). Va justo despues de
 * "Aprobada" porque es ahi, con la OT ya aprobada, cuando esas firmas empiezan a pedirse. OJO: esto es
 * independiente del boton "Firmar como Control de Inventario" (`ot.inventorySignedAt`, una sola firma
 * de Control sobre el documento completo de la OT) -- ese sigue existiendo aparte, sin paso propio aqui.
 * "Enviado a SAP" depende de `ot.sapSentAt`, que se simula automaticamente (siempre exitoso) al cerrar la
 * OT. El estado real "cerrada" no tiene su propio paso visual: "Enviado a SAP" ocurre en el mismo momento
 * y lo reemplaza como hito final.
 */
export function OTTimeline({ ot }: { ot: WorkOrder }) {
  // "rechazada" no forma parte de otFlow: se muestra el flujo detenido en "Pendiente de aprobacion",
  // que es la etapa desde la que se rechaza (el banner rojo de abajo explica el motivo)
  const currentIndex = ot.status === 'rechazada' ? otFlow.indexOf('pendiente_aprobacion') : otFlow.indexOf(ot.status);
  const earlySteps = otFlow.slice(0, otFlow.indexOf('aprobada') + 1);
  const lateSteps = otFlow.slice(otFlow.indexOf('en_ejecucion'), otFlow.indexOf('finalizada') + 1);
  const reachedAprobada = currentIndex >= otFlow.indexOf('aprobada');
  const requisitionPending = ot.lines.some(l => requiresRequisition(l) && requisitionStatus(l) !== 'completa');
  const requisitionDone = reachedAprobada && !requisitionPending;
  const requisitionActive = reachedAprobada && requisitionPending;
  const sapDone = Boolean(ot.sapSentAt);
  const sapActive = !sapDone && ot.status === 'cerrada';

  const statusStep = (status: typeof otFlow[number]): TimelineStep => {
    const idx = otFlow.indexOf(status);
    const entry = [...ot.history].reverse().find(h => h.status === status);
    return {
      key: status,
      label: statusLabels[status],
      owner: statusOwnerLabels[status],
      done: idx < currentIndex,
      active: idx === currentIndex,
      at: entry?.at ?? null,
      by: entry?.by ?? null,
    };
  };

  const steps: TimelineStep[] = [
    ...earlySteps.map(statusStep),
    {
      key: 'revision_inventario',
      label: 'Revision de Inventario',
      owner: 'Tecnico / Jefe de Taller / Control de Inventario',
      done: requisitionDone,
      active: requisitionActive,
      at: null,
      by: null,
    },
    ...lateSteps.map(statusStep),
    {
      key: 'enviado_sap',
      label: 'Enviado a SAP',
      owner: 'Sistema',
      done: sapDone,
      active: sapActive,
      at: ot.sapSentAt,
      by: sapDone ? 'SAP' : null,
    },
  ];

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

import type { WorkOrder } from '@/types';
import { Check } from 'lucide-react';
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
 * Creada -> Pendiente de aprobacion -> Aprobada -> En ejecucion -> Finalizada -> Revision de Inventario
 * El ultimo paso ya NO es el estado "cerrada" de la OT (ese estado sigue existiendo para el cierre del
 * Jefe de Taller en el resto de la app, solo se dejo de representar aqui): muestra en su lugar la firma
 * de Control de Inventario sobre el documento de la OT (`ot.inventorySignedAt`), que puede llegar antes
 * o despues de que el Jefe cierre la OT.
 */
export function OTTimeline({ ot }: { ot: WorkOrder }) {
  // "rechazada" no forma parte de otFlow: se muestra el flujo detenido en "Pendiente de aprobacion",
  // que es la etapa desde la que se rechaza (el banner rojo de abajo explica el motivo)
  const displaySteps = otFlow.slice(0, -1);
  const currentIndex = ot.status === 'rechazada' ? otFlow.indexOf('pendiente_aprobacion') : otFlow.indexOf(ot.status);
  const inventoryDone = Boolean(ot.inventorySignedAt);
  const inventoryActive = !inventoryDone && currentIndex >= displaySteps.length;

  const steps: TimelineStep[] = [
    ...displaySteps.map((status, idx) => {
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
    }),
    {
      key: 'revision_inventario',
      label: 'Revision de Inventario',
      owner: 'Control de Inventario',
      done: inventoryDone,
      active: inventoryActive,
      at: ot.inventorySignedAt,
      by: ot.inventorySignedBy,
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

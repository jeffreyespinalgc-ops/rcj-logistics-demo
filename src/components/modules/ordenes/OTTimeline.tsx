import type { WorkOrder } from '@/types';
import { Check } from 'lucide-react';
import { formatDateTime, otFlow, statusLabels, statusOwnerLabels } from './otMeta';

/**
 * Linea de tiempo del flujo de la OT:
 * Creada -> Pendiente de aprobacion -> Aprobada -> En ejecucion -> Finalizada -> Cerrada
 */
export function OTTimeline({ ot }: { ot: WorkOrder }) {
  const currentIndex = otFlow.indexOf(ot.status);

  return (
    <div className="flex items-start overflow-x-auto pb-1">
      {otFlow.map((status, idx) => {
        const entry = [...ot.history].reverse().find(h => h.status === status);
        const done = idx < currentIndex;
        const active = idx === currentIndex;

        const circle = done
          ? 'bg-green-500 border-green-500 text-white'
          : active
            ? 'bg-orange-500 border-orange-500 text-white ring-4 ring-orange-100'
            : 'bg-white border-stone-300 text-stone-400';

        return (
          <div key={status} className="flex-1 min-w-[136px] flex flex-col items-center relative">
            {idx > 0 && (
              <div className={`absolute top-3.5 right-1/2 w-full h-0.5 ${idx <= currentIndex ? 'bg-green-400' : 'bg-stone-200'}`} />
            )}
            <div className={`relative z-10 w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold ${circle}`}>
              {done ? <Check size={14} /> : idx + 1}
            </div>
            <div className="mt-1.5 text-center px-1">
              <p className={`text-[11px] font-semibold leading-tight ${active ? 'text-orange-700' : done ? 'text-stone-700' : 'text-stone-400'}`}>
                {statusLabels[status]}
              </p>
              <p className="text-[10px] text-stone-400 leading-tight mt-0.5">{statusOwnerLabels[status]}</p>
              {entry && (
                <p className="text-[10px] text-stone-500 leading-tight mt-0.5">
                  {formatDateTime(entry.at)}<br />{entry.by}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

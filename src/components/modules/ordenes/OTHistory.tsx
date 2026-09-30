import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import type { WorkOrder } from '@/types';
import { History } from 'lucide-react';
import { roleLabels } from '@/lib/roles';
import { formatDateTime, statusLabels, statusVariants } from './otMeta';

/** Boton "ver historial" + su modal: cada cambio de estado que tuvo la OT, quien lo hizo, con que rol y cuando */
export function OTHistoryButton({ ot }: { ot: WorkOrder }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        className="flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 sm:min-h-0 sm:min-w-0 sm:p-1.5"
        title="Ver historial de modificaciones"
        aria-label={`Ver historial de ${ot.code}`}
      >
        <History size={16} />
      </button>
      {open && <OTHistoryModal ot={ot} onClose={() => setOpen(false)} />}
    </>
  );
}

function OTHistoryModal({ ot, onClose }: { ot: WorkOrder; onClose: () => void }) {
  const entries = ot.history;

  return (
    <Modal open onClose={onClose} title={`Historial de ${ot.code}`} size="md">
      {entries.length === 0 ? (
        <p className="text-content text-stone-500">Sin cambios registrados.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-stone-200">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>Estado</th>
                <th>Responsable</th>
                <th>Rol</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((h, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td><Badge variant={statusVariants[h.status]}>{statusLabels[h.status]}</Badge></td>
                  <td className="font-normal text-stone-800">{h.by}</td>
                  <td className="text-stone-600">{roleLabels[h.role]}</td>
                  <td className="whitespace-nowrap text-stone-500">{formatDateTime(h.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

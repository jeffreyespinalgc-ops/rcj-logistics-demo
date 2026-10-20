import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Modal } from '@/components/ui/Modal';
import type { WorkOrder } from '@/types';
import { History } from 'lucide-react';
import { actionLabels, entityLabels } from '@/lib/otLog';
import { formatDateTime } from './otMeta';

export function OTHistoryButton({ ot }: { ot: WorkOrder }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md transition-colors hover:bg-stone-100 hover:text-blue-500 pointer-fine:min-h-0 pointer-fine:min-w-0 sm:p-1.5"
        title="Ver log de modificaciones"
        aria-label={`Ver log de modificaciones de ${ot.code}`}
      >
        <History size={16} />
      </button>
      {open && <OTHistoryModal ot={ot} onClose={() => setOpen(false)} />}
    </>
  );
}

function OTHistoryModal({ ot, onClose }: { ot: WorkOrder; onClose: () => void }) {
  const { otLog } = useApp();
  // el log guarda la mas reciente primero; aqui se muestra en orden ascendente (el cambio mas antiguo arriba)
  const entries = otLog.filter(e => e.otId === ot.id).reverse();

  return (
    <Modal open onClose={onClose} title={`Log de modificaciones ${ot.code}`} size="xl">
      {entries.length === 0 ? (
        <p className="text-content text-stone-500">Sin modificaciones registradas.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-stone-200">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10 py-1.5!">#</th>
                <th className="whitespace-nowrap py-1.5!">Fecha</th>
                <th className="py-1.5!">Usuario</th>
                <th className="py-1.5!">Documento</th>
                <th className="py-1.5!">Accion</th>
                <th className="py-1.5!">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.id} className='text-left'>
                  <td className="py-0.5! ">{i + 1}</td>
                  <td className="py-0.5! whitespace-nowrap text-stone-500">{formatDateTime(e.at)}</td>
                  <td className="py-0.5! font-normal text-stone-800">{e.by}</td>
                  <td className="py-0.5!">{entityLabels[e.entity]}</td>
                  <td className="py-0.5!">{actionLabels[e.action] ?? e.action}</td>
                  <td className="py-0.5! font-normal">{e.summary}{e.reason ? ` (${e.reason})` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}


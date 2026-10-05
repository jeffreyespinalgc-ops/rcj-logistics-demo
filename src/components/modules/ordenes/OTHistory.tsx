import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Modal } from '@/components/ui/Modal';
import type { WorkOrder } from '@/types';
import { History } from 'lucide-react';
import { roleLabels } from '@/lib/roles';
import { actionLabels, entityLabels } from '@/lib/otLog';
import { formatDateTime } from './otMeta';

export function OTHistoryButton({ ot }: { ot: WorkOrder }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        className="flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 sm:min-h-0 sm:min-w-0 sm:p-1.5"
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
    <Modal open onClose={onClose} title={`Log de modificaciones de ${ot.code}`} size="xl">
      {entries.length === 0 ? (
        <p className="text-content text-stone-500">Sin modificaciones registradas.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-stone-200">
          <table className="data-table">
            <thead>
              <tr className="">
                <th className="w-10">#</th>
                <th className="text-center">Fecha</th>
                <th className="text-center">Usuario</th>
                <th className="text-center">Rol</th>
                <th className="text-center">Entidad</th>
                <th className="text-center">Accion</th>
                <th className="text-center">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.id}>
                  <td className="text-left">{i + 1}</td>
                  <td className="text-left whitespace-nowrap text-stone-500">{formatDateTime(e.at)}</td>
                  <td className="font-normal text-stone-800">{e.by}</td>
                  <td className="text-stone-600">{e.role === 'sistema' ? 'Sistema' : roleLabels[e.role]}</td>
                  <td className="text-left">{entityLabels[e.entity]}</td>
                  <td className="text-left">{actionLabels[e.action] ?? e.action}</td>
                  <td className="font-normal text-left">{e.summary}{e.reason ? ` (${e.reason})` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

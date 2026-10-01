import { useMemo, useState } from 'react';
import { useApp, type NewOTLine } from '@/store/AppContext';
import { useConfirm } from '@/store/ConfirmContext';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea } from '@/components/ui/Field';
import type { OTPriority } from '@/types';
import { AlertTriangle, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { LineFields, useLineDraft } from './LineForm';
import { priorityLabels } from './otMeta';

const priorityOrder: OTPriority[] = ['baja', 'media', 'alta', 'critica'];

/**
 * Nueva OT en una sola pagina: los datos de la OT, sus lineas de trabajo y los repuestos que pide cada una. Al crearla
 * queda pendiente de aprobacion, igual que antes; la requisa de cada linea sigue su propio flujo de firmas.
 */
export function CreateOTPage({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const { assets, workOrders, currentRole, currentUser, addWorkOrder, addNotification } = useApp();
  const confirm = useConfirm();
  const [assetId, setAssetId] = useState('');
  const [priority, setPriority] = useState<OTPriority>('media');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<NewOTLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  // el tecnico que crea la OT es quien solicita los repuestos y quien hace las lineas
  const draft = useLineDraft(currentRole === 'tecnico' ? currentUser : '');

  const nextCode = useMemo(() => {
    const max = workOrders.reduce((acc, ot) => {
      const n = Number(ot.code.split('-').pop());
      return Number.isFinite(n) ? Math.max(acc, n) : acc;
    }, 0);
    return `OT-2026-${String(max + 1).padStart(4, '0')}`;
  }, [workOrders]);

  // una linea completa que aun no se agrego a la lista tambien se incluye al crear la OT
  const pending = draft.build();
  const allLines = pending ? [...lines, pending] : lines;
  const totalParts = allLines.reduce((sum, l) => sum + (l.parts?.length ?? 0), 0);
  const summary = `Se creara con ${allLines.length === 0 ? 'ninguna linea' : allLines.length === 1 ? '1 linea' : `${allLines.length} lineas`}`
    + `${totalParts > 0 ? ` y ${totalParts} repuesto${totalParts === 1 ? '' : 's'}` : ''}.`;

  const addLine = () => {
    const line = draft.build();
    if (!line) return;
    setLines(prev => [...prev, line]);
    draft.reset();
    setError(null);
  };

  const handleCreate = async () => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return setError('Selecciona el vehiculo de la OT.');
    if (!description.trim()) return setError('Escribe la descripcion de la OT.');
    if (draft.dirty && !pending) return setError('La linea en curso esta incompleta: elige el trabajo o limpiala antes de crear la OT.');
    if (!(await confirm({ title: 'Crear OT', message: '¿Estas realmente seguro de crear la OT?', confirmLabel: 'Crear OT' }))) return;

    const date = new Date().toISOString().slice(0, 10);
    addWorkOrder({
      code: nextCode,
      assetId: asset.id,
      assetCode: asset.code,
      assetName: asset.name,
      priority,
      description: description.trim(),
      createdAt: date,
      // la asignacion la hace el Jefe de Taller despues de aprobar
      assignedTo: null,
      assignedToType: null,
    }, allLines);
    addNotification({
      type: 'aprobacion',
      title: `${nextCode} pendiente de aprobacion`,
      description: `${asset.name} - ${description.trim()}`,
      date,
      reference: nextCode,
      priority: priority === 'critica' ? 'alta' : 'media',
    });
    draft.reset();
    onCreated();
  };

  return (
    <div className="p-3 sm:p-4 space-y-2">
      <button
        onClick={onBack}
        className="flex min-h-[44px] items-center gap-2 text-sm text-stone-600 transition-colors hover:text-orange-600 sm:min-h-0"
      >
        <ArrowLeft size={16} /> Volver al listado
      </button>

      <div className="rounded-lg border border-stone-200 bg-white shadow-card">
        <div className="border-b border-stone-200 px-4 py-2.5 sm:px-5">
          <h3 className="ui-title">Nueva Orden de Trabajo</h3>
        </div>

        <section className="space-y-3 border-b border-stone-200 px-4 py-3 sm:px-5" aria-labelledby="ot-data">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Field label="Vehiculo *" className="md:col-span-1">
              <Select value={assetId} onChange={e => { setAssetId(e.target.value); setError(null); }}>
                <option value="">Seleccionar vehiculo...</option>
                {assets.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
              </Select>
            </Field>
            <Field label="Prioridad *" className="md:col-span-1">
              <Select value={priority} onChange={e => setPriority(e.target.value as OTPriority)}>
                {priorityOrder.map(p => <option key={p} value={p}>{priorityLabels[p]}</option>)}
              </Select>
            </Field>
            <Field label="Descripcion *" className="md:col-span-2">
              <TextArea
                value={description}
                onChange={e => { setDescription(e.target.value); setError(null); }}
                rows={1}
                placeholder="Describe el trabajo a realizar..."
              />
            </Field>
          </div>
        </section>

        <section className="space-y-3 px-4 py-3 sm:px-5" aria-labelledby="ot-lines">
          <div className="space-y-3 rounded-md border border-stone-200 bg-stone-50/50 p-3">
            <LineFields draft={draft} asset={assets.find(a => a.id === assetId)} />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="primary" className="min-h-[44px] sm:min-h-0" onClick={addLine} disabled={!draft.valid} title="Agregar linea de trabajo">
                <Plus size={16} />
              </Button>
            </div>
          </div>

          <h4 id="ot-lines" className="ui-subtitle">Lineas de trabajo</h4>
          {lines.length === 0 ? (
            <p className="rounded-md border border-dashed border-stone-200 py-3 text-center text-content text-stone-500">Sin lineas agregadas todavia.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-stone-200">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-10">#</th>
                    <th>Linea de trabajo</th>
                    <th>Repuestos</th>
                    {/* relative: el texto sr-only (absolute) queda recortado por el scroll de la tabla y no agranda la pagina */}
                    <th className="relative w-12"><span className="sr-only">Quitar</span></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={`${index}-${line.work}`}>
                      <td>{index + 1}</td>
                      <td className="min-w-[220px]">
                        <span className="block font-normal text-stone-800">{line.work}</span>
                      </td>
                      <td className="min-w-[180px]">
                        {(line.parts?.length ?? 0) === 0 ? (
                          <span className="text-stone-500">{line.needsPart ? 'Sin repuestos elegidos' : '--'}</span>
                        ) : (
                          <ul className="space-y-0.5">
                            {line.parts?.map(p => (
                              <li key={p.partId} className="font-normal text-stone-800">
                                {p.partDescription} <span className="text-stone-500">x{p.quantity}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => setLines(prev => prev.filter((_, i) => i !== index))}
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 sm:min-h-0 sm:min-w-0 sm:p-1.5"
                          title="Quitar linea"
                          aria-label={`Quitar la linea ${line.work}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 px-4 py-2.5 sm:px-5">
          <div className="mr-auto min-w-0">
            {error && (
              <p role="alert" className="mt-1 flex items-start gap-1.5 text-content text-red-700">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /> {error}
              </p>
            )}
          </div>
          <Button variant="outline" className="min-h-[44px] sm:min-h-0" onClick={onBack}>Cancelar</Button>
          <Button className="min-h-[44px] sm:min-h-0" onClick={handleCreate}><Plus size={16} /> Crear OT</Button>
        </div>
      </div>
    </div>
  );
}

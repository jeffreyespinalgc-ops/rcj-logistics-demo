import { useEffect, useMemo, useState } from 'react';
import { useApp, type NewOTLine } from '@/store/AppContext';
import { useConfirm } from '@/store/ConfirmContext';
import { useToast } from '@/store/ToastContext';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { PhotoCarousel } from '@/components/ui/PhotoCarousel';
import { fileToCompressedDataUrl } from '@/lib/image';
import { selectionFromLine } from '@/lib/planSelection';
import type { Asset, AssetPhoto, OTPriority } from '@/types';
import { AlertTriangle, ArrowLeft, Check, Edit, FileIcon, Pencil, Plus, SaveAll, SaveAllIcon, SaveOff, SaveOffIcon, Trash2, X } from 'lucide-react';
import { LineFields, useLineDraft } from './LineForm';
import { priorityLabels } from './otMeta';

const priorityOrder: OTPriority[] = ['baja', 'media', 'alta', 'critica'];
/** Id/fecha solo para distinguir fotos en el carrusel mientras la OT no existe (aun no hay id/fecha reales) */
const draftPhotoId = () => `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Nueva OT en una sola pagina: los datos de la OT, sus lineas de trabajo y los repuestos que pide cada una. Al crearla
 * queda pendiente de aprobacion, igual que antes; la requisa de cada linea sigue su propio flujo de firmas.
 */
export function CreateOTPage({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const { assets, workOrders, currentRole, currentUser, addWorkOrder, addNotification } = useApp();
  const confirm = useConfirm();
  const toast = useToast();
  const [assetId, setAssetId] = useState('');
  const [priority, setPriority] = useState<OTPriority>('media');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<NewOTLine[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [photos, setPhotos] = useState<AssetPhoto[]>([]);
  const [photosBusy, setPhotosBusy] = useState(false);
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

  // evidencia a nivel de OT: se junta local (la OT todavia no existe) y se manda junto con addWorkOrder
  const handleAddPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhotosBusy(true);
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await fileToCompressedDataUrl(file);
        setPhotos(prev => [...prev, { id: draftPhotoId(), dataUrl, name: file.name, addedAt: new Date().toISOString().slice(0, 19) }]);
      } catch {
        // archivo invalido: se omite
      }
    }
    setPhotosBusy(false);
  };

  const handleRemovePhoto = async (photo: AssetPhoto) => {
    if (await confirm({ title: 'Eliminar fotografia', message: '¿Estas seguro de eliminar esta fotografia?', confirmLabel: 'Eliminar', variant: 'danger' })) {
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
    }
  };

  const handleCreate = async () => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return setError('Selecciona el vehiculo de la OT.');
    if (!description.trim()) return setError('Escribe la descripcion de la OT.');
    if (draft.dirty && !pending) return setError('La linea en curso esta incompleta: elige el trabajo o limpiala antes de crear la OT.');
    if (!(await confirm({ title: 'Crear OT', message: '¿Estas seguro de crear la orden de trabajo?', confirmLabel: 'Crear Orden de Trabajo' }))) return;

    const date = new Date().toISOString().slice(0, 10);
    addWorkOrder({
      code: nextCode,
      assetId: asset.id,
      assetCode: asset.code,
      assetName: asset.name,
      priority,
      description: description.trim(),
      createdAt: date,
      assignedTo: null,
      assignedToType: null,
      photos,
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
    toast(`${nextCode} creada correctamente`);
    onCreated();
  };

  return (
    <div className="p-3 sm:p-4 space-y-2">
      <button
        onClick={onBack}
        className="flex min-h-[44px] items-center gap-2 text-sm text-stone-600 transition-colors hover:text-orange-600 [@media(pointer:fine)]:min-h-0"
      >
        <ArrowLeft size={16} /> Volver al listado
      </button>

      <div className="rounded-lg border border-stone-200 bg-white shadow-card">
        <div className="border-b border-stone-200 px-4 py-2.5 sm:px-5">
          <h3 className="ui-title">Nueva Orden de Trabajo</h3>
        </div>

        <section className="space-y-3 border-b border-stone-200 px-4 py-3 sm:px-5" aria-labelledby="ot-data">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 ">
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-1">
                <Field label="Vehiculo *">
                  <Select value={assetId} onChange={e => { setAssetId(e.target.value); setError(null); }}>
                    <option value="">Seleccionar vehiculo...</option>
                    {assets.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </Select>
                </Field>
                <Field label="Prioridad *">
                  <Select value={priority} onChange={e => setPriority(e.target.value as OTPriority)}>
                    {priorityOrder.map(p => <option key={p} value={p}>{priorityLabels[p]}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Descripcion *">
                <TextArea
                  value={description}
                  onChange={e => { setDescription(e.target.value); setError(null); }}
                  rows={3}
                  placeholder="Describe el trabajo a realizar..."
                />
              </Field>
            </div>

            <Field label="Archivos">
              <PhotoCarousel
                photos={photos}
                canEdit
                busy={photosBusy}
                onAddFiles={files => { void handleAddPhotos(files); }}
                onRemove={photo => { void handleRemovePhoto(photo); }}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-3 px-4 py-3 sm:px-5" aria-labelledby="ot-lines">
          <div className="space-y-3 rounded-md border border-stone-200 bg-stone-50/50 p-3">
            <LineFields draft={draft} asset={assets.find(a => a.id === assetId)} />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="primary" className="min-h-[44px] [@media(pointer:fine)]:min-h-0" onClick={addLine} disabled={!draft.valid} title="Agregar linea de trabajo">
                <Plus size={16} /> Agregar linea de trabajo
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
                    <th className="min-w-[220px]">Linea de trabajo</th>
                    <th className="whitespace-nowrap text-right">Cantidad</th>
                    <th className="whitespace-nowrap">Unidad</th>
                    <th>Producto</th>
                    <th>Observaciones</th>
                    <th className="w-48 whitespace-nowrap text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {/* una fila por repuesto: la linea, su numero y sus acciones ocupan todas las filas de sus repuestos */}
                  {lines.map((line, index) => {
                    const parts = line.parts ?? [];
                    const span = Math.max(parts.length, 1);
                    const actions = (
                      <td rowSpan={span} className="align-middle text-right">
                        <div className="flex flex-row items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            className="min-h-[44px] [@media(pointer:fine)]:min-h-0"
                            onClick={() => setEditingIndex(index)}
                            title="Editar linea"
                            aria-label={`Editar la linea ${line.work}`}
                          >
                            <Edit size={14} /> Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            className="min-h-[44px] [@media(pointer:fine)]:min-h-0"
                            onClick={() => setLines(prev => prev.filter((_, i) => i !== index))}
                            title="Quitar linea"
                            aria-label={`Quitar la linea ${line.work}`}
                          >
                            <Trash2 size={14} /> Eliminar
                          </Button>
                        </div>
                      </td>
                    );
                    const lineCells = (
                      <>
                        <td rowSpan={span} className="align-middle">{index + 1}</td>
                        <td rowSpan={span} className="align-middle">
                          <span className="block font-normal text-stone-800">{line.work}</span>
                        </td>
                      </>
                    );

                    if (parts.length === 0) {
                      return (
                        <tr key={`${index}-${line.work}`}>
                          {lineCells}
                          <td colSpan={4} className="text-stone-500">{line.needsPart ? 'Sin repuestos elegidos' : '--'}</td>
                          {actions}
                        </tr>
                      );
                    }
                    return parts.map((p, i) => (
                      <tr key={`${index}-${p.partId}`}>
                        {i === 0 && lineCells}
                        <td className="text-right font-normal">{p.quantity}</td>
                        <td className="whitespace-nowrap text-stone-600">{p.unit}</td>
                        <td className="font-normal">{p.partDescription}</td>
                        <td className="font-normal">{p.notes ?? ''}</td>
                        {i === 0 && actions}
                      </tr>
                    ));
                  })}
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
          <Button variant="danger" className="min-h-[44px] [@media(pointer:fine)]:min-h-0" onClick={onBack}><X size={16} />Cancelar</Button>
          <Button className="min-h-[44px] [@media(pointer:fine)]:min-h-0" onClick={handleCreate}><Plus size={16} /> Crear</Button>
        </div>
      </div>

      {editingIndex !== null && lines[editingIndex] && (
        <EditDraftLineModal
          line={lines[editingIndex]}
          asset={assets.find(a => a.id === assetId)}
          onSave={updated => setLines(prev => prev.map((l, i) => (i === editingIndex ? updated : l)))}
          onClose={() => setEditingIndex(null)}
        />
      )}
    </div>
  );
}

/**
 * Editar una linea de la OT que se esta creando: el mismo formulario completo de "Agregar linea" (tipo de trabajo,
 * columnas del plan, repuestos y observaciones). La OT todavia no existe, asi que solo cambia la lista de esta pagina.
 */
function EditDraftLineModal({ line, asset, onSave, onClose }: {
  line: NewOTLine;
  asset?: Asset;
  onSave: (updated: NewOTLine) => void;
  onClose: () => void;
}) {
  const { workTypes, maintenancePlans } = useApp();
  const confirm = useConfirm();
  const toast = useToast();
  // la linea conserva a su tecnico: el formulario solo arma de nuevo el trabajo, los repuestos y las observaciones
  const draft = useLineDraft(line.technician);

  useEffect(() => {
    draft.setSelection(selectionFromLine(workTypes, maintenancePlans, line));
    // una linea de texto libre no tiene ruta en el plan: lo que se guardo como trabajo es el texto mismo
    draft.setFreeText(line.workPath.length === 0 ? line.work : '');
    draft.setNotes(line.notes);
    draft.setParts(line.parts ?? []);
  }, []);

  const handleSave = async () => {
    const updated = draft.build();
    if (!updated) return;
    if (!(await confirm({ title: 'Editar linea', message: '¿Estas seguro de guardar los cambios de esta linea de trabajo?', confirmLabel: 'Guardar cambios' }))) return;
    onSave(updated);
    toast('Linea actualizada correctamente');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Editar linea de trabajo" size="xl">
      <div className="space-y-4">
        <LineFields draft={draft} asset={asset} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="danger" className="min-h-[44px] [@media(pointer:fine)]:min-h-0" onClick={onClose}>
            <X size={14} />
            Cancelar
          </Button>
          <Button className="min-h-[44px] [@media(pointer:fine)]:min-h-0" onClick={handleSave} disabled={!draft.valid}>
            <SaveAllIcon className="w-4 h-4" /> Guardar cambios
          </Button>
        </div>
      </div>
    </Modal>
  );
}

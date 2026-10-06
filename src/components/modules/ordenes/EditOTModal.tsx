import { useEffect, useState } from 'react';
import { useApp } from '@/store/AppContext';
import { useConfirm } from '@/store/ConfirmContext';
import { useToast } from '@/store/ToastContext';
import { Button } from '@/components/ui/Button';
import { Field, Select, TextArea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { PhotoCarousel } from '@/components/ui/PhotoCarousel';
import { fileToCompressedDataUrl } from '@/lib/image';
import { selectionFromLine } from '@/lib/planSelection';
import type { AssetPhoto, OTLine, OTPriority, WorkOrder } from '@/types';
import { SaveAllIcon, X } from 'lucide-react';
import { LineFields, useLineDraft } from './LineForm';
import { priorityLabels } from './otMeta';

const priorityOrder: OTPriority[] = ['baja', 'media', 'alta', 'critica'];

/**
 * Jefe de Taller: edita una OT ya creada con el MISMO formulario completo de "Nueva OT" (vehiculo, prioridad,
 * descripcion, fotos y cada linea con su tipo de trabajo/repuestos), en un unico modal -- en vez de un modal
 * chico para la cabecera y botones "Editar" sueltos por linea. El vehiculo queda bloqueado porque cambiarlo
 * invalidaria el tipo de trabajo/plan ya inferido en las lineas existentes.
 */
export function EditOTModal({ ot, onClose }: { ot: WorkOrder; onClose: () => void }) {
  const { updateWorkOrder, addOTPhoto, removeOTPhoto } = useApp();
  const confirm = useConfirm();
  const toast = useToast();
  const [description, setDescription] = useState(ot.description);
  const [priority, setPriority] = useState<OTPriority>(ot.priority);
  const [error, setError] = useState<string | null>(null);
  const [photosBusy, setPhotosBusy] = useState(false);
  const unchanged = description.trim() === ot.description && priority === ot.priority;

  const handleSaveHeader = async () => {
    if (!(await confirm({ title: 'Editar OT', message: '¿Estas seguro de guardar los cambios de esta OT?', confirmLabel: 'Guardar cambios' }))) return;
    const result = updateWorkOrder(ot.id, { description, priority });
    if (result) setError(result);
    else { setError(null); toast(`${ot.code} actualizada correctamente`); }
  };

  // evidencia a nivel de OT: la OT ya existe, asi que cada foto se guarda de una (igual que en "Agregar linea")
  const handleAddPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhotosBusy(true);
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await fileToCompressedDataUrl(file);
        addOTPhoto(ot.id, { dataUrl, name: file.name });
      } catch {
        // archivo invalido: se omite
      }
    }
    setPhotosBusy(false);
  };

  const handleRemovePhoto = async (photo: AssetPhoto) => {
    if (await confirm({ title: 'Eliminar fotografia', message: '¿Estas seguro de eliminar esta fotografia?', confirmLabel: 'Eliminar', variant: 'danger' })) {
      removeOTPhoto(ot.id, photo.id);
      toast({ message: 'Fotografia eliminada', variant: 'info' });
    }
  };

  return (
    <Modal open onClose={onClose} title={`Editar ${ot.code}`} size="xl">
      <div className="space-y-5">
        <section className="space-y-3">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Vehiculo">
                  <Select value={ot.assetId} disabled>
                    <option value={ot.assetId}>{ot.assetCode} - {ot.assetName}</option>
                  </Select>
                </Field>
                <Field label="Prioridad *">
                  <Select value={priority} onChange={e => { setPriority(e.target.value as OTPriority); setError(null); }}>
                    {priorityOrder.map(p => <option key={p} value={p}>{priorityLabels[p]}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Descripcion *">
                <TextArea value={description} onChange={e => { setDescription(e.target.value); setError(null); }} rows={3} />
              </Field>
            </div>

            <Field label="Archivos">
              <PhotoCarousel
                photos={ot.photos ?? []}
                canEdit
                busy={photosBusy}
                onAddFiles={files => { void handleAddPhotos(files); }}
                onRemove={photo => { void handleRemovePhoto(photo); }}
              />
            </Field>
          </div>

          {error && <p role="alert" className="text-content text-red-700">{error}</p>}
          <div className="flex justify-end">
            <Button size="sm" className="min-h-[44px] sm:min-h-0" onClick={handleSaveHeader} disabled={unchanged || !description.trim()}>
              <SaveAllIcon className="w-4 h-4" /> Guardar cambios
            </Button>
          </div>
        </section>

        <section className="space-y-3 border-t border-stone-200 pt-4">
          <h4 className="ui-subtitle">Lineas de trabajo</h4>
          {ot.lines.length === 0 ? (
            <p className="rounded-md border border-dashed border-stone-200 py-3 text-center text-content text-stone-500">Sin lineas de trabajo.</p>
          ) : (
            <div className="space-y-3">
              {ot.lines.map(line => <OTLineEditSection key={line.id} ot={ot} line={line} />)}
            </div>
          )}
        </section>

        <div className="flex justify-end gap-2 border-t border-stone-200 pt-3">
          <Button variant="outline" className="min-h-[44px] sm:min-h-0" onClick={onClose}>
            <X size={14} /> Cerrar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Una linea de la OT, editable en el mismo lugar (reusa LineFields: tipo de trabajo, repuestos y observaciones).
 * Cada linea se guarda por separado (sigue llamando a updateOTLine/setLineParts igual que antes), asi que una
 * linea con repuestos ya entregados puede seguir viendose aqui, pero al guardar conserva el mismo bloqueo de
 * siempre si se intentan cambiar esos repuestos.
 */
function OTLineEditSection({ ot, line }: { ot: WorkOrder; line: OTLine }) {
  const { assets, workTypes, maintenancePlans, updateOTLine, setLineParts } = useApp();
  const confirm = useConfirm();
  const toast = useToast();
  const draft = useLineDraft(line.technician);
  const asset = assets.find(a => a.id === ot.assetId);
  const [error, setError] = useState<string | null>(null);
  const partsUnchanged = JSON.stringify(draft.parts.map(p => [p.partId, p.quantity])) === JSON.stringify(line.parts.map(p => [p.partId, p.quantity]));

  useEffect(() => {
    draft.setSelection(selectionFromLine(workTypes, maintenancePlans, line));
    draft.setNotes(line.notes);
    draft.setParts(line.parts);
    // solo al abrir: no queremos pisar lo que el usuario va editando
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    const work = draft.build();
    if (!work) return;
    if (!(await confirm({ title: 'Editar linea', message: '¿Estas seguro de guardar los cambios de esta linea de trabajo?', confirmLabel: 'Guardar cambios' }))) return;
    if (!partsUnchanged) {
      const result = setLineParts(ot.id, line.id, draft.parts);
      if (result) { setError(result); return; }
    }
    setError(null);
    updateOTLine(ot.id, line.id, { work: work.work, workPath: work.workPath, activities: work.activities, notes: draft.notes.trim() });
    toast('Linea actualizada correctamente');
  };

  return (
    <div className="space-y-3 rounded-md border border-stone-200 bg-stone-50/50 p-3">
      <p className="text-content font-bold text-stone-700">{line.work}</p>
      <LineFields draft={draft} asset={asset} />
      {error && <p role="alert" className="text-content text-red-700">{error}</p>}
      <div className="flex justify-end">
        <Button size="sm" className="min-h-[44px] sm:min-h-0" onClick={handleSave} disabled={!draft.valid}>
          <SaveAllIcon className="w-4 h-4" /> Guardar linea
        </Button>
      </div>
    </div>
  );
}

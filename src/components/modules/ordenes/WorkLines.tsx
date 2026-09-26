import { useRef, useState } from 'react';
import { useApp, type PhotoGroup } from '@/store/AppContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, TextInput, Select, TextArea } from '@/components/ui/Field';
import type { OTActivity, OTLine, OTLinePart, OTLinePhoto, OTLineStatus, WorkOrder } from '@/types';
import { fileToCompressedDataUrl } from '@/lib/image';
import { emptyPlanSelection, planSelectionResult, type PlanSelection } from '@/lib/planSelection';
import { EditLineWorkModal, PlanPicker } from './PlanPicker';
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Play,
  Square,
  Camera,
  X,
  AlertTriangle,
  Flag,
  CheckCircle,
  XCircle,
  Upload,
  PenTool,
} from 'lucide-react';
import {
  isRequisitionComplete,
  isRequisitionRequester,
  missingSteps,
  requiresRequisition,
  requisitionStepLabels,
  signatureFor,
  signaturesOf,
} from '@/lib/requisition';
import { RequisitionProgress } from './RequisitionProgress';
import { RequisitionPdfButton } from './RequisitionPdfButton';
import {
  formatDateTime,
  findingStatusLabels,
  findingStatusVariants,
  lineStatusLabels,
  lineStatusVariants,
} from './otMeta';

/**
 * canAdd: puede crear lineas nuevas.
 * canEdit: puede editar o eliminar lineas ya creadas (tecnico, actividades, observaciones, repuestos sin firmar).
 * canExecute: puede ejecutarlas (responsable, estado, horas, actividades completadas, evidencias, repuestos).
 */
export function WorkLinesSection({ ot, canAdd, canEdit, canExecute }: {
  ot: WorkOrder;
  canAdd: boolean;
  canEdit: boolean;
  canExecute: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [lightbox, setLightbox] = useState<OTLinePhoto | null>(null);
  const { addOTLine, currentUser, currentRole, storageWarning, dismissStorageWarning } = useApp();
  const canAddLines = canAdd;
  // se propone al tecnico asignado; si no hay, el propio tecnico que crea la linea
  const defaultTechnician = ot.assignedToType === 'tecnico' && ot.assignedTo
    ? ot.assignedTo
    : (currentRole === 'tecnico' ? currentUser : '');

  return (
    <div className="px-4 sm:px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h4 className="font-heading text-sm font-bold text-stone-700">Lineas de Trabajo</h4>
          {/* <p className="text-xs text-stone-400 mt-0.5">
            Cada linea es una unidad independiente de ejecucion y trazabilidad
          </p> */}
        </div>
        {canAddLines && (
          <Button size="sm" variant="outline" onClick={() => setShowAddModal(true)}>
            <Plus size={14} /> Agregar linea de trabajo
          </Button>
        )}
      </div>

      {storageWarning && (
        <div className="mb-3 flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
          <AlertTriangle size={14} className="text-yellow-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-yellow-800 flex-1">{storageWarning}</p>
          <button onClick={dismissStorageWarning} className="text-yellow-600 hover:text-yellow-800">
            <X size={14} />
          </button>
        </div>
      )}

      {ot.lines.length === 0 ? (
        <div className="text-center py-6 text-stone-400 text-sm border border-dashed border-stone-200 rounded-md">
          Sin lineas de trabajo {canAddLines ? '' : ''}
        </div>
      ) : (
        <div className="space-y-2">
          {ot.lines.map(line => (
            <LineAccordion
              key={line.id}
              ot={ot}
              line={line}
              expanded={expandedId === line.id}
              onToggle={() => setExpandedId(expandedId === line.id ? null : line.id)}
              canEdit={canEdit}
              canExecute={canExecute}
              onOpenPhoto={setLightbox}
            />
          ))}
        </div>
      )}

      <AddLineModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        defaultTechnician={defaultTechnician}
        onAdd={(line) => addOTLine(ot.id, line)}
      />

      {lightbox && <PhotoLightbox photo={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

function LineAccordion({ ot, line, expanded, onToggle, canEdit, canExecute, onOpenPhoto }: {
  ot: WorkOrder;
  line: OTLine;
  expanded: boolean;
  onToggle: () => void;
  canEdit: boolean;
  canExecute: boolean;
  onOpenPhoto: (p: OTLinePhoto) => void;
}) {
  const { updateOTLine, deleteOTLine, startLine, finishLine, reviewFinding, signRequisition, hasPermission, currentUser } = useApp();
  const [editingWork, setEditingWork] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  // los hallazgos que ya estaban registrados los sigue revisando el Jefe de Taller
  const canReviewFinding = hasPermission('ot.lineas.aprobarHallazgo') && line.isFinding && line.findingStatus === 'pendiente';
  // lineas anteriores a las actividades no traen el campo
  const activities = line.activities ?? [];
  // requisa de repuestos: firma primero el tecnico de la linea (solicitante); la linea inicia con todas las firmas
  const needsRequisition = requiresRequisition(line);
  const requesterSigned = Boolean(signatureFor(line, 'solicitante'));
  const canRequest = hasPermission('requisa.solicitar')
    && isRequisitionRequester(line, ot.assignedTo, currentUser)
    && ot.status !== 'finalizada' && ot.status !== 'cerrada';
  const requisitionDone = isRequisitionComplete(line);
  const hasSignatures = signaturesOf(line).length > 0;
  const pendingSignatures = missingSteps(line).map(step => requisitionStepLabels[step]);
  const hasPhotos = line.photosBefore.length + line.photosAfter.length > 0;
  const showActions = (canExecute || (needsRequisition && canRequest)) && (!line.startedAt || !line.finishedAt);

  return (
    <div className={`border rounded-md transition-colors ${expanded ? 'border-orange-300 bg-orange-50/20' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
      <button
        onClick={onToggle}
        className="w-full flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 min-w-0 w-full sm:w-auto sm:flex-1">
          {expanded ? <ChevronDown size={16} className="text-stone-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-stone-400 flex-shrink-0" />}
          <span className="text-sm font-medium text-stone-800 truncate">{line.work}</span>
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-3 border-t border-stone-200/70 space-y-4">
          {canReviewFinding && (
            <div className="flex flex-wrap items-center gap-2 p-2 rounded-md border bg-orange-50 border-orange-100">
              <Flag size={14} className="text-orange-600" />
              <Badge variant={findingStatusVariants[line.findingStatus]}>{findingStatusLabels[line.findingStatus]}</Badge>
              <span className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="primary" onClick={() => reviewFinding(ot.id, line.id, true)}>
                  <CheckCircle size={12} /> Aprobar hallazgo
                </Button>
                <Button size="sm" variant="danger" onClick={() => reviewFinding(ot.id, line.id, false)}>
                  <XCircle size={12} /> Rechazar
                </Button>
              </span>
            </div>
          )}

          {/* Responsable, estado y acciones en una sola fila */}
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <Field label="Tecnico" className="min-w-[10rem] flex-1 sm:w-56 sm:flex-none">
              {canEdit ? (
                <TextInput value={line.technician} onChange={e => updateOTLine(ot.id, line.id, { technician: e.target.value })} />
              ) : (
                <p className="text-sm text-stone-800 py-2">{line.technician || '--'}</p>
              )}
            </Field>
            <div className="flex flex-wrap items-center gap-2 pb-2">
              <Badge variant={lineStatusVariants[line.status]}>{lineStatusLabels[line.status]}</Badge>
              {line.startedAt && (
                <span className="text-xs text-stone-500">
                  Inicio {formatDateTime(line.startedAt)}{line.finishedAt ? ` · Fin ${formatDateTime(line.finishedAt)}` : ''}
                </span>
              )}
            </div>
            {showActions && (
              <span className="ml-auto flex items-center gap-2">
                {/* solo el tecnico de la linea firma la solicitud; quien supervisa no la firma por el */}
                {!line.startedAt && needsRequisition && !requesterSigned && canRequest && (
                  <Button
                    size="sm"
                    variant="primary"
                    className="min-h-[44px] sm:min-h-0"
                    onClick={() => setSignError(signRequisition(ot.id, line.id, 'solicitante'))}
                  >
                    <PenTool size={12} /> Firmar
                  </Button>
                )}
                {/* tras firmar, Iniciar queda deshabilitado hasta reunir las demas firmas */}
                {!line.startedAt && needsRequisition && requesterSigned && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="min-h-[44px] sm:min-h-0"
                    disabled={!requisitionDone || !canExecute}
                    title={
                      !requisitionDone
                        ? `Faltan firmas: ${pendingSignatures.join(', ')}`
                        : !canExecute ? 'La OT debe estar aprobada y asignada al tecnico para iniciar la linea.' : undefined
                    }
                    onClick={() => startLine(ot.id, line.id)}
                  >
                    <Play size={12} /> Iniciar
                  </Button>
                )}
                {!line.startedAt && !needsRequisition && canExecute && (
                  <Button size="sm" variant="secondary" className="min-h-[44px] sm:min-h-0" onClick={() => startLine(ot.id, line.id)}>
                    <Play size={12} /> Iniciar
                  </Button>
                )}
                {line.startedAt && !line.finishedAt && canExecute && (
                  <Button size="sm" variant="primary" className="min-h-[44px] sm:min-h-0" onClick={() => finishLine(ot.id, line.id)}>
                    <Square size={12} /> Finalizar
                  </Button>
                )}
              </span>
            )}
          </div>
          {signError && <p role="alert" className="text-xs text-red-700">{signError}</p>}

          {/* Actividades del plan: solo las edita quien puede editar lineas */}
          {(activities.length > 0 || canEdit) && (
            <div className="border-t border-stone-200/70 pt-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Actividades</p>
                {canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => setEditingWork(true)}>
                    <Pencil size={12} /> Editar actividades
                  </Button>
                )}
              </div>
              {activities.length === 0 ? (
                <p className="text-xs text-stone-400">Sin actividades registradas.</p>
              ) : (
                <ul className="list-disc pl-5 space-y-1 text-sm text-stone-700">
                  {activities.map((activity, index) => <li key={`${activity.name}-${index}`}>{activity.name}</li>)}
                </ul>
              )}
            </div>
          )}

          {line.parts.length > 0 && <LineParts ot={ot} line={line} canRemove={canEdit && !hasSignatures} />}

          {/* Evidencias: solo si hay fotos o quien ejecuta puede agregarlas */}
          {(hasPhotos || canExecute) && (
            <div className="border-t border-stone-200/70 pt-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Evidencias</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EvidenceGroup ot={ot} line={line} group="before" title="Antes" canEdit={canExecute} onOpenPhoto={onOpenPhoto} />
                <EvidenceGroup ot={ot} line={line} group="after" title="Despues" canEdit={canExecute} onOpenPhoto={onOpenPhoto} />
              </div>
            </div>
          )}

          {(canEdit || line.notes) && (
            <div className="border-t border-stone-200/70 pt-3">
              <Field label="Observaciones">
                {canEdit ? (
                  <TextArea
                    rows={2}
                    value={line.notes}
                    onChange={e => updateOTLine(ot.id, line.id, { notes: e.target.value })}
                    placeholder="Recomendaciones o pendientes de esta linea..."
                  />
                ) : (
                  <p className="text-sm text-stone-700 whitespace-pre-wrap">{line.notes}</p>
                )}
              </Field>
            </div>
          )}

          {canEdit && (
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => deleteOTLine(ot.id, line.id)}>
                <Trash2 size={12} /> Eliminar linea
              </Button>
            </div>
          )}
        </div>
      )}

      {editingWork && (
        <EditLineWorkModal
          line={line}
          onClose={() => setEditingWork(false)}
          onSave={patch => {
            updateOTLine(ot.id, line.id, patch);
            setEditingWork(false);
          }}
        />
      )}
    </div>
  );
}

/** Repuestos de la linea junto con el avance de su requisa; quien edita lineas puede quitarlos mientras no haya firmas */
function LineParts({ ot, line, canRemove }: { ot: WorkOrder; line: OTLine; canRemove: boolean }) {
  const { removeLinePart } = useApp();

  return (
    <div className="border-t border-stone-200/70 pt-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Repuestos</p>
        <RequisitionPdfButton ot={ot} line={line} />
      </div>
      <ul className="space-y-1">
        {line.parts.map(p => (
          <li key={p.partId} className="flex items-center gap-2 text-sm text-stone-700">
            <span className="w-10 flex-shrink-0 text-right font-medium">{p.quantity} x</span>
            <span className="min-w-0 flex-1 truncate">{p.partDescription}</span>
            <span className="flex-shrink-0 text-xs text-stone-400">{p.partCode}</span>
            {canRemove && (
              <button
                onClick={() => removeLinePart(ot.id, line.id, p.partId)}
                className="text-stone-400 hover:text-red-600 transition-colors flex-shrink-0"
                title="Quitar repuesto"
                aria-label={`Quitar ${p.partDescription}`}
              >
                <Trash2 size={12} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {requiresRequisition(line) && (
        <div className="flex flex-wrap items-center gap-2">
          {line.requisition && <span className="text-xs font-semibold text-blue-700">{line.requisition.code}</span>}
          <RequisitionProgress line={line} />
        </div>
      )}
    </div>
  );
}

function EvidenceGroup({ ot, line, group, title, canEdit, onOpenPhoto }: {
  ot: WorkOrder;
  line: OTLine;
  group: PhotoGroup;
  title: string;
  canEdit: boolean;
  onOpenPhoto: (p: OTLinePhoto) => void;
}) {
  const { addLinePhoto, removeLinePhoto } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const photos = group === 'before' ? line.photosBefore : line.photosAfter;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await fileToCompressedDataUrl(file);
        addLinePhoto(ot.id, line.id, group, { dataUrl, name: file.name });
      } catch {
        // archivo no valido: se ignora y se continua con el resto
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-bold text-stone-700">
          {title} {photos.length > 0 && <span className="font-normal text-stone-400">({photos.length})</span>}
        </p>
        {canEdit && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => cameraRef.current?.click()}
              disabled={busy}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-2 sm:py-0.5 rounded text-xs sm:text-[11px] font-medium text-stone-500 hover:text-orange-600 hover:bg-orange-50 transition-colors disabled:opacity-50"
              title="Tomar fotografia con la camara"
            >
              <Camera size={12} /> 
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex items-center gap-1 px-2.5 py-1.5 sm:px-2 sm:py-0.5 rounded text-xs sm:text-[11px] font-medium text-stone-500 hover:text-orange-600 hover:bg-orange-50 transition-colors disabled:opacity-50"
              title="Subir imagenes desde el dispositivo"
            >
              <Upload size={12} />
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {photos.map(photo => (
          <div key={photo.id} className="relative group w-16 h-16">
            <button
              onClick={() => onOpenPhoto(photo)}
              className="w-16 h-16 rounded-md overflow-hidden border border-stone-300 bg-stone-100 hover:border-orange-400 transition-colors"
              title={`${photo.name} - ${formatDateTime(photo.addedAt)}`}
            >
              <img src={photo.dataUrl} alt={photo.name} className="w-full h-full object-cover" />
            </button>
            {canEdit && (
              <button
                onClick={() => removeLinePhoto(ot.id, line.id, group, photo.id)}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity shadow-sm"
                title="Eliminar fotografia"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}

        {canEdit && (
          <>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => { void handleFiles(e.target.files); }}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { void handleFiles(e.target.files); }}
            />
          </>
        )}

        {photos.length === 0 && (
          <p className="text-xs text-stone-400">Sin fotos</p>
        )}
      </div>
    </div>
  );
}

type NewLine = {
  status: OTLineStatus;
  technician: string;
  notes: string;
  needsPart: boolean;
  isFinding: boolean;
  parts: OTLinePart[];
  photosBefore: { dataUrl: string; name: string }[];
};

type NewLinePayload = NewLine & { work: string; workPath: string[]; activities: OTActivity[] };

function emptyLineForm(technician: string): NewLine {
  return {
    // la linea siempre nace pendiente: se ejecuta despues
    status: 'pendiente',
    technician,
    notes: '',
    needsPart: false,
    isFinding: false,
    parts: [],
    photosBefore: [],
  };
}

function AddLineModal({ open, onClose, onAdd, defaultTechnician }: {
  open: boolean;
  onClose: () => void;
  onAdd: (line: NewLinePayload) => void;
  defaultTechnician: string;
}) {
  const { parts: inventory, workTypes, maintenancePlans, hasPermission } = useApp();
  const canPickParts = hasPermission('repuestos.consumir');
  const [form, setForm] = useState<NewLine>(() => emptyLineForm(defaultTechnician));
  const [selection, setSelection] = useState<PlanSelection>(() => emptyPlanSelection());
  const [freeText, setFreeText] = useState('');
  const [pickPartId, setPickPartId] = useState('');
  const [pickQty, setPickQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const picked = inventory.find(p => p.id === pickPartId);
  const alreadyPicked = form.parts.find(p => p.partId === pickPartId)?.quantity ?? 0;
  const insufficient = Boolean(picked && alreadyPicked + pickQty > picked.currentStock);
  const workResult = planSelectionResult(workTypes, maintenancePlans, selection, freeText);

  const resetForm = () => {
    setForm(emptyLineForm(defaultTechnician));
    setSelection(emptyPlanSelection());
    setFreeText('');
    setPickPartId('');
    setPickQty(1);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const addPickedPart = () => {
    if (!picked || pickQty <= 0 || insufficient) return;
    setForm(prev => {
      const existing = prev.parts.find(p => p.partId === picked.id);
      const parts = existing
        ? prev.parts.map(p => (p.partId === picked.id ? { ...p, quantity: p.quantity + pickQty } : p))
        : [...prev.parts, {
            partId: picked.id,
            partCode: picked.code,
            partDescription: picked.description,
            quantity: pickQty,
            unitCost: picked.unitCost,
          }];
      return { ...prev, parts };
    });
    setPickPartId('');
    setPickQty(1);
  };

  const removePickedPart = (partId: string) => {
    setForm(prev => ({ ...prev, parts: prev.parts.filter(p => p.partId !== partId) }));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await fileToCompressedDataUrl(file);
        setForm(prev => ({ ...prev, photosBefore: [...prev.photosBefore, { dataUrl, name: file.name }] }));
      } catch {
        // archivo no valido: se omite y se continua con el resto
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    setForm(prev => ({ ...prev, photosBefore: prev.photosBefore.filter((_, i) => i !== index) }));
  };

  const handleSubmit = () => {
    if (!workResult.valid) return;
    // los repuestos elegidos solo cuentan si "Requiere repuesto" sigue marcado
    onAdd({
      ...form,
      work: workResult.work,
      workPath: workResult.workPath,
      activities: workResult.activities,
      parts: form.needsPart ? form.parts : [],
    });
    resetForm();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Agregar Linea de Trabajo" size="lg">
      <div className="space-y-4">
        <PlanPicker value={selection} onChange={setSelection} freeText={freeText} onFreeTextChange={setFreeText} />

        <Field label="Tecnico responsable">
          <TextInput value={form.technician} onChange={e => setForm({ ...form, technician: e.target.value })} />
        </Field>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.needsPart}
              onChange={e => setForm({ ...form, needsPart: e.target.checked })}
              className="rounded border-stone-300 text-orange-500 focus:ring-orange-300"
            />
            Requiere repuesto
          </label>

          {form.needsPart && (
            canPickParts ? (
              <div className="p-3 rounded-md border border-stone-200 bg-stone-50/60 space-y-2">
                {inventory.length === 0 ? (
                  <p className="text-xs text-stone-500">No hay repuestos en el inventario.</p>
                ) : (
                  <div className="flex items-end gap-2 flex-wrap">
                    <Field label="Repuesto" className="flex-1 min-w-[200px]">
                      <Select value={pickPartId} onChange={e => setPickPartId(e.target.value)}>
                        <option value="">Seleccionar repuesto...</option>
                        {inventory.map(p => (
                          <option key={p.id} value={p.id}>{p.code} - {p.description} (Stock: {p.currentStock})</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Cantidad" className="w-24">
                      <TextInput type="number" min={1} value={pickQty} onChange={e => setPickQty(Number(e.target.value))} />
                    </Field>
                    <Button size="sm" variant="outline" onClick={addPickedPart} disabled={!picked || pickQty <= 0 || insufficient}>
                      <Plus size={12} /> Agregar
                    </Button>
                  </div>
                )}

                {insufficient && picked && (
                  <div className="flex items-center gap-1.5 text-xs text-red-700">
                    <AlertTriangle size={12} /> Stock insuficiente. Disponible: {picked.currentStock - alreadyPicked}
                  </div>
                )}

                {form.parts.length > 0 && (
                  <div className="space-y-1">
                    {form.parts.map(p => (
                      <div key={p.partId} className="flex items-center gap-2 text-xs bg-white border border-stone-200 rounded px-2 py-1.5">
                        <span className="font-mono font-semibold text-blue-700 flex-shrink-0">{p.partCode}</span>
                        <span className="text-stone-700 flex-1 min-w-0 truncate">{p.partDescription}</span>
                        <span className="text-stone-500 flex-shrink-0">x{p.quantity}</span>
                        <button
                          onClick={() => removePickedPart(p.partId)}
                          className="text-stone-400 hover:text-red-600 transition-colors flex-shrink-0"
                          title="Quitar repuesto"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            ) : (
              <p className="text-xs text-stone-400">No tienes permiso para seleccionar repuestos: la linea quedara solo con el aviso.</p>
            )
          )}
        </div>

        <Field label="Observaciones">
          <TextArea
            rows={3}
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Recomendaciones o pendientes..."
          />
        </Field>

        <div>
          <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide mb-2">Evidencia fotografica (opcional)</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button size="sm" variant="outline" onClick={() => cameraRef.current?.click()} disabled={busy}>
              <Camera size={14} /> 
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload size={14} /> {busy ? 'Cargando...' : ''}
            </Button>
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => { void handleFiles(e.target.files); }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => { void handleFiles(e.target.files); }}
          />

          {form.photosBefore.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3">
              {form.photosBefore.map((photo, index) => (
                <div key={`${photo.name}-${index}`} className="relative w-20 h-20">
                  <img
                    src={photo.dataUrl}
                    alt={photo.name}
                    className="w-full h-full object-cover rounded-md border border-stone-300 bg-stone-100"
                  />
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm"
                    title="Quitar fotografia"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!workResult.valid}><Plus size={16} /> Agregar linea</Button>
        </div>
      </div>
    </Modal>
  );
}

function PhotoLightbox({ photo, onClose }: { photo: OTLinePhoto; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-stone-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <div className="text-white">
            <p className="text-sm font-medium">{photo.name}</p>
            <p className="text-xs text-stone-300">{formatDateTime(photo.addedAt)}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X size={22} />
          </button>
        </div>
        <img src={photo.dataUrl} alt={photo.name} className="rounded-lg max-h-[75vh] object-contain bg-stone-900" />
      </div>
    </div>
  );
}

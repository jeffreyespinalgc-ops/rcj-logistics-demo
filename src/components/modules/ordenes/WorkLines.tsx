import { useRef, useState } from 'react';
import { useApp, type NewOTLine, type PhotoGroup } from '@/store/AppContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Select, TextArea } from '@/components/ui/Field';
import type { OTLine, OTLinePart, OTLinePhoto, OTPriority, WorkOrder } from '@/types';
import { fileToCompressedDataUrl } from '@/lib/image';
import { EditLineWorkModal } from './PlanPicker';
import { LineFields, PartsEditor, useLineDraft } from './LineForm';
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
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
  isDelivered,
  isPartial,
  isRequisitionRequester,
  quantityLabel,
  requiresRequisition,
  requisitionSignLabels,
  signableSteps,
  signaturesOf,
} from '@/lib/requisition';
import { RequisitionProgress } from './RequisitionProgress';
import { RequisitionDocumentButton } from './RequisitionDocument';
import {
  formatDateTime,
  findingStatusLabels,
  findingStatusVariants,
  lineStatusLabels,
  lineStatusVariants,
  priorityLabels,
} from './otMeta';

const priorityOrder: OTPriority[] = ['baja', 'media', 'alta', 'critica'];

export function WorkLinesSection({ ot, canAdd, canEdit, canExecute, canFinalize, finalizeBlockedReason, onFinalize }: {
  ot: WorkOrder;
  canAdd: boolean;
  canEdit: boolean;
  canExecute: boolean;
  canFinalize: boolean;
  finalizeBlockedReason: string | null;
  onFinalize: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [lightbox, setLightbox] = useState<OTLinePhoto | null>(null);
  const { addOTLine, currentUser, currentRole, storageWarning, dismissStorageWarning } = useApp();
  // se propone al tecnico asignado (o al taller externo, si la OT se asigno a uno: asi queda registrado
  // de forma automatica quien hizo la linea sin que haya que escribirlo a mano); sin asignacion, el propio
  // tecnico que crea la linea
  const defaultTechnician = ot.assignedTo && (ot.assignedToType === 'tecnico' || ot.assignedToType === 'taller_externo')
    ? ot.assignedTo
    : (currentRole === 'tecnico' ? currentUser : '');
  // una sola requisa por OT: un solo boton de "Ver documento" arriba, no uno por linea
  const requisitionLine = ot.lines.find(requiresRequisition);

  return (
    <div className="px-4 sm:px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h4 className="ui-subtitle">Lineas de trabajo</h4>
        <div className="flex items-center gap-2 flex-wrap">
          {(canFinalize || finalizeBlockedReason) && (
            <Button
              size="sm"
              className="min-h-[44px] sm:min-h-0"
              disabled={!canFinalize}
              title={finalizeBlockedReason ?? undefined}
              onClick={onFinalize}
            >
              <PenTool size={14} /> Finalizar OT
            </Button>
          )}
          {requisitionLine && <RequisitionDocumentButton ot={ot} line={requisitionLine} />}
          {canAdd && (
            <Button size="sm" variant="primary" className="min-h-[44px] sm:min-h-0" onClick={() => setShowAddModal(true)}>
              <Plus size={14} />
            </Button>
          )}
        </div>
      </div>

      {storageWarning && (
        <div className="mb-3 flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
          <AlertTriangle size={14} className="text-yellow-600 mt-0.5 flex-shrink-0" />
          <p className="text-content text-yellow-800 flex-1">{storageWarning}</p>
          <button onClick={dismissStorageWarning} className="text-yellow-600 hover:text-yellow-800">
            <X size={14} />
          </button>
        </div>
      )}

      {ot.lines.length === 0 ? (
        <div className="text-center py-6 text-stone-400 text-content border border-dashed border-stone-200 rounded-md">
          Sin lineas de trabajo
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
        onAdd={line => addOTLine(ot.id, line)}
        ot={ot}
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
  const { updateOTLine, deleteOTLine, reviewFinding, signRequisition, hasPermission, currentUser } = useApp();
  const [editingWork, setEditingWork] = useState(false);
  const [editingParts, setEditingParts] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const canReviewFinding = hasPermission('ot.lineas.aprobarHallazgo') && line.isFinding && line.findingStatus === 'pendiente'
    && ot.status !== 'cerrada' && ot.status !== 'rechazada';
  const activities = line.activities ?? [];
  const needsRequisition = requiresRequisition(line);
  const delivered = isDelivered(line);
  // el tecnico de la linea firma "Solicitado por" (si aun no lo hizo) y "Recibido por" (cuando Control ya entrego)
  const canSignAsTechnician = hasPermission('requisa.solicitar')
    && isRequisitionRequester(line, ot.assignedTo, currentUser)
    && ot.status !== 'finalizada' && ot.status !== 'cerrada' && ot.status !== 'rechazada';
  const signStep = needsRequisition && !line.startedAt
    ? signableSteps(line, { requester: canSignAsTechnician, autoriza: false, despacha: false })[0]
    : undefined;
  const hasPhotos = line.photosBefore.length + line.photosAfter.length > 0;
  // ya no hay boton "Finalizar" por linea (se resuelve solo con "Finalizar OT"): la unica accion posible
  // aqui es firmar la requisa
  const showActions = Boolean(signStep);

  return (
    <div className={`overflow-hidden rounded-md border transition-colors ${expanded ? 'border-orange-500' : 'border-orange-500/60 hover:border-orange-500'}`}>
      {/* barra del titulo de la linea: naranja solido */}
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 bg-orange-300 px-3 py-2.5 text-left text-black transition-colors hover:bg-orange-300 "
      >
        {expanded ? <ChevronDown size={16} className="flex-shrink-0" /> : <ChevronRight size={16} className="flex-shrink-0" />}
        <span className={`min-w-0 flex-1 text-content font-bold ${expanded ? 'break-words' : 'truncate'}`}>{line.work}</span>
      </button>

      {expanded && (
        <div className="space-y-3 bg-white p-3">
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

          <table className="sap-table">
            <tbody>
              <tr>
                <th scope="row">Estado</th>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={lineStatusVariants[line.status]}>{lineStatusLabels[line.status]}</Badge>
                    {ot.assignedToType === 'taller_externo' && (
                      <Badge variant="gray">Taller externo: {ot.assignedTo}</Badge>
                    )}
                    {showActions && (
                      <span className="ml-auto flex flex-wrap items-center gap-2">
                        {signStep && (
                          <Button
                            size="sm"
                            variant="primary"
                            className="min-h-[44px] sm:min-h-0"
                            onClick={() => setSignError(signRequisition(ot.id, line.id, signStep))}
                          >
                            <PenTool size={12} /> {requisitionSignLabels[signStep]}
                          </Button>
                        )}
                      </span>
                    )}
                  </div>
                  {signError && <p role="alert" className="mt-1 text-content text-red-700">{signError}</p>}
                </td>
              </tr>

              {(activities.length > 0 || canEdit) && (
                <tr>
                  <th scope="row">Actividades</th>
                  <td>
                    {/* contenido a la izquierda y la accion a la derecha (en telefono baja, alineada a la derecha) */}
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      {activities.length === 0 ? (
                        <p className="text-stone-500">Sin actividades registradas.</p>
                      ) : (
                        <ul className="list-disc space-y-1 pl-5">
                          {activities.map((activity, index) => <li key={`${activity.name}-${index}`}>{activity.name}</li>)}
                        </ul>
                      )}
                      {canEdit && (
                        <Button size="sm" variant="primary" className="ml-auto min-h-[44px] whitespace-nowrap sm:min-h-0" onClick={() => setEditingWork(true)}>
                          <Pencil size={15} /> 
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {(line.parts.length > 0 || canEdit) && (
                <tr>
                  <th scope="row">Repuestos</th>
                  <td>
                    {line.parts.length === 0 ? (
                      <p className="text-stone-500">Sin repuestos.</p>
                    ) : (
                      <table className="w-full text-content">
                        <thead>
                          <tr className="text-left text-xs text-stone-600">
                            <th className="pb-1 text-right font-bold">{delivered ? 'Entregado / Solicitado' : 'Cantidad Solicitada'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {line.parts.map(p => (
                            <tr key={p.partId} className="border-t border-stone-100">
                              <td className="py-1 pr-2 font-normal">
                                {p.partDescription} <span className="text-stone-500"> - UND </span>
                                {/* <span className="block text-stone-500">{p.partCode}</span> */}
                              </td>
                              <td className={`py-1 text-right ${isPartial(line, p) ? 'font-bold text-orange-700' : 'font-normal'}`}>
                                {quantityLabel(line, p)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {canEdit && (
                      <div className="mt-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="primary"
                          className="min-h-[44px] whitespace-nowrap sm:min-h-0"
                          disabled={delivered}
                          title={delivered ? 'Control de Inventario ya entrego estos repuestos' : undefined}
                          onClick={() => setEditingParts(true)}
                        >
                          <Pencil size={14} /> {line.parts.length > 0 ? ' ' : ' '}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              )}

              {needsRequisition && (
                <tr>
                  <th scope="row">Requisa</th>
                  <td>
                    <div className="flex flex-wrap items-center gap-2">
                      {line.requisition && <span className="font-normal">{line.requisition.code}</span>}
                      <RequisitionProgress line={line} />
                    </div>
                  </td>
                </tr>
              )}

              {(hasPhotos || canExecute) && (
                <tr>
                  <th scope="row">Evidencia</th>
                  <td>
                    <EvidenceGroup ot={ot} line={line} canEdit={canExecute} onOpenPhoto={onOpenPhoto} />
                  </td>
                </tr>
              )}

              {(canEdit || line.notes) && (
                <tr>
                  <th scope="row">Observaciones</th>
                  <td>
                    {canEdit ? (
                      <TextArea
                        rows={2}
                        aria-label="Observaciones"
                        className="w-full"
                        value={line.notes}
                        onChange={e => updateOTLine(ot.id, line.id, { notes: e.target.value })}
                        placeholder=""
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{line.notes}</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {canEdit && (
            <div className="flex justify-end">
              <Button size="sm" variant="danger" className="min-h-[44px] sm:min-h-0" onClick={() => deleteOTLine(ot.id, line.id)}>
                <Trash2 size={12} />
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

      {editingParts && <EditPartsModal ot={ot} line={line} onClose={() => setEditingParts(false)} />}
    </div>
  );
}

/** Jefe de Taller: agregar, quitar o cambiar la cantidad de los repuestos de la linea (antes de que Control los entregue) */
function EditPartsModal({ ot, line, onClose }: { ot: WorkOrder; line: OTLine; onClose: () => void }) {
  const { setLineParts } = useApp();
  const [parts, setParts] = useState<OTLinePart[]>(line.parts);
  const [error, setError] = useState<string | null>(null);
  const unchanged = JSON.stringify(parts.map(p => [p.partId, p.quantity])) === JSON.stringify(line.parts.map(p => [p.partId, p.quantity]));

  const handleSave = () => {
    const result = setLineParts(ot.id, line.id, parts);
    if (result) setError(result);
    else onClose();
  };

  return (
    <Modal open onClose={onClose} title="Editar repuestos de la linea" size="lg">
      <div className="space-y-4">
        <p className="text-content text-stone-600">{line.work}</p>
        <PartsEditor value={parts} onChange={next => { setParts(next); setError(null); }} />
        {signaturesOf(line).length > 0 && (
          <p className="rounded-md border border-stone-200 bg-stone-50 p-2.5 text-content text-stone-600">
          </p>
        )}
        {error && <p role="alert" className="text-content text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" className="min-h-[44px] sm:min-h-0" onClick={onClose}>Cancelar</Button>
          <Button className="min-h-[44px] sm:min-h-0" onClick={handleSave} disabled={unchanged}>Guardar cambios</Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Fotografias de la linea (la "Evidencia"). Las nuevas siempre se guardan en el grupo "antes"; las de "despues"
 * de lineas anteriores se siguen mostrando aqui para no perderlas de vista.
 */
function EvidenceGroup({ ot, line, canEdit, onOpenPhoto }: {
  ot: WorkOrder;
  line: OTLine;
  canEdit: boolean;
  onOpenPhoto: (p: OTLinePhoto) => void;
}) {
  const { addLinePhoto, removeLinePhoto } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const photos: { photo: OTLinePhoto; group: PhotoGroup }[] = [
    ...line.photosBefore.map(photo => ({ photo, group: 'before' as const })),
    ...line.photosAfter.map(photo => ({ photo, group: 'after' as const })),
  ];

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await fileToCompressedDataUrl(file);
        addLinePhoto(ot.id, line.id, 'before', { dataUrl, name: file.name });
      } catch {
        // una imagen que no se pudo leer se omite; las demas se siguen guardando
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  return (
    // fotos a la izquierda y los botones para agregar a la derecha (en telefono los botones bajan, alineados a la derecha)
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {photos.map(({ photo, group }) => (
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
                aria-label={`Eliminar ${photo.name}`}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            className="min-h-[44px] sm:min-h-0"
            onClick={() => cameraRef.current?.click()}
            disabled={busy}
            title="Tomar fotografia con la camara"
          >
            <Camera size={12} />
          </Button>
          <Button
            size="sm"
            variant="primary"
            className="min-h-[44px] sm:min-h-0"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            title="Subir imagenes desde el dispositivo"
          >
            <Upload size={12} />
          </Button>
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
        </div>
      )}
    </div>
  );
}

function AddLineModal({ open, onClose, onAdd, defaultTechnician, ot }: {
  open: boolean;
  onClose: () => void;
  onAdd: (line: NewOTLine) => void;
  defaultTechnician: string;
  ot: WorkOrder;
}) {
  const { assets } = useApp();
  const draft = useLineDraft(defaultTechnician);
  const asset = assets.find(a => a.id === ot.assetId);

  const handleClose = () => {
    draft.reset();
    onClose();
  };

  const handleSubmit = () => {
    const line = draft.build();
    if (!line) return;
    onAdd(line);
    draft.reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Agregar linea de trabajo" size="lg">
      <div className="space-y-4">
        {/* misma ficha que "Nueva Orden de Trabajo": estos datos ya existen en la OT, se muestran deshabilitados */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Vehiculo">
            <Select value={ot.assetId} disabled>
              <option value={ot.assetId}>{ot.assetCode} - {ot.assetName}</option>
            </Select>
          </Field>
          <Field label="Prioridad">
            <Select value={ot.priority} disabled>
              {priorityOrder.map(p => <option key={p} value={p}>{priorityLabels[p]}</option>)}
            </Select>
          </Field>
          <Field label="Descripcion" className="md:col-span-2">
            <TextArea value={ot.description} rows={3} disabled />
          </Field>
        </div>

        <LineFields draft={draft} asset={asset} />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!draft.valid}><Plus size={16} /> </Button>
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
            <p className="text-content font-bold">{photo.name}</p>
            <p className="text-content font-normal text-stone-300">{formatDateTime(photo.addedAt)}</p>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors" aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>
        <img src={photo.dataUrl} alt={photo.name} className="rounded-lg max-h-[75vh] object-contain bg-stone-900" />
      </div>
    </div>
  );
}

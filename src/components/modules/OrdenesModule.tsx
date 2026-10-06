import { useApp } from '@/store/AppContext';
import { useConfirm } from '@/store/ConfirmContext';
import { useToast } from '@/store/ToastContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, TextInput, Select, TextArea } from '@/components/ui/Field';
import { StatCard } from '@/components/ui/StatCard';
import { IndicatorCards } from '@/components/ui/IndicatorCards';
import { SortableTh } from '@/components/ui/SortableTh';
import { PhotoCarousel } from '@/components/ui/PhotoCarousel';
import { useSort } from '@/lib/useSort';
import { isOTAssignedTo, otResponsibles } from '@/lib/otTeam';
import { useAuth } from '@/store/AuthContext';
import type { WorkOrder, OTPriority } from '@/types';
import {
  Plus,
  ArrowLeft,
  ClipboardList,
  CheckCircle,
  XCircle,
  Lock,
  AlertCircle,
  CircleAlert,
  List,
  LayoutGrid,
  Search,
  Play,
  PenTool,
  Pencil,
  Camera,
  Package,
  Clock,
  UserPlus,
  ShieldAlert,
  Flag,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { WorkLinesSection } from './ordenes/WorkLines';
import { CreateOTPage } from './ordenes/CreateOT';
import { EditOTModal } from './ordenes/EditOTModal';
import { OTDocumentButton } from './ordenes/OTDocument';
import { OTHistoryButton } from './ordenes/OTHistory';
import { OTTimeline, OTTimelineMini } from './ordenes/OTTimeline';
import {
  blockingReason,
  formatCLP,
  formatDateTime,
  formatHours,
  allOTStatuses,
  otCreatedAt,
  otFlow,
  otHours,
  otNeedsFollowUp,
  otPartsCost,
  otProgress,
  otWaitingParts,
  pendingFindings,
  priorityIconColors,
  priorityLabels,
  priorityVariants,
  statusLabels,
  statusOwnerLabels,
  statusShortLabels,
  statusVariants,
} from './ordenes/otMeta';

type ViewMode = 'lista' | 'cuadricula';

export function OrdenesModule() {
  const {
    workOrders, currentUser, hasPermission, pendingOTId, clearPendingOT,
    reopenWorkOrder, approveWorkOrder, rejectWorkOrder, approveEmergencyRetro,
    assignWorkOrder, finalizeWorkOrder, closeWorkOrder,
  } = useApp();
  const confirm = useConfirm();
  const toast = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>(() => (window.matchMedia('(max-width: 639px)').matches ? 'cuadricula' : 'lista'));
  const [selectedOTId, setSelectedOTId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRetroModal, setShowRetroModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAsset, setFilterAsset] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');

  // sin permiso para ver todas, el tecnico solo ve las OTs asignadas a el
  const canSeeAll = hasPermission('ot.ver.todas');
  const visibleOrders = useMemo(
    () => (canSeeAll ? workOrders : workOrders.filter(ot => isOTAssignedTo(ot, currentUser) || ot.createdBy === currentUser)),
    [workOrders, canSeeAll, currentUser]
  );

  const stats = useMemo(() => ({
    total: visibleOrders.length,
    porAprobar: visibleOrders.filter(o => o.status === 'creada' || o.status === 'pendiente_aprobacion').length,
    enEjecucion: visibleOrders.filter(o => o.status === 'en_ejecucion').length,
    cerradas: visibleOrders.filter(o => o.status === 'cerrada').length,
  }), [visibleOrders]);

  // opciones de los filtros: solo lo que realmente aparece en las OTs visibles, no el catalogo completo
  const assetOptions = useMemo(() => {
    const byId = new Map<string, string>();
    visibleOrders.forEach(ot => byId.set(ot.assetId, `${ot.assetCode} - ${ot.assetName}`));
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [visibleOrders]);

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    visibleOrders.forEach(ot => {
      if (ot.assignedToType === 'taller_externo' && ot.assignedTo) names.add(ot.assignedTo);
      ot.assignedTeam.forEach(n => names.add(n));
    });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [visibleOrders]);

  const filtered = useMemo(() => visibleOrders.filter(ot => {
    if (search) {
      const q = search.toLowerCase();
      const hit = ot.code.toLowerCase().includes(q)
        || ot.description.toLowerCase().includes(q)
        || ot.assetName.toLowerCase().includes(q)
        || ot.assetCode.toLowerCase().includes(q);
      if (!hit) return false;
    }
    if (filterStatus && ot.status !== filterStatus) return false;
    if (filterPriority && ot.priority !== filterPriority) return false;
    if (filterAsset && ot.assetId !== filterAsset) return false;
    if (filterAssignee) {
      const assigned = ot.assignedToType === 'taller_externo'
        ? ot.assignedTo === filterAssignee
        : ot.assignedTeam.includes(filterAssignee);
      if (!assigned) return false;
    }
    return true;
  }), [visibleOrders, search, filterStatus, filterPriority, filterAsset, filterAssignee]);

  // otro modulo (p. ej. Requisas de Repuestos) puede pedir abrir una OT concreta
  useEffect(() => {
    if (!pendingOTId) return;
    setCreating(false);
    setSelectedOTId(pendingOTId);
    clearPendingOT();
  }, [pendingOTId, clearPendingOT]);

  const selectedOT = selectedOTId ? visibleOrders.find(o => o.id === selectedOTId) ?? null : null;
  const canCreate = hasPermission('ot.crear');

  // al aprobar, el Jefe asigna el responsable antes de que la OT pueda empezar; si la pagina se recargo antes de
  // asignar, el modal vuelve a aparecer solo (la OT no tiene otro boton para asignar)
  const needsAssignment = selectedOT?.status === 'aprobada' && !selectedOT.assignedTo && hasPermission('ot.asignar');
  useEffect(() => {
    if (needsAssignment) setShowAssignModal(true);
  }, [needsAssignment]);

  if (creating && canCreate) {
    return <CreateOTPage onBack={() => setCreating(false)} onCreated={() => setCreating(false)} />;
  }

  if (selectedOT) {
    return (
      <>
        <OTDetail
          ot={selectedOT}
          currentUser={currentUser}
          onBack={() => setSelectedOTId(null)}
          onReopen={async () => {
            const ok = await confirm({ title: 'Reabrir OT', message: '¿Estas seguro de reabrir la OT?', confirmLabel: 'Reabrir OT' });
            if (ok) {
              reopenWorkOrder(selectedOT.id);
              toast(`${selectedOT.code} reabierta correctamente`);
            }
          }}
          onApprove={() => setShowApproveModal(true)}
          onReject={() => setShowRejectModal(true)}
          onRetroApprove={() => setShowRetroModal(true)}
          onFinalize={() => setShowFinalizeModal(true)}
          onClose={() => setShowCloseModal(true)}
        />

        {/* El nombre de quien firma se infiere de la sesion (currentUser); estos modales solo piden confirmar. */}
        <ConfirmModal
          open={showApproveModal}
          onClose={() => setShowApproveModal(false)}
          title="Aprobar Orden de Trabajo"
          message="Estas seguro de aprobar esta OT?"
          confirmLabel="Aprobar"
          confirmVariant="primary"
          onConfirm={() => {
            approveWorkOrder(selectedOT.id, currentUser);
            setShowApproveModal(false);
            toast(`${selectedOT.code} aprobada correctamente`);
          }}
        />

        <ConfirmModal
          open={showRejectModal}
          onClose={() => { setShowRejectModal(false); setRejectReason(''); }}
          title="Rechazar Orden de Trabajo"
          message='Indica el motivo del rechazo. La OT quedara cerrada como "Rechazada".'
          confirmLabel="Rechazar"
          confirmVariant="danger"
          extraField={
            <Field label="Motivo de rechazo *">
              <TextArea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
            </Field>
          }
          onConfirm={() => {
            if (rejectReason) {
              rejectWorkOrder(selectedOT.id, rejectReason);
              setShowRejectModal(false);
              setRejectReason('');
              toast({ message: `${selectedOT.code} rechazada`, variant: 'info' });
            }
          }}
        />

        <ConfirmModal
          open={showFinalizeModal}
          onClose={() => setShowFinalizeModal(false)}
          title="Finalizar Orden de Trabajo"
          message="Estas seguro de finalizar esta OT? Quedara en espera de la firma del Jefe de Taller para su cierre."
          confirmLabel="Firmar y finalizar"
          confirmVariant="primary"
          onConfirm={() => {
            finalizeWorkOrder(selectedOT.id, currentUser);
            setShowFinalizeModal(false);
            toast(`${selectedOT.code} finalizada correctamente`);
          }}
        />

        <ConfirmModal
          open={showCloseModal}
          onClose={() => setShowCloseModal(false)}
          title="Cerrar Orden de Trabajo"
          message="Estas seguro de cerrar esta OT? No se podran registrar mas avances."
          confirmLabel="Firmar y cerrar OT"
          confirmVariant="primary"
          onConfirm={() => {
            closeWorkOrder(selectedOT.id);
            setShowCloseModal(false);
            toast(`${selectedOT.code} cerrada y enviada a SAP correctamente`);
          }}
        />

        <ConfirmModal
          open={showRetroModal}
          onClose={() => setShowRetroModal(false)}
          title="Aprobar retroactivamente"
          message="Esta OT se ejecuto sin aprobacion previa. Estas seguro de aprobarla retroactivamente?"
          confirmLabel="Aprobar retroactivamente"
          confirmVariant="primary"
          onConfirm={() => {
            approveEmergencyRetro(selectedOT.id, currentUser);
            setShowRetroModal(false);
            toast(`${selectedOT.code} aprobada retroactivamente`);
          }}
        />

        {showAssignModal && (
          <AssignModal
            ot={selectedOT}
            onClose={() => setShowAssignModal(false)}
            onAssign={(team, type) => {
              assignWorkOrder(selectedOT.id, team, type);
              setShowAssignModal(false);
              toast(`${selectedOT.code} asignada correctamente`);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4">
      <IndicatorCards>
        <StatCard label="Total OTs" value={stats.total} icon={<ClipboardList size={28} />} />
        <StatCard label="Por Aprobar" value={stats.porAprobar} icon={<AlertCircle size={28} />} />
        <StatCard label="En Ejecucion" value={stats.enEjecucion} icon={<Play size={28} />} />
        <StatCard label="Cerradas" value={stats.cerradas} icon={<CheckCircle size={28} />} />
      </IndicatorCards>

      <div className="bg-white rounded-lg shadow-card border border-stone-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h3 className="ui-title">Ordenes de trabajo</h3>
            <div className="flex items-center gap-1 bg-stone-100 rounded-md p-0.5">
              <button
                onClick={() => setViewMode('lista')}
                className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors [@media(pointer:fine)]:min-h-0 [@media(pointer:fine)]:min-w-0 ${viewMode === 'lista' ?'bg-white text-orange-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <List size={14} /> 
              </button>
              <button
                onClick={() => setViewMode('cuadricula')}
                className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors [@media(pointer:fine)]:min-h-0 [@media(pointer:fine)]:min-w-0 ${viewMode === 'cuadricula' ?'bg-white text-orange-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <LayoutGrid size={14} /> 
              </button>
            </div>
          </div>



          <div className="flex items-center gap-2">
            {/* {!canSeeAll && (
              <span className="text-xs text-stone-400 pr-2 border-r border-stone-200">
                Viendo solo las OTs asignadas a ti
              </span>
            )} */}
            {canCreate && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} /> Crear Orden de Trabajo
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 bg-stone-50/50 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Field label="Buscar">
              <Search size={16} className="absolute left-3 top-1/2 text-stone-400" />
              <TextInput
                placeholder="Buscar por codigo, vehiculo o descripcion..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9"
              />
            </Field>
          </div>
          <Field label="Estado">
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full sm:w-auto">
              <option value="">--- seleccione ---</option>
              {allOTStatuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
            </Select>
          </Field>
          <Field label="Prioridad">
            <Select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="w-full sm:w-auto">
              <option value="">--- seleccione ---</option>
              {priorityOrder.map(p => <option key={p} value={p}>{priorityLabels[p]}</option>)}
            </Select>
          </Field>
          <Field label="Vehiculo">
            <Select value={filterAsset} onChange={e => setFilterAsset(e.target.value)} className="w-full sm:w-auto">
              <option value="">--- seleccione ---</option>
              {assetOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Asignada a">
            <Select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="w-full sm:w-auto">
              <option value="">--- seleccione ---</option>
              {assigneeOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </Select>
          </Field>
        </div>

        <div key={viewMode} className="animate-fade-in">
          {viewMode === 'lista' ? (
            <OTTable orders={filtered} onSelect={setSelectedOTId} />
          ) : (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map(ot => (
                <OTCard key={ot.id} ot={ot} onClick={() => setSelectedOTId(ot.id)} />
              ))}
            </div>
          )}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-8 text-stone-400 text-content">No se encontraron ordenes con los filtros seleccionados</div>
        )}
      </div>

    </div>
  );
}

const priorityOrder: OTPriority[] = ['baja', 'media', 'alta', 'critica'];
const priorityRank: Record<OTPriority, number> = { baja: 0, media: 1, alta: 2, critica: 3 };

const otSortGetters = {
  code: (ot: WorkOrder) => ot.code,
  asset: (ot: WorkOrder) => ot.assetName,
  description: (ot: WorkOrder) => ot.description,
  priority: (ot: WorkOrder) => priorityRank[ot.priority],
  status: (ot: WorkOrder) => otFlow.indexOf(ot.status),
  lines: (ot: WorkOrder) => ot.lines.length,
  assignedTo: (ot: WorkOrder) => ot.assignedTo,
  createdAt: (ot: WorkOrder) => ot.createdAt,
};

function OTTable({ orders, onSelect }: { orders: WorkOrder[]; onSelect: (id: string) => void }) {
  const { openAsset } = useApp();
  const { sorted, sort, toggle } = useSort(orders, otSortGetters);

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <SortableTh label="Código" sortKey="code" sort={sort} onSort={toggle} />
            <SortableTh label="Vehiculo" sortKey="asset" sort={sort} onSort={toggle} />
            <SortableTh label="Descripción" sortKey="description" sort={sort} onSort={toggle} />
            <SortableTh label="Prioridad" sortKey="priority" sort={sort} onSort={toggle} />
            <SortableTh label="Estado" sortKey="status" sort={sort} onSort={toggle} />
            <SortableTh label="Líneas" sortKey="lines" sort={sort} onSort={toggle} className="hidden md:table-cell" />
            <SortableTh label="Asignada a" sortKey="assignedTo" sort={sort} onSort={toggle} />
            <SortableTh label="Creación" sortKey="createdAt" sort={sort} onSort={toggle} className="hidden md:table-cell" />
            <th className="relative w-10"><span className="sr-only">Historial</span></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(ot => {
            const progress = otProgress(ot);
            return (
              <tr key={ot.id} className="cursor-pointer" onClick={() => onSelect(ot.id)}>
                <td className="text-stone-600 font-semibold">{ot.code}</td>
                <td className="text-stone-600">
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); openAsset(ot.assetId); }}
                    className="block text-left text-blue-700 hover:underline"
                  >
                    {ot.assetName}
                  </button>
                </td>
                <td className="font-medium text-stone-800 max-w-[280px] truncate">{ot.description}</td>
                <td>
                  <CircleAlert
                    size={18}
                    className={priorityIconColors[ot.priority]}
                    aria-label={`Prioridad ${priorityLabels[ot.priority]}`}
                  >
                    <title>{`Prioridad ${priorityLabels[ot.priority]}`}</title>
                  </CircleAlert>
                </td>
                <td><OTTimelineMini ot={ot} /></td>
                <td className="hidden text-stone-600 whitespace-nowrap md:table-cell">
                  {progress.total === 0 ? 'Sin lineas' : `${progress.done}/${progress.total}`}
                  {otWaitingParts(ot) && <span className="ml-1 text-yellow-600" title="Esperando repuesto">·</span>}
                  {otNeedsFollowUp(ot) && <span className="ml-1 text-purple-600" title="Requiere seguimiento">·</span>}
                  {pendingFindings(ot).length > 0 && (
                    <Flag size={11} className="ml-1 inline text-orange-500" />
                  )}
                </td>
                <td className="text-stone-600">
                  {otResponsibles(ot) ?? <span className="text-stone-400">Sin asignar</span>}
                  {ot.assignedToType === 'taller_externo' && <span className="block text-stone-400">Taller externo</span>}
                </td>
                <td className="hidden text-stone-500 whitespace-nowrap md:table-cell">{formatDateTime(otCreatedAt(ot))}</td>
                <td className="text-right"><OTHistoryButton ot={ot} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OTCard({ ot, onClick }: { ot: WorkOrder; onClick: () => void }) {
  const { openAsset } = useApp();
  const progress = otProgress(ot);
  const photos = ot.lines.reduce((s, l) => s + l.photosBefore.length + l.photosAfter.length, 0);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-md shadow-card border border-stone-200 p-3 cursor-pointer hover:shadow-card-hover hover:border-orange-300 transition-[box-shadow,border-color,transform] duration-200 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-content font-bold text-blue-700">{ot.code}</span>
        <Badge variant={statusVariants[ot.status]}>{statusShortLabels[ot.status]}</Badge>
      </div>

      <p className="text-content font-normal text-stone-800 mb-1 line-clamp-2">{ot.description}</p>
      <button
        type="button"
        onClick={e => { e.stopPropagation(); openAsset(ot.assetId); }}
        className="mb-2 block text-content text-blue-700 hover:underline"
      >
        {ot.assetCode} · {ot.assetName}
      </button>

      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <Badge variant={priorityVariants[ot.priority]}>{priorityLabels[ot.priority]}</Badge>
      </div>

      {progress.total > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-content text-stone-500 mb-1">
            <span>Lineas de trabajo</span>
            <span className="font-semibold text-stone-700">{progress.done}/{progress.total} completadas</span>
          </div>
          <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5 text-content font-normal text-stone-700 pt-2 border-t border-stone-100">
        <span className="truncate"><strong className="font-bold text-stone-600">Asignada a:</strong> {otResponsibles(ot) ?? 'Sin asignar'}</span>
        <span className="text-right"><strong className="font-bold text-stone-600">Creada:</strong> {ot.createdAt}</span>
        <span className="flex items-center gap-1"><Clock size={11} /> {formatHours(otHours(ot))}</span>
        <span className="text-right"><strong className="font-bold text-stone-600">Repuestos:</strong> {formatCLP(otPartsCost(ot))}</span>
      </div>

      {(photos > 0 || otWaitingParts(ot) || otNeedsFollowUp(ot)) && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {photos > 0 && (
            <span className="flex items-center gap-1 text-content text-stone-400"><Camera size={11} /> {photos} evidencias</span>
          )}
          {otWaitingParts(ot) && (
            <span className="flex items-center gap-1 text-content text-yellow-700"><Package size={11} /> Esperando repuesto</span>
          )}
          {otNeedsFollowUp(ot) && (
            <span className="flex items-center gap-1 text-content text-purple-700"><AlertCircle size={11} /> Requiere seguimiento</span>
          )}
        </div>
      )}
    </div>
  );
}

function OTDetail({ ot, currentUser, onBack, onReopen, onApprove, onReject, onRetroApprove, onFinalize, onClose }: {
  ot: WorkOrder;
  currentUser: string;
  onBack: () => void;
  onReopen: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRetroApprove: () => void;
  onFinalize: () => void;
  onClose: () => void;
}) {
  const { hasPermission } = useApp();
  const [editingOT, setEditingOT] = useState(false);
  const blocked = blockingReason(ot);
  const isAssigned = isOTAssignedTo(ot, currentUser);
  const isCreator = ot.createdBy === currentUser;
  const canSeeAllOTs = hasPermission('ot.ver.todas');
  const locked = ot.status === 'cerrada' || ot.status === 'rechazada';
  const linesOpen = !locked;
  const canAddLines = hasPermission('ot.lineas.agregar') && (isAssigned || isCreator || canSeeAllOTs) && linesOpen;
  const canEditLines = hasPermission('ot.lineas.editar') && linesOpen;
  const canExecuteLines = hasPermission('ot.lineas.estado') && (isAssigned || canSeeAllOTs)
    && (ot.status === 'aprobada' || ot.status === 'en_ejecucion');

  // una OT nace "creada" y espera la aprobacion del Jefe de Taller (la version anterior "pendiente_aprobacion" tambien cuenta)
  const awaitingApproval = ot.status === 'creada' || ot.status === 'pendiente_aprobacion';
  const canApprove = hasPermission('ot.aprobar') && awaitingApproval;
  const canReject = hasPermission('ot.rechazar') && awaitingApproval;
  const canRetro = hasPermission('ot.emergencia.aprobarRetro')
    && !ot.approvedBy
    && (ot.status === 'en_ejecucion' || ot.status === 'finalizada');
  const canFinalize = hasPermission('ot.finalizar') && (isAssigned || canSeeAllOTs) && ot.status === 'en_ejecucion';
  const canFinalizeNow = canFinalize && !blocked;
  const canClose = hasPermission('ot.cerrar') && ot.status === 'finalizada';
  // reabrir una OT rechazada: el Jefe de Taller (mismo permiso con el que la rechazo) o el tecnico que la creo
  const canReopen = ot.status === 'rechazada' && (hasPermission('ot.rechazar') || isCreator);
  const hasActions = canApprove || canReject || canRetro || canClose || canReopen;
  const showActionBar = hasActions || (canFinalize && Boolean(blocked));

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-600 hover:text-orange-600 transition-colors">
        <ArrowLeft size={16} /> Volver al listado
      </button>

      <div className="bg-white rounded-lg shadow-card border border-stone-200">
        <div className="px-5 py-4 border-b border-stone-200">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-sm font-bold text-black">{ot.code}</span>
                <OTDocumentButton ot={ot} />
                <OTHistoryButton ot={ot} />
              </div>
              <h3 className="ui-title break-words">{ot.description}</h3>
              <p className="text-sm font-normal mt-0.5">{ot.assetCode} - {ot.assetName}</p>
            </div>
            {canEditLines && (
              <Button variant="secondary" size="sm" className="min-h-[44px] [@media(pointer:fine)]:min-h-0 flex-shrink-0 self-start" onClick={() => setEditingOT(true)}>
                <Pencil size={14} /> Editar
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 border-b border-stone-100 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="min-w-0">
            <div className="px-5 py-4 border-b border-stone-100 bg-stone-50/50">
              <OTTimeline ot={ot} />
            </div>

            <div className="px-4 sm:px-5 py-4">
              <dl className="sap-grid grid-cols-1 border-stone-100 sm:grid-cols-2 sm:border-stone-100 lg:grid-cols-3 lg:border-stone-100">
                <SapCell label="Solicitado por">{ot.createdBy}</SapCell>
                <SapCell label="Asignada a">
                  {otResponsibles(ot) ? `${otResponsibles(ot)}${ot.assignedToType === 'taller_externo' ? ' (taller externo)' : ''}` : 'Sin asignar'}
                </SapCell>
                <SapCell label="Fecha de creacion">{ot.createdAt}</SapCell>
                <SapCell label="Aprobado por">{ot.approvedBy ?? 'Sin aprobar'}</SapCell>
                <SapCell label="Prioridad">{priorityLabels[ot.priority]}</SapCell>
                <SapCell label="Tiempo trabajado">{formatHours(otHours(ot))}</SapCell>
              </dl>
            </div>
          </div>

          {/* evidencia a nivel de OT (se agrega desde "Nueva OT" o "Agregar linea de trabajo"), solo para ver */}
          <div className="px-4 py-4 sm:px-5 lg:border-l lg:border-stone-100">
            <h4 className="ui-subtitle mb-2">Archivos</h4>
            <PhotoCarousel
              photos={ot.photos ?? []}
              canEdit={false}
              compact
              emptyReadonlyLabel="Sin fotografias registradas."
              onAddFiles={() => undefined}
              onRemove={() => undefined}
            />
          </div>
        </div>

        {ot.rejectedReason && (
          <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
            <XCircle size={16} className="text-red-600" />
            <p className="text-content text-red-700"><strong>Rechazada:</strong> {ot.rejectedReason}</p>
          </div>
        )}

        {canRetro && (
          <div className="px-5 py-3 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
            <ShieldAlert size={16} className="text-orange-600 flex-shrink-0" />
            <p className="text-content text-orange-800 flex-1">
              OT ejecutada sin aprobacion previa. Requiere revision retroactiva.
            </p>
          </div>
        )}

        {/* Al intentar cerrar la OT solo se habla del Jefe de Taller: la firma de Control de Inventario sobre
            el documento es un tramite aparte que no bloquea ni se menciona aqui (ver "Firmar como Control de
            Inventario" mas abajo, disponible en cualquier momento y en cualquier orden). */}
        {ot.status === 'finalizada' && (
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
            <PenTool size={16} className="text-blue-600 flex-shrink-0" />
            <p className="text-content text-blue-800">
              Firmada por <strong>{ot.signedBy ?? '--'}</strong>. En espera de la firma del Jefe de Taller para cerrar la OT.
            </p>
          </div>
        )}

        <WorkLinesSection
          ot={ot}
          canAdd={canAddLines}
          canEdit={canEditLines}
          canExecute={canExecuteLines}
          canFinalize={canFinalizeNow}
          finalizeBlockedReason={canFinalize ? blocked : null}
          onFinalize={onFinalize}
        />

        {showActionBar && (
          <div className="px-5 py-4 border-t border-stone-200 flex items-center gap-2 flex-wrap">
            {canApprove && (
              <Button variant="primary" onClick={onApprove}><CheckCircle size={16} /> Aprobar</Button>
            )}
            {canReject && (
              <Button variant="danger" onClick={onReject}><XCircle size={16} /> Rechazar</Button>
            )}
            {canReopen && (
              <Button variant="outline" onClick={onReopen}><RotateCcw size={16} /> Reabrir OT</Button>
            )}
            {canRetro && (
              <Button variant="secondary" onClick={onRetroApprove}><ShieldAlert size={16} /> Aprobar retroactivamente</Button>
            )}
            {canClose && (
              <Button variant="primary" onClick={onClose} disabled={Boolean(blocked)} title={blocked ?? undefined}>
                <Lock size={16} /> Firmar y cerrar OT
              </Button>
            )}
            {canFinalize && blocked && (
              <span className="flex items-center gap-1.5 text-content text-orange-700">
                <AlertCircle size={13} /> {blocked}
              </span>
            )}
          </div>
        )}

        {!showActionBar && ot.status !== 'cerrada' && (
          <div className="px-5 py-3 border-t border-stone-200 text-content text-stone-500">

          </div>
        )}
      </div>

      {editingOT && <EditOTModal ot={ot} onClose={() => setEditingOT(false)} />}
    </div>
  );
}

function SapCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sap-cell border-stone-100">
      <dt>{label}:</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * Se abre justo despues de aprobar la OT. Tecnico de taller: se marcan uno o varios tecnicos activos (por defecto
 * el que creo la OT, si es tecnico). Taller externo: un solo nombre escrito a mano.
 */
function AssignModal({ ot, onClose, onAssign }: {
  ot: WorkOrder;
  onClose: () => void;
  onAssign: (team: string[], type: 'tecnico' | 'taller_externo') => void;
}) {
  const { users } = useAuth();
  const confirm = useConfirm();
  const [type, setType] = useState<'tecnico' | 'taller_externo'>('tecnico');
  const [externalShop, setExternalShop] = useState('');
  const technicians = users.filter(u => u.role === 'tecnico' && u.active);
  const [team, setTeam] = useState<string[]>(() => (technicians.some(u => u.name === ot.createdBy) ? [ot.createdBy] : []));

  const toggleTechnician = (name: string) => {
    setTeam(prev => (prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]));
  };

  const canSubmit = type === 'tecnico' ? team.length > 0 : externalShop.trim() !== '';

  const handleSubmit = async () => {
    const who = type === 'tecnico' ? team : [externalShop.trim()];
    if (!canSubmit) return;
    if (!(await confirm({ title: 'Asignar OT', message: `¿Estas seguro de asignar esta OT a ${who.join(', ')}?`, confirmLabel: 'Asignar' }))) return;
    onAssign(who, type);
  };

  return (
    // sin cerrar a medias: la OT no puede empezar sin responsable, asi que el modal solo se cierra al asignar
    <Modal open onClose={onClose} title={`Asignar ${ot.code}`} size="md" dismissible={false}>
      <div className="space-y-4">
        <Field label="Asignar a *">
          <div className="flex gap-3">
            <button
              onClick={() => setType('tecnico')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${type === 'tecnico' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-stone-300 text-stone-500 hover:bg-stone-50'}`}
            >
              Tecnico de taller
            </button>
            <button
              onClick={() => setType('taller_externo')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${type === 'taller_externo' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-stone-300 text-stone-500 hover:bg-stone-50'}`}
            >
              Taller externo
            </button>
          </div>
        </Field>

        {type === 'tecnico' ? (
          <Field label="Asignar Personal *">
            {technicians.length === 0 ? (
              <p className="text-content text-stone-500">No hay tecnicos activos. Crealos en Administracion.</p>
            ) : (
              <ul className="divide-y divide-stone-100 rounded-md border border-stone-200">
                {technicians.map(u => (
                  <li key={u.id}>
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2 px-3 py-2 text-content text-stone-700 transition-colors hover:bg-stone-50 [@media(pointer:fine)]:min-h-0">
                      <input
                        type="checkbox"
                        checked={team.includes(u.name)}
                        onChange={() => toggleTechnician(u.name)}
                        className="flex-shrink-0 rounded border-stone-300 text-orange-500 focus:ring-orange-300"
                      />
                      {u.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Field>
        ) : (
          <Field label="Taller externo *">
            <TextInput value={externalShop} onChange={e => setExternalShop(e.target.value)} placeholder="Ej: Taller Diesel Norte" />
          </Field>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={handleSubmit} disabled={!canSubmit}><UserPlus size={16} /> Asignar</Button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmModal({ open, onClose, title, message, confirmLabel, confirmVariant, extraField, onConfirm }: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant: 'primary' | 'danger' | 'secondary';
  extraField?: React.ReactNode;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="space-y-4">
        <p className="text-content text-stone-600">{message}</p>
        {extraField}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}

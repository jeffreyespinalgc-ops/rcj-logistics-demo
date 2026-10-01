import { useApp } from '@/store/AppContext';
import { useConfirm } from '@/store/ConfirmContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, TextInput, Select, TextArea } from '@/components/ui/Field';
import { StatCard } from '@/components/ui/StatCard';
import { IndicatorCards } from '@/components/ui/IndicatorCards';
import { SortableTh } from '@/components/ui/SortableTh';
import { useSort } from '@/lib/useSort';
import type { WorkOrder, OTPriority } from '@/types';
import {
  Plus,
  ArrowLeft,
  ClipboardList,
  CheckCircle,
  XCircle,
  Lock,
  AlertCircle,
  List,
  LayoutGrid,
  Search,
  Play,
  PenTool,
  Pencil,
  Send,
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
import { OTDocumentButton } from './ordenes/OTDocument';
import { OTHistoryButton } from './ordenes/OTHistory';
import { OTTimeline } from './ordenes/OTTimeline';
import {
  blockingReason,
  formatCLP,
  formatHours,
  allOTStatuses,
  otFlow,
  otHours,
  otNeedsFollowUp,
  otPartsCost,
  otProgress,
  otWaitingParts,
  pendingFindings,
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
    submitForApproval, approveWorkOrder, rejectWorkOrder, approveEmergencyRetro,
    assignWorkOrder, finalizeWorkOrder, closeWorkOrder, signOTInventory,
  } = useApp();
  const confirm = useConfirm();

  const [viewMode, setViewMode] = useState<ViewMode>(() => (window.matchMedia('(max-width: 639px)').matches ? 'cuadricula' : 'lista'));
  const [selectedOTId, setSelectedOTId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRetroModal, setShowRetroModal] = useState(false);
  const [showSignInventoryModal, setShowSignInventoryModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // sin permiso para ver todas, el tecnico solo ve las OTs asignadas a el
  const canSeeAll = hasPermission('ot.ver.todas');
  const visibleOrders = useMemo(
    () => (canSeeAll ? workOrders : workOrders.filter(ot => ot.assignedTo === currentUser || ot.createdBy === currentUser)),
    [workOrders, canSeeAll, currentUser]
  );

  const stats = useMemo(() => ({
    total: visibleOrders.length,
    porAprobar: visibleOrders.filter(o => o.status === 'pendiente_aprobacion').length,
    enEjecucion: visibleOrders.filter(o => o.status === 'en_ejecucion').length,
    cerradas: visibleOrders.filter(o => o.status === 'cerrada').length,
  }), [visibleOrders]);

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
    return true;
  }), [visibleOrders, search, filterStatus]);

  // otro modulo (p. ej. Requisas de Repuestos) puede pedir abrir una OT concreta
  useEffect(() => {
    if (!pendingOTId) return;
    setCreating(false);
    setSelectedOTId(pendingOTId);
    clearPendingOT();
  }, [pendingOTId, clearPendingOT]);

  const selectedOT = selectedOTId ? visibleOrders.find(o => o.id === selectedOTId) ?? null : null;
  const canCreate = hasPermission('ot.crear');

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
          onSubmit={async () => {
            const reopening = selectedOT.status === 'rechazada';
            const ok = await confirm({
              title: reopening ? 'Reabrir OT' : 'Enviar a aprobacion',
              message: reopening ? '¿Estas seguro de reabrir la OT?' : '¿Estas seguro de enviar esta OT a aprobacion?',
              confirmLabel: reopening ? 'Reabrir OT' : 'Enviar',
            });
            if (ok) submitForApproval(selectedOT.id);
          }}
          onApprove={() => setShowApproveModal(true)}
          onReject={() => setShowRejectModal(true)}
          onRetroApprove={() => setShowRetroModal(true)}
          onAssign={() => setShowAssignModal(true)}
          onFinalize={() => setShowFinalizeModal(true)}
          onClose={() => setShowCloseModal(true)}
          onSignInventory={() => setShowSignInventoryModal(true)}
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
          }}
        />

        <ConfirmModal
          open={showSignInventoryModal}
          onClose={() => setShowSignInventoryModal(false)}
          title="Firmar documento de la OT"
          message="Estas seguro de firmar el documento de esta OT como Control de Inventario?"
          confirmLabel="Firmar"
          confirmVariant="primary"
          onConfirm={() => {
            signOTInventory(selectedOT.id, currentUser);
            setShowSignInventoryModal(false);
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
          }}
        />

        <AssignModal
          open={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          ot={selectedOT}
          onAssign={(who, type) => {
            assignWorkOrder(selectedOT.id, who, type);
            setShowAssignModal(false);
          }}
        />
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
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${viewMode === 'lista' ? 'bg-white text-orange-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                <List size={14} /> 
              </button>
              <button
                onClick={() => setViewMode('cuadricula')}
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors ${viewMode === 'cuadricula' ? 'bg-white text-orange-700 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
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
                <Plus size={16} />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 bg-stone-50/50 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <TextInput
              placeholder="Buscar por codigo, activo o descripcion..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9"
            />
          </div>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full sm:w-auto">
            <option value="">Todos los estados</option>
            {allOTStatuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
          </Select>
        </div>

        {viewMode === 'lista' ? (
          <OTTable orders={filtered} onSelect={setSelectedOTId} />
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(ot => (
              <OTCard key={ot.id} ot={ot} onClick={() => setSelectedOTId(ot.id)} />
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-8 text-stone-400 text-content">No se encontraron ordenes con los filtros seleccionados</div>
        )}
      </div>

    </div>
  );
}

const priorityRank: Record<OTPriority, number> = { baja: 0, media: 1, alta: 2, critica: 3 };
const allPriorities: OTPriority[] = ['baja', 'media', 'alta', 'critica'];

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
            <SortableTh label="Líneas" sortKey="lines" sort={sort} onSort={toggle} />
            <SortableTh label="Asignada a" sortKey="assignedTo" sort={sort} onSort={toggle} />
            <SortableTh label="Creación" sortKey="createdAt" sort={sort} onSort={toggle} />
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
                  <span className="block text-stone-700">{ot.assetName}</span>
                </td>
                <td className="font-medium text-stone-800 max-w-[280px] truncate">{ot.description}</td>
                <td><Badge variant={priorityVariants[ot.priority]}>{priorityLabels[ot.priority]}</Badge></td>
                <td><Badge variant={statusVariants[ot.status]}>{statusShortLabels[ot.status]}</Badge></td>
                <td className="text-stone-600 whitespace-nowrap">
                  {progress.total === 0 ? 'Sin lineas' : `${progress.done}/${progress.total}`}
                  {otWaitingParts(ot) && <span className="ml-1 text-yellow-600" title="Esperando repuesto">·</span>}
                  {otNeedsFollowUp(ot) && <span className="ml-1 text-purple-600" title="Requiere seguimiento">·</span>}
                  {pendingFindings(ot).length > 0 && (
                    <Flag size={11} className="ml-1 inline text-orange-500" />
                  )}
                </td>
                <td className="text-stone-600">
                  {ot.assignedTo ?? <span className="text-stone-400">Sin asignar</span>}
                  {ot.assignedToType === 'taller_externo' && <span className="block text-stone-400">Taller externo</span>}
                </td>
                <td className="text-stone-500">{ot.createdAt}</td>
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
  const progress = otProgress(ot);
  const photos = ot.lines.reduce((s, l) => s + l.photosBefore.length + l.photosAfter.length, 0);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-md shadow-card border border-stone-200 p-3 cursor-pointer hover:shadow-card-hover hover:border-orange-300 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-content font-bold text-blue-700">{ot.code}</span>
        <Badge variant={statusVariants[ot.status]}>{statusShortLabels[ot.status]}</Badge>
      </div>

      <p className="text-content font-normal text-stone-800 mb-1 line-clamp-2">{ot.description}</p>
      <p className="text-content text-stone-500 mb-2">
        {ot.assetCode} · {ot.assetName}
      </p>

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
        <span className="truncate"><strong className="font-bold text-stone-600">Asignada a:</strong> {ot.assignedTo ?? 'Sin asignar'}</span>
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

function OTDetail({ ot, currentUser, onBack, onSubmit, onApprove, onReject, onRetroApprove, onAssign, onFinalize, onClose, onSignInventory }: {
  ot: WorkOrder;
  currentUser: string;
  onBack: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRetroApprove: () => void;
  onAssign: () => void;
  onFinalize: () => void;
  onClose: () => void;
  onSignInventory: () => void;
}) {
  const { hasPermission } = useApp();
  const [editingOT, setEditingOT] = useState(false);
  const blocked = blockingReason(ot);
  const isAssigned = ot.assignedTo === currentUser;
  const isCreator = ot.createdBy === currentUser;
  const canSeeAllOTs = hasPermission('ot.ver.todas');
  const locked = ot.status === 'cerrada' || ot.status === 'rechazada';
  const linesOpen = !locked;
  const canAddLines = hasPermission('ot.lineas.agregar') && (isAssigned || isCreator || canSeeAllOTs) && linesOpen;
  const canEditLines = hasPermission('ot.lineas.editar') && linesOpen;
  const canExecuteLines = hasPermission('ot.lineas.estado') && (isAssigned || canSeeAllOTs)
    && (ot.status === 'aprobada' || ot.status === 'en_ejecucion');

  const canSubmit = hasPermission('ot.crear') && ot.status === 'creada';
  const canApprove = hasPermission('ot.aprobar') && ot.status === 'pendiente_aprobacion';
  const canReject = hasPermission('ot.rechazar') && ot.status === 'pendiente_aprobacion';
  const canAssign = hasPermission('ot.asignar') && !locked && !ot.assignedTo;
  const canRetro = hasPermission('ot.emergencia.aprobarRetro')
    && !ot.approvedBy
    && (ot.status === 'en_ejecucion' || ot.status === 'finalizada');
  const canFinalize = hasPermission('ot.finalizar') && (isAssigned || canSeeAllOTs) && ot.status === 'en_ejecucion';
  const canFinalizeNow = canFinalize && !blocked;
  const canClose = hasPermission('ot.cerrar') && ot.status === 'finalizada';
  const canSignInventory = hasPermission('ot.inventario.firmar') && ot.status === 'finalizada' && !ot.inventorySignedBy;
  // reabrir una OT rechazada: el Jefe de Taller (mismo permiso con el que la rechazo) o el tecnico que la creo
  const canReopen = ot.status === 'rechazada' && (hasPermission('ot.rechazar') || isCreator);
  const hasActions = canSubmit || canApprove || canReject || canAssign || canRetro || canClose || canSignInventory || canReopen;
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
                <span className="text-sm font-bold text-blue-700">{ot.code}</span>
                <OTDocumentButton ot={ot} />
                <OTHistoryButton ot={ot} />
              </div>
              <h3 className="ui-title break-words">{ot.description}</h3>
              <p className="text-sm font-normal text-stone-500 mt-0.5">{ot.assetCode} - {ot.assetName}</p>
            </div>
            {canEditLines && (
              <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0 flex-shrink-0 self-start" onClick={() => setEditingOT(true)}>
                <Pencil size={14} /> Editar OT
              </Button>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-b border-stone-100 bg-stone-50/50">
          <OTTimeline ot={ot} />
        </div>

        <div className="px-4 sm:px-5 py-4 border-b border-stone-50">
          <dl className="sap-grid grid-cols-1 border-stone-100 sm:grid-cols-2 sm:border-stone-100 lg:grid-cols-3 lg:border-stone-100">
            <SapCell label="Solicitado por">{ot.createdBy}</SapCell>
            <SapCell label="Asignada a">
              {ot.assignedTo ? `${ot.assignedTo}${ot.assignedToType === 'taller_externo' ? ' (taller externo)' : ''}` : 'Sin asignar'}
            </SapCell>
            <SapCell label="Fecha de creacion">{ot.createdAt}</SapCell>
            <SapCell label="Aprobado por">{ot.approvedBy ?? 'Sin aprobar'}</SapCell>
            <SapCell label="Prioridad">{priorityLabels[ot.priority]}</SapCell>
            <SapCell label="Tiempo trabajado">{formatHours(otHours(ot))}</SapCell>
          </dl>
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
            {canSubmit && (
              <Button variant="primary" onClick={onSubmit}><Send size={16} /> Enviar a aprobacion</Button>
            )}
            {canApprove && (
              <Button variant="primary" onClick={onApprove}><CheckCircle size={16} /> Aprobar</Button>
            )}
            {canReject && (
              <Button variant="danger" onClick={onReject}><XCircle size={16} /> Rechazar</Button>
            )}
            {canReopen && (
              <Button variant="outline" onClick={onSubmit}><RotateCcw size={16} /> Reabrir OT</Button>
            )}
            {canRetro && (
              <Button variant="secondary" onClick={onRetroApprove}><ShieldAlert size={16} /> Aprobar retroactivamente</Button>
            )}
            {canAssign && (
              <Button variant="outline" onClick={onAssign}>
                <UserPlus size={16} /> Asignar tecnico
              </Button>
            )}
            {canClose && (
              <Button variant="primary" onClick={onClose} disabled={Boolean(blocked)} title={blocked ?? undefined}>
                <Lock size={16} /> Firmar y cerrar OT
              </Button>
            )}
            {canSignInventory && (
              <Button variant="outline" onClick={onSignInventory}>
                <PenTool size={16} /> Firmar como Control de Inventario
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

function EditOTModal({ ot, onClose }: { ot: WorkOrder; onClose: () => void }) {
  const { updateWorkOrder } = useApp();
  const confirm = useConfirm();
  const [description, setDescription] = useState(ot.description);
  const [priority, setPriority] = useState<OTPriority>(ot.priority);
  const [error, setError] = useState<string | null>(null);
  const unchanged = description.trim() === ot.description && priority === ot.priority;

  const handleSave = async () => {
    if (!(await confirm({ title: 'Editar OT', message: '¿Estas seguro de guardar los cambios de esta OT?', confirmLabel: 'Guardar cambios' }))) return;
    const result = updateWorkOrder(ot.id, { description, priority });
    if (result) setError(result);
    else onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Editar ${ot.code}`} size="md">
      <div className="space-y-4">
        <Field label="Descripcion *">
          <TextArea value={description} onChange={e => { setDescription(e.target.value); setError(null); }} rows={3} />
        </Field>
        <Field label="Prioridad *">
          <Select value={priority} onChange={e => setPriority(e.target.value as OTPriority)}>
            {allPriorities.map(p => <option key={p} value={p}>{priorityLabels[p]}</option>)}
          </Select>
        </Field>
        {error && <p role="alert" className="text-content text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" className="min-h-[44px] sm:min-h-0" onClick={onClose}>Cancelar</Button>
          <Button className="min-h-[44px] sm:min-h-0" onClick={handleSave} disabled={unchanged || !description.trim()}>Guardar cambios</Button>
        </div>
      </div>
    </Modal>
  );
}

function AssignModal({ open, onClose, ot, onAssign }: {
  open: boolean;
  onClose: () => void;
  ot: WorkOrder;
  onAssign: (who: string, type: 'tecnico' | 'taller_externo') => void;
}) {
  const [type, setType] = useState<'tecnico' | 'taller_externo'>('tecnico');
  const [externalShop, setExternalShop] = useState('');
  const confirm = useConfirm();

  const inferredTechnician = ot.createdBy;

  const handleSubmit = async () => {
    const who = type === 'tecnico' ? inferredTechnician : externalShop.trim();
    if (!who) return;
    if (!(await confirm({ title: 'Asignar OT', message: `¿Estas seguro de asignar esta OT a ${who}?`, confirmLabel: 'Asignar' }))) return;
    onAssign(who, type);
    setExternalShop('');
  };

  return (
    <Modal open={open} onClose={onClose} title={`Asignar ${ot.code}`} size="md">
      <div className="space-y-4">
        <Field label="Responsable de la ejecucion *">
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
          <Field label="Tecnico">
            <p className="text-content text-stone-800 py-2 px-3 rounded-md border border-stone-200 bg-stone-50">{inferredTechnician}</p>
          </Field>
        ) : (
          <Field label="Taller externo *">
            <TextInput value={externalShop} onChange={e => setExternalShop(e.target.value)} placeholder="Ej: Taller Diesel Norte" />
          </Field>
        )}

        {ot.assignedTo && (
          <p className="text-content text-stone-500">
            Asignada actualmente a <strong className="text-stone-700">{ot.assignedTo}</strong>.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}><UserPlus size={16} /> Asignar</Button>
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

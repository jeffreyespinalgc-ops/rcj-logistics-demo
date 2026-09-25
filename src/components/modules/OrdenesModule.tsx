import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, TextInput, Select, TextArea } from '@/components/ui/Field';
import { StatCard } from '@/components/ui/StatCard';
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
  Send,
  Camera,
  Package,
  Clock,
  UserPlus,
  ShieldAlert,
  Flag,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { WorkLinesSection } from './ordenes/WorkLines';
import { OTTimeline } from './ordenes/OTTimeline';
import {
  blockingReason,
  formatCLP,
  formatHours,
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
    workOrders, assets, currentUser, hasPermission,
    addWorkOrder, submitForApproval, approveWorkOrder, rejectWorkOrder, approveEmergencyRetro,
    assignWorkOrder, finalizeWorkOrder, closeWorkOrder, addNotification,
  } = useApp();
  const { users } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>(() => (window.matchMedia('(max-width: 639px)').matches ? 'cuadricula' : 'lista'));
  const [selectedOTId, setSelectedOTId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRetroModal, setShowRetroModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actorName, setActorName] = useState(currentUser);
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

  const selectedOT = selectedOTId ? visibleOrders.find(o => o.id === selectedOTId) ?? null : null;
  const canCreate = hasPermission('ot.crear');
  const technicians = useMemo(() => users.filter(u => u.role === 'tecnico' && u.active).map(u => u.name), [users]);

  const openAction = (setter: (v: boolean) => void) => {
    setActorName(currentUser);
    setter(true);
  };

  if (selectedOT) {
    return (
      <>
        <OTDetail
          ot={selectedOT}
          currentUser={currentUser}
          onBack={() => setSelectedOTId(null)}
          onSubmit={() => submitForApproval(selectedOT.id)}
          onApprove={() => openAction(setShowApproveModal)}
          onReject={() => setShowRejectModal(true)}
          onRetroApprove={() => openAction(setShowRetroModal)}
          onAssign={() => setShowAssignModal(true)}
          onFinalize={() => openAction(setShowFinalizeModal)}
          onClose={() => setShowCloseModal(true)}
        />

        <ConfirmModal
          open={showApproveModal}
          onClose={() => setShowApproveModal(false)}
          title="Aprobar Orden de Trabajo"
          message={`Confirmas la aprobacion de ${selectedOT.code}? Quedara disponible para ejecucion en taller.`}
          confirmLabel="Aprobar"
          confirmVariant="primary"
          extraField={
            <Field label="Aprobador">
              <TextInput value={actorName} onChange={e => setActorName(e.target.value)} />
            </Field>
          }
          onConfirm={() => {
            approveWorkOrder(selectedOT.id, actorName);
            setShowApproveModal(false);
          }}
        />

        <ConfirmModal
          open={showRejectModal}
          onClose={() => { setShowRejectModal(false); setRejectReason(''); }}
          title="Rechazar Orden de Trabajo"
          message={`Indica el motivo del rechazo de ${selectedOT.code}. Volvera al solicitante como "Creada".`}
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
          message={`Confirmas que todas las lineas de trabajo de ${selectedOT.code} estan terminadas? Al firmar, la OT quedara en espera de la firma del Jefe de Taller para su cierre.`}
          confirmLabel="Firmar y finalizar"
          confirmVariant="primary"
          extraField={
            <Field label="Firma de quien finaliza">
              <TextInput value={actorName} onChange={e => setActorName(e.target.value)} />
            </Field>
          }
          onConfirm={() => {
            finalizeWorkOrder(selectedOT.id, actorName);
            setShowFinalizeModal(false);
          }}
        />

        <ConfirmModal
          open={showCloseModal}
          onClose={() => setShowCloseModal(false)}
          title="Cerrar Orden de Trabajo"
          message={`Confirmas el cierre de ${selectedOT.code}? Con la firma de supervisor no se podran registrar mas avances.`}
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
          message={`${selectedOT.code} es una OT de emergencia que se ejecuto sin aprobacion previa. Al confirmar queda revisada y aprobada, sin alterar su etapa actual.`}
          confirmLabel="Aprobar retroactivamente"
          confirmVariant="primary"
          extraField={
            <Field label="Revisado por">
              <TextInput value={actorName} onChange={e => setActorName(e.target.value)} />
            </Field>
          }
          onConfirm={() => {
            approveEmergencyRetro(selectedOT.id, actorName);
            setShowRetroModal(false);
          }}
        />

        <AssignModal
          open={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          ot={selectedOT}
          technicians={technicians}
          onAssign={(who, type) => {
            assignWorkOrder(selectedOT.id, who, type);
            setShowAssignModal(false);
          }}
        />
      </>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total OTs" value={stats.total} icon={<ClipboardList size={28} />} />
        <StatCard label="Por Aprobar" value={stats.porAprobar} icon={<AlertCircle size={28} />} />
        <StatCard label="En Ejecucion" value={stats.enEjecucion} icon={<Play size={28} />} />
        <StatCard label="Cerradas" value={stats.cerradas} icon={<CheckCircle size={28} />} />
      </div>

      <div className="bg-white rounded-lg shadow-card border border-stone-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h3 className="font-heading text-base font-bold text-stone-800">Ordenes de Trabajo</h3>
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
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus size={16} /> Nueva OT
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
            {otFlow.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
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
          <div className="text-center py-8 text-stone-400 text-sm">No se encontraron ordenes con los filtros seleccionados</div>
        )}
      </div>

      <CreateOTModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        assets={assets}
        workOrders={workOrders}
        onCreate={(data) => {
          addWorkOrder(data);
          addNotification({
            type: 'aprobacion',
            title: `${data.code} pendiente de aprobacion`,
            description: `${data.assetName} - ${data.description}`,
            date: new Date().toISOString().slice(0, 10),
            reference: data.code,
            priority: data.priority === 'critica' ? 'alta' : 'media',
          });
        }}
      />
    </div>
  );
}

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
                <td className="text-stone-600 text-xs whitespace-nowrap">
                  {progress.total === 0 ? 'Sin lineas' : `${progress.done}/${progress.total}`}
                  {otWaitingParts(ot) && <span className="ml-1 text-yellow-600" title="Esperando repuesto">·</span>}
                  {otNeedsFollowUp(ot) && <span className="ml-1 text-purple-600" title="Requiere seguimiento">·</span>}
                  {pendingFindings(ot).length > 0 && (
                    <Flag size={11} className="ml-1 inline text-orange-500" />
                  )}
                </td>
                <td className="text-stone-600 text-xs">
                  {ot.assignedTo ?? <span className="text-stone-400">Sin asignar</span>}
                  {ot.assignedToType === 'taller_externo' && <span className="block text-[10px] text-stone-400">Taller externo</span>}
                </td>
                <td className="text-stone-500 text-xs">{ot.createdAt}</td>
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
        <span className="font-mono text-xs font-bold text-blue-700">{ot.code}</span>
        <Badge variant={statusVariants[ot.status]}>{statusShortLabels[ot.status]}</Badge>
      </div>

      <p className="text-sm font-medium text-stone-800 mb-1 line-clamp-2">{ot.description}</p>
      <p className="text-xs text-stone-500 mb-2">
        <span className="font-mono">{ot.assetCode}</span> · {ot.assetName}
      </p>

      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <Badge variant={priorityVariants[ot.priority]}>{priorityLabels[ot.priority]}</Badge>
      </div>

      {progress.total > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
            <span>Lineas de trabajo</span>
            <span className="font-semibold text-stone-700">{progress.done}/{progress.total} completadas</span>
          </div>
          <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-stone-500 pt-2 border-t border-stone-100">
        <span className="truncate">Asignada a: <strong className="text-stone-700 font-medium">{ot.assignedTo ?? 'Sin asignar'}</strong></span>
        <span className="text-right">Creada: <strong className="text-stone-700 font-medium">{ot.createdAt}</strong></span>
        <span className="flex items-center gap-1"><Clock size={11} /> {formatHours(otHours(ot))}</span>
        <span className="text-right">Repuestos: <strong className="text-stone-700 font-medium">{formatCLP(otPartsCost(ot))}</strong></span>
      </div>

      {(photos > 0 || otWaitingParts(ot) || otNeedsFollowUp(ot)) && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {photos > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-stone-400"><Camera size={11} /> {photos} evidencias</span>
          )}
          {otWaitingParts(ot) && (
            <span className="flex items-center gap-1 text-[11px] text-yellow-700"><Package size={11} /> Esperando repuesto</span>
          )}
          {otNeedsFollowUp(ot) && (
            <span className="flex items-center gap-1 text-[11px] text-purple-700"><AlertCircle size={11} /> Requiere seguimiento</span>
          )}
        </div>
      )}
    </div>
  );
}

function OTDetail({ ot, currentUser, onBack, onSubmit, onApprove, onReject, onRetroApprove, onAssign, onFinalize, onClose }: {
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
}) {
  const { hasPermission } = useApp();
  const blocked = blockingReason(ot);
  const pending = pendingFindings(ot);
  const isAssigned = ot.assignedTo === currentUser;
  const isCreator = ot.createdBy === currentUser;
  const canSeeAllOTs = hasPermission('ot.ver.todas');
  const linesOpen = ot.status !== 'finalizada' && ot.status !== 'cerrada';
  // crear lineas: quien creo o tiene asignada la OT, o quien ve todas (Jefe de Taller), mientras no este finalizada
  const canAddLines = hasPermission('ot.lineas.agregar') && (isAssigned || isCreator || canSeeAllOTs) && linesOpen;
  // editar o eliminar lineas ya creadas y sus actividades: administrador y jefe de taller (el tecnico no)
  const canEditLines = hasPermission('ot.lineas.editar') && linesOpen;
  // ejecutar lineas (iniciar, finalizar, evidencias): el tecnico asignado o quien ve todas (Jefe de Taller)
  // con el permiso de ejecucion, con la OT aprobada o en ejecucion. Iniciar la primera linea pone la OT en
  // ejecucion, por eso no hay un boton de inicio a nivel de OT.
  const canExecuteLines = hasPermission('ot.lineas.estado') && (isAssigned || canSeeAllOTs)
    && (ot.status === 'aprobada' || ot.status === 'en_ejecucion');

  const canSubmit = hasPermission('ot.crear') && ot.status === 'creada';
  const canApprove = hasPermission('ot.aprobar') && ot.status === 'pendiente_aprobacion';
  const canReject = hasPermission('ot.rechazar') && ot.status === 'pendiente_aprobacion';
  // la asignacion es unica: una vez asignada la OT no se reasigna
  const canAssign = hasPermission('ot.asignar') && ot.status !== 'cerrada' && !ot.assignedTo;
  // una OT que se ejecuto sin aprobacion previa (caso de emergencia) queda pendiente de revision retroactiva
  const canRetro = hasPermission('ot.emergencia.aprobarRetro')
    && !ot.approvedBy
    && (ot.status === 'en_ejecucion' || ot.status === 'finalizada');
  const canFinalize = hasPermission('ot.finalizar') && (isAssigned || canSeeAllOTs) && ot.status === 'en_ejecucion';
  // "Finalizar OT" (firma de quien ejecuta) solo aparece cuando todas las lineas estan finalizadas y no quedan
  // hallazgos por aprobar; despues la OT espera la firma del Jefe de Taller para cerrarse
  const canFinalizeNow = canFinalize && !blocked;
  const canClose = hasPermission('ot.cerrar') && ot.status === 'finalizada';
  const hasActions = canSubmit || canApprove || canReject || canAssign || canRetro || canFinalizeNow || canClose;
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
                <span className="font-mono text-sm font-bold text-blue-700">{ot.code}</span>
                <Badge variant={priorityVariants[ot.priority]}>{priorityLabels[ot.priority]}</Badge>
              </div>
              <h3 className="font-heading text-lg font-bold text-stone-800 break-words">{ot.description}</h3>
              <p className="text-sm text-stone-500 mt-0.5">{ot.assetCode} - {ot.assetName}</p>
            </div>
            <div className="sm:text-right flex-shrink-0">
              <Badge variant={statusVariants[ot.status]}>{statusLabels[ot.status]}</Badge>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-stone-200 bg-stone-50/50">
          <OTTimeline ot={ot} />
        </div>

        <div className="px-5 py-4 border-b border-stone-200 grid grid-cols-2 md:grid-cols-5 gap-4">
          <InfoCell label="Solicitado por" value={ot.createdBy} />
          <InfoCell
            label="Asignada a"
            value={ot.assignedTo ? `${ot.assignedTo}${ot.assignedToType === 'taller_externo' ? ' (taller externo)' : ''}` : 'Sin asignar'}
          />
          <InfoCell label="Fecha Creacion" value={ot.createdAt} />
          <InfoCell label="Aprobado por" value={ot.approvedBy ?? 'Sin aprobar'} />
          <InfoCell label="Tiempo trabajado" value={formatHours(otHours(ot))} />
          <InfoCell label="Costo repuestos" value={formatCLP(otPartsCost(ot))} />
        </div>

        {ot.rejectedReason && (
          <div className="px-5 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2">
            <XCircle size={16} className="text-red-600" />
            <p className="text-sm text-red-700"><strong>Rechazada:</strong> {ot.rejectedReason}</p>
          </div>
        )}

        {canRetro && (
          <div className="px-5 py-3 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
            <ShieldAlert size={16} className="text-orange-600 flex-shrink-0" />
            <p className="text-sm text-orange-800 flex-1">
              OT ejecutada sin aprobacion previa. Requiere revision retroactiva.
            </p>
          </div>
        )}

        {pending.length > 0 && (
          <div className="px-5 py-3 bg-orange-50 border-b border-orange-100 flex items-center gap-2">
            <Flag size={16} className="text-orange-600 flex-shrink-0" />
            <p className="text-sm text-orange-800">
              {pending.length} hallazgo{pending.length !== 1 ? 's' : ''} pendiente{pending.length !== 1 ? 's' : ''} de aprobacion del Jefe de Taller.
            </p>
          </div>
        )}

        {ot.status === 'finalizada' && (
          <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
            <PenTool size={16} className="text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-800">
              Firmada por <strong>{ot.signedBy ?? '--'}</strong>. En espera de la firma del Jefe de Taller para cerrar la OT.
            </p>
          </div>
        )}

        <WorkLinesSection ot={ot} canAdd={canAddLines} canEdit={canEditLines} canExecute={canExecuteLines} />

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
            {canRetro && (
              <Button variant="secondary" onClick={onRetroApprove}><ShieldAlert size={16} /> Aprobar retroactivamente</Button>
            )}
            {canAssign && (
              <Button variant="outline" onClick={onAssign}>
                <UserPlus size={16} /> Asignar tecnico
              </Button>
            )}
            {canFinalizeNow && (
              <Button variant="primary" onClick={onFinalize}>
                <PenTool size={16} /> Finalizar OT
              </Button>
            )}
            {canClose && (
              <Button variant="primary" onClick={onClose} disabled={Boolean(blocked)} title={blocked ?? undefined}>
                <Lock size={16} /> Firmar y cerrar OT
              </Button>
            )}
            {(canFinalize || canClose) && blocked && (
              <span className="flex items-center gap-1.5 text-xs text-orange-700">
                <AlertCircle size={13} /> {blocked}
              </span>
            )}
          </div>
        )}

        {!showActionBar && ot.status !== 'cerrada' && (
          <div className="px-5 py-3 border-t border-stone-200 text-xs text-stone-500">
            {!isAssigned && ot.assignedTo && (ot.status === 'aprobada' || ot.status === 'en_ejecucion') && (
              <span> ({ot.assignedTo})</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-stone-800 break-words">{value}</p>
    </div>
  );
}

function CreateOTModal({ open, onClose, assets, workOrders, onCreate }: {
  open: boolean;
  onClose: () => void;
  assets: { id: string; code: string; name: string }[];
  workOrders: WorkOrder[];
  onCreate: (data: {
    code: string;
    assetId: string;
    assetCode: string;
    assetName: string;
    priority: OTPriority;
    description: string;
    createdAt: string;
    assignedTo: string | null;
    assignedToType: 'tecnico' | 'taller_externo' | null;
  }) => void;
}) {
  const [assetId, setAssetId] = useState('');
  const [priority, setPriority] = useState<OTPriority>('media');
  const [description, setDescription] = useState('');

  const nextCode = useMemo(() => {
    const max = workOrders.reduce((acc, ot) => {
      const n = Number(ot.code.split('-').pop());
      return Number.isFinite(n) ? Math.max(acc, n) : acc;
    }, 0);
    return `OT-2026-${String(max + 1).padStart(4, '0')}`;
  }, [workOrders]);

  const handleSubmit = () => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset || !description) return;
    onCreate({
      code: nextCode,
      assetId: asset.id,
      assetCode: asset.code,
      assetName: asset.name,
      priority,
      description,
      createdAt: new Date().toISOString().slice(0, 10),
      // la asignacion la hace el Jefe de Taller despues de aprobar
      assignedTo: null,
      assignedToType: null,
    });
    onClose();
    setAssetId('');
    setDescription('');
  };

  return (
    <Modal open={open} onClose={onClose} title="Crear Orden de Trabajo" size="lg">
      <div className="space-y-4">
        <Field label="Activo *">
          <Select value={assetId} onChange={e => setAssetId(e.target.value)}>
            <option value="">Seleccionar vehiculo...</option>
            {assets.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
          </Select>
        </Field>

        <Field label="Prioridad *">
          <Select value={priority} onChange={e => setPriority(e.target.value as OTPriority)}>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="critica">Critica</option>
          </Select>
        </Field>

        <Field label="Descripcion *">
          <TextArea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe el trabajo a realizar..." />
        </Field>

        {/* <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-md border border-blue-100">
          <Send size={16} className="text-blue-600 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            La OT se creara como <strong>{nextCode}</strong> y quedara <strong>pendiente de aprobacion</strong> del supervisor.
          </p>
        </div> */}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}><Plus size={16} /> Crear OT</Button>
        </div>
      </div>
    </Modal>
  );
}

function AssignModal({ open, onClose, ot, technicians, onAssign }: {
  open: boolean;
  onClose: () => void;
  ot: WorkOrder;
  technicians: string[];
  onAssign: (who: string, type: 'tecnico' | 'taller_externo') => void;
}) {
  const [type, setType] = useState<'tecnico' | 'taller_externo'>('tecnico');
  const [technician, setTechnician] = useState('');
  const [externalShop, setExternalShop] = useState('');

  const handleSubmit = () => {
    const who = type === 'tecnico' ? technician : externalShop.trim();
    if (!who) return;
    onAssign(who, type);
    setTechnician('');
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
          <Field label="Tecnico *">
            <Select value={technician} onChange={e => setTechnician(e.target.value)}>
              <option value="">Seleccionar tecnico...</option>
              {technicians.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
        ) : (
          <Field label="Taller externo *">
            <TextInput value={externalShop} onChange={e => setExternalShop(e.target.value)} placeholder="Ej: Taller Diesel Norte" />
          </Field>
        )}

        {ot.assignedTo && (
          <p className="text-xs text-stone-500">
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
        <p className="text-sm text-stone-600">{message}</p>
        {extraField}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant={confirmVariant} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}

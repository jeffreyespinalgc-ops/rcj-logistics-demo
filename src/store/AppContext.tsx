import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type {
  Asset,
  AssetHistoryEntry,
  AssetPhoto,
  Part,
  InventoryMovement,
  WorkOrder,
  FuelLoad,
  AppNotification,
  CatalogItem,
  ModuleKey,
  OTStatus,
  OTLine,
  OTLinePart,
  OTLinePhoto,
  OTLineStatus,
  OTWorkType,
  UserRole,
  MaintenancePlans,
  MaintenanceTreeNode,
} from '@/types';
import {
  initialAssets,
  initialAssetHistory,
  initialParts,
  initialMovements,
  initialWorkOrders,
  initialFuelLoads,
  initialNotifications,
  initialWorkTypes,
  initialMaintenancePlans,
} from '@/data/mockData';
import { loadJSON, saveJSON } from '@/lib/localStore';
import { defaultPermissions, isLocked, modulePermissions, type Permission, type PermissionMatrix } from '@/lib/permissions';
import { useAuth } from '@/store/AuthContext';

export type PhotoGroup = 'before' | 'after';

type NewWorkOrder = Omit<
  WorkOrder,
  'id' | 'lines' | 'closedAt' | 'approvedBy' | 'signedBy' | 'rejectedReason' | 'estimatedCost' | 'history' | 'createdBy' | 'status'
>;

interface AppState {
  // Navigation
  activeModule: ModuleKey;
  setActiveModule: (m: ModuleKey) => void;

  // Sesion activa (viene del login)
  currentRole: UserRole;
  currentUser: string;

  // Permisos
  permissions: PermissionMatrix;
  /** Permisos del rol conectado */
  hasPermission: (p: Permission) => boolean;
  setRolePermission: (role: UserRole, permission: Permission, enabled: boolean) => void;
  resetPermissions: () => void;

  // Assets
  assets: Asset[];
  assetHistory: AssetHistoryEntry[];
  addAsset: (asset: Omit<Asset, 'id'>) => void;
  syncingAssets: boolean;
  lastAssetSync: string | null;
  syncAssetsFromSAP: (assetId?: string) => void;
  addAssetPhoto: (assetId: string, photo: Omit<AssetPhoto, 'id' | 'addedAt'>) => void;
  removeAssetPhoto: (assetId: string, photoId: string) => void;

  // Parts (el stock tambien se ajusta automaticamente al consumir repuestos en lineas de OT)
  parts: Part[];
  addPart: (part: Omit<Part, 'id'>) => void;
  updatePart: (id: string, patch: Partial<Part>) => void;
  removePart: (id: string) => void;
  movements: InventoryMovement[];

  // Work Orders
  workOrders: WorkOrder[];
  addWorkOrder: (ot: NewWorkOrder) => void;
  updateWorkOrderStatus: (id: string, status: OTStatus) => void;
  submitForApproval: (id: string) => void;
  approveWorkOrder: (id: string, approver: string) => void;
  rejectWorkOrder: (id: string, reason: string) => void;
  /** Revision retroactiva de una OT de emergencia ya ejecutada */
  approveEmergencyRetro: (id: string, approver: string) => void;
  assignWorkOrder: (id: string, assignedTo: string, type: 'tecnico' | 'taller_externo') => void;
  startExecution: (id: string, technician: string) => void;
  finalizeWorkOrder: (id: string, signer: string) => void;
  closeWorkOrder: (id: string) => void;

  // Lineas de trabajo
  /** `parts` se consumen del inventario al crear la linea; `photosBefore` entran como evidencia "Antes" */
  addOTLine: (
    otId: string,
    line: Omit<OTLine, 'id' | 'createdAt' | 'photosBefore' | 'photosAfter' | 'parts' | 'startedAt' | 'finishedAt' | 'hours' | 'findingStatus'> & {
      parts?: OTLinePart[];
      photosBefore?: Omit<OTLinePhoto, 'id' | 'addedAt'>[];
    }
  ) => void;
  updateOTLine: (otId: string, lineId: string, patch: Partial<OTLine>) => void;
  deleteOTLine: (otId: string, lineId: string) => void;
  /** Inicia la linea; si es la primera y la OT esta aprobada, la OT pasa a "En ejecucion" */
  startLine: (otId: string, lineId: string) => void;
  /** Finaliza la linea. La OT no se finaliza sola: la firma quien ejecuta con el boton "Finalizar OT" */
  finishLine: (otId: string, lineId: string) => void;
  addLinePhoto: (otId: string, lineId: string, group: PhotoGroup, photo: Omit<OTLinePhoto, 'id' | 'addedAt'>) => void;
  removeLinePhoto: (otId: string, lineId: string, group: PhotoGroup, photoId: string) => void;
  removeLinePart: (otId: string, lineId: string, partId: string) => void;
  /** Aprobacion / rechazo de una linea marcada como hallazgo (Jefe de Taller) */
  reviewFinding: (otId: string, lineId: string, approved: boolean) => void;

  /** Aviso cuando localStorage rechaza guardar datos (cuota llena) */
  storageWarning: string | null;
  dismissStorageWarning: () => void;

  // Fuel
  fuelLoads: FuelLoad[];
  addFuelLoad: (f: Omit<FuelLoad, 'id'>) => void;

  // Notifications
  notifications: AppNotification[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  addNotification: (n: Omit<AppNotification, 'id' | 'read'>) => void;

  // Tipos de Trabajo (editable por el Administrador; se eligen al agregar lineas de trabajo)
  workTypes: CatalogItem[];
  addWorkType: (item: Omit<CatalogItem, 'id'>) => void;
  updateWorkType: (id: string, patch: Partial<CatalogItem>) => void;
  removeWorkType: (id: string) => void;

  // Planes de mantenimiento (arbol personalizable por Tipo de Trabajo)
  maintenancePlans: MaintenancePlans;
  addMaintenanceNode: (workType: OTWorkType, parentId: string | null, name: string) => void;
  renameMaintenanceNode: (workType: OTWorkType, nodeId: string, name: string) => void;
  removeMaintenanceNode: (workType: OTWorkType, nodeId: string) => void;
  moveMaintenanceNode: (workType: OTWorkType, nodeId: string, targetId: string | null, position: 'before' | 'after' | 'inside') => void;
}

const AppContext = createContext<AppState | null>(null);

let idCounter = 1000;
const genId = () => `gen-${++idCounter}-${Math.random().toString(36).slice(2, 8)}`;

const now = () => new Date().toISOString().slice(0, 19);
const today = () => new Date().toISOString().slice(0, 10);

/** Aplica fn al nodo con ese id, buscando en todo el arbol (recursivo) */
function mapMaintenanceNode(
  nodes: MaintenanceTreeNode[],
  id: string,
  fn: (n: MaintenanceTreeNode) => MaintenanceTreeNode
): MaintenanceTreeNode[] {
  return nodes.map(n => {
    if (n.id === id) return fn(n);
    if (n.children.length === 0) return n;
    return { ...n, children: mapMaintenanceNode(n.children, id, fn) };
  });
}

/** Elimina el nodo con ese id en cualquier nivel del arbol (recursivo) */
function removeMaintenanceNodeById(nodes: MaintenanceTreeNode[], id: string): MaintenanceTreeNode[] {
  return nodes.filter(n => n.id !== id).map(n => (
    n.children.length === 0 ? n : { ...n, children: removeMaintenanceNodeById(n.children, id) }
  ));
}

function findMaintenanceNode(nodes: MaintenanceTreeNode[], id: string): MaintenanceTreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const inChildren = findMaintenanceNode(n.children, id);
    if (inChildren) return inChildren;
  }
  return null;
}

/**
 * Mueve un nodo a otra posicion del arbol: antes/despues de `targetId` (mismo nivel que el destino)
 * o dentro de el como ultimo hijo. `targetId` null con 'inside' lo manda al final del primer nivel.
 * Un nodo no puede quedar dentro de si mismo ni de sus descendientes.
 */
function moveMaintenanceNodeInTree(
  nodes: MaintenanceTreeNode[],
  nodeId: string,
  targetId: string | null,
  position: 'before' | 'after' | 'inside'
): MaintenanceTreeNode[] {
  const moving = findMaintenanceNode(nodes, nodeId);
  if (!moving) return nodes;
  if (targetId === null) {
    if (position !== 'inside') return nodes;
    return [...removeMaintenanceNodeById(nodes, nodeId), moving];
  }
  if (findMaintenanceNode([moving], targetId)) return nodes;

  const without = removeMaintenanceNodeById(nodes, nodeId);
  if (!findMaintenanceNode(without, targetId)) return nodes;
  if (position === 'inside') {
    return mapMaintenanceNode(without, targetId, n => ({ ...n, children: [...n.children, moving] }));
  }

  const insertAmongSiblings = (list: MaintenanceTreeNode[]): MaintenanceTreeNode[] => {
    const idx = list.findIndex(n => n.id === targetId);
    if (idx !== -1) {
      const copy = [...list];
      copy.splice(position === 'before' ? idx : idx + 1, 0, moving);
      return copy;
    }
    return list.map(n => (n.children.length === 0 ? n : { ...n, children: insertAmongSiblings(n.children) }));
  };
  return insertAmongSiblings(without);
}

/** Estado de la linea al finalizarla: solo las pendientes o en ejecucion pasan a "Completado" */
function resolvedLineStatus(status: OTLineStatus): OTLineStatus {
  return status === 'en_ejecucion' || status === 'pendiente' ? 'completado' : status;
}

/** Horas trabajadas entre dos marcas de tiempo, redondeadas a cuartos de hora */
function hoursBetween(startedAt: string, finishedAt: string): number {
  const diff = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.round((diff / 3_600_000) * 4) / 4;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [requestedModule, setActiveModule] = useState<ModuleKey>('activos');
  const [assets, setAssets] = useState<Asset[]>(() => loadJSON('rcj_v1_assets', initialAssets));
  const [assetHistory, setAssetHistory] = useState<AssetHistoryEntry[]>(() => loadJSON('rcj_v1_asset_history', initialAssetHistory));
  const [parts, setParts] = useState<Part[]>(() => loadJSON('rcj_v1_parts', initialParts));
  const [movements, setMovements] = useState<InventoryMovement[]>(() => loadJSON('rcj_v1_movements', initialMovements));
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() => loadJSON('rcj_v1_work_orders', initialWorkOrders));
  const [fuelLoads, setFuelLoads] = useState<FuelLoad[]>(() => loadJSON('rcj_v1_fuel_loads', initialFuelLoads));
  const [notifications, setNotifications] = useState<AppNotification[]>(() => loadJSON('rcj_v1_notifications', initialNotifications));
  const [workTypes, setWorkTypes] = useState<CatalogItem[]>(() => loadJSON('rcj_v1_work_types', initialWorkTypes));
  const [maintenancePlans, setMaintenancePlans] = useState<MaintenancePlans>(() => loadJSON('rcj_v1_maintenance_plans', initialMaintenancePlans));
  // v4: se sube la version de la llave cada vez que cambian los permisos por defecto, para que apliquen
  const [permissions, setPermissions] = useState<PermissionMatrix>(() => loadJSON('rcj_v4_permissions', defaultPermissions));
  const [syncingAssets, setSyncingAssets] = useState(false);
  const [lastAssetSync, setLastAssetSync] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // El rol y el nombre vienen de la sesion iniciada en el login
  const currentRole: UserRole = session?.role ?? 'tecnico';
  const currentUser = session?.name ?? '';

  const hasPermission = useCallback(
    (p: Permission) => permissions[currentRole]?.includes(p) ?? false,
    [permissions, currentRole]
  );

  // Si el usuario no tiene acceso al modulo pedido, se muestra el primero al que si tiene acceso
  const activeModule: ModuleKey = useMemo(() => {
    if (hasPermission(modulePermissions[requestedModule])) return requestedModule;
    const first = (Object.keys(modulePermissions) as ModuleKey[]).find(k => hasPermission(modulePermissions[k]));
    return first ?? requestedModule;
  }, [requestedModule, hasPermission]);

  const setRolePermission = useCallback((role: UserRole, permission: Permission, enabled: boolean) => {
    if (!enabled && isLocked(role, permission)) return;
    setPermissions(prev => {
      const current = prev[role] ?? [];
      const next = enabled
        ? (current.includes(permission) ? current : [...current, permission])
        : current.filter(p => p !== permission);
      return { ...prev, [role]: next };
    });
  }, []);

  const resetPermissions = useCallback(() => setPermissions(defaultPermissions), []);

  // Persistencia local: cada dominio se guarda completo en localStorage al cambiar.
  // Activos y OTs llevan fotos embebidas (dataUrl), asi que son los que mas facil
  // agotan la cuota del navegador; el resto son registros de texto livianos.
  useEffect(() => {
    if (!saveJSON('rcj_v1_assets', assets)) {
      setStorageWarning('No se pudieron guardar los activos localmente (almacenamiento lleno). Los cambios se mantienen solo en esta sesion.');
    }
  }, [assets]);

  useEffect(() => {
    if (!saveJSON('rcj_v1_work_orders', workOrders)) {
      setStorageWarning('No se pudieron guardar las ordenes de trabajo localmente (almacenamiento lleno). Los cambios se mantienen solo en esta sesion.');
    }
  }, [workOrders]);

  useEffect(() => { saveJSON('rcj_v1_asset_history', assetHistory); }, [assetHistory]);
  useEffect(() => { saveJSON('rcj_v1_parts', parts); }, [parts]);
  useEffect(() => { saveJSON('rcj_v1_movements', movements); }, [movements]);
  useEffect(() => { saveJSON('rcj_v1_fuel_loads', fuelLoads); }, [fuelLoads]);
  useEffect(() => { saveJSON('rcj_v1_notifications', notifications); }, [notifications]);
  useEffect(() => { saveJSON('rcj_v1_work_types', workTypes); }, [workTypes]);
  useEffect(() => { saveJSON('rcj_v1_maintenance_plans', maintenancePlans); }, [maintenancePlans]);
  useEffect(() => { saveJSON('rcj_v4_permissions', permissions); }, [permissions]);

  const pushNotification = useCallback((n: Omit<AppNotification, 'id' | 'read'>) => {
    setNotifications(prev => [{ ...n, id: genId(), read: false }, ...prev]);
  }, []);

  /** Entrada del historial de un activo (pestana Historial de su ficha) */
  const pushAssetHistory = useCallback((entry: Omit<AssetHistoryEntry, 'id'>) => {
    setAssetHistory(prev => [{ ...entry, id: genId() }, ...prev]);
  }, []);

  /** Movimiento de inventario generado por el consumo de repuestos en una linea de OT */
  const pushMovement = useCallback((m: Omit<InventoryMovement, 'id'>) => {
    setMovements(prev => [{ ...m, id: genId() }, ...prev]);
  }, []);

  const adjustStock = useCallback((partId: string, delta: number) => {
    setParts(prev => prev.map(p => (p.id === partId ? { ...p, currentStock: Math.max(0, p.currentStock + delta) } : p)));
  }, []);

  // ===== Catalogo de repuestos =====

  const addPart = useCallback((part: Omit<Part, 'id'>) => {
    setParts(prev => [...prev, { ...part, id: genId() }]);
  }, []);

  const updatePart = useCallback((id: string, patch: Partial<Part>) => {
    setParts(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const removePart = useCallback((id: string) => {
    setParts(prev => prev.filter(p => p.id !== id));
  }, []);

  const addAsset = useCallback((asset: Omit<Asset, 'id'>) => {
    setAssets(prev => [...prev, { ...asset, id: genId() }]);
  }, []);

  /** Simula la sincronizacion del activo/vehiculo con SAP */
  const syncAssetsFromSAP = useCallback((assetId?: string) => {
    setSyncingAssets(true);
    window.setTimeout(() => {
      const stamp = now();
      let synced = 0;
      let linked = 0;
      setAssets(prev => prev.map(a => {
        if (assetId && a.id !== assetId) return a;
        synced += 1;
        const sapCode = a.sapCode ?? `SAP-${a.code.replace('ACT-', '')}-${a.plate !== 'N/A' ? a.plate.replace('-', '') : 'EQ'}`;
        if (!a.sapCode) linked += 1;
        return { ...a, sapCode, sapSynced: true, lastSyncAt: stamp };
      }));
      setLastAssetSync(stamp);
      setSyncingAssets(false);
      pushNotification({
        type: 'aprobacion',
        title: assetId ? 'Activo sincronizado con SAP' : 'Sincronizacion con SAP completada',
        description: `${synced} activo${synced !== 1 ? 's' : ''} sincronizado${synced !== 1 ? 's' : ''}${linked > 0 ? ` - ${linked} vinculado${linked !== 1 ? 's' : ''} por primera vez` : ''}`,
        date: today(),
        reference: 'SAP',
        priority: 'baja',
      });
    }, 1200);
  }, [pushNotification]);

  const addAssetPhoto = useCallback((assetId: string, photo: Omit<AssetPhoto, 'id' | 'addedAt'>) => {
    const entry: AssetPhoto = { ...photo, id: genId(), addedAt: now() };
    setAssets(prev => prev.map(a => (a.id === assetId ? { ...a, photos: [...a.photos, entry] } : a)));
  }, []);

  const removeAssetPhoto = useCallback((assetId: string, photoId: string) => {
    setAssets(prev => prev.map(a => (a.id === assetId ? { ...a, photos: a.photos.filter(p => p.id !== photoId) } : a)));
  }, []);

  // ===== Flujo de la OT =====

  const transition = useCallback((id: string, status: OTStatus, patch: Partial<WorkOrder> = {}) => {
    setWorkOrders(prev => prev.map(ot => {
      if (ot.id !== id) return ot;
      return {
        ...ot,
        ...patch,
        status,
        history: [...ot.history, { status, at: now(), by: currentUser, role: currentRole }],
      };
    }));
  }, [currentRole, currentUser]);

  const addWorkOrder = useCallback((ot: NewWorkOrder) => {
    const stamp = now();
    const by = currentUser;
    const newOT: WorkOrder = {
      ...ot,
      id: genId(),
      status: 'pendiente_aprobacion',
      createdBy: by,
      lines: [],
      closedAt: null,
      approvedBy: null,
      signedBy: null,
      rejectedReason: null,
      estimatedCost: 0,
      history: [
        { status: 'creada', at: stamp, by, role: currentRole },
        { status: 'pendiente_aprobacion', at: stamp, by, role: currentRole },
      ],
    };
    setWorkOrders(prev => [newOT, ...prev]);
  }, [currentRole, currentUser]);

  const updateWorkOrderStatus = useCallback((id: string, status: OTStatus) => {
    transition(id, status, status === 'cerrada' ? { closedAt: today() } : {});
  }, [transition]);

  const submitForApproval = useCallback((id: string) => {
    transition(id, 'pendiente_aprobacion', { rejectedReason: null });
  }, [transition]);

  const approveWorkOrder = useCallback((id: string, approver: string) => {
    transition(id, 'aprobada', { approvedBy: approver, rejectedReason: null });
    const ot = workOrders.find(o => o.id === id);
    if (ot) {
      pushNotification({
        type: 'aprobacion',
        title: `${ot.code} aprobada`,
        description: `${ot.assetName} - lista para ejecucion`,
        date: today(),
        reference: ot.code,
        priority: 'media',
      });
    }
  }, [transition, workOrders, pushNotification]);

  const rejectWorkOrder = useCallback((id: string, reason: string) => {
    transition(id, 'creada', { rejectedReason: reason, approvedBy: null });
  }, [transition]);

  /** Deja constancia de la aprobacion sin alterar la etapa: la OT de emergencia ya se ejecuto */
  const approveEmergencyRetro = useCallback((id: string, approver: string) => {
    setWorkOrders(prev => prev.map(ot => (
      ot.id === id
        ? {
            ...ot,
            approvedBy: approver,
            rejectedReason: null,
            history: [...ot.history, { status: 'aprobada' as OTStatus, at: now(), by: approver, role: currentRole }],
          }
        : ot
    )));
    const ot = workOrders.find(o => o.id === id);
    if (ot) {
      pushNotification({
        type: 'aprobacion',
        title: `${ot.code} aprobada retroactivamente`,
        description: `Emergencia revisada y aprobada por ${approver}`,
        date: today(),
        reference: ot.code,
        priority: 'media',
      });
    }
  }, [currentRole, workOrders, pushNotification]);

  const assignWorkOrder = useCallback((id: string, assignedTo: string, type: 'tecnico' | 'taller_externo') => {
    setWorkOrders(prev => prev.map(ot => (ot.id === id ? { ...ot, assignedTo, assignedToType: type } : ot)));
    const ot = workOrders.find(o => o.id === id);
    if (ot) {
      pushNotification({
        type: 'aprobacion',
        title: `${ot.code} asignada`,
        description: `${ot.assetName} - ${type === 'tecnico' ? 'Tecnico' : 'Taller externo'}: ${assignedTo}`,
        date: today(),
        reference: ot.code,
        priority: 'media',
      });
    }
  }, [workOrders, pushNotification]);

  const startExecution = useCallback((id: string, technician: string) => {
    transition(id, 'en_ejecucion', { signedBy: null });
    const ot = workOrders.find(o => o.id === id);
    if (ot) {
      pushNotification({
        type: 'aprobacion',
        title: `${ot.code} en ejecucion`,
        description: `${ot.assetName} - a cargo de ${technician}`,
        date: today(),
        reference: ot.code,
        priority: 'baja',
      });
    }
  }, [transition, workOrders, pushNotification]);

  const finalizeWorkOrder = useCallback((id: string, signer: string) => {
    transition(id, 'finalizada', { signedBy: signer });
    const ot = workOrders.find(o => o.id === id);
    if (ot) {
      pushNotification({
        type: 'firma',
        title: `${ot.code} finalizada`,
        description: `${ot.assetName} - pendiente de revision y cierre`,
        date: today(),
        reference: ot.code,
        priority: 'alta',
      });
    }
  }, [transition, workOrders, pushNotification]);

  const closeWorkOrder = useCallback((id: string) => {
    transition(id, 'cerrada', { closedAt: today() });
    const ot = workOrders.find(o => o.id === id);
    if (ot) {
      pushAssetHistory({ assetId: ot.assetId, date: today(), type: 'ot', description: ot.description, reference: ot.code });
    }
  }, [transition, workOrders, pushAssetHistory]);

  // ===== Lineas de trabajo =====

  const patchLine = useCallback((otId: string, lineId: string, patch: (line: OTLine) => OTLine) => {
    setWorkOrders(prev => prev.map(ot => {
      if (ot.id !== otId) return ot;
      return { ...ot, lines: ot.lines.map(line => (line.id === lineId ? patch(line) : line)) };
    }));
  }, []);

  const addOTLine = useCallback<AppState['addOTLine']>((otId, line) => {
    const { parts: lineParts = [], photosBefore: linePhotos = [], ...data } = line;
    const newLine: OTLine = {
      ...data,
      id: genId(),
      createdAt: today(),
      startedAt: null,
      finishedAt: null,
      hours: 0,
      photosBefore: linePhotos.map(p => ({ ...p, id: genId(), addedAt: now() })),
      photosAfter: [],
      parts: lineParts,
      // el hallazgo nace pendiente: lo aprueba el Jefe de Taller, nunca quien lo registra
      findingStatus: line.isFinding ? 'pendiente' : 'no_aplica',
    };
    setWorkOrders(prev => prev.map(ot => (ot.id === otId ? { ...ot, lines: [...ot.lines, newLine] } : ot)));

    const ot = workOrders.find(o => o.id === otId);
    if (!ot) return;

    // los repuestos elegidos al crear la linea se consumen igual que desde el detalle de la linea
    lineParts.forEach(p => {
      adjustStock(p.partId, -p.quantity);
      pushMovement({
        partId: p.partId,
        partCode: p.partCode,
        partDescription: p.partDescription,
        type: 'salida',
        quantity: p.quantity,
        reason: `Consumo en linea de trabajo - ${line.work}`,
        reference: ot.code,
        user: currentUser,
        date: today(),
      });
      pushAssetHistory({
        assetId: ot.assetId,
        date: today(),
        type: 'movimiento',
        description: `Salida de repuesto - ${p.partDescription} x${p.quantity}`,
        reference: ot.code,
      });
    });

    if (line.notes) {
      pushNotification({
        type: 'hallazgo',
        title: `Nueva linea en ${ot.code}`,
        description: `${line.work} - ${line.notes}`,
        date: today(),
        reference: ot.code,
        priority: 'media',
      });
    }
  }, [workOrders, pushNotification, adjustStock, pushMovement, pushAssetHistory, currentUser]);

  const updateOTLine = useCallback((otId: string, lineId: string, patch: Partial<OTLine>) => {
    // la aprobacion del hallazgo solo se cambia via reviewFinding (Jefe de Taller)
    const safePatch = { ...patch };
    delete safePatch.findingStatus;
    patchLine(otId, lineId, line => ({ ...line, ...safePatch }));
  }, [patchLine]);

  const deleteOTLine = useCallback((otId: string, lineId: string) => {
    const ot = workOrders.find(o => o.id === otId);
    const line = ot?.lines.find(l => l.id === lineId);
    setWorkOrders(prev => prev.map(o =>
      o.id === otId ? { ...o, lines: o.lines.filter(l => l.id !== lineId) } : o
    ));
    // devolver al inventario los repuestos que la linea tenia consumidos
    if (ot && line) {
      line.parts.forEach(p => {
        adjustStock(p.partId, p.quantity);
        pushMovement({
          partId: p.partId,
          partCode: p.partCode,
          partDescription: p.partDescription,
          type: 'entrada',
          quantity: p.quantity,
          reason: `Reverso por eliminacion de linea - ${line.work}`,
          reference: ot.code,
          user: currentUser,
          date: today(),
        });
      });
    }
  }, [workOrders, adjustStock, pushMovement, currentUser]);

  const startLine = useCallback((otId: string, lineId: string) => {
    patchLine(otId, lineId, line => ({
      ...line,
      startedAt: line.startedAt ?? now(),
      finishedAt: null,
      status: 'en_ejecucion',
    }));
    // la primera linea que se inicia pone en ejecucion a la OT aprobada
    const ot = workOrders.find(o => o.id === otId);
    if (ot?.status === 'aprobada') startExecution(otId, ot.assignedTo ?? currentUser);
  }, [workOrders, patchLine, startExecution, currentUser]);

  const finishLine = useCallback((otId: string, lineId: string) => {
    const stamp = now();
    patchLine(otId, lineId, line => {
      const startedAt = line.startedAt ?? stamp;
      return {
        ...line,
        startedAt,
        finishedAt: stamp,
        hours: hoursBetween(startedAt, stamp) || line.hours,
        status: resolvedLineStatus(line.status),
      };
    });
  }, [patchLine]);

  const addLinePhoto = useCallback<AppState['addLinePhoto']>((otId, lineId, group, photo) => {
    const entry: OTLinePhoto = { ...photo, id: genId(), addedAt: now() };
    patchLine(otId, lineId, line => (
      group === 'before'
        ? { ...line, photosBefore: [...line.photosBefore, entry] }
        : { ...line, photosAfter: [...line.photosAfter, entry] }
    ));
  }, [patchLine]);

  const removeLinePhoto = useCallback<AppState['removeLinePhoto']>((otId, lineId, group, photoId) => {
    patchLine(otId, lineId, line => (
      group === 'before'
        ? { ...line, photosBefore: line.photosBefore.filter(p => p.id !== photoId) }
        : { ...line, photosAfter: line.photosAfter.filter(p => p.id !== photoId) }
    ));
  }, [patchLine]);

  const removeLinePart = useCallback((otId: string, lineId: string, partId: string) => {
    const ot = workOrders.find(o => o.id === otId);
    const line = ot?.lines.find(l => l.id === lineId);
    const part = line?.parts.find(p => p.partId === partId);
    if (!part) return;
    patchLine(otId, lineId, l => ({ ...l, parts: l.parts.filter(p => p.partId !== partId) }));
    adjustStock(partId, part.quantity);
    if (ot) {
      pushMovement({
        partId: part.partId,
        partCode: part.partCode,
        partDescription: part.partDescription,
        type: 'entrada',
        quantity: part.quantity,
        reason: `Reverso de consumo - ${line?.work ?? 'OT'}`,
        reference: ot.code,
        user: currentUser,
        date: today(),
      });
    }
  }, [workOrders, patchLine, adjustStock, pushMovement, currentUser]);

  const reviewFinding = useCallback((otId: string, lineId: string, approved: boolean) => {
    patchLine(otId, lineId, line => ({ ...line, findingStatus: approved ? 'aprobada' : 'rechazada' }));
    const ot = workOrders.find(o => o.id === otId);
    const line = ot?.lines.find(l => l.id === lineId);
    if (ot && line) {
      pushNotification({
        type: 'hallazgo',
        title: `Hallazgo ${approved ? 'aprobado' : 'rechazado'} en ${ot.code}`,
        description: `${line.work} - revisado por ${currentUser}`,
        date: today(),
        reference: ot.code,
        priority: approved ? 'media' : 'alta',
      });
    }
  }, [patchLine, workOrders, pushNotification, currentUser]);

  // ===== Tipos de Trabajo de la OT =====

  const addWorkType = useCallback((item: Omit<CatalogItem, 'id'>) => {
    setWorkTypes(prev => [...prev, { ...item, id: genId() }]);
  }, []);

  const updateWorkType = useCallback((id: string, patch: Partial<CatalogItem>) => {
    setWorkTypes(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const removeWorkType = useCallback((id: string) => {
    setWorkTypes(prev => prev.filter(c => c.id !== id));
  }, []);

  // ===== Planes de mantenimiento =====

  const addMaintenanceNode = useCallback((workType: OTWorkType, parentId: string | null, name: string) => {
    const newNode = { id: genId(), name, children: [] };
    setMaintenancePlans(prev => {
      const current = prev[workType] ?? [];
      const next = parentId === null
        ? [...current, newNode]
        : mapMaintenanceNode(current, parentId, n => ({ ...n, children: [...n.children, newNode] }));
      return { ...prev, [workType]: next };
    });
  }, []);

  const renameMaintenanceNode = useCallback((workType: OTWorkType, nodeId: string, name: string) => {
    setMaintenancePlans(prev => ({
      ...prev,
      [workType]: mapMaintenanceNode(prev[workType] ?? [], nodeId, n => ({ ...n, name })),
    }));
  }, []);

  const removeMaintenanceNode = useCallback((workType: OTWorkType, nodeId: string) => {
    setMaintenancePlans(prev => ({
      ...prev,
      [workType]: removeMaintenanceNodeById(prev[workType] ?? [], nodeId),
    }));
  }, []);

  const moveMaintenanceNode = useCallback<AppState['moveMaintenanceNode']>((workType, nodeId, targetId, position) => {
    setMaintenancePlans(prev => ({
      ...prev,
      [workType]: moveMaintenanceNodeInTree(prev[workType] ?? [], nodeId, targetId, position),
    }));
  }, []);

  const addFuelLoad = useCallback((f: Omit<FuelLoad, 'id'>) => {
    setFuelLoads(prev => [{ ...f, id: genId() }, ...prev]);
    pushAssetHistory({
      assetId: f.assetId,
      date: f.date,
      type: 'carga_combustible',
      description: `Carga de ${f.fuelType.replace('_', ' ')} - ${f.liters} L`,
      reference: f.provider,
    });
  }, [pushAssetHistory]);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const dismissStorageWarning = useCallback(() => setStorageWarning(null), []);

  const value = useMemo<AppState>(() => ({
    activeModule, setActiveModule,
    currentRole, currentUser,
    permissions, hasPermission, setRolePermission, resetPermissions,
    assets, assetHistory, addAsset, syncingAssets, lastAssetSync, syncAssetsFromSAP,
    addAssetPhoto, removeAssetPhoto,
    parts, addPart, updatePart, removePart, movements,
    workOrders, addWorkOrder, updateWorkOrderStatus, submitForApproval, approveWorkOrder,
    rejectWorkOrder, approveEmergencyRetro, assignWorkOrder, startExecution, finalizeWorkOrder, closeWorkOrder,
    addOTLine, updateOTLine, deleteOTLine, startLine, finishLine,
    addLinePhoto, removeLinePhoto, removeLinePart, reviewFinding,
    storageWarning, dismissStorageWarning,
    fuelLoads, addFuelLoad,
    notifications, markNotificationRead, markAllNotificationsRead, addNotification: pushNotification,
    workTypes, addWorkType, updateWorkType, removeWorkType,
    maintenancePlans, addMaintenanceNode, renameMaintenanceNode, removeMaintenanceNode, moveMaintenanceNode,
  }), [
    activeModule, currentRole, currentUser, permissions, hasPermission, setRolePermission, resetPermissions,
    assets, assetHistory, addAsset, syncingAssets, lastAssetSync, syncAssetsFromSAP, addAssetPhoto,
    removeAssetPhoto, parts, addPart, updatePart, removePart, movements, workOrders, addWorkOrder,
    updateWorkOrderStatus, submitForApproval,
    approveWorkOrder, rejectWorkOrder, approveEmergencyRetro, assignWorkOrder, startExecution,
    finalizeWorkOrder, closeWorkOrder, addOTLine, updateOTLine, deleteOTLine, startLine, finishLine,
    addLinePhoto, removeLinePhoto, removeLinePart, reviewFinding, storageWarning,
    dismissStorageWarning, fuelLoads, addFuelLoad, notifications, markNotificationRead,
    markAllNotificationsRead, pushNotification, workTypes, addWorkType, updateWorkType, removeWorkType,
    maintenancePlans, addMaintenanceNode, renameMaintenanceNode, removeMaintenanceNode, moveMaintenanceNode,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
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
  RequisitionSignature,
  RequisitionStep,
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
import {
  deliveredQuantity,
  dropInvalidRequesterRequisitions,
  firstMissingBefore,
  isDelivered,
  isRequisitionComplete,
  isRequisitionRequester,
  requiresRequisition,
  requisitionStepLabels,
  requisitionStepsFor,
  signaturesOf,
  signatureFor,
} from '@/lib/requisition';
import { useAuth } from '@/store/AuthContext';

export type PhotoGroup = 'before' | 'after';

type NewWorkOrder = Omit<
  WorkOrder,
  'id' | 'lines' | 'closedAt' | 'approvedBy' | 'signedBy' | 'inventorySignedBy' | 'inventorySignedAt' | 'sapSentAt'
  | 'rejectedReason' | 'estimatedCost' | 'history' | 'createdBy' | 'status'
>;

/** Linea de trabajo tal como la llena el formulario, antes de que el sistema le asigne id, fechas y requisa */
export type NewOTLine = Omit<OTLine, 'id' | 'createdAt' | 'photosBefore' | 'photosAfter' | 'parts' | 'startedAt' | 'finishedAt' | 'hours' | 'findingStatus'> & {
  parts?: OTLinePart[];
  photosBefore?: Omit<OTLinePhoto, 'id' | 'addedAt'>[];
};

interface AppState {
  // Navigation
  activeModule: ModuleKey;
  setActiveModule: (m: ModuleKey) => void;
  /** OT que otro modulo pidio abrir (p. ej. desde una requisa); Ordenes de Trabajo la abre y la limpia */
  pendingOTId: string | null;
  openWorkOrder: (otId: string) => void;
  clearPendingOT: () => void;
  /** Activo que otro modulo pidio abrir (p. ej. el vehiculo de una OT); Activos lo abre y lo limpia */
  pendingAssetId: string | null;
  openAsset: (assetId: string) => void;
  clearPendingAsset: () => void;

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
  /** Crea la OT ya con sus lineas de trabajo (y los repuestos que piden) en un solo paso */
  addWorkOrder: (ot: NewWorkOrder, lines?: NewOTLine[]) => void;
  /** Descripcion y prioridad de la OT (Jefe de Taller). Devuelve el motivo si no se pudo, o null. */
  updateWorkOrder: (id: string, patch: Partial<Pick<WorkOrder, 'description' | 'priority'>>) => string | null;
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
  signOTInventory: (id: string, signer: string) => void;

  // Lineas de trabajo
  /** `parts` son una solicitud (el stock sale al entregarse); `photosBefore` entran como la evidencia de la linea */
  addOTLine: (otId: string, line: NewOTLine) => void;
  updateOTLine: (otId: string, lineId: string, patch: Partial<OTLine>) => void;
  deleteOTLine: (otId: string, lineId: string) => void;
  /** Inicia la linea; si es la primera y la OT esta aprobada, la OT pasa a "En ejecucion" */
  startLine: (otId: string, lineId: string) => void;
  /** Finaliza la linea. La OT no se finaliza sola: la firma quien ejecuta con el boton "Finalizar OT" */
  finishLine: (otId: string, lineId: string) => void;
  addLinePhoto: (otId: string, lineId: string, group: PhotoGroup, photo: Omit<OTLinePhoto, 'id' | 'addedAt'>) => void;
  removeLinePhoto: (otId: string, lineId: string, group: PhotoGroup, photoId: string) => void;
  /**
   * Cambia los repuestos solicitados de una linea (agregar, quitar o cambiar cantidades). Solo el Jefe de Taller,
   * y solo antes de que Control de Inventario los entregue. Las firmas que ya tiene la requisa se conservan.
   */
  setLineParts: (otId: string, lineId: string, parts: OTLinePart[]) => string | null;
  /**
   * Firma una etapa de la requisa de repuestos de la linea. Cuando Control de Inventario aprueba y entrega
   * (`delivered`: cantidad por repuesto, por defecto lo maximo posible) se descuentan del inventario solo las
   * unidades entregadas. Devuelve el motivo si no se pudo firmar, o null.
   */
  signRequisition: (otId: string, lineId: string, step: RequisitionStep, delivered?: Record<string, number>) => string | null;
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

/** Llaves de localStorage. Subir la version de una llave descarta lo guardado de ese dominio. */
const storageKeys = {
  // v2: flota inicial de 20 vehiculos reales (Camion/Volqueta/Traileta/Vehiculo Ligero) precargada --
  // antes arrancaba vacio (ver mockData.ts)
  assets: 'rcj_v2_assets',
  assetHistory: 'rcj_v1_asset_history',
  // v2 (parts): catalogo inicial de 20 repuestos (Bodega/Ubicacion iguales en todos) precargado -- antes
  // arrancaba vacio (ver mockData.ts)
  parts: 'rcj_v2_parts',
  movements: 'rcj_v1_movements',
  workOrders: 'rcj_v1_work_orders',
  fuelLoads: 'rcj_v1_fuel_loads',
  notifications: 'rcj_v1_notifications',
  // v3: catalogo de fabrica completo (Camion/Volqueta/Traileta/Vehiculo Ligero con modelos, intervalos y
  // tareas en Preventivo/Correctivo; Emergencia/Inspeccion con mas items) -- sube de version de nuevo para
  // que el default nuevo reemplace lo que hubiera en v2 (ver mockData.ts)
  // v4 (solo maintenancePlans): Preventivo paso de intervalos por km/modelo generico a modelos con
  // clasificacion por numero de ruedas (6R/10R/12R + variante especializada) y mantenimiento por horas de
  // uso (800/1200/1600 Hrs), con todas las categorias completas -- antes solo Volqueta tenia este detalle
  // v5 (solo maintenancePlans): Correctivo gano el mismo nivel de Categoria>Modelo especifico que
  // Preventivo (antes saltaba directo a Categoria>Sistema); Emergencia e Inspeccion ganaron un nivel de
  // acciones/puntos concretos bajo cada tipo (antes eran listas planas de un solo nivel)
  workTypes: 'rcj_v3_work_types',
  maintenancePlans: 'rcj_v5_maintenance_plans',
  permissions: 'rcj_v9_permissions',
  requisitionRepair: 'rcj_requisition_repair_v1',
} as const;

/** Permiso que habilita firmar cada paso de la requisa */
const stepPermissions: Record<RequisitionStep, Permission> = {
  solicitante: 'requisa.solicitar',
  autoriza: 'requisa.autorizar',
  despacha: 'requisa.despachar',
  // quien solicita es quien confirma que recibio: el mismo permiso
  recibe: 'requisa.solicitar',
};

/** Generador de numeros de requisa: REQ-<anio>-0001, consecutivo entre todas las lineas */
function requisitionCodeSequence(orders: WorkOrder[]): () => string {
  let max = orders.flatMap(o => o.lines).reduce((acc, l) => {
    const n = Number(l.requisition?.code.split('-').pop());
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  const year = today().slice(0, 4);
  return () => `REQ-${year}-${String(++max).padStart(4, '0')}`;
}

/**
 * Una sola requisa (un solo codigo/documento) por OT: si otra linea de la misma OT ya tiene una, se reutiliza
 * su codigo en vez de generar uno nuevo. Las firmas siguen siendo por linea (cada una su propio
 * Solicitante->Jefe->Control->Receptor), solo el codigo/documento se comparte.
 */
function otRequisitionCode(ot: WorkOrder | undefined, nextCode: () => string): string {
  return ot?.lines.find(l => l.requisition?.code)?.requisition?.code ?? nextCode();
}

/** Horas trabajadas entre dos marcas de tiempo, redondeadas a cuartos de hora */
function hoursBetween(startedAt: string, finishedAt: string): number {
  const diff = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.round((diff / 3_600_000) * 4) / 4;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { session, users } = useAuth();
  const [requestedModule, setActiveModule] = useState<ModuleKey>('activos');
  const [pendingOTId, setPendingOTId] = useState<string | null>(null);
  const [pendingAssetId, setPendingAssetId] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>(() => loadJSON(storageKeys.assets, initialAssets));
  const [assetHistory, setAssetHistory] = useState<AssetHistoryEntry[]>(() => loadJSON(storageKeys.assetHistory, initialAssetHistory));
  const [parts, setParts] = useState<Part[]>(() => loadJSON(storageKeys.parts, initialParts));
  const [movements, setMovements] = useState<InventoryMovement[]>(() => loadJSON(storageKeys.movements, initialMovements));
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() => {
    const stored = loadJSON<WorkOrder[]>(storageKeys.workOrders, initialWorkOrders);
    // una sola vez: reinicia las requisas firmadas como solicitante por quien no es tecnico (regla anterior)
    return loadJSON<boolean>(storageKeys.requisitionRepair, false) ? stored : dropInvalidRequesterRequisitions(stored);
  });
  const [fuelLoads, setFuelLoads] = useState<FuelLoad[]>(() => loadJSON(storageKeys.fuelLoads, initialFuelLoads));
  const [notifications, setNotifications] = useState<AppNotification[]>(() => loadJSON(storageKeys.notifications, initialNotifications));
  const [workTypes, setWorkTypes] = useState<CatalogItem[]>(() => loadJSON(storageKeys.workTypes, initialWorkTypes));
  const [maintenancePlans, setMaintenancePlans] = useState<MaintenancePlans>(() => loadJSON(storageKeys.maintenancePlans, initialMaintenancePlans));
  // v4: se sube la version de la llave cada vez que cambian los permisos por defecto, para que apliquen
  const [permissions, setPermissions] = useState<PermissionMatrix>(() => loadJSON(storageKeys.permissions, defaultPermissions));
  // la matriz solo se guarda cuando el administrador la edita: asi una pestana con una copia vieja en memoria
  // nunca sobrescribe los permisos por defecto vigentes
  const permissionsEdited = useRef(false);
  const [syncingAssets, setSyncingAssets] = useState(false);
  const [lastAssetSync, setLastAssetSync] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  // El rol y el nombre vienen de la sesion iniciada en el login
  const currentRole: UserRole = session?.role ?? 'tecnico';
  const currentUser = session?.name ?? '';
  // la firma que el usuario dibujo al entrar por primera vez: se hereda en todo lo que firma
  const currentSignature = useMemo(
    () => users.find(u => u.id === session?.userId)?.signature ?? null,
    [users, session]
  );

  const openWorkOrder = useCallback((otId: string) => {
    setActiveModule('ordenes');
    setPendingOTId(otId);
  }, []);
  const clearPendingOT = useCallback(() => setPendingOTId(null), []);

  const openAsset = useCallback((assetId: string) => {
    setActiveModule('activos');
    setPendingAssetId(assetId);
  }, []);
  const clearPendingAsset = useCallback(() => setPendingAssetId(null), []);

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
    permissionsEdited.current = true;
    setPermissions(prev => {
      const current = prev[role] ?? [];
      const next = enabled
        ? (current.includes(permission) ? current : [...current, permission])
        : current.filter(p => p !== permission);
      return { ...prev, [role]: next };
    });
  }, []);

  const resetPermissions = useCallback(() => {
    permissionsEdited.current = true;
    setPermissions(defaultPermissions);
  }, []);

  // Persistencia local: cada dominio se guarda completo en localStorage al cambiar.
  // Activos y OTs llevan fotos embebidas (dataUrl), asi que son los que mas facil
  // agotan la cuota del navegador; el resto son registros de texto livianos.
  useEffect(() => {
    if (!saveJSON(storageKeys.assets, assets)) {
      setStorageWarning('No se pudieron guardar los activos localmente (almacenamiento lleno). Los cambios se mantienen solo en esta sesion.');
    }
  }, [assets]);

  useEffect(() => {
    if (!saveJSON(storageKeys.workOrders, workOrders)) {
      setStorageWarning('No se pudieron guardar las ordenes de trabajo localmente (almacenamiento lleno). Los cambios se mantienen solo en esta sesion.');
    }
  }, [workOrders]);

  useEffect(() => { saveJSON(storageKeys.assetHistory, assetHistory); }, [assetHistory]);
  useEffect(() => { saveJSON(storageKeys.parts, parts); }, [parts]);
  useEffect(() => { saveJSON(storageKeys.movements, movements); }, [movements]);
  useEffect(() => { saveJSON(storageKeys.fuelLoads, fuelLoads); }, [fuelLoads]);
  useEffect(() => { saveJSON(storageKeys.notifications, notifications); }, [notifications]);
  useEffect(() => { saveJSON(storageKeys.workTypes, workTypes); }, [workTypes]);
  useEffect(() => { saveJSON(storageKeys.maintenancePlans, maintenancePlans); }, [maintenancePlans]);
  useEffect(() => { if (permissionsEdited.current) saveJSON(storageKeys.permissions, permissions); }, [permissions]);
  useEffect(() => { saveJSON(storageKeys.requisitionRepair, true); }, []);

  // Sincronizacion entre pestanas: cuando otra pestana guarda un dominio, esta lo recarga sin necesitar F5.
  // Guardar el mismo valor no dispara el evento, asi que no hay rebote entre pestanas.
  useEffect(() => {
    const apply: Record<string, (value: unknown) => void> = {
      [storageKeys.assets]: v => setAssets(v as Asset[]),
      [storageKeys.assetHistory]: v => setAssetHistory(v as AssetHistoryEntry[]),
      [storageKeys.parts]: v => setParts(v as Part[]),
      [storageKeys.movements]: v => setMovements(v as InventoryMovement[]),
      [storageKeys.workOrders]: v => setWorkOrders(v as WorkOrder[]),
      [storageKeys.fuelLoads]: v => setFuelLoads(v as FuelLoad[]),
      [storageKeys.notifications]: v => setNotifications(v as AppNotification[]),
      [storageKeys.workTypes]: v => setWorkTypes(v as CatalogItem[]),
      [storageKeys.maintenancePlans]: v => setMaintenancePlans(v as MaintenancePlans),
      [storageKeys.permissions]: v => setPermissions(v as PermissionMatrix),
    };
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== window.localStorage || !e.key || e.newValue === null) return;
      const set = apply[e.key];
      if (!set) return;
      try {
        set(JSON.parse(e.newValue));
      } catch {
        // valor ilegible: se conserva el estado actual
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

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
        history: [...ot.history, { status, at: now(), by: currentUser, role: currentRole, signature: currentSignature }],
      };
    }));
  }, [currentRole, currentUser, currentSignature]);

  /**
   * Arma la linea que se guarda a partir de lo que llena el formulario. "Solicitado por" se infiere del
   * tecnico que crea la OT o la linea: si pide repuestos, su firma guardada queda registrada sola y la
   * requisa nace ya solicitada (el Jefe de Taller es el siguiente en firmar).
   */
  const buildLine = useCallback((input: NewOTLine, nextCode: () => string): { line: OTLine; requested: boolean } => {
    const { parts: lineParts = [], photosBefore: linePhotos = [], ...data } = input;
    const requested = currentRole === 'tecnico' && hasPermission('requisa.solicitar') && input.needsPart && lineParts.length > 0;
    const line: OTLine = {
      ...data,
      id: genId(),
      createdAt: today(),
      startedAt: null,
      finishedAt: null,
      hours: 0,
      photosBefore: linePhotos.map(p => ({ ...p, id: genId(), addedAt: now() })),
      photosAfter: [],
      parts: lineParts,
      // los repuestos elegidos son una solicitud: el stock sale cuando Control de Inventario los entrega
      requisition: requested
        ? {
            code: nextCode(),
            signatures: [{ step: 'solicitante', role: currentRole, name: currentUser, at: now(), signature: currentSignature }],
            releasedAt: null,
            receiptRequired: true,
          }
        : null,
      // el hallazgo nace pendiente: lo aprueba el Jefe de Taller, nunca quien lo registra
      findingStatus: input.isFinding ? 'pendiente' : 'no_aplica',
    };
    return { line, requested };
  }, [currentRole, currentUser, currentSignature, hasPermission]);

  const notifyRequisitionRequested = useCallback((otCode: string, line: OTLine) => {
    if (!line.requisition) return;
    pushNotification({
      type: 'aprobacion',
      title: `Requisa ${line.requisition.code} pendiente de firma`,
      description: `${otCode} - ${line.work} - solicitada por ${currentUser}`,
      date: today(),
      reference: line.requisition.code,
      priority: 'media',
    });
  }, [pushNotification, currentUser]);

  const addWorkOrder = useCallback((ot: NewWorkOrder, newLines: NewOTLine[] = []) => {
    const stamp = now();
    const by = currentUser;
    const nextCode = requisitionCodeSequence(workOrders);
    // si varias lineas nuevas piden repuestos a la vez, comparten un solo codigo de requisa (un documento por OT)
    let sharedCode: string | null = null;
    const getCode = () => (sharedCode ??= nextCode());
    const built = newLines.map(l => buildLine(l, getCode));
    const newOT: WorkOrder = {
      ...ot,
      id: genId(),
      status: 'pendiente_aprobacion',
      createdBy: by,
      lines: built.map(b => b.line),
      closedAt: null,
      approvedBy: null,
      signedBy: null,
      inventorySignedBy: null,
      inventorySignedAt: null,
      sapSentAt: null,
      rejectedReason: null,
      estimatedCost: 0,
      history: [
        { status: 'creada', at: stamp, by, role: currentRole, signature: currentSignature },
        { status: 'pendiente_aprobacion', at: stamp, by, role: currentRole, signature: currentSignature },
      ],
    };
    setWorkOrders(prev => [newOT, ...prev]);
    built.forEach(b => { if (b.requested) notifyRequisitionRequested(newOT.code, b.line); });
  }, [currentRole, currentUser, currentSignature, workOrders, buildLine, notifyRequisitionRequested]);

  const updateWorkOrder = useCallback<AppState['updateWorkOrder']>((id, patch) => {
    if (!hasPermission('ot.lineas.editar')) return 'Tu rol no puede editar la OT.';
    const ot = workOrders.find(o => o.id === id);
    if (!ot) return 'No se encontro la OT.';
    if (ot.status === 'cerrada' || ot.status === 'rechazada') return 'Una OT cerrada o rechazada ya no se modifica.';
    if (patch.description !== undefined && !patch.description.trim()) return 'La descripcion no puede quedar vacia.';
    setWorkOrders(prev => prev.map(o => (o.id === id
      ? { ...o, ...patch, ...(patch.description !== undefined ? { description: patch.description.trim() } : {}) }
      : o)));
    return null;
  }, [hasPermission, workOrders]);

  const updateWorkOrderStatus = useCallback((id: string, status: OTStatus) => {
    transition(id, status, status === 'cerrada' ? { closedAt: today() } : {});
  }, [transition]);

  const submitForApproval = useCallback((id: string) => {
    transition(id, 'pendiente_aprobacion', { rejectedReason: null });
  }, [transition]);

  // definida antes de approveWorkOrder porque la usa para poner en ejecucion la OT cuando alguna
  // linea arranca sola (sin repuestos por solicitar) al aprobarse
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

  const approveWorkOrder = useCallback((id: string, approver: string) => {
    transition(id, 'aprobada', { approvedBy: approver, rejectedReason: null });
    const ot = workOrders.find(o => o.id === id);
    // las lineas sin repuestos por solicitar no esperan firmas: arrancan solas al aprobarse la OT, sin boton "Iniciar"
    const autoStarts = ot?.lines.some(l => !l.startedAt && !requiresRequisition(l)) ?? false;
    if (autoStarts) {
      setWorkOrders(prev => prev.map(o => (
        o.id === id
          ? { ...o, lines: o.lines.map(l => (!l.startedAt && !requiresRequisition(l) ? { ...l, startedAt: now(), finishedAt: null, status: 'en_ejecucion' as const } : l)) }
          : o
      )));
      startExecution(id, ot?.assignedTo ?? approver);
    }
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
  }, [transition, workOrders, pushNotification, startExecution]);

  const rejectWorkOrder = useCallback((id: string, reason: string) => {
    // rechazada es terminal: no vuelve a "creada" para reenviarse, queda cerrada por completo
    transition(id, 'rechazada', { rejectedReason: reason, approvedBy: null });
  }, [transition]);

  /** Deja constancia de la aprobacion sin alterar la etapa: la OT de emergencia ya se ejecuto */
  const approveEmergencyRetro = useCallback((id: string, approver: string) => {
    setWorkOrders(prev => prev.map(ot => (
      ot.id === id
        ? {
            ...ot,
            approvedBy: approver,
            rejectedReason: null,
            history: [...ot.history, { status: 'aprobada' as OTStatus, at: now(), by: approver, role: currentRole, signature: currentSignature }],
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
  }, [currentRole, currentSignature, workOrders, pushNotification]);

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

  const finalizeWorkOrder = useCallback((id: string, signer: string) => {
    const stamp = now();
    // ya no hay boton "Finalizar" por linea: al finalizar la OT, toda linea ya iniciada ("en_ejecucion") se
    // marca completada sola. Las "pendiente" (requisa sin completar), "esperando_repuesto" y
    // "requiere_seguimiento" no se tocan aqui: blockingReason sigue impidiendo finalizar mientras existan.
    setWorkOrders(prev => prev.map(ot => (
      ot.id === id
        ? {
            ...ot,
            lines: ot.lines.map(l => (
              l.status === 'en_ejecucion'
                ? { ...l, startedAt: l.startedAt ?? stamp, finishedAt: stamp, hours: hoursBetween(l.startedAt ?? stamp, stamp) || l.hours, status: 'completado' as const }
                : l
            )),
          }
        : ot
    )));
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
    // "Enviado a SAP" es la ultima etapa de la linea de tiempo: se simula automatica e instantanea al
    // cerrar (siempre exitosa), no requiere una accion aparte del usuario.
    transition(id, 'cerrada', { closedAt: today(), sapSentAt: now() });
    const ot = workOrders.find(o => o.id === id);
    if (ot) {
      pushAssetHistory({ assetId: ot.assetId, date: today(), type: 'ot', description: ot.description, reference: ot.code });
    }
  }, [transition, workOrders, pushAssetHistory]);

  // Firma de Control de Inventario sobre el documento de la OT: no cambia el estado ni depende
  // de "Firmar y cerrar OT" del Jefe de Taller, cada una se firma en el orden que corresponda.
  const signOTInventory = useCallback((id: string, signer: string) => {
    setWorkOrders(prev => prev.map(ot => (
      ot.id === id ? { ...ot, inventorySignedBy: signer, inventorySignedAt: now() } : ot
    )));
  }, []);

  // ===== Lineas de trabajo =====

  const patchLine = useCallback((otId: string, lineId: string, patch: (line: OTLine) => OTLine) => {
    setWorkOrders(prev => prev.map(ot => {
      if (ot.id !== otId) return ot;
      return { ...ot, lines: ot.lines.map(line => (line.id === lineId ? patch(line) : line)) };
    }));
  }, []);

  const addOTLine = useCallback<AppState['addOTLine']>((otId, line) => {
    const ot = workOrders.find(o => o.id === otId);
    // si la OT ya tiene una requisa (de otra linea), esta nueva linea se suma a ese mismo documento
    const { line: built, requested } = buildLine(line, () => otRequisitionCode(ot, requisitionCodeSequence(workOrders)));
    // sin repuestos por solicitar y la OT ya se puede ejecutar: la linea arranca sola, sin boton "Iniciar"
    const newLine = ot && (ot.status === 'aprobada' || ot.status === 'en_ejecucion') && !requiresRequisition(built)
      ? { ...built, startedAt: now(), status: 'en_ejecucion' as const }
      : built;
    setWorkOrders(prev => prev.map(o => (o.id === otId ? { ...o, lines: [...o.lines, newLine] } : o)));

    if (!ot) return;
    if (newLine.startedAt && ot.status === 'aprobada') startExecution(otId, ot.assignedTo ?? currentUser);
    if (requested) notifyRequisitionRequested(ot.code, newLine);

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
  }, [workOrders, buildLine, notifyRequisitionRequested, pushNotification, startExecution, currentUser]);

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
    // devolver al inventario lo que Control de Inventario ya entrego (y se desconto); lo solicitado y no entregado nunca salio
    if (ot && line && isDelivered(line)) {
      line.parts.forEach(p => {
        const back = deliveredQuantity(line, p);
        if (back <= 0) return;
        adjustStock(p.partId, back);
        pushMovement({
          partId: p.partId,
          partCode: p.partCode,
          partDescription: p.partDescription,
          type: 'entrada',
          quantity: back,
          reason: `Reverso por eliminacion de linea - ${line.work}`,
          reference: ot.code,
          user: currentUser,
          date: today(),
        });
      });
    }
  }, [workOrders, adjustStock, pushMovement, currentUser]);

  const startLine = useCallback((otId: string, lineId: string) => {
    // una linea con requisa no inicia hasta completarla (solicitud, autorizacion, aprobacion/entrega y recepcion)
    const target = workOrders.find(o => o.id === otId)?.lines.find(l => l.id === lineId);
    if (target && requiresRequisition(target) && !isRequisitionComplete(target)) return;
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

  const setLineParts = useCallback<AppState['setLineParts']>((otId, lineId, nextParts) => {
    if (!hasPermission('ot.lineas.editar')) return 'Tu rol no puede modificar los repuestos.';
    const ot = workOrders.find(o => o.id === otId);
    const line = ot?.lines.find(l => l.id === lineId);
    if (!ot || !line) return 'No se encontro la linea de la OT.';
    if (ot.status === 'cerrada' || ot.status === 'rechazada') return 'Una OT cerrada o rechazada ya no se modifica.';
    // mientras los repuestos no salgan del inventario se pueden cambiar; despues el stock ya no cuadraria
    if (isDelivered(line)) return 'Control de Inventario ya entrego estos repuestos; no se pueden modificar.';
    if (nextParts.some(p => !Number.isInteger(p.quantity) || p.quantity <= 0)) return 'Las cantidades deben ser numeros enteros mayores a cero.';
    if (new Set(nextParts.map(p => p.partId)).size !== nextParts.length) return 'Un repuesto no puede repetirse en la misma linea.';
    // las firmas que ya tiene la requisa se conservan tal cual
    patchLine(otId, lineId, l => ({ ...l, parts: nextParts.map(p => ({ ...p, deliveredQuantity: undefined })), needsPart: nextParts.length > 0 }));
    return null;
  }, [hasPermission, workOrders, patchLine]);

  const signRequisition = useCallback<AppState['signRequisition']>((otId, lineId, step, delivered) => {
    const ot = workOrders.find(o => o.id === otId);
    const line = ot?.lines.find(l => l.id === lineId);
    if (!ot || !line) return 'No se encontro la linea de la OT.';
    if (ot.status === 'cerrada' || ot.status === 'rechazada') return 'Una OT cerrada o rechazada ya no se modifica.';
    if (!requiresRequisition(line)) return 'Esta linea no tiene repuestos por solicitar.';
    if (!requisitionStepsFor(line).includes(step)) return 'Esta etapa no aplica a la requisa.';
    if (signatureFor(line, step)) return 'Esta firma ya esta registrada.';
    if (!hasPermission(stepPermissions[step])) return 'Tu rol no puede firmar esta etapa de la requisa.';
    if ((step === 'solicitante' || step === 'recibe') && !isRequisitionRequester(line, ot.assignedTo, currentUser)) {
      return step === 'solicitante'
        ? 'Solo el tecnico de la linea puede firmar la solicitud.'
        : 'Solo el tecnico de la linea puede confirmar que recibio los repuestos.';
    }
    const previous = firstMissingBefore(line, step);
    if (previous) return `Falta la firma de "${requisitionStepLabels[previous]}" antes de firmar esta etapa.`;

    // Control de Inventario entrega lo que hay: por repuesto, entre 0 y lo menor entre lo solicitado y el stock
    let deliveredParts: OTLinePart[] | null = null;
    if (step === 'despacha') {
      const plan = line.parts.map(p => {
        const max = Math.min(p.quantity, parts.find(x => x.id === p.partId)?.currentStock ?? 0);
        return { part: p, max, qty: Math.floor(delivered?.[p.partId] ?? max) };
      });
      const invalid = plan.find(x => !Number.isFinite(x.qty) || x.qty < 0 || x.qty > x.max);
      if (invalid) return `La cantidad a entregar de ${invalid.part.partDescription} debe estar entre 0 y ${invalid.max}.`;
      if (plan.every(x => x.qty === 0)) return 'No hay nada que entregar: indica al menos una unidad (revisa el stock disponible).';
      deliveredParts = plan.map(x => ({ ...x.part, deliveredQuantity: x.qty }));
    }

    const stamp = now();
    const code = line.requisition?.code ?? otRequisitionCode(ot, requisitionCodeSequence(workOrders));
    const signature: RequisitionSignature = {
      step,
      role: currentRole,
      name: currentUser,
      at: stamp,
      signature: currentSignature,
      // "Entregado a": el tecnico que solicito, a quien Control le entrega los repuestos
      ...(step === 'despacha' ? { deliveredTo: signatureFor(line, 'solicitante')?.name ?? ot.assignedTo ?? line.technician } : {}),
    };
    const signatures = [...signaturesOf(line), signature];
    const releasedAt = step === 'despacha' ? stamp : (line.requisition?.releasedAt ?? null);
    // sin boton "Iniciar": en cuanto la requisa queda completa (ultima firma que falta), la linea arranca sola
    const requisitionNowComplete = requisitionStepsFor(line).every(s => signatures.some(x => x.step === s));
    const autoStarts = requisitionNowComplete && !line.startedAt;
    patchLine(otId, lineId, l => ({
      ...l,
      parts: deliveredParts ?? l.parts,
      requisition: { code, signatures, releasedAt, receiptRequired: l.requisition?.receiptRequired ?? true },
      ...(autoStarts ? { startedAt: stamp, finishedAt: null, status: 'en_ejecucion' as const } : {}),
    }));
    if (autoStarts && ot.status === 'aprobada') startExecution(otId, ot.assignedTo ?? currentUser);

    if (step === 'solicitante') {
      pushNotification({
        type: 'aprobacion',
        title: `Requisa ${code} pendiente de firma`,
        description: `${ot.code} - ${line.work} - solicitada por ${currentUser}`,
        date: today(),
        reference: code,
        priority: 'media',
      });
    }

    if (deliveredParts) {
      deliveredParts.forEach(p => {
        const qty = p.deliveredQuantity ?? 0;
        if (qty <= 0) return;
        adjustStock(p.partId, -qty);
        pushMovement({
          partId: p.partId,
          partCode: p.partCode,
          partDescription: p.partDescription,
          type: 'salida',
          quantity: qty,
          reason: `Requisa ${code} - ${line.work}${qty < p.quantity ? ` (entrega parcial ${qty} de ${p.quantity})` : ''}`,
          reference: ot.code,
          user: currentUser,
          date: today(),
        });
        pushAssetHistory({
          assetId: ot.assetId,
          date: today(),
          type: 'movimiento',
          description: `Salida de repuesto - ${p.partDescription} x${qty}`,
          reference: ot.code,
        });
      });
      pushNotification({
        type: 'firma',
        title: `Requisa ${code} entregada`,
        description: `${ot.code} - ${line.work} - pendiente de que el tecnico confirme la recepcion`,
        date: today(),
        reference: code,
        priority: 'alta',
      });
    }

    if (step === 'recibe') {
      pushNotification({
        type: 'firma',
        title: `Requisa ${code} recibida`,
        description: `${ot.code} - ${line.work} - en ejecucion`,
        date: today(),
        reference: code,
        priority: 'media',
      });
    }
    return null;
  }, [workOrders, parts, patchLine, adjustStock, pushMovement, pushAssetHistory, pushNotification, hasPermission, currentRole, currentUser, currentSignature, startExecution]);

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
    activeModule, setActiveModule, pendingOTId, openWorkOrder, clearPendingOT,
    pendingAssetId, openAsset, clearPendingAsset,
    currentRole, currentUser,
    permissions, hasPermission, setRolePermission, resetPermissions,
    assets, assetHistory, addAsset, syncingAssets, lastAssetSync, syncAssetsFromSAP,
    addAssetPhoto, removeAssetPhoto,
    parts, addPart, updatePart, removePart, movements,
    workOrders, addWorkOrder, updateWorkOrder, updateWorkOrderStatus, submitForApproval, approveWorkOrder,
    rejectWorkOrder, approveEmergencyRetro, assignWorkOrder, startExecution, finalizeWorkOrder, closeWorkOrder, signOTInventory,
    addOTLine, updateOTLine, deleteOTLine, startLine, finishLine,
    addLinePhoto, removeLinePhoto, setLineParts, signRequisition, reviewFinding,
    storageWarning, dismissStorageWarning,
    fuelLoads, addFuelLoad,
    notifications, markNotificationRead, markAllNotificationsRead, addNotification: pushNotification,
    workTypes, addWorkType, updateWorkType, removeWorkType,
    maintenancePlans, addMaintenanceNode, renameMaintenanceNode, removeMaintenanceNode, moveMaintenanceNode,
  }), [
    activeModule, pendingOTId, openWorkOrder, clearPendingOT, pendingAssetId, openAsset, clearPendingAsset, currentRole, currentUser, permissions, hasPermission, setRolePermission, resetPermissions,
    assets, assetHistory, addAsset, syncingAssets, lastAssetSync, syncAssetsFromSAP, addAssetPhoto,
    removeAssetPhoto, parts, addPart, updatePart, removePart, movements, workOrders, addWorkOrder, updateWorkOrder,
    updateWorkOrderStatus, submitForApproval,
    approveWorkOrder, rejectWorkOrder, approveEmergencyRetro, assignWorkOrder, startExecution,
    finalizeWorkOrder, closeWorkOrder, signOTInventory, addOTLine, updateOTLine, deleteOTLine, startLine, finishLine,
    addLinePhoto, removeLinePhoto, setLineParts, signRequisition, reviewFinding, storageWarning,
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

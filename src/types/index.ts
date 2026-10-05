// ===== Core Types =====

export type AssetStatus = 'operativo' | 'en_mantenimiento' | 'fuera_de_servicio' | 'baja';
export type AssetType = 'vehiculo_ligero' | 'vehiculo_pesado' | 'maquinaria' | 'equipo_auxiliar';

export interface Asset {
  id: string;
  code: string;
  name: string;
  type: AssetType;
  location: string;
  status: AssetStatus;
  lastMaintenance: string;
  sapCode: string | null;
  sapSynced: boolean;
  lastSyncAt: string | null;
  brand: string;
  model: string;
  year: number;
  plate: string;
  engine: string;
  chassis: string;
  odometer: number;
  acquisitionDate: string;
  acquisitionCost: number;
  photos: AssetPhoto[];
}

/** Fotografia del estado actual del activo */
export interface AssetPhoto {
  id: string;
  dataUrl: string;
  name: string;
  addedAt: string;
}

export interface AssetHistoryEntry {
  id: string;
  assetId: string;
  date: string;
  type: 'ot' | 'movimiento' | 'carga_combustible';
  description: string;
  reference: string;
}

// ===== Inventory Types =====

export interface Part {
  id: string;
  code: string;
  description: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unitCost: number;
  warehouse: string;
  location: string;
  /** Unidad de medida (UND, KG, Toneladas, ...); hoy se ingresa a mano, mas adelante vendra de SAP */
  unit: string;
}

export type MovementType = 'entrada' | 'salida';

export interface InventoryMovement {
  id: string;
  partId: string;
  partCode: string;
  partDescription: string;
  type: MovementType;
  quantity: number;
  reason: string;
  reference: string;
  user: string;
  date: string;
}

// ===== Work Order Types =====

export type OTStatus =
  | 'creada'
  | 'pendiente_aprobacion'
  | 'aprobada'
  | 'en_ejecucion'
  | 'finalizada'
  | 'cerrada'
  /** Terminal: el Jefe de Taller la rechazo. No vuelve a "creada", queda cerrada por completo. */
  | 'rechazada';

/** Codigo del catalogo editable "Tipos de Trabajo de la OT" (Administracion). No es una union fija: el administrador puede agregar o eliminar tipos. */
export type OTWorkType = string;
export type OTPriority = 'baja' | 'media' | 'alta' | 'critica';

/** Roles del sistema */
export type UserRole = 'administrador' | 'jefe_taller' | 'control_inventario' | 'tecnico';

/**
 * Etapas de la requisa de repuestos, en orden: el tecnico la solicita ("Solicitado por"), el Jefe de Taller la
 * autoriza ("Autorizado por"), Control de Inventario la aprueba y entrega ("Aprobado por" / "Entregado a") y el
 * tecnico confirma que la recibio ("Recibido por").
 */
export type RequisitionStep = 'solicitante' | 'autoriza' | 'despacha' | 'recibe';

export interface RequisitionSignature {
  step: RequisitionStep;
  role: UserRole;
  name: string;
  at: string;
  /** Firma dibujada por quien firma (la guardada en su perfil), en PNG; ausente en firmas anteriores a esa funcion */
  signature?: string | null;
  /** Solo en el paso "despacha": tecnico a quien se entregaron los repuestos ("Entregado a") */
  deliveredTo?: string;
}

/** Requisa de los repuestos de una linea: se crea con la firma del solicitante */
export interface LineRequisition {
  code: string;
  signatures: RequisitionSignature[];
  /** Cuando Control de Inventario entrego los repuestos y se descontaron del inventario */
  releasedAt: string | null;
  /**
   * true cuando la requisa termina con la confirmacion "Recibido por" del tecnico. Las requisas que ya se habian
   * entregado antes de existir ese paso no lo traen y se consideran completas al entregarse.
   */
  receiptRequired?: boolean;
}

/** Estado de aprobacion de una linea marcada como hallazgo */
export type FindingStatus = 'no_aplica' | 'pendiente' | 'aprobada' | 'rechazada';

export type OTLineStatus =
  | 'pendiente'
  | 'en_ejecucion'
  | 'esperando_repuesto'
  | 'completado'
  | 'completado_con_observaciones'
  | 'no_completado'
  | 'requiere_seguimiento';

export interface OTLinePhoto {
  id: string;
  dataUrl: string;
  name: string;
  addedAt: string;
}

export interface OTLinePart {
  partId: string;
  partCode: string;
  partDescription: string;
  /** Unidad de medida del repuesto (copiada de Part.unit al elegirlo) */
  unit: string;
  /** Cantidad solicitada */
  quantity: number;
  unitCost: number;
  /** Cantidad que Control de Inventario entrego (puede ser menor a la solicitada si no habia stock); ausente antes de la entrega */
  deliveredQuantity?: number;
  /** Observacion propia de este repuesto (distinta de las observaciones generales de la linea) */
  notes?: string;
}

/** Actividad de un plan de mantenimiento elegida para una linea */
export interface OTActivity {
  name: string;
}

/** Linea de trabajo: unidad independiente de ejecucion y trazabilidad dentro de una OT */
export interface OTLine {
  id: string;
  /** Ruta completa del plan ("Preventivo > Camion > ...") o, si el tipo no tiene plan, el texto libre */
  work: string;
  /** Nombres de la ruta elegida (tipo de trabajo y niveles); vacio en lineas de texto libre o anteriores */
  workPath: string[];
  activities: OTActivity[];
  status: OTLineStatus;
  technician: string;
  startedAt: string | null;
  finishedAt: string | null;
  hours: number;
  photosBefore: OTLinePhoto[];
  photosAfter: OTLinePhoto[];
  parts: OTLinePart[];
  notes: string;
  /** Aviso de planificacion: no bloquea el cierre ni la ejecucion de la linea */
  needsPart: boolean;
  /** Requisa de los repuestos; ausente en lineas anteriores a este flujo */
  requisition?: LineRequisition | null;
  isFinding: boolean;
  findingStatus: FindingStatus;
  createdAt: string;
}

export interface OTHistoryEntry {
  status: OTStatus;
  at: string;
  by: string;
  role: UserRole;
  /** Firma guardada de quien hizo el cambio de etapa, para los documentos de la OT */
  signature?: string | null;
}

/** Parte de la OT que cambio: una fila del log de modificaciones */
export type OTLogEntity = 'ot' | 'linea' | 'repuesto' | 'requisa' | 'evidencia' | 'hallazgo' | 'sap';

/** Una modificacion de una OT. Las filas solo se agregan: nunca se editan ni se borran. */
export interface OTLogEntry {
  id: string;
  otId: string;
  otCode: string;
  /** Linea afectada; null si el cambio es de la OT completa */
  lineId: string | null;
  at: string;
  /** Usuario que hizo el cambio (o el firmante, en las firmas de la requisa) */
  by: string;
  role: UserRole | 'sistema';
  entity: OTLogEntity;
  action: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  /** Frase legible del cambio */
  summary: string;
  reason: string | null;
  signatureStep: RequisitionStep | null;
}

export interface WorkOrder {
  id: string;
  code: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  priority: OTPriority;
  status: OTStatus;
  description: string;
  createdAt: string;
  createdBy: string;
  /** Tecnico de taller o taller externo responsable de la ejecucion */
  assignedTo: string | null;
  assignedToType: 'tecnico' | 'taller_externo' | null;
  /** Equipo de tecnicos asignados (el principal es `assignedTo`); vacio si la OT va a un taller externo */
  assignedTeam: string[];
  closedAt: string | null;
  approvedBy: string | null;
  signedBy: string | null;
  /** Firma de Control de Inventario sobre el documento completo de la OT; etapa previa obligatoria a Finalizar */
  inventorySignedBy: string | null;
  inventorySignedAt: string | null;
  /** Envio a SAP: automatico y simulado al cerrar la OT (ultima etapa de la linea de tiempo) */
  sapSentAt: string | null;
  rejectedReason: string | null;
  lines: OTLine[];
  estimatedCost: number;
  history: OTHistoryEntry[];
  /** Evidencia a nivel de OT (no por linea): se agrega desde "Nueva OT" o desde "Agregar linea de trabajo" */
  photos: AssetPhoto[];
}

// ===== Fuel Types =====

export interface FuelLoad {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  date: string;
  liters: number;
  fuelType: 'diesel' | 'gasolina_87' | 'gasolina_91' | 'gasolina_95';
  cost: number;
  odometer: number;
  provider: string;
  unitPrice: number;
}

// ===== Notification Types =====

export type NotificationType = 'aprobacion' | 'firma' | 'hallazgo' | 'bajo_stock' | 'ot_vencida';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  date: string;
  reference: string;
  read: boolean;
  priority: 'alta' | 'media' | 'baja';
}

// ===== Catalogs =====

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  description: string;
  active: boolean;
}

/**
 * Nodo de un plan de mantenimiento: arbol generico y personalizable por Tipo de Trabajo.
 * Preventivo/Correctivo suelen anidar Tipo de Vehiculo -> Intervalo de Horas -> Tareas;
 * Emergencia/Inspeccion suelen quedar en un solo nivel (hijos directos sin nietos).
 * La profundidad la decide el administrador agregando o no hijos a cada nodo.
 */
export interface MaintenanceTreeNode {
  id: string;
  name: string;
  children: MaintenanceTreeNode[];
}

export type MaintenancePlans = Record<OTWorkType, MaintenanceTreeNode[]>;

// ===== Auth Types =====

export interface AppUser {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  active: boolean;
  /** Firma dibujada por el usuario la primera vez que inicia sesion (PNG); se hereda en los documentos que firma */
  signature?: string | null;
}

export interface Session {
  userId: string;
  username: string;
  name: string;
  role: UserRole;
  loggedAt: string;
}

// ===== Module Types =====
export type ModuleKey =
  | 'activos'
  | 'inventario'
  | 'ordenes'
  | 'combustible'
  | 'reportes'
  | 'notificaciones'
  | 'requisas'
  | 'administracion';

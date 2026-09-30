import type {
  Asset,
  AssetHistoryEntry,
  Part,
  InventoryMovement,
  WorkOrder,
  FuelLoad,
  AppNotification,
  CatalogItem,
  MaintenancePlans,
  MaintenanceTreeNode,
} from '@/types';

/**
 * Arranque en cero para la demo: no hay activos, repuestos, OTs, cargas de
 * combustible ni notificaciones precargadas. Todo se introduce manualmente
 * desde la interfaz y queda persistido en localStorage (ver src/lib/localStore.ts
 * y su uso en AppContext/AuthContext). Los Tipos de Trabajo y sus Planes de
 * Mantenimiento SI vienen precargados (ver mas abajo): son un catalogo de
 * referencia pensado para que la inferencia de vehiculo -> tipo de trabajo
 * (al elegir el vehiculo en "Nueva OT") tenga con que calzar desde el primer uso;
 * el administrador los puede editar/borrar libremente desde "Tipos de Trabajo" y
 * "Planes de Mantenimiento" como cualquier otro catalogo.
 */

export const initialAssets: Asset[] = [];

export const initialAssetHistory: AssetHistoryEntry[] = [];

export const initialParts: Part[] = [];

export const initialMovements: InventoryMovement[] = [];

export const initialWorkOrders: WorkOrder[] = [];

export const initialFuelLoads: FuelLoad[] = [];

export const initialNotifications: AppNotification[] = [];

let planNodeSeq = 0;
/** Nodo del arbol de un plan de mantenimiento, con id autogenerado y estable dentro de esta semilla */
const node = (name: string, children: MaintenanceTreeNode[] = []): MaintenanceTreeNode => ({
  id: `mp-${++planNodeSeq}`,
  name,
  children,
});

/**
 * Categorias de flota (Camion/Volqueta/Traileta/Vehiculo Ligero, con sus modelos especificos): es el
 * primer y segundo nivel de Preventivo a proposito, porque `inferNodeIds` (lib/planSelection.ts) compara
 * el nombre de cada nodo contra `asset.brand`/`model`/`name`/tipo -- "Vehiculo Ligero" infiere solo por
 * el tipo del activo; "Camion"/"Volqueta"/"Traileta" (categorias mas finas que el tipo de activo) infieren
 * solo si esa palabra tambien aparece en el nombre/marca/modelo del vehiculo cargado. El modelo especifico
 * (segundo nivel, p. ej. "Toyota Hilux") normalmente SI infiere solo con marca+modelo del activo.
 */
const fleetCategories: { name: string; models: string[]; intervals: string[]; extraTasks: string[] }[] = [
  {
    name: 'Camion',
    models: ['Toyota Hilux', 'Trailer Kenworth T800', 'Camion de Carga', 'Camion de Cisterna', 'Camion de Plataforma'],
    intervals: ['Cada 10,000 km', 'Cada 20,000 km', 'Cada 40,000 km'],
    extraTasks: ['Revision de sistema de frenos de aire', 'Inspeccion de carroceria y carga'],
  },
  {
    name: 'Volqueta',
    models: ['Volqueta Kenworth T800', 'Volqueta Mack Granite', 'Volqueta International 7600'],
    intervals: ['Cada 10,000 km', 'Cada 20,000 km', 'Cada 40,000 km'],
    extraTasks: ['Revision de sistema hidraulico de volteo', 'Inspeccion de compuerta trasera'],
  },
  {
    name: 'Traileta',
    models: ['Traileta Refrigerada', 'Traileta Seca', 'Traileta Plataforma'],
    intervals: ['Cada 10,000 km', 'Cada 20,000 km', 'Cada 40,000 km'],
    extraTasks: ['Revision de ejes y suspension', 'Revision de luces y conexion electrica'],
  },
  {
    name: 'Vehiculo Ligero',
    models: ['Nissan Frontier', 'Chevrolet Dmax', 'Hyundai H100', 'Toyota Corolla'],
    intervals: ['Cada 5,000 km', 'Cada 10,000 km', 'Cada 20,000 km'],
    extraTasks: ['Rotacion de llantas'],
  },
];

const commonPmTasks = [
  'Cambio de aceite y filtro de motor',
  'Revision de frenos',
  'Revision de niveles de fluidos',
  'Cambio de filtro de aire',
  'Revision de bandas y mangueras',
];

const correctiveSystems = ['Motor', 'Frenos', 'Suspension', 'Sistema electrico', 'Transmision', 'Sistema de refrigeracion'];
const correctiveTasksBySystem: Record<string, string[]> = {
  'Motor': ['Fuga de aceite', 'Sobrecalentamiento', 'Perdida de potencia', 'Ruido anormal del motor'],
  'Frenos': ['Frenos no responden', 'Ruido al frenar', 'Pedal esponjoso', 'Desgaste irregular de pastillas'],
  'Suspension': ['Ruido en la suspension', 'Vehiculo se inclina hacia un lado', 'Amortiguador dañado'],
  'Sistema electrico': ['Bateria no carga', 'Luces no encienden', 'Falla de arranque'],
  'Transmision': ['Cambios bruscos', 'Fuga de aceite de transmision', 'Dificultad para cambiar de marcha'],
  'Sistema de refrigeracion': ['Fuga de refrigerante', 'Ventilador no enciende', 'Radiador obstruido'],
};

/** Camion/Volqueta/Traileta/Vehiculo Ligero > modelo especifico > intervalo > tareas */
const preventivoPlan: MaintenanceTreeNode[] = fleetCategories.map(cat => node(cat.name,
  cat.models.map(model => node(model,
    cat.intervals.map(interval => node(interval, [...commonPmTasks, ...cat.extraTasks].map(t => node(t))))))));

/** Camion/Volqueta/Traileta/Vehiculo Ligero > sistema > sintoma o falla (sin nivel de modelo: la falla se reporta por sistema) */
const correctivoPlan: MaintenanceTreeNode[] = fleetCategories.map(cat => node(cat.name,
  correctiveSystems.map(system => node(system, (correctiveTasksBySystem[system] ?? []).map(t => node(t))))));

/** Emergencia e Inspeccion quedan en un solo nivel (no se anidan por vehiculo): se elige directo de la lista */
const emergenciaPlan: MaintenanceTreeNode[] = [
  'Vehiculo varado en via', 'Accidente de transito', 'Falla total de frenos', 'Incendio o conato de incendio',
  'Volcadura', 'Perdida de control del vehiculo', 'Falla critica de motor en ruta', 'Llanta reventada en carretera',
  'Colision con daños materiales',
].map(t => node(t));

const inspeccionPlan: MaintenanceTreeNode[] = [
  'Inspeccion pre-viaje', 'Revision tecnico-mecanica', 'Inspeccion de frenos', 'Inspeccion de luces y señales',
  'Inspeccion de llantas', 'Inspeccion de extintor y botiquin', 'Inspeccion de cinturones de seguridad',
  'Inspeccion de placas y documentos', 'Inspeccion de fugas de fluidos',
].map(t => node(t));

/**
 * Tipos de Trabajo: catalogo editable desde Administracion. El campo `code` es la llave de
 * `maintenancePlans`. Se agregan/quitan mas desde la pestana "Tipos de Trabajo" y de inmediato
 * quedan disponibles al agregar lineas de trabajo y como pestana en Planes de Mantenimiento.
 */
export const initialWorkTypes: CatalogItem[] = [
  { id: 'wt-prev', code: 'PREV', name: 'Mantenimiento Preventivo', description: 'Mantenimiento programado segun kilometraje u horas de uso', active: true },
  { id: 'wt-corr', code: 'CORR', name: 'Mantenimiento Correctivo', description: 'Reparacion de fallas o averias detectadas', active: true },
  { id: 'wt-emer', code: 'EMER', name: 'Emergencia', description: 'Atencion inmediata por incidentes en ruta', active: true },
  { id: 'wt-insp', code: 'INSP', name: 'Inspeccion Programada', description: 'Revisiones y chequeos periodicos obligatorios', active: true },
];

/** Planes de mantenimiento: arbol personalizable por Tipo de Trabajo (ver `node()` y las listas de arriba). */
export const initialMaintenancePlans: MaintenancePlans = {
  PREV: preventivoPlan,
  CORR: correctivoPlan,
  EMER: emergenciaPlan,
  INSP: inspeccionPlan,
};

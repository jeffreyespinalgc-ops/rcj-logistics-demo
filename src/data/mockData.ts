import type {
  Asset,
  AssetType,
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
 * Arranque en cero para la demo: no hay repuestos, OTs, cargas de combustible ni notificaciones
 * precargadas. Todo eso se introduce manualmente desde la interfaz y queda persistido en localStorage
 * (ver src/lib/localStore.ts y su uso en AppContext/AuthContext). Los Tipos de Trabajo, sus Planes de
 * Mantenimiento y la flota inicial de Activos (ver mas abajo) SI vienen precargados: son catalogos de
 * referencia pensados para que la inferencia de vehiculo -> tipo de trabajo (al elegir el vehiculo en
 * "Nueva OT") tenga con que calzar desde el primer uso; el administrador los puede editar/borrar
 * libremente desde "Tipos de Trabajo", "Planes de Mantenimiento" y "Activos" como cualquier otro catalogo.
 */

/**
 * Flota inicial (2026-10-01, lista real entregada por el usuario). "Categoria" es mas fina que
 * `AssetType` (Camion/Volqueta/Traileta caen todos en 'vehiculo_pesado') por lo que se antepone al
 * nombre del activo en los 3 primeros casos, para que `inferNodeIds` (lib/planSelection.ts) pueda
 * distinguirlos al elegir el vehiculo en "Nueva OT" -- igual que ya distinguen los nodos de primer nivel
 * de Planes de Mantenimiento ("Camion"/"Volqueta"/"Traileta"/"Vehiculo Ligero"). "Numero de Chasis" y
 * "VIN del Motor" de la lista mapean a `chassis`/`engine` tal cual los nombro el usuario.
 */
const fleetSeedRows: { category: string; brand: string; model: string; year: number; chassis: string; engine: string }[] = [
  { category: 'Camion', brand: 'Freightliner', model: 'M2 106', year: 2022, chassis: 'CHS-FL-M2-22001', engine: 'ENG-FL-M2-22001' },
  { category: 'Camion', brand: 'International', model: 'MV607', year: 2021, chassis: 'CHS-IN-MV-21002', engine: 'ENG-IN-MV-21002' },
  { category: 'Camion', brand: 'Hino', model: '500 FC', year: 2023, chassis: 'CHS-HN-500-23003', engine: 'ENG-HN-500-23003' },
  { category: 'Camion', brand: 'Isuzu', model: 'FVR', year: 2020, chassis: 'CHS-IZ-FVR-20004', engine: 'ENG-IZ-FVR-20004' },
  { category: 'Camion', brand: 'Kenworth', model: 'T370', year: 2022, chassis: 'CHS-KW-T37-22005', engine: 'ENG-KW-T37-22005' },
  { category: 'Volqueta', brand: 'Mack', model: 'Granite', year: 2021, chassis: 'CHS-MK-GRA-21006', engine: 'ENG-MK-GRA-21006' },
  { category: 'Volqueta', brand: 'Volvo', model: 'FMX 440', year: 2023, chassis: 'CHS-VL-FMX-23007', engine: 'ENG-VL-FMX-23007' },
  { category: 'Volqueta', brand: 'Scania', model: 'P410', year: 2022, chassis: 'CHS-SC-P41-22008', engine: 'ENG-SC-P41-22008' },
  { category: 'Volqueta', brand: 'Mercedes-Benz', model: 'Arocs 3345', year: 2020, chassis: 'CHS-MB-ARC-20009', engine: 'ENG-MB-ARC-20009' },
  { category: 'Volqueta', brand: 'Shacman', model: 'X3000', year: 2023, chassis: 'CHS-SH-X30-23010', engine: 'ENG-SH-X30-23010' },
  { category: 'Traileta', brand: 'Freightliner', model: 'Cascadia 126', year: 2022, chassis: 'CHS-FL-CAS-22011', engine: 'ENG-FL-CAS-22011' },
  { category: 'Traileta', brand: 'Kenworth', model: 'T680', year: 2023, chassis: 'CHS-KW-T68-23012', engine: 'ENG-KW-T68-23012' },
  { category: 'Traileta', brand: 'International', model: 'LT625', year: 2021, chassis: 'CHS-IN-LT6-21013', engine: 'ENG-IN-LT6-21013' },
  { category: 'Traileta', brand: 'Volvo', model: 'VNL 760', year: 2020, chassis: 'CHS-VL-VNL-20014', engine: 'ENG-VL-VNL-20014' },
  { category: 'Traileta', brand: 'Peterbilt', model: '579', year: 2022, chassis: 'CHS-PB-579-22015', engine: 'ENG-PB-579-22015' },
  { category: 'Vehiculo Ligero', brand: 'Toyota', model: 'Hilux', year: 2023, chassis: 'CHS-TY-HLX-23016', engine: 'ENG-TY-HLX-23016' },
  { category: 'Vehiculo Ligero', brand: 'Ford', model: 'Ranger', year: 2022, chassis: 'CHS-FD-RNG-22017', engine: 'ENG-FD-RNG-22017' },
  { category: 'Vehiculo Ligero', brand: 'Chevrolet', model: 'Colorado', year: 2021, chassis: 'CHS-CV-CLD-21018', engine: 'ENG-CV-CLD-21018' },
  { category: 'Vehiculo Ligero', brand: 'Nissan', model: 'Frontier', year: 2023, chassis: 'CHS-NI-FRT-23019', engine: 'ENG-NI-FRT-23019' },
  { category: 'Vehiculo Ligero', brand: 'Mitsubishi', model: 'L200', year: 2020, chassis: 'CHS-MT-L20-20020', engine: 'ENG-MT-L20-20020' },
];

export const initialAssets: Asset[] = fleetSeedRows.map((v, i) => {
  const code = `A-${String(i + 1).padStart(3, '0')}`;
  const type: AssetType = v.category === 'Vehiculo Ligero' ? 'vehiculo_ligero' : 'vehiculo_pesado';
  const name = v.category === 'Vehiculo Ligero' ? `${v.brand} ${v.model}` : `${v.category} ${v.brand} ${v.model}`;
  const acquisitionDate = `${v.year}-01-15`;
  return {
    id: `asset-${code}`,
    code,
    name,
    type,
    location: 'Taller',
    status: 'operativo',
    lastMaintenance: acquisitionDate,
    sapCode: null,
    sapSynced: false,
    lastSyncAt: null,
    brand: v.brand,
    model: v.model,
    year: v.year,
    plate: '',
    engine: v.engine,
    chassis: v.chassis,
    odometer: 0,
    acquisitionDate,
    acquisitionCost: 0,
    photos: [],
  };
});

export const initialAssetHistory: AssetHistoryEntry[] = [];

/**
 * Catalogo inicial de 20 repuestos (2026-10-01, pedido del usuario): Bodega y Ubicacion iguales en todos
 * ("Almacen Central" / "A-01-01", confirmado con el usuario); el resto de los valores (categoria, stock,
 * costo, unidad de medida) varia por repuesto, cubriendo las categorias que ya se usan en Planes de
 * Mantenimiento (filtros, frenos, lubricantes, electrico, suspension, neumaticos, correas y mangueras).
 */
const partSeedRows: { code: string; description: string; category: string; currentStock: number; minStock: number; maxStock: number; unitCost: number; unit: string }[] = [
  { code: 'REP-001', description: 'Filtro de aceite', category: 'Filtros', currentStock: 45, minStock: 10, maxStock: 60, unitCost: 180, unit: 'UND' },
  { code: 'REP-002', description: 'Filtro de aire', category: 'Filtros', currentStock: 38, minStock: 8, maxStock: 50, unitCost: 220, unit: 'UND' },
  { code: 'REP-003', description: 'Filtro de combustible', category: 'Filtros', currentStock: 30, minStock: 8, maxStock: 45, unitCost: 150, unit: 'UND' },
  { code: 'REP-004', description: 'Filtro hidraulico', category: 'Filtros', currentStock: 15, minStock: 5, maxStock: 25, unitCost: 320, unit: 'UND' },
  { code: 'REP-005', description: 'Aceite de motor 15W40', category: 'Lubricantes', currentStock: 60, minStock: 15, maxStock: 100, unitCost: 280, unit: 'GALONES' },
  { code: 'REP-006', description: 'Aceite hidraulico', category: 'Lubricantes', currentStock: 25, minStock: 8, maxStock: 40, unitCost: 310, unit: 'GALONES' },
  { code: 'REP-007', description: 'Grasa multiproposito', category: 'Lubricantes', currentStock: 40, minStock: 10, maxStock: 60, unitCost: 90, unit: 'LB' },
  { code: 'REP-008', description: 'Refrigerante', category: 'Lubricantes', currentStock: 35, minStock: 10, maxStock: 50, unitCost: 150, unit: 'LITROS' },
  { code: 'REP-009', description: 'Pastillas de freno', category: 'Frenos', currentStock: 20, minStock: 6, maxStock: 30, unitCost: 650, unit: 'UND' },
  { code: 'REP-010', description: 'Bandas de freno', category: 'Frenos', currentStock: 18, minStock: 5, maxStock: 25, unitCost: 850, unit: 'UND' },
  { code: 'REP-011', description: 'Liquido de frenos', category: 'Frenos', currentStock: 30, minStock: 8, maxStock: 45, unitCost: 120, unit: 'LITROS' },
  { code: 'REP-012', description: 'Disco de freno', category: 'Frenos', currentStock: 10, minStock: 3, maxStock: 15, unitCost: 1200, unit: 'UND' },
  { code: 'REP-013', description: 'Bateria 12V', category: 'Sistema Electrico', currentStock: 8, minStock: 2, maxStock: 12, unitCost: 2800, unit: 'UND' },
  { code: 'REP-014', description: 'Bombillo de faro', category: 'Sistema Electrico', currentStock: 25, minStock: 6, maxStock: 35, unitCost: 95, unit: 'UND' },
  { code: 'REP-015', description: 'Fusible automotriz', category: 'Sistema Electrico', currentStock: 20, minStock: 5, maxStock: 30, unitCost: 60, unit: 'FARDO' },
  { code: 'REP-016', description: 'Amortiguador delantero', category: 'Suspension', currentStock: 12, minStock: 3, maxStock: 18, unitCost: 1500, unit: 'UND' },
  { code: 'REP-017', description: 'Resorte de suspension', category: 'Suspension', currentStock: 10, minStock: 3, maxStock: 15, unitCost: 980, unit: 'UND' },
  { code: 'REP-018', description: 'Llanta 295/80 R22.5', category: 'Neumaticos', currentStock: 16, minStock: 4, maxStock: 24, unitCost: 4200, unit: 'UND' },
  { code: 'REP-019', description: 'Banda de transmision', category: 'Correas y Mangueras', currentStock: 22, minStock: 6, maxStock: 30, unitCost: 310, unit: 'UND' },
  { code: 'REP-020', description: 'Manguera de radiador', category: 'Correas y Mangueras', currentStock: 18, minStock: 5, maxStock: 25, unitCost: 180, unit: 'UND' },
];

export const initialParts: Part[] = partSeedRows.map((p, i) => ({
  id: `part-${String(i + 1).padStart(3, '0')}`,
  code: p.code,
  description: p.description,
  category: p.category,
  currentStock: p.currentStock,
  minStock: p.minStock,
  maxStock: p.maxStock,
  unitCost: p.unitCost,
  warehouse: 'Almacen Central',
  location: 'A-01-01',
  unit: p.unit,
}));

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
 * (segundo nivel, p. ej. "Volqueta 6R") normalmente SI infiere solo con marca+modelo del activo.
 *
 * Vehiculos pesados (Camion/Volqueta/Traileta) se mantienen por HORAS de uso (clasificacion por numero de
 * ruedas: 6R/10R/12R, mas una variante especializada por categoria); Vehiculo Ligero se mantiene por
 * KILOMETRAJE, como cualquier pickup/automovil.
 */
const heavyCategories: { name: string; models: string[] }[] = [
  { name: 'Camion', models: ['Camion 6R', 'Camion 10R', 'Camion 12R', 'Camion Cisterna'] },
  { name: 'Volqueta', models: ['Volqueta 6R', 'Volqueta 10R', 'Volqueta 12R', 'Volqueta de Mineria'] },
  { name: 'Traileta', models: ['Traileta 4R', 'Traileta 6R', 'Traileta Refrigerada', 'Traileta Plataforma'] },
];

/** Tareas por nivel de horas: cada tramo acumula mas alcance que el anterior, como un plan de mantenimiento real */
const hourTiers: { label: string; tasks: string[] }[] = [
  {
    label: 'Mantenimiento 800 Hrs',
    tasks: [
      'Recepcion de vehiculo',
      'Cambio de aceite',
      'Cambio de filtro de aire',
      'Calibracion de valvula',
      'Verificacion de despacho',
    ],
  },
  {
    label: 'Mantenimiento 1200 Hrs',
    tasks: [
      'Recepcion de vehiculo',
      'Cambio de aceite y filtro',
      'Cambio de filtro de combustible',
      'Calibracion de valvula',
      'Revision de sistema de frenos de aire',
      'Revision de niveles de fluidos',
      'Verificacion de despacho',
    ],
  },
  {
    label: 'Mantenimiento 1600 Hrs',
    tasks: [
      'Recepcion de vehiculo',
      'Cambio de aceite y filtro',
      'Cambio de filtro de combustible',
      'Revision de sistema de frenos de aire',
      'Revision de transmision',
      'Revision de sistema electrico',
      'Inspeccion de carroceria y chasis',
      'Verificacion de despacho',
    ],
  },
];

const lightVehicleModels = ['Nissan Frontier', 'Chevrolet Dmax', 'Hyundai H100', 'Toyota Corolla'];

const kmTiers: { label: string; tasks: string[] }[] = [
  {
    label: 'Cada 5,000 km',
    tasks: ['Recepcion de vehiculo', 'Cambio de aceite y filtro de motor', 'Revision de niveles de fluidos'],
  },
  {
    label: 'Cada 10,000 km',
    tasks: ['Recepcion de vehiculo', 'Cambio de aceite y filtro de motor', 'Revision de frenos', 'Cambio de filtro de aire', 'Rotacion de llantas'],
  },
  {
    label: 'Cada 20,000 km',
    tasks: ['Recepcion de vehiculo', 'Cambio de aceite y filtro de motor', 'Revision de frenos', 'Revision de bandas y mangueras', 'Alineacion y balanceo', 'Revision de sistema electrico'],
  },
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

/** Camion/Volqueta/Traileta (por horas) + Vehiculo Ligero (por kilometraje) > modelo especifico > intervalo > tareas */
const preventivoPlan: MaintenanceTreeNode[] = [
  ...heavyCategories.map(cat => node(cat.name,
    cat.models.map(model => node(model,
      hourTiers.map(tier => node(tier.label, tier.tasks.map(t => node(t)))))))),
  node('Vehiculo Ligero',
    lightVehicleModels.map(model => node(model,
      kmTiers.map(tier => node(tier.label, tier.tasks.map(t => node(t))))))),
];

/** Mismos niveles de Categoria/Modelo especifico que Preventivo; el ultimo nivel cambia a sistema > sintoma o falla */
const correctivoPlan: MaintenanceTreeNode[] = [
  ...heavyCategories.map(cat => node(cat.name,
    cat.models.map(model => node(model,
      correctiveSystems.map(system => node(system, (correctiveTasksBySystem[system] ?? []).map(t => node(t)))))))),
  node('Vehiculo Ligero',
    lightVehicleModels.map(model => node(model,
      correctiveSystems.map(system => node(system, (correctiveTasksBySystem[system] ?? []).map(t => node(t))))))),
];

/** Emergencia e Inspeccion no se anidan por vehiculo (no aplica un modelo especifico): tipo > acciones/puntos concretos */
const emergencyResponses: Record<string, string[]> = {
  'Vehiculo varado en via': ['Notificar a despacho', 'Contactar grua o auxilio vial', 'Senalizar el vehiculo en la via', 'Evaluar y documentar la causa'],
  'Accidente de transito': ['Resguardar el area y senalizar', 'Atender heridos si los hay', 'Notificar a la policia de transito', 'Tomar fotografias para el reporte', 'Notificar a la aseguradora'],
  'Falla total de frenos': ['Detener el vehiculo de forma segura', 'Notificar a despacho de inmediato', 'Solicitar grua, no continuar la ruta', 'Inspeccionar el sistema de frenos antes de mover el vehiculo'],
  'Incendio o conato de incendio': ['Detener el vehiculo y apagar el motor', 'Evacuar a los ocupantes', 'Usar extintor si es seguro hacerlo', 'Notificar a bomberos y a despacho'],
  'Volcadura': ['Asegurar la escena y senalizar', 'Atender heridos si los hay', 'Notificar a despacho y a la policia', 'No mover el vehiculo hasta el peritaje'],
  'Perdida de control del vehiculo': ['Detener el vehiculo de forma segura', 'Inspeccionar llantas, direccion y suspension', 'Notificar a despacho', 'No continuar la ruta sin inspeccion'],
  'Falla critica de motor en ruta': ['Detener el vehiculo de forma segura', 'Notificar a despacho', 'Solicitar grua si no arranca', 'Documentar los sintomas de la falla'],
  'Llanta reventada en carretera': ['Detener el vehiculo de forma segura', 'Senalizar el vehiculo', 'Cambiar la llanta si es seguro hacerlo', 'Notificar a despacho'],
  'Colision con daños materiales': ['Resguardar el area y senalizar', 'Notificar a la policia de transito', 'Tomar fotografias para el reporte', 'Notificar a la aseguradora'],
};
const emergenciaPlan: MaintenanceTreeNode[] = Object.entries(emergencyResponses).map(([type, actions]) => node(type, actions.map(a => node(a))));

const inspectionCheckpoints: Record<string, string[]> = {
  'Inspeccion pre-viaje': ['Niveles de aceite y refrigerante', 'Presion de llantas', 'Luces y frenos', 'Documentos del vehiculo'],
  'Revision tecnico-mecanica': ['Sistema de direccion', 'Sistema de suspension', 'Emisiones de escape', 'Ruidos anormales del motor'],
  'Inspeccion de frenos': ['Estado de pastillas o bandas', 'Nivel de liquido de frenos', 'Prueba de frenado'],
  'Inspeccion de luces y señales': ['Luces altas y bajas', 'Direccionales', 'Luces de freno', 'Luces de reversa'],
  'Inspeccion de llantas': ['Presion de aire', 'Desgaste de la banda', 'Estado de los rines', 'Llanta de repuesto'],
  'Inspeccion de extintor y botiquin': ['Vigencia del extintor', 'Presion del extintor', 'Contenido del botiquin'],
  'Inspeccion de cinturones de seguridad': ['Funcionamiento del seguro', 'Estado de la cinta', 'Anclajes'],
  'Inspeccion de placas y documentos': ['Placa visible y vigente', 'Tarjeta de circulacion', 'Seguro vigente', 'Permiso de operacion'],
  'Inspeccion de fugas de fluidos': ['Fuga de aceite de motor', 'Fuga de refrigerante', 'Fuga de liquido de frenos', 'Fuga de combustible'],
};
const inspeccionPlan: MaintenanceTreeNode[] = Object.entries(inspectionCheckpoints).map(([type, points]) => node(type, points.map(p => node(p))));

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

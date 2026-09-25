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
} from '@/types';

/**
 * Arranque en cero para la demo: no hay activos, repuestos, OTs, cargas de
 * combustible, notificaciones ni tipos de trabajo precargados. Todo se
 * introduce manualmente desde la interfaz y queda persistido en localStorage
 * (ver src/lib/localStore.ts y su uso en AppContext/AuthContext).
 */

export const initialAssets: Asset[] = [];

export const initialAssetHistory: AssetHistoryEntry[] = [];

export const initialParts: Part[] = [];

export const initialMovements: InventoryMovement[] = [];

export const initialWorkOrders: WorkOrder[] = [];

export const initialFuelLoads: FuelLoad[] = [];

export const initialNotifications: AppNotification[] = [];

/**
 * Tipos de Trabajo: catalogo editable desde Administracion. El campo `code` es la llave de
 * `maintenancePlans`. Arranca vacio: se agregan desde la pestana "Tipos de Trabajo" y de
 * inmediato quedan disponibles al agregar lineas de trabajo y como pestana en Planes de Mantenimiento.
 */
export const initialWorkTypes: CatalogItem[] = [];

/** Planes de mantenimiento: arbol personalizable por Tipo de Trabajo, vacio hasta que el administrador lo construya. */
export const initialMaintenancePlans: MaintenancePlans = {};

import type { ModuleKey, UserRole } from '@/types';

/**
 * Matriz de permisos por rol.
 *
 * Es la unica fuente de verdad para lo que cada rol ve y puede hacer:
 * la usan el Sidebar (visibilidad de modulos), los modulos (botones y acciones)
 * y el modulo de Administracion (configuracion de permisos por rol).
 */
export type Permission =
  // Modulos
  | 'modulo.activos'
  | 'modulo.inventario'
  | 'modulo.ordenes'
  | 'modulo.combustible'
  | 'modulo.reportes'
  | 'modulo.notificaciones'
  | 'modulo.administracion'
  // Administracion
  | 'usuarios.gestionar'
  | 'catalogos.editar'
  | 'permisos.configurar'
  // Activos
  | 'activos.sap.vincular'
  | 'activos.fotos.gestionar'
  // Ordenes de trabajo
  | 'ot.ver.todas'
  | 'ot.crear'
  | 'ot.aprobar'
  | 'ot.rechazar'
  | 'ot.emergencia.aprobarRetro'
  | 'ot.asignar'
  | 'ot.cerrar'
  | 'ot.finalizar'
  | 'ot.lineas.agregar'
  | 'ot.lineas.editar'
  | 'ot.lineas.estado'
  | 'ot.lineas.aprobarHallazgo'
  // Inventario
  | 'repuestos.consumir'
  | 'inventario.catalogo.editar'
  // Reportes
  | 'reportes.ver';

export type PermissionMatrix = Record<UserRole, Permission[]>;

export const permissionLabels: Record<Permission, string> = {
  'modulo.activos': 'Ver modulo Activos',
  'modulo.inventario': 'Ver modulo Repuestos e Inventario',
  'modulo.ordenes': 'Ver modulo Ordenes de Trabajo',
  'modulo.combustible': 'Ver modulo Combustible',
  'modulo.reportes': 'Ver modulo Reportes TCO',
  'modulo.notificaciones': 'Ver modulo Notificaciones',
  'modulo.administracion': 'Ver modulo Administracion',
  'usuarios.gestionar': 'Gestionar usuarios y roles',
  'catalogos.editar': 'Editar tipos de mantenimiento y catalogos',
  'permisos.configurar': 'Configurar permisos por rol',
  'activos.sap.vincular': 'Vincular / sincronizar activos con SAP',
  'activos.fotos.gestionar': 'Subir y eliminar fotografias de activos',
  'ot.ver.todas': 'Ver todas las OTs (sin este permiso solo ve las asignadas)',
  'ot.crear': 'Crear OT',
  'ot.aprobar': 'Aprobar OT',
  'ot.rechazar': 'Rechazar OT',
  'ot.emergencia.aprobarRetro': 'Aprobar retroactivamente OT de emergencia',
  'ot.asignar': 'Asignar tecnico o taller externo',
  'ot.cerrar': 'Firmar cierre y cerrar OT',
  'ot.finalizar': 'Firma tecnica al finalizar',
  'ot.lineas.agregar': 'Crear lineas de trabajo',
  'ot.lineas.editar': 'Editar o eliminar lineas de trabajo y sus actividades',
  'ot.lineas.estado': 'Ejecutar lineas: iniciar y finalizar, evidencias',
  'ot.lineas.aprobarHallazgo': 'Aprobar o rechazar lineas de hallazgo',
  'repuestos.consumir': 'Consumir repuestos en lineas de OT',
  'inventario.catalogo.editar': 'Editar catalogo de repuestos',
  'reportes.ver': 'Ver reportes TCO completos',
};

/** Agrupacion usada por la matriz editable del modulo Administracion */
export const permissionGroups: { title: string; permissions: Permission[] }[] = [
  {
    title: 'Modulos',
    permissions: [
      'modulo.activos', 'modulo.inventario', 'modulo.ordenes',
      'modulo.combustible', 'modulo.reportes', 'modulo.notificaciones', 'modulo.administracion',
    ],
  },
  {
    title: 'Administracion del sistema',
    permissions: ['usuarios.gestionar', 'catalogos.editar', 'permisos.configurar', 'inventario.catalogo.editar'],
  },
  {
    title: 'Activos',
    permissions: ['activos.sap.vincular', 'activos.fotos.gestionar'],
  },
  {
    title: 'Ordenes de Trabajo',
    permissions: [
      'ot.ver.todas', 'ot.crear', 'ot.aprobar', 'ot.rechazar', 'ot.emergencia.aprobarRetro',
      'ot.asignar', 'ot.cerrar', 'ot.finalizar',
      'ot.lineas.agregar', 'ot.lineas.editar', 'ot.lineas.estado', 'ot.lineas.aprobarHallazgo', 'repuestos.consumir',
    ],
  },
  {
    title: 'Reportes',
    permissions: ['reportes.ver'],
  },
];

/**
 * Permisos por defecto.
 *
 * Administrador: configura el sistema y lo ve todo; edita/elimina lineas de trabajo y sus
 * actividades, pero no ejecuta trabajo tecnico ni aprueba/firma OTs del dia a dia.
 * Jefe de Taller: aprueba, asigna, rechaza y cierra; crea, edita y ejecuta lineas y consume
 * repuestos; no toca catalogos ni SAP.
 * Tecnico: ve las OTs que creo o le asignaron y crea lineas en ellas; una vez creadas no las edita
 * ni elimina, solo las ejecuta (estado, horas, actividades, evidencias, repuestos) en las asignadas a el.
 */
export const defaultPermissions: PermissionMatrix = {
  administrador: [
    'modulo.activos', 'modulo.inventario', 'modulo.ordenes', 'modulo.combustible',
    'modulo.reportes', 'modulo.notificaciones', 'modulo.administracion',
    'usuarios.gestionar', 'catalogos.editar', 'permisos.configurar',
    'activos.sap.vincular', 'activos.fotos.gestionar',
    'ot.ver.todas', 'ot.lineas.editar', 'inventario.catalogo.editar', 'reportes.ver',
  ],
  jefe_taller: [
    'modulo.activos', 'modulo.inventario', 'modulo.ordenes', 'modulo.combustible',
    'modulo.reportes', 'modulo.notificaciones',
    'activos.fotos.gestionar',
    'ot.ver.todas', 'ot.crear', 'ot.aprobar', 'ot.rechazar', 'ot.emergencia.aprobarRetro',
    'ot.asignar', 'ot.cerrar', 'ot.lineas.aprobarHallazgo',
    'ot.finalizar', 'ot.lineas.agregar', 'ot.lineas.editar', 'ot.lineas.estado', 'repuestos.consumir',
    'reportes.ver',
  ],
  tecnico: [
    'modulo.ordenes', 'modulo.notificaciones',
    'ot.crear', 'ot.finalizar', 'ot.lineas.agregar', 'ot.lineas.estado', 'repuestos.consumir',
  ],
};

/** Permiso de modulo asociado a cada entrada de navegacion */
export const modulePermissions: Record<ModuleKey, Permission> = {
  activos: 'modulo.activos',
  inventario: 'modulo.inventario',
  ordenes: 'modulo.ordenes',
  combustible: 'modulo.combustible',
  reportes: 'modulo.reportes',
  notificaciones: 'modulo.notificaciones',
  administracion: 'modulo.administracion',
};

/**
 * Permisos que no se pueden revocar, para que un administrador no quede
 * bloqueado fuera de la pantalla donde se configuran los permisos.
 */
export const lockedPermissions: { role: UserRole; permission: Permission }[] = [
  { role: 'administrador', permission: 'modulo.administracion' },
  { role: 'administrador', permission: 'permisos.configurar' },
];

export function isLocked(role: UserRole, permission: Permission): boolean {
  return lockedPermissions.some(l => l.role === role && l.permission === permission);
}

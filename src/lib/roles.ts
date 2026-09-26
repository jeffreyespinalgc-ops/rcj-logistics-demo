import type { UserRole } from '@/types';

export const roleLabels: Record<UserRole, string> = {
  administrador: 'Administrador',
  jefe_taller: 'Jefe de Taller',
  control_inventario: 'Control de Inventario',
  tecnico: 'Tecnico / Mecanico',
};

/** Etiqueta corta para chips y tablas */
export const roleShortLabels: Record<UserRole, string> = {
  administrador: 'Admin',
  jefe_taller: 'Jefe Taller',
  control_inventario: 'Control Inv.',
  tecnico: 'Tecnico',
};

export const roleOrder: UserRole[] = ['administrador', 'jefe_taller', 'control_inventario', 'tecnico'];

/** Iniciales para el avatar del sidebar */
export function initialsOf(name: string): string {
  const parts = name.replace(/\./g, '').split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

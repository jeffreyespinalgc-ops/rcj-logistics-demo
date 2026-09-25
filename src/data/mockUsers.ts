import type { AppUser, UserRole } from '@/types';

/**
 * Usuarios de prueba para el login local.
 * Las claves estan en texto plano a proposito: es data de demo, no produccion.
 */
export const initialUsers: AppUser[] = [
  { id: 'u1', username: 'admin', password: 'admin123', name: 'A. Contreras', role: 'administrador', active: true },
  { id: 'u2', username: 'jefe', password: 'jefe123', name: 'M. Torres', role: 'jefe_taller', active: true },
  { id: 'u3', username: 'tecnico', password: 'tecnico123', name: 'J. Martinez', role: 'tecnico', active: true },
  { id: 'u4', username: 'crojas', password: 'tecnico123', name: 'C. Rojas', role: 'tecnico', active: true },
  { id: 'u5', username: 'rfuentes', password: 'tecnico123', name: 'R. Fuentes', role: 'tecnico', active: true },
  { id: 'u6', username: 'lvega', password: 'tecnico123', name: 'L. Vega', role: 'tecnico', active: true },
];

/** Credencial sugerida en la pantalla de login para cada rol */
export const demoCredentials: Record<UserRole, { username: string; password: string }> = {
  administrador: { username: 'admin', password: 'admin123' },
  jefe_taller: { username: 'jefe', password: 'jefe123' },
  tecnico: { username: 'tecnico', password: 'tecnico123' },
};

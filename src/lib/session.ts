import type { Session } from '@/types';

/**
 * Sesion local en sessionStorage (no localStorage): sobrevive a un refresh
 * pero es propia de cada pestana, asi se puede tener un usuario distinto
 * conectado en cada pestana del mismo navegador. Se borra al cerrar sesion
 * o al cerrar la pestana.
 */
const STORAGE_KEY = 'rcj_taller_sesion_v1';

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return parsed && parsed.userId && parsed.role ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // sin sessionStorage la sesion vive solo en memoria
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // nada que limpiar
  }
}

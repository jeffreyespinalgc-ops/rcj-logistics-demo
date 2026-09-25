/**
 * Persistencia local generica: toda la data operativa del sistema (activos,
 * repuestos, OTs, combustible, notificaciones, catalogos) vive en localStorage
 * para que la demo sobreviva a un refresh sin depender de un backend.
 */

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Devuelve false si el navegador rechaza la escritura (cuota llena). */
export function saveJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Envio de una OT finalizada a SAP. Por ahora es una simulacion: la confirmacion llega siempre bien y despues de
 * una pausa. Cuando exista la API real, este archivo es el unico que cambia: la OT queda en "Enviado a SAP"
 * (naranja) hasta que esta promesa se resuelve.
 */
export function sendOTToSAP(): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, 2000));
}

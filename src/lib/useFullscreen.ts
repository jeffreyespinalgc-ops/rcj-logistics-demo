import { useCallback, useEffect, useState } from 'react';

/**
 * Pantalla completa del navegador para toda la app. Escucha "fullscreenchange" para que el icono/estado se
 * mantenga correcto aunque el usuario salga con Esc o F11 en vez del boton (no solo cuando lo togglea aqui).
 */
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  return { isFullscreen, toggle };
}

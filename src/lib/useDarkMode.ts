import { useCallback, useState } from 'react';

const STORAGE_KEY = 'rcj_theme_v1';

/**
 * Modo oscuro de toda la app: la clase "dark" en <html> es la unica fuente de verdad (tailwind.config.js la
 * usa como darkMode: 'class', index.css redefine la escala stone-* y bg-surface a partir de ella). Por defecto
 * siempre arranca en claro (no se respeta el tema del sistema); el script inline en index.html solo la activa
 * si el usuario ya la habia elegido antes (localStorage), asi que este hook solo lee ese estado inicial y lo
 * alterna, guardando la eleccion explicita.
 */
export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggle = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
      } catch {
        /* almacenamiento no disponible (modo privado, cuota llena...); el tema solo no se recuerda */
      }
      return next;
    });
  }, []);

  return { isDark, toggle };
}

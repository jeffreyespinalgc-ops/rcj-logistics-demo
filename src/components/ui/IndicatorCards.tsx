import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Envuelve la fila de StatCard de cada modulo con un boton para mostrarla u ocultarla. Arranca
 * expandida en pantallas sm+ y contraida en movil (lo mismo que antes, cuando esas cards se ocultaban
 * a la fuerza en movil), pero ahora el usuario puede cambiarlo en cualquier tamano de pantalla.
 */
export function IndicatorCards({ children }: { children: ReactNode }) {
  // ocultas por defecto en cualquier tamano de pantalla; el usuario las despliega si quiere verlas
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        aria-label={expanded ? 'Ocultar indicadores' : 'Mostrar indicadores'}
        title={expanded ? 'Ocultar indicadores' : 'Mostrar indicadores'}
        className="flex min-h-[44px] w-fit items-center gap-1.5 rounded-md px-1 text-sm font-medium text-stone-500 transition-colors hover:text-orange-600"
      >
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {expanded && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {children}
        </div>
      )}
    </div>
  );
}

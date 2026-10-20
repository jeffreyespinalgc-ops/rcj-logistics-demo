import { SlidersHorizontal } from 'lucide-react';

/**
 * Boton "Filtros" que solo existe en movil (sm:hidden): muestra/oculta el resto de selects de la barra de
 * filtros para que el contenido del modulo (tabla, cards) quede visible mas arriba en pantallas chicas. En
 * tablet/escritorio los filtros siguen siempre visibles, sin este boton -- no cambia nada ahi.
 */
export function FiltersToggleButton({ open, onToggle, activeCount }: { open: boolean; onToggle: () => void; activeCount: number }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label="Mostrar u ocultar filtros"
      className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 text-content font-medium text-stone-700 transition-colors hover:bg-stone-50 sm:hidden"
    >
      <SlidersHorizontal size={14} />
      Filtros
      {activeCount > 0 && (
        <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-white">
          {activeCount}
        </span>
      )}
    </button>
  );
}

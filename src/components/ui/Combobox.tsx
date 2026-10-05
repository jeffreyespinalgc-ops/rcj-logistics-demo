import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface DropdownRect {
  top: number;
  left: number;
  width: number;
  openUp: boolean;
}

const DROPDOWN_MAX_HEIGHT = 224; // max-h-56

/**
 * Select con texto escribible: se ve y se usa como un <select> (un valor, lista fija de opciones) pero al
 * escribir filtra la lista en vez de solo saltar a la primera coincidencia como hace el navegador. Base de
 * `Select` (Field.tsx) y `CellSelect` (LineForm.tsx) -- un solo lugar para el comportamiento de busqueda.
 * La lista se dibuja en un portal a `document.body` con `position: fixed`: si no, quedaria recortada por
 * cualquier ancestro con scroll (p. ej. la tabla de repuestos, que tiene `overflow-x-auto` -- eso fuerza al
 * navegador a tratar tambien el eje Y como recortado, aunque no se haya pedido explicitamente).
 */
export function Combobox({ value, onChange, options, placeholder, disabled, ariaLabel, id, className = '' }: {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState<DropdownRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => { setHighlight(0); }, [query, open]);

  const updateRect = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < DROPDOWN_MAX_HEIGHT + 8 && r.top > spaceBelow;
    setRect({ top: openUp ? r.top : r.bottom, left: r.left, width: r.width, openUp });
  };

  useEffect(() => {
    if (!open) return;
    updateRect();
    const handler = () => updateRect();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const pick = (opt: ComboboxOption) => {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
    // quitar el foco: si queda puesto, al volver a tocar el campo no hay evento de foco y la lista no se abre
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlight(h => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlight]) pick(filtered[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        disabled={disabled}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
        value={open ? query : (selected?.label ?? '')}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onBlur={() => {
          window.setTimeout(() => {
            if (!rootRef.current?.contains(document.activeElement) && !listRef.current?.contains(document.activeElement)) setOpen(false);
          }, 0);
        }}
        onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
        onKeyDown={handleKeyDown}
        className={`w-full min-h-[44px] px-3 py-2 pr-7 text-content leading-5 border border-stone-300 rounded-md bg-white text-stone-800 transition-colors focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500 sm:min-h-0 ${className}`}
      />
      <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-stone-400" />
      {open && !disabled && rect && createPortal(
        <ul
          ref={listRef}
          style={{
            position: 'fixed',
            left: rect.left,
            width: rect.width,
            maxHeight: DROPDOWN_MAX_HEIGHT,
            ...(rect.openUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.top + 4 }),
          }}
          className="z-[100] overflow-y-auto rounded-md border border-stone-200 bg-white py-1 shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-content text-stone-400">Sin resultados</li>
          ) : filtered.map((opt, i) => (
            <li key={opt.value}>
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => pick(opt)}
                className={`flex min-h-[44px] w-full items-center px-3 py-1.5 text-left text-content transition-colors sm:min-h-[36px] ${
                  i === highlight ? 'bg-orange-50 text-orange-700' : 'text-stone-700 hover:bg-stone-50'
                } ${opt.value === value ? 'font-bold' : ''}`}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
}

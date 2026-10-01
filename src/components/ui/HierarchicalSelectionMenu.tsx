import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Un nodo del arbol de niveles. Un nodo SIN `children` (o con `children: []`) pertenece al ULTIMO nivel:
 * se muestra como una casilla seleccionable en vez de una opcion para seguir bajando.
 */
export interface HierarchyNode {
  id: string;
  label: string;
  /** Texto corto opcional bajo la etiqueta, en la fila de la opcion */
  description?: string;
  children?: HierarchyNode[];
}

export interface HierarchicalSelectionResult {
  /** El nodo elegido en cada nivel, en orden (sin incluir las actividades marcadas) */
  path: { id: string; label: string }[];
  /** Los elementos marcados del ultimo nivel */
  selected: { id: string; label: string }[];
}

export interface HierarchicalSelectionMenuProps {
  /** Nombre de cada nivel, en orden (ej. ["Tipo de trabajo", "Subtipo", ..., "Actividades"]) */
  levelLabels: string[];
  /** Arbol de opciones: la raiz es el primer nivel (columna 1) */
  data: HierarchyNode[];
  /** Se llama cuando el usuario confirma la seleccion del ultimo nivel */
  onComplete: (result: HierarchicalSelectionResult) => void;
  /** Vuelve a mostrar solo la primera columna despues de confirmar, lista para una nueva seleccion (default: true) */
  resetOnComplete?: boolean;
  className?: string;
}

const isLeaf = (node: HierarchyNode) => !node.children || node.children.length === 0;

function maxDepth(nodes: HierarchyNode[]): number {
  let max = 1;
  for (const n of nodes) {
    if (n.children && n.children.length > 0) max = Math.max(max, 1 + maxDepth(n.children));
  }
  return max;
}

function ChevronRightIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M7.5 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Column {
  /** Profundidad de esta columna: 0 = raiz (`data`), 1 = hijos de `path[0]`, etc. */
  depth: number;
  nodes: HierarchyNode[];
}

/**
 * Menu jerarquico en columnas, una al lado de la otra (como el buscador de archivos de macOS): al elegir
 * una opcion se abre una columna nueva a la derecha con sus hijos, sin ocultar las anteriores -- todas
 * quedan ahi, con scroll horizontal si no caben en el ancho de pantalla. Cada vez que se abre o se recorta
 * una columna, la fila se desliza sola hasta la mas nueva (por eso las primeras "se ocultan": quedan
 * scrolleadas fuera de vista, no se destruyen). Arriba queda fijo un breadcrumb con toda la ruta elegida,
 * cada paso clickeable para volver a desplazarse hasta esa columna y, si se elige otra opcion ahi, el resto
 * de columnas a la derecha se recorta y se arma de nuevo. El ultimo nivel de cada rama (nodos sin
 * `children`) es una lista de seleccion multiple con casillas.
 *
 * No depende de ninguna libreria externa ni de la cantidad de niveles: la profundidad la define `data`;
 * `levelLabels` solo pone el nombre de cada nivel en el encabezado de su columna.
 */
export function HierarchicalSelectionMenu({ levelLabels, data, onComplete, resetOnComplete = true, className = '' }: HierarchicalSelectionMenuProps) {
  const [path, setPath] = useState<HierarchyNode[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const totalLevels = useMemo(() => maxDepth(data), [data]);
  const rowRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef(new Map<number, HTMLDivElement>());

  const columns = useMemo<Column[]>(() => {
    const cols: Column[] = [{ depth: 0, nodes: data }];
    path.forEach((node, i) => cols.push({ depth: i + 1, nodes: node.children ?? [] }));
    return cols;
  }, [data, path]);

  // al abrir o recortar columnas, la fila se desliza sola hasta mostrar la mas nueva
  useEffect(() => {
    rowRef.current?.scrollTo({ left: rowRef.current.scrollWidth, behavior: 'smooth' });
  }, [columns.length]);

  const selectAt = (depth: number, node: HierarchyNode) => {
    setPath(prev => [...prev.slice(0, depth), node]);
    setSelectedIds(new Set());
  };

  const scrollToColumn = (depth: number) => {
    columnRefs.current.get(depth)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  const lastColumn = columns[columns.length - 1];
  const atLeafLevel = lastColumn.nodes.length > 0 && lastColumn.nodes.every(isLeaf);

  const toggleLeaf = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = atLeafLevel && lastColumn.nodes.every(n => selectedIds.has(n.id));
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(lastColumn.nodes.map(n => n.id)));

  const handleConfirm = () => {
    const result: HierarchicalSelectionResult = {
      path: path.map(n => ({ id: n.id, label: n.label })),
      selected: lastColumn.nodes.filter(n => selectedIds.has(n.id)).map(n => ({ id: n.id, label: n.label })),
    };
    onComplete(result);
    if (resetOnComplete) {
      setPath([]);
      setSelectedIds(new Set());
    }
  };

  return (
    <div className={`flex w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {/* breadcrumb fijo: ubica la ruta elegida aunque sus columnas hayan quedado fuera de vista por el scroll */}
      <nav aria-label="Ruta de seleccion" className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <button
          type="button"
          onClick={() => scrollToColumn(0)}
          className="rounded px-1.5 py-0.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-white hover:text-orange-600"
        >
          {levelLabels[0] ?? 'Inicio'}
        </button>
        {path.map((node, i) => (
          <span key={node.id} className="flex items-center gap-1">
            <ChevronRightIcon className="h-3 w-3 flex-shrink-0 text-slate-300" />
            <button
              type="button"
              onClick={() => scrollToColumn(i + 1)}
              title={`Ver "${levelLabels[i + 1] ?? `Nivel ${i + 2}`}"`}
              className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors hover:bg-white hover:text-orange-600 ${
                i === path.length - 1 ? 'text-slate-800' : 'text-slate-500'
              }`}
            >
              {node.label}
            </button>
          </span>
        ))}
        <span className="ml-auto flex-shrink-0 pl-2 text-[11px] font-medium text-slate-400">
          {Math.min(columns.length, totalLevels)}/{totalLevels}
        </span>
      </nav>

      {/* columnas lado a lado, una por nivel alcanzado; scroll horizontal si no caben en el ancho disponible */}
      <div ref={rowRef} className="flex h-80 overflow-x-auto overflow-y-hidden scroll-smooth">
        {columns.map(col => {
          const columnIsLeaf = col.nodes.length > 0 && col.nodes.every(isLeaf);
          return (
            <div
              key={col.depth}
              ref={el => {
                if (el) columnRefs.current.set(col.depth, el);
                else columnRefs.current.delete(col.depth);
              }}
              className="flex h-full w-60 flex-shrink-0 flex-col border-r border-slate-100 last:border-r-0"
            >
              <div className="flex-shrink-0 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                <p className="truncate text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {levelLabels[col.depth] ?? `Nivel ${col.depth + 1}`}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto">
                {col.nodes.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-slate-400">Sin opciones</p>
                ) : columnIsLeaf ? (
                  <ul className="divide-y divide-slate-100">
                    {col.nodes.map(node => {
                      const checked = selectedIds.has(node.id);
                      return (
                        <li key={node.id}>
                          <label
                            className={`flex min-h-[44px] cursor-pointer items-start gap-2 px-3 py-2 transition-colors hover:bg-orange-50/60 active:bg-orange-50 ${
                              checked ? 'bg-orange-50/80' : 'bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleLeaf(node.id)}
                              className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-orange-500 focus:ring-orange-300"
                            />
                            <span className="min-w-0 flex-1">
                              <span className={`block text-sm ${checked ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                                {node.label}
                              </span>
                              {node.description && <span className="block text-xs text-slate-400">{node.description}</span>}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {col.nodes.map(node => {
                      const chosen = path[col.depth]?.id === node.id;
                      return (
                        <li key={node.id}>
                          <button
                            type="button"
                            onClick={() => selectAt(col.depth, node)}
                            className={`flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 ${
                              chosen ? 'bg-orange-50/70' : 'bg-white'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${chosen ? 'bg-orange-500' : 'bg-transparent'}`} />
                            <span className="min-w-0 flex-1">
                              <span className={`block truncate text-sm ${chosen ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                                {node.label}
                              </span>
                              {node.description && <span className="block truncate text-xs text-slate-400">{node.description}</span>}
                            </span>
                            <ChevronRightIcon className={`h-4 w-4 flex-shrink-0 ${chosen ? 'text-orange-500' : 'text-slate-300'}`} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* pie fijo: seleccionar todos / confirmar, siempre a la vista sin importar el scroll de las columnas */}
      {atLeafLevel && (
        <div className="flex flex-shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
          <button type="button" onClick={toggleAll} className="text-xs font-medium text-orange-600 hover:text-orange-700">
            {allSelected ? 'Quitar todos' : 'Seleccionar todos'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className="flex min-h-[40px] items-center gap-1.5 rounded-md bg-orange-500 px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
          >
            <CheckIcon className="h-4 w-4" /> Confirmar seleccion ({selectedIds.size})
          </button>
        </div>
      )}
    </div>
  );
}

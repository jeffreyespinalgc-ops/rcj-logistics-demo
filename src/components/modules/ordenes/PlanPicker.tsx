import { useEffect, useMemo, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import { Field, Select, TextInput } from '@/components/ui/Field';
import type { Asset, MaintenanceTreeNode } from '@/types';
import { ChevronRight } from 'lucide-react';
import { inferPlanSelection, type PlanSelection } from '@/lib/planSelection';

const isLeaf = (node: MaintenanceTreeNode) => node.children.length === 0;

interface Column {
  depth: number;
  /** Nombre de quien contiene estas opciones (el tipo de trabajo para la 1ra columna, el nodo elegido para las demas) */
  parentName: string;
  nodes: MaintenanceTreeNode[];
}

/**
 * Arma una columna por nivel alcanzado, caminando `nodeIds` sobre el arbol real. `lockedIds` es el tramo
 * inicial que ya se infirio solo del vehiculo elegido (ver `inferPlanSelection`): en esos niveles la
 * columna solo muestra la opcion que coincide con el vehiculo, no todos los hermanos -- por ejemplo, si el
 * vehiculo es una Volqueta, el primer nivel ya no ofrece Camion/Traileta/Vehiculo Ligero para elegir.
 */
function buildColumns(roots: MaintenanceTreeNode[], rootLabel: string, nodeIds: string[], lockedIds: string[] = []): Column[] {
  const visibleAt = (depth: number, nodes: MaintenanceTreeNode[]) =>
    depth < lockedIds.length ? nodes.filter(n => n.id === lockedIds[depth]) : nodes;

  const cols: Column[] = [{ depth: 0, parentName: rootLabel, nodes: visibleAt(0, roots) }];
  let siblings = roots;
  for (let i = 0; i < nodeIds.length; i++) {
    const chosen = siblings.find(n => n.id === nodeIds[i]);
    if (!chosen) break;
    cols.push({ depth: i + 1, parentName: chosen.name, nodes: visibleAt(i + 1, chosen.children) });
    siblings = chosen.children;
  }
  return cols;
}

/**
 * Plan de mantenimiento en columnas, una al lado de la otra (como el buscador de archivos de macOS): al
 * elegir una opcion se abre una columna nueva a la derecha con sus hijos, sin ocultar las anteriores --
 * quedan ahi, con scroll horizontal si no caben en el ancho disponible (al abrir una columna nueva la fila
 * se desliza sola hasta mostrarla, por eso las primeras "se ocultan": quedan fuera de vista por el scroll,
 * no se destruyen). Arriba un breadcrumb fijo con toda la ruta elegida: cada paso es clickeable para volver
 * a desplazarse hasta esa columna; elegir ahi una opcion DISTINTA recorta y rearma las columnas siguientes.
 * El ultimo nivel de cada rama (nodos sin hijos) es una lista de seleccion multiple con casillas.
 */
function PlanColumns({ roots, rootLabel, value, onChange, asset }: {
  roots: MaintenanceTreeNode[];
  rootLabel: string;
  value: PlanSelection;
  onChange: (next: PlanSelection) => void;
  asset?: Asset;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef(new Map<number, HTMLDivElement>());
  const lockedIds = useMemo(() => (asset ? inferPlanSelection(roots, asset).nodeIds : []), [roots, asset]);
  const columns = useMemo(() => buildColumns(roots, rootLabel, value.nodeIds, lockedIds), [roots, rootLabel, value.nodeIds, lockedIds]);

  useEffect(() => {
    rowRef.current?.scrollTo({ left: rowRef.current.scrollWidth, behavior: 'smooth' });
  }, [columns.length]);

  const selectAt = (depth: number, node: MaintenanceTreeNode) => {
    // las actividades del ultimo nivel arrancan deseleccionadas: el usuario las marca a mano (o usa "Seleccionar Todos")
    onChange({ ...value, nodeIds: [...value.nodeIds.slice(0, depth), node.id], checkedIds: [] });
  };

  const toggleLeaf = (id: string) => {
    const checkedIds = value.checkedIds.includes(id) ? value.checkedIds.filter(c => c !== id) : [...value.checkedIds, id];
    onChange({ ...value, checkedIds });
  };

  const toggleAll = (nodes: MaintenanceTreeNode[]) => {
    const leafIds = nodes.map(n => n.id);
    const allChecked = leafIds.every(id => value.checkedIds.includes(id));
    onChange({ ...value, checkedIds: allChecked ? [] : leafIds });
  };

  const scrollToColumn = (depth: number) => {
    columnRefs.current.get(depth)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  return (
    <div className="overflow-hidden rounded-md border border-stone-200 bg-white">
      {/* breadcrumb fijo: ubica la ruta elegida aunque sus columnas hayan quedado fuera de vista por el scroll */}
      {columns.length > 1 && (
        <nav aria-label="Ruta del plan" className="flex flex-wrap items-center gap-1 border-b border-stone-100 bg-stone-50/60 px-3 py-2">
          <button
            type="button"
            onClick={() => scrollToColumn(0)}
            className="rounded px-1.5 py-0.5 text-content font-bold text-stone-500 transition-colors hover:bg-white hover:text-orange-600"
          >
            {rootLabel}
          </button>

          {columns.slice(1).map((col, i) => (
            <span key={col.depth} className="flex items-center gap-1">
              <ChevronRight size={11} className="flex-shrink-0 text-stone-300" />
              <button
                type="button"
                onClick={() => scrollToColumn(col.depth)}
                className={`rounded px-1.5 py-0.5 text-content font-medium transition-colors hover:bg-white hover:text-orange-600 ${
                  i === columns.length - 2 ? 'text-stone-800' : 'text-stone-500'
                }`}
              >
                {col.parentName}
              </button>
            </span>
          ))}
        </nav>
      )}

      {/* columnas lado a lado, una por nivel alcanzado; scroll horizontal si no caben en el ancho disponible */}
      <div ref={rowRef} className="flex h-64 overflow-x-auto overflow-y-hidden scroll-smooth">
        {columns.map(col => {
          const columnIsLeaf = col.nodes.length > 0 && col.nodes.every(isLeaf);
          return (
            <div
              key={col.depth}
              ref={el => {
                if (el) columnRefs.current.set(col.depth, el);
                else columnRefs.current.delete(col.depth);
              }}
              className="flex h-full w-52 flex-shrink-0 flex-col border-r border-stone-100 last:border-r-0 sm:w-60"
            >
              <div className="flex-shrink-0 border-b border-stone-100 bg-stone-50/80 px-2.5 py-1.5">
                <p className="truncate text-content font-bold text-stone-500">{col.parentName}</p>
              </div>

              <div className="flex-1 overflow-y-auto">
                {col.nodes.length === 0 ? (
                  <p className="px-3 py-6 text-center text-content text-stone-400">Sin opciones</p>
                ) : columnIsLeaf ? (
                  <>
                    <div className="flex justify-end border-b border-stone-100 px-2 py-1">
                      <button type="button" onClick={() => toggleAll(col.nodes)} className="text-content font-medium text-orange-600 hover:text-orange-700">
                        Seleccionar Todos
                      </button>
                    </div>
                    <ul className="divide-y divide-stone-100">
                      {col.nodes.map(node => {
                        const checked = value.checkedIds.includes(node.id);
                        return (
                          <li key={node.id}>
                            <label
                              className={`flex min-h-[44px] cursor-pointer items-center gap-2 px-2.5 py-2 text-content text-stone-700 transition-colors hover:bg-orange-50/50 sm:min-h-0 ${
                                checked ? 'bg-orange-200' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleLeaf(node.id)}
                                className="flex-shrink-0 rounded border-stone-300 text-orange-500 focus:ring-orange-300"
                              />
                              <span className={checked ? 'font-bold text-stone-800' : ''}>{node.name}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {col.nodes.map(node => {
                      const chosen = value.nodeIds[col.depth] === node.id;
                      return (
                        <li key={node.id}>
                          <button
                            type="button"
                            onClick={() => selectAt(col.depth, node)}
                            className={`flex min-h-[44px] w-full items-center gap-2 px-2.5 py-2 text-left text-content transition-colors hover:bg-stone-50 sm:min-h-0 ${
                              chosen ? 'bg-orange-200' : ''
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${chosen ? 'bg-orange-500' : 'bg-transparent'}`} />
                            <span className={`min-w-0 flex-1 truncate ${chosen ? 'font-bold text-stone-800' : 'text-stone-700'}`}>{node.name}</span>
                            <ChevronRight size={14} className={`flex-shrink-0 ${chosen ? 'text-orange-500' : 'text-stone-300'}`} />
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
    </div>
  );
}

export function PlanPicker({ value, onChange, freeText, onFreeTextChange, asset }: {
  value: PlanSelection;
  onChange: (next: PlanSelection) => void;
  freeText: string;
  onFreeTextChange: (text: string) => void;
  asset?: Asset;
}) {
  const { workTypes, maintenancePlans } = useApp();
  const activeTypes = workTypes.filter(w => w.active);
  const type = workTypes.find(w => w.code === value.workTypeCode);
  const roots = type ? (maintenancePlans[type.code] ?? []) : [];
  const freeTextMode = type ? roots.length === 0 : activeTypes.length === 0;

  return (
    <div className="space-y-3">
      <Field label="Tipo de trabajo *">
        <Select
          value={type ? type.code : ''}
          onChange={e => onChange({ workTypeCode: e.target.value, nodeIds: [], checkedIds: [] })}
        >
          <option value=""> ---Seleccionar ---</option>
          {activeTypes.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
        </Select>
      </Field>

      {freeTextMode ? (
        <Field label="Trabajo *">
          <TextInput value={freeText} onChange={e => onFreeTextChange(e.target.value)} placeholder="Ej: Cambio de llanta" />
        </Field>
      ) : type && roots.length > 0 && (
        <PlanColumns roots={roots} rootLabel={type.name} value={value} onChange={onChange} asset={asset} />
      )}
    </div>
  );
}


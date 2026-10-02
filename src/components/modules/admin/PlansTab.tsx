import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/store/AppContext';
import { useConfirm } from '@/store/ConfirmContext';
import { useToast } from '@/store/ToastContext';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import type { MaintenanceTreeNode, OTWorkType } from '@/types';
import { CheckSquare, ChevronDown, ChevronRight, ChevronUp, Plus, Trash2 } from 'lucide-react';

interface Column {
  depth: number;
  /** Nombre de quien contiene estas opciones (el tipo de trabajo para la 1ra columna, el nodo elegido para las demas) */
  parentName: string;
  /** id a pasarle a `addMaintenanceNode`; null = raiz */
  parentId: string | null;
  nodes: MaintenanceTreeNode[];
}

/** Arma una columna por nivel abierto, caminando `openPath` sobre el arbol real */
function buildColumns(roots: MaintenanceTreeNode[], rootLabel: string, openPath: string[]): Column[] {
  const cols: Column[] = [{ depth: 0, parentName: rootLabel, parentId: null, nodes: roots }];
  let siblings = roots;
  for (let i = 0; i < openPath.length; i++) {
    const chosen = siblings.find(n => n.id === openPath[i]);
    if (!chosen) break;
    cols.push({ depth: i + 1, parentName: chosen.name, parentId: chosen.id, nodes: chosen.children });
    siblings = chosen.children;
  }
  return cols;
}

/**
 * Planes de Mantenimiento, en columnas (mismo estilo que el selector de Tipo de Trabajo de la OT): el
 * administrador hace click en un elemento para abrir su columna de hijos a la derecha -- sin ocultar las
 * anteriores, con scroll horizontal si no caben y un breadcrumb fijo arriba. Cada columna se edita en el
 * lugar: renombrar (campo de texto), reordenar (flechas arriba/abajo entre hermanos), eliminar y agregar
 * nuevos elementos al final. El administrador decide cuantos niveles tiene cada rama agregando o no hijos;
 * un elemento sin hijos se marca con un icono de casilla, para recordar que asi es como el tecnico lo va a
 * ver: como una actividad seleccionable, no como un nivel mas para seguir bajando.
 */
export function PlansTab() {
  const { workTypes, maintenancePlans } = useApp();
  const activeTypes = workTypes.filter(w => w.active);
  const [selected, setSelected] = useState<OTWorkType>('');
  const workType = activeTypes.some(w => w.code === selected) ? selected : (activeTypes[0]?.code ?? '');
  const [openPath, setOpenPath] = useState<string[]>([]);

  const selectType = (code: OTWorkType) => {
    setSelected(code);
    setOpenPath([]);
  };

  if (activeTypes.length === 0) {
    return (
      <div className="p-6 text-center text-content text-stone-400">
        No hay tipos de trabajo activos. Agrega uno en la pestana "Tipos de Trabajo".
      </div>
    );
  }

  const typeLabel = activeTypes.find(w => w.code === workType)?.name ?? 'Tipo de trabajo';

  return (
    <>
      <div className="flex overflow-x-auto border-b border-stone-100 bg-stone-50/50">
        {activeTypes.map(wt => (
          <button
            key={wt.code}
            onClick={() => selectType(wt.code)}
            className={`px-4 py-2 text-content font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${workType === wt.code ? 'border-orange-500 text-orange-600' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
          >
            {wt.name}
          </button>
        ))}
      </div>
      <div className="p-4">
        <AdminPlanColumns
          key={workType}
          workType={workType}
          roots={maintenancePlans[workType] ?? []}
          rootLabel={typeLabel}
          openPath={openPath}
          setOpenPath={setOpenPath}
        />
      </div>
    </>
  );
}

function AdminPlanColumns({ workType, roots, rootLabel, openPath, setOpenPath }: {
  workType: OTWorkType;
  roots: MaintenanceTreeNode[];
  rootLabel: string;
  openPath: string[];
  setOpenPath: (path: string[]) => void;
}) {
  const { addMaintenanceNode, renameMaintenanceNode, removeMaintenanceNode, moveMaintenanceNode } = useApp();
  const confirm = useConfirm();
  const toast = useToast();
  const rowRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef(new Map<number, HTMLDivElement>());
  const [newNameByDepth, setNewNameByDepth] = useState<Record<number, string>>({});
  const columns = useMemo(() => buildColumns(roots, rootLabel, openPath), [roots, rootLabel, openPath]);

  useEffect(() => {
    rowRef.current?.scrollTo({ left: rowRef.current.scrollWidth, behavior: 'smooth' });
  }, [columns.length]);

  const openAt = (depth: number, node: MaintenanceTreeNode) => {
    setOpenPath([...openPath.slice(0, depth), node.id]);
  };

  const scrollToColumn = (depth: number) => {
    columnRefs.current.get(depth)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  const handleDelete = async (depth: number, node: MaintenanceTreeNode) => {
    if (!(await confirm({ title: 'Eliminar elemento', message: `¿Estas seguro de eliminar "${node.name}"? Se eliminaran tambien sus subelementos.`, confirmLabel: 'Eliminar', variant: 'danger' }))) return;
    removeMaintenanceNode(workType, node.id);
    toast({ message: `"${node.name}" eliminado`, variant: 'info' });
    // si se borra el elemento que estaba abierto en el camino, se recorta la navegacion hasta ahi
    if (openPath[depth] === node.id) setOpenPath(openPath.slice(0, depth));
  };

  const handleAdd = (col: Column) => {
    const name = (newNameByDepth[col.depth] ?? '').trim();
    if (!name) return;
    addMaintenanceNode(workType, col.parentId, name);
    setNewNameByDepth(prev => ({ ...prev, [col.depth]: '' }));
  };

  const moveUp = (nodes: MaintenanceTreeNode[], index: number) => {
    if (index === 0) return;
    moveMaintenanceNode(workType, nodes[index].id, nodes[index - 1].id, 'before');
  };

  const moveDown = (nodes: MaintenanceTreeNode[], index: number) => {
    if (index === nodes.length - 1) return;
    moveMaintenanceNode(workType, nodes[index].id, nodes[index + 1].id, 'after');
  };

  return (
    <div className="overflow-hidden rounded-md border border-stone-200 bg-white">
      {/* breadcrumb fijo: ubica la rama que se esta editando aunque sus columnas hayan quedado fuera de vista por el scroll */}
      {openPath.length > 0 && (
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

      {/* columnas lado a lado, una por nivel abierto; scroll horizontal si no caben en el ancho disponible */}
      <div ref={rowRef} className="flex h-80 overflow-x-auto overflow-y-hidden scroll-smooth">
        {columns.map(col => (
          <div
            key={col.depth}
            ref={el => {
              if (el) columnRefs.current.set(col.depth, el);
              else columnRefs.current.delete(col.depth);
            }}
            className="flex h-full w-64 flex-shrink-0 flex-col border-r border-stone-100 last:border-r-0"
          >
            <div className="flex-shrink-0 border-b border-stone-100 bg-stone-50/80 px-2.5 py-1.5">
              <p className="truncate text-content font-bold text-stone-500">{col.parentName}</p>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-1.5">
              {col.nodes.length === 0 && (
                <p className="px-2 py-4 text-center text-content text-stone-400"></p>
              )}
              {col.nodes.map((node, i) => {
                const isLeafNow = node.children.length === 0;
                return (
                  <div key={node.id} className="flex min-w-0 items-center gap-0.5 rounded-md border border-stone-200 bg-white px-1 py-1">
                    <div className="flex flex-shrink-0 flex-col">
                      <button
                        type="button"
                        onClick={() => moveUp(col.nodes, i)}
                        disabled={i === 0}
                        title="Subir"
                        aria-label={`Subir ${node.name}`}
                        className="text-stone-300 transition-colors hover:text-stone-600 disabled:pointer-events-none disabled:opacity-20"
                      >
                        <ChevronUp size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDown(col.nodes, i)}
                        disabled={i === col.nodes.length - 1}
                        title="Bajar"
                        aria-label={`Bajar ${node.name}`}
                        className="text-stone-300 transition-colors hover:text-stone-600 disabled:pointer-events-none disabled:opacity-20"
                      >
                        <ChevronDown size={11} />
                      </button>
                    </div>
                    <TextInput
                      value={node.name}
                      onChange={e => renameMaintenanceNode(workType, node.id, e.target.value)}
                      aria-label={`Renombrar ${node.name}`}
                      className="min-h-[36px] min-w-0 flex-1 !px-1.5 !py-1 !text-content"
                    />
                    <button
                      type="button"
                      onClick={() => openAt(col.depth, node)}
                      title={isLeafNow ? 'Vacio: se ve como actividad -- click para agregarle niveles' : 'Ver/editar sus elementos'}
                      aria-label={isLeafNow ? `${node.name}: actividad, click para agregarle niveles` : `Ver elementos de ${node.name}`}
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md transition-colors ${
                        isLeafNow ? 'text-stone-400 hover:bg-orange-50 hover:text-orange-600' : 'text-orange-500 hover:bg-orange-50'
                      }`}
                    >
                      {isLeafNow ? <CheckSquare size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(col.depth, node)}
                      title="Eliminar"
                      aria-label={`Eliminar ${node.name}`}
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-shrink-0 items-center gap-1 border-t border-stone-100 bg-stone-50/50 p-1.5">
              <TextInput
                value={newNameByDepth[col.depth] ?? ''}
                onChange={e => setNewNameByDepth(prev => ({ ...prev, [col.depth]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(col); }}
                placeholder={col.depth === 0 ? 'Nuevo elemento' : 'Nuevo subelemento'}
                aria-label="Nombre del nuevo elemento"
                className="min-h-[36px] min-w-0 flex-1 !py-1 !text-content"
              />
              <Button size="sm" variant="outline" onClick={() => handleAdd(col)} title="Agregar">
                <Plus size={12} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



import { createContext, useCallback, useContext, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import type { MaintenanceTreeNode, OTWorkType } from '@/types';
import { ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react';

// ===== Planes de Mantenimiento (arbol personalizable por Tipo de Trabajo) =====
// El arrastre usa eventos de puntero (no HTML5 drag & drop) para que funcione igual con
// mouse, dedo y lapiz: el asa tiene touch-action: none y el destino se calcula con
// elementFromPoint sobre los marcadores data-plan-row / data-plan-end.

type DropPosition = 'before' | 'after' | 'inside';

interface DropTarget {
  targetId: string | null;
  position: DropPosition;
  /** 'row' = soltado sobre una fila; 'end' = sobre la fila "Agregar" que cierra una lista */
  via: 'row' | 'end';
}

interface DragState {
  nodeId: string;
  label: string;
  x: number;
  y: number;
}

interface PlanEditor {
  workType: OTWorkType;
  drag: DragState | null;
  drop: DropTarget | null;
  expanded: Set<string>;
  toggle: (id: string) => void;
  startDrag: (node: MaintenanceTreeNode, e: ReactPointerEvent) => void;
}

const PlanEditorContext = createContext<PlanEditor | null>(null);

function usePlanEditor(): PlanEditor {
  const ctx = useContext(PlanEditorContext);
  if (!ctx) throw new Error('usePlanEditor must be used within PlansTab');
  return ctx;
}

function computeDrop(x: number, y: number, dragId: string): DropTarget | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  const dragged = document.querySelector(`[data-plan-node="${dragId}"]`);

  const row = el.closest<HTMLElement>('[data-plan-row]');
  if (row) {
    // sobre si mismo o sobre un descendiente: no es un destino valido
    if (dragged?.contains(row)) return null;
    const rect = row.getBoundingClientRect();
    const rel = (y - rect.top) / rect.height;
    const position: DropPosition = rel < 0.28 ? 'before' : rel > 0.72 ? 'after' : 'inside';
    return { targetId: row.dataset.nodeId ?? null, position, via: 'row' };
  }

  const end = el.closest<HTMLElement>('[data-plan-end]');
  if (end) {
    if (dragged?.contains(end)) return null;
    return { targetId: end.dataset.parentId || null, position: 'inside', via: 'end' };
  }
  return null;
}

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let cur = el?.parentElement ?? null;
  while (cur) {
    const overflowY = getComputedStyle(cur).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && cur.scrollHeight > cur.clientHeight) return cur;
    cur = cur.parentElement;
  }
  return null;
}

/** Desplaza el contenedor cuando el puntero se acerca a su borde superior o inferior */
function autoScroll(scroller: HTMLElement | null, y: number) {
  const edge = 56;
  const step = 14;
  const top = scroller ? scroller.getBoundingClientRect().top : 0;
  const bottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight;
  const dy = y < top + edge ? -step : y > bottom - edge ? step : 0;
  if (dy === 0) return;
  if (scroller) scroller.scrollBy(0, dy);
  else window.scrollBy(0, dy);
}

export function PlansTab() {
  const { workTypes, maintenancePlans, moveMaintenanceNode } = useApp();
  const activeTypes = workTypes.filter(w => w.active);
  const [selected, setSelected] = useState<OTWorkType>('');
  const workType = activeTypes.some(w => w.code === selected) ? selected : (activeTypes[0]?.code ?? '');

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [drag, setDrag] = useState<DragState | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const startDrag = (node: MaintenanceTreeNode, e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const nodeId = node.id;
    const scroller = findScrollParent(containerRef.current);
    setDrag({ nodeId, label: node.name, x: e.clientX, y: e.clientY });

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      setDrag(null);
      setDrop(null);
    };
    const onMove = (ev: PointerEvent) => {
      setDrag(d => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
      setDrop(computeDrop(ev.clientX, ev.clientY, nodeId));
      autoScroll(scroller, ev.clientY);
    };
    const onUp = (ev: PointerEvent) => {
      const target = computeDrop(ev.clientX, ev.clientY, nodeId);
      cleanup();
      if (!target) return;
      moveMaintenanceNode(workType, nodeId, target.targetId, target.position);
      // al volverlo hijo se expande el destino para que el elemento movido quede a la vista
      const parentId = target.targetId;
      if (target.position === 'inside' && parentId) setExpanded(prev => new Set(prev).add(parentId));
    };
    const onCancel = () => cleanup();

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  if (activeTypes.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-stone-400">
        No hay tipos de trabajo activos. Agrega uno en la pestana "Tipos de Trabajo".
      </div>
    );
  }

  return (
    <PlanEditorContext.Provider value={{ workType, drag, drop, expanded, toggle, startDrag }}>
      <div className="flex overflow-x-auto border-b border-stone-100 bg-stone-50/50">
        {activeTypes.map(wt => (
          <button
            key={wt.code}
            onClick={() => setSelected(wt.code)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${workType === wt.code ? 'border-orange-500 text-orange-600' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
          >
            {wt.name}
          </button>
        ))}
      </div>
      <div className="p-4" ref={containerRef}>
        <p className="text-xs text-stone-400 mb-3">
          Agrega niveles segun lo necesites (ej. Tipo de Vehiculo → Intervalo de Horas → Tareas). Arrastra un elemento por el asa para
          reordenarlo: sueltalo en el borde de otro para ubicarlo antes o despues, o en el centro para volverlo su hijo.
        </p>
        <MaintenanceNodeList key={workType} parentId={null} nodes={maintenancePlans[workType] ?? []} depth={0} />
      </div>

      {drag && (
        <div
          className="fixed z-[70] pointer-events-none px-2 py-1 rounded-md bg-white border border-orange-300 shadow-card-hover text-xs font-medium text-stone-700 max-w-[14rem] truncate"
          style={{ left: drag.x + 12, top: drag.y + 12 }}
        >
          {drag.label || 'Elemento'}
        </div>
      )}
    </PlanEditorContext.Provider>
  );
}

function MaintenanceNodeList({ parentId, nodes, depth }: {
  parentId: string | null;
  nodes: MaintenanceTreeNode[];
  depth: number;
}) {
  const { addMaintenanceNode } = useApp();
  const { workType, drop } = usePlanEditor();
  const [newName, setNewName] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    addMaintenanceNode(workType, parentId, newName.trim());
    setNewName('');
  };

  const endHighlighted = drop?.via === 'end' && drop.targetId === parentId;

  return (
    <div className="space-y-1">
      {nodes.map(node => (
        <MaintenanceNodeRow key={node.id} node={node} depth={depth} />
      ))}
      <div
        data-plan-end
        data-parent-id={parentId ?? ''}
        className={`flex items-center gap-2 rounded py-0.5 ${endHighlighted ? 'bg-orange-100 ring-1 ring-orange-300' : ''}`}
        style={{ paddingLeft: depth * 20 }}
      >
        <TextInput
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder={depth === 0 ? 'Nuevo elemento' : 'Nuevo subelemento'}
          className="flex-1 max-w-xs !py-1 !text-xs"
        />
        <Button size="sm" variant="outline" onClick={handleAdd}><Plus size={12} /> Agregar</Button>
      </div>
    </div>
  );
}

function MaintenanceNodeRow({ node, depth }: {
  node: MaintenanceTreeNode;
  depth: number;
}) {
  const { renameMaintenanceNode, removeMaintenanceNode } = useApp();
  const { workType, drag, drop, expanded, toggle, startDrag } = usePlanEditor();
  const isExpanded = expanded.has(node.id);
  const rowDrop = drop?.via === 'row' && drop.targetId === node.id ? drop.position : null;

  return (
    <div data-plan-node={node.id} className={drag?.nodeId === node.id ? 'opacity-40' : ''}>
      <div
        data-plan-row
        data-node-id={node.id}
        className={`relative flex items-center gap-1.5 py-1 rounded ${rowDrop === 'inside' ? 'bg-orange-100 ring-1 ring-orange-300' : 'hover:bg-stone-50'}`}
        style={{ paddingLeft: depth * 20 }}
      >
        {rowDrop === 'before' && <span className="absolute left-0 right-0 top-0 h-0.5 bg-orange-500 pointer-events-none" />}
        {rowDrop === 'after' && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-orange-500 pointer-events-none" />}
        <button
          type="button"
          onPointerDown={e => startDrag(node, e)}
          className="touch-none cursor-grab active:cursor-grabbing text-stone-300 hover:text-stone-500 flex-shrink-0 p-1.5"
          title="Arrastrar para mover"
          aria-label="Arrastrar para mover"
        >
          <GripVertical size={14} />
        </button>
        <button onClick={() => toggle(node.id)} className="text-stone-400 flex-shrink-0">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <TextInput
          value={node.name}
          onChange={e => renameMaintenanceNode(workType, node.id, e.target.value)}
          className="flex-1 max-w-sm !py-1 !text-xs"
        />
        <button
          onClick={() => removeMaintenanceNode(workType, node.id)}
          className="text-stone-400 hover:text-red-600 transition-colors flex-shrink-0"
          title="Eliminar"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {isExpanded && (
        <MaintenanceNodeList parentId={node.id} nodes={node.children} depth={depth + 1} />
      )}
    </div>
  );
}

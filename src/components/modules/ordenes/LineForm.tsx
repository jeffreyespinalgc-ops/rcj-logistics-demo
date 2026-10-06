import { useEffect, useRef, useState } from 'react';
import { useApp, type NewOTLine } from '@/store/AppContext';
import { Combobox } from '@/components/ui/Combobox';
import type { Asset, OTLinePart } from '@/types';
import { emptyPlanSelection, inferPlanSelection, planSelectionResult, type PlanSelection } from '@/lib/planSelection';
import { PlanPicker } from './PlanPicker';
import { AlertTriangle, Trash2 } from 'lucide-react';

/** Cantidad editable: mientras se escribe puede quedar vacia; al salir del campo vuelve al ultimo valor valido */
function QuantityInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);

  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      value={text}
      aria-label={label}
      onChange={e => {
        setText(e.target.value);
        const n = Math.floor(Number(e.target.value));
        if (Number.isFinite(n) && n > 0) onChange(n);
      }}
      onBlur={() => setText(String(value))}
      className="min-h-[44px] w-20 bg-white px-2 py-1.5 text-right text-content text-stone-800 transition-colors focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300 [@media(pointer:fine)]:min-h-0"
    />
  );
}

/** Desplegable de una celda de la tabla ("estilo SAP"), con buscador: escribir filtra la lista */
function CellSelect({ value, options, placeholder, onChange, ariaLabel }: {
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <Combobox
      value={value}
      options={options}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      onChange={v => { if (v) onChange(v); }}
      className='border-none'
    />
  );
}

/**
 * Repuestos de una linea, en tabla estilo SAP con lineas de grilla visibles. Cada fila (incluida la ultima,
 * siempre en blanco) tiene su celda de Codigo como un desplegable -- elegir un codigo ahi trae solo el resto
 * de los datos del repuesto (Repuesto/Unidad/Stock) y, si es la fila en blanco, agrega la fila sin boton
 * "Agregar". Cambiar el codigo de una fila ya elegida la reapunta a otro repuesto (conserva cantidad y
 * observaciones). Pedir mas de lo que hay en stock esta permitido (Control de Inventario entrega lo disponible
 * y la requisa muestra "entregado / solicitado"), por eso solo se avisa.
 */
export function PartsEditor({ value, onChange }: { value: OTLinePart[]; onChange: (parts: OTLinePart[]) => void }) {
  const { parts: inventory } = useApp();
  const usedIds = new Set(value.map(p => p.partId));
  const stockOf = (partId: string) => inventory.find(p => p.id === partId)?.currentStock ?? 0;

  const pick = (currentPartId: string | null, newPartId: string) => {
    const picked = inventory.find(p => p.id === newPartId);
    if (!picked) return;
    if (currentPartId === null) {
      onChange([...value, {
        partId: picked.id,
        partCode: picked.code,
        partDescription: picked.description,
        unit: picked.unit,
        quantity: 1,
        unitCost: picked.unitCost,
        notes: '',
      }]);
    } else {
      onChange(value.map(x => (x.partId === currentPartId
        ? { ...x, partId: picked.id, partCode: picked.code, partDescription: picked.description, unit: picked.unit, unitCost: picked.unitCost }
        : x)));
    }
  };

  const codeOptions = (currentPartId: string | null) => inventory
    .filter(p => p.id === currentPartId || !usedIds.has(p.id))
    .map(p => ({ value: p.id, label: p.code }));

  const nameOptions = (currentPartId: string | null) => inventory
    .filter(p => p.id === currentPartId || !usedIds.has(p.id))
    .map(p => ({ value: p.id, label: p.description }));

  const cell = 'border border-stone-300 px-2 py-1.5';

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto border">
        <table className="w-full border-collapse text-content">
          <thead>
            <tr className="bg-white text-center text-black">
              <th className={`${cell} whitespace-nowrap font-bold`}>Codigo</th>
              <th className={`${cell} font-bold`}>Repuesto</th>
              <th className={`${cell} whitespace-nowrap font-bold`}>Unidad</th>
              <th className={`${cell} whitespace-nowrap font-bold`}>Stock actual</th>
              <th className={`${cell} whitespace-nowrap font-bold`}>Cantidad a solicitar</th>
              <th className={`${cell} min-w-[140px] font-bold`}>Observaciones</th>
              <th className={`${cell} whitespace-nowrap font-bold`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {value.map(p => {
              const stock = stockOf(p.partId);
              const short = p.quantity > stock;
              return (
                <tr key={p.partId}>
                  <td className={`${cell} min-w-[80px]`}>
                    <CellSelect
                      value={p.partId}
                      options={codeOptions(p.partId)}
                      placeholder="..."
                      ariaLabel={`Codigo del repuesto (${p.partDescription})`}
                      onChange={newId => pick(p.partId, newId)}
                    />
                  </td>
                  <td className={`${cell} min-w-[200px]`}>
                    <CellSelect
                      value={p.partId}
                      options={nameOptions(p.partId)}
                      placeholder=" --- Seleccionar ---"
                      ariaLabel={`Repuesto (${p.partCode})`}
                      onChange={newId => pick(p.partId, newId)}
                    />
                  </td>
                  <td className={`${cell}`}>{p.unit}</td>
                  <td className={`${cell} whitespace-nowrap text-right ${short ? 'font-bold text-red-700' : 'text-stone-800'}`}>{stock}</td>
                  <td className={cell}>
                    <div className="flex justify-end">
                      <QuantityInput
                        value={p.quantity}
                        label={`Cantidad de ${p.partDescription}`}
                        onChange={quantity => onChange(value.map(x => (x.partId === p.partId ? { ...x, quantity } : x)))}
                      />
                    </div>
                  </td>
                  <td className={cell}>
                    <input
                      type="text"
                      value={p.notes ?? ''}
                      onChange={e => onChange(value.map(x => (x.partId === p.partId ? { ...x, notes: e.target.value } : x)))}
                      placeholder="Observaciones..."
                      aria-label={`Observaciones de ${p.partDescription}`}
                      className="w-full min-w-[120px] bg-white px-2 py-1.5 text-content text-stone-800 transition-colors focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </td>
                  <td className={`${cell} text-right`}>
                    <button
                      type="button"
                      onClick={() => onChange(value.filter(x => x.partId !== p.partId))}
                      className="flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 [@media(pointer:fine)]:min-h-0 [@media(pointer:fine)]:min-w-0 sm:p-1.5"
                      title="Quitar repuesto"
                      aria-label={`Quitar ${p.partDescription}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {usedIds.size < inventory.length && (
              <tr className="bg-stone-50/60">
                <td className={`${cell} min-w-[110px]`}>
                  <CellSelect
                    value=""
                    options={codeOptions(null)}
                    placeholder="..."
                    ariaLabel="Agregar repuesto por codigo"
                    onChange={newId => pick(null, newId)}
                  />
                </td>
                <td className={cell}>
                  <CellSelect
                    value=""
                    options={nameOptions(null)}
                    placeholder="..."
                    ariaLabel="Agregar repuesto por nombre"
                    onChange={newId => pick(null, newId)}
                  />
                </td>
                <td className={`${cell} whitespace-nowrap text-stone-400`}>--</td>
                <td className={`${cell} whitespace-nowrap text-right text-stone-400`}>--</td>
                <td className={`${cell} text-right text-stone-400`}>--</td>
                <td className={`${cell} text-stone-400`}>--</td>
                <td className={cell}></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {value.some(p => p.quantity > stockOf(p.partId)) && (
        <p className="flex items-start gap-1.5 text-content text-orange-700">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          Los repuestos en rojo piden mas de lo que hay en stock: Control de Inventario entregara lo disponible.
        </p>
      )}
    </div>
  );
}

/**
 * Estado del formulario de una linea de trabajo. Vive en un hook para que quien lo use (el modal de "Agregar linea"
 * o la pagina de "Nueva OT") pueda armar la linea en el momento que quiera, incluso sin que se haya pulsado "Agregar".
 */
export function useLineDraft(defaultTechnician: string) {
  const { workTypes, maintenancePlans } = useApp();
  const [selection, setSelection] = useState<PlanSelection>(() => emptyPlanSelection());
  const [freeText, setFreeText] = useState('');
  const [parts, setParts] = useState<OTLinePart[]>([]);
  const [notes, setNotes] = useState('');

  const work = planSelectionResult(workTypes, maintenancePlans, selection, freeText);
  const dirty = work.valid || selection.workTypeCode !== '' || freeText.trim() !== '' || parts.length > 0 || notes.trim() !== '';

  const reset = () => {
    setSelection(emptyPlanSelection());
    setFreeText('');
    setParts([]);
    setNotes('');
  };

  /** La linea lista para guardar; null si aun falta elegir el trabajo */
  const build = (): NewOTLine | null => (work.valid
    ? {
        work: work.work,
        workPath: work.workPath,
        activities: work.activities,
        // la linea siempre nace pendiente: se ejecuta despues
        status: 'pendiente',
        technician: defaultTechnician,
        notes: notes.trim(),
        // se infiere de si hay repuestos elegidos, ya no hay un checkbox aparte
        needsPart: parts.length > 0,
        isFinding: false,
        parts,
      }
    : null);

  return {
    selection, setSelection, freeText, setFreeText, parts, setParts, notes, setNotes,
    valid: work.valid, dirty, reset, build,
  };
}

export type LineDraft = ReturnType<typeof useLineDraft>;

/**
 * Campos de la linea: tipo de trabajo, tabla de repuestos y observaciones. Si se pasa `asset` (el vehiculo ya
 * elegido para la OT), al escoger el tipo de trabajo se intenta bajar sola por el arbol de planes segun la
 * marca/modelo del vehiculo -- solo cuando hay una sola coincidencia posible por nivel.
 */
export function LineFields({ draft, asset }: { draft: LineDraft; asset?: Asset }) {
  const { hasPermission, workTypes, maintenancePlans } = useApp();
  const canPickParts = hasPermission('repuestos.consumir');
  const prevAssetId = useRef(asset?.id);

  useEffect(() => {
    // si cambio el vehiculo, la ruta ya elegida (manual o inferida) quedo apuntando al arbol del vehiculo
    // anterior y hay que recalcularla; si no cambio, se respeta una seleccion manual ya hecha
    const assetChanged = prevAssetId.current !== asset?.id;
    prevAssetId.current = asset?.id;
    if (!asset || !draft.selection.workTypeCode) return;
    if (!assetChanged && draft.selection.nodeIds.length > 0) return;
    const type = workTypes.find(w => w.code === draft.selection.workTypeCode);
    if (!type) return;
    const inferred = inferPlanSelection(maintenancePlans[type.code] ?? [], asset);
    draft.setSelection({ ...draft.selection, nodeIds: inferred.nodeIds, checkedIds: inferred.checkedIds });
    // solo cuando cambia el vehiculo o el tipo de trabajo elegido: no queremos pelear con la navegacion manual
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id, draft.selection.workTypeCode]);

  return (
    <div className="space-y-3">
      <PlanPicker
        value={draft.selection}
        onChange={draft.setSelection}
        freeText={draft.freeText}
        onFreeTextChange={draft.setFreeText}
        asset={asset}
      />

      {canPickParts ? (
        <PartsEditor value={draft.parts} onChange={draft.setParts} />
      ) : (
        <p className="text-content text-stone-500">No tienes permiso para seleccionar repuestos.</p>
      )}
    </div>
  );
}

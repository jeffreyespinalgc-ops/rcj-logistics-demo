import { useEffect, useRef, useState } from 'react';
import { useApp, type NewOTLine } from '@/store/AppContext';
import { Button } from '@/components/ui/Button';
import type { Asset, OTLinePart } from '@/types';
import { emptyPlanSelection, inferNodeIds, planSelectionResult, type PlanSelection } from '@/lib/planSelection';
import { fileToCompressedDataUrl } from '@/lib/image';
import { PlanPicker } from './PlanPicker';
import { AlertTriangle, Camera, ChevronDown, Trash2, Upload, X } from 'lucide-react';

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
      className="min-h-[44px] w-20 rounded-md border border-stone-300 bg-white px-2 py-1.5 text-right text-content text-stone-800 transition-colors focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300 sm:min-h-0"
    />
  );
}

/** Desplegable de una celda de la tabla, con el icono de flecha a la derecha (estilo "celda de SAP") */
function CellSelect({ value, options, placeholder, onChange, ariaLabel }: {
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        aria-label={ariaLabel}
        onChange={e => { if (e.target.value) onChange(e.target.value); }}
        className="w-full min-h-[44px] appearance-none rounded-md border border-stone-300 bg-white py-1.5 pl-2 pr-7 text-content text-stone-800 transition-colors focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300 sm:min-h-0"
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-stone-400" />
    </div>
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

  if (inventory.length === 0) {
    return <p className="text-content text-stone-500">No hay repuestos en el inventario.</p>;
  }

  const cell = 'border border-stone-300 px-2 py-1.5';

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border border-stone-300">
        <table className="w-full border-collapse text-content">
          <thead>
            <tr className="bg-stone-100 text-left text-stone-600">
              <th className={`${cell} whitespace-nowrap font-bold`}>Codigo</th>
              <th className={`${cell} font-bold`}>Repuesto</th>
              <th className={`${cell} whitespace-nowrap font-bold`}>Unidad</th>
              <th className={`${cell} whitespace-nowrap text-right font-bold`}>Stock actual</th>
              <th className={`${cell} whitespace-nowrap text-right font-bold`}>Cantidad a solicitar</th>
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
                  <td className={`${cell} min-w-[110px]`}>
                    <CellSelect
                      value={p.partId}
                      options={codeOptions(p.partId)}
                      placeholder="..."
                      ariaLabel={`Codigo del repuesto (${p.partDescription})`}
                      onChange={newId => pick(p.partId, newId)}
                    />
                  </td>
                  <td className={cell}>
                    <CellSelect
                      value={p.partId}
                      options={nameOptions(p.partId)}
                      placeholder="Seleccionar..."
                      ariaLabel={`Repuesto (${p.partCode})`}
                      onChange={newId => pick(p.partId, newId)}
                    />
                  </td>
                  <td className={`${cell} whitespace-nowrap text-stone-600`}>{p.unit}</td>
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
                      className="w-full min-w-[120px] rounded-md border border-stone-300 bg-white px-2 py-1.5 text-content text-stone-800 transition-colors focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300"
                    />
                  </td>
                  <td className={`${cell} text-right`}>
                    <button
                      type="button"
                      onClick={() => onChange(value.filter(x => x.partId !== p.partId))}
                      className="flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600 sm:min-h-0 sm:min-w-0 sm:p-1.5"
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
  const [photosBefore, setPhotosBefore] = useState<{ dataUrl: string; name: string }[]>([]);

  const work = planSelectionResult(workTypes, maintenancePlans, selection, freeText);
  const dirty = work.valid || selection.workTypeCode !== '' || freeText.trim() !== '' || parts.length > 0
    || notes.trim() !== '' || photosBefore.length > 0;

  const reset = () => {
    setSelection(emptyPlanSelection());
    setFreeText('');
    setParts([]);
    setNotes('');
    setPhotosBefore([]);
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
        photosBefore,
      }
    : null);

  return {
    selection, setSelection, freeText, setFreeText, parts, setParts, notes, setNotes,
    photosBefore, setPhotosBefore,
    valid: work.valid, dirty, reset, build,
  };
}

export type LineDraft = ReturnType<typeof useLineDraft>;

/**
 * Campos de la linea, en dos pestanas como una ficha SAP: "Detalle" (tipo de trabajo, tabla de repuestos y
 * observaciones) y "Anexos" (evidencia fotografica, opcional desde que se crea la linea). Si se pasa `asset`
 * (el vehiculo ya elegido para la OT), al escoger el tipo de trabajo se intenta bajar sola por el arbol de
 * planes segun la marca/modelo del vehiculo -- solo cuando hay una sola coincidencia posible por nivel.
 */
export function LineFields({ draft, asset }: { draft: LineDraft; asset?: Asset }) {
  const { hasPermission, workTypes, maintenancePlans } = useApp();
  const canPickParts = hasPermission('repuestos.consumir');
  const [tab, setTab] = useState<'detalle' | 'anexos'>('detalle');
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!asset || !draft.selection.workTypeCode || draft.selection.nodeIds.length > 0) return;
    const type = workTypes.find(w => w.code === draft.selection.workTypeCode);
    if (!type) return;
    const inferred = inferNodeIds(maintenancePlans[type.code] ?? [], asset);
    if (inferred.length > 0) draft.setSelection({ ...draft.selection, nodeIds: inferred });
    // solo cuando cambia el vehiculo o el tipo de trabajo elegido: no queremos pelear con la navegacion manual
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id, draft.selection.workTypeCode]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await fileToCompressedDataUrl(file);
        draft.setPhotosBefore(prev => [...prev, { dataUrl, name: file.name }]);
      } catch {
        // una imagen que no se pudo leer se omite; las demas se siguen guardando
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 border-b border-stone-200">
        <button
          type="button"
          onClick={() => setTab('detalle')}
          className={`min-h-[44px] px-3 text-content font-bold transition-colors sm:min-h-0 sm:py-2 ${tab === 'detalle' ? 'border-b-2 border-orange-500 text-orange-600' : 'border-b-2 border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          Detalle
        </button>
        <button
          type="button"
          onClick={() => setTab('anexos')}
          className={`min-h-[44px] px-3 text-content font-bold transition-colors sm:min-h-0 sm:py-2 ${tab === 'anexos' ? 'border-b-2 border-orange-500 text-orange-600' : 'border-b-2 border-transparent text-stone-500 hover:text-stone-700'}`}
        >
          Anexos{draft.photosBefore.length > 0 ? ` (${draft.photosBefore.length})` : ''}
        </button>
      </div>

      {tab === 'detalle' ? (
        <div className="space-y-3">
          <PlanPicker
            value={draft.selection}
            onChange={draft.setSelection}
            freeText={draft.freeText}
            onFreeTextChange={draft.setFreeText}
          />

          {canPickParts ? (
            <PartsEditor value={draft.parts} onChange={draft.setParts} />
          ) : (
            <p className="text-content text-stone-500">No tienes permiso para seleccionar repuestos.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {draft.photosBefore.map((photo, index) => (
              <div key={`${photo.name}-${index}`} className="relative w-16 h-16 group">
                <div className="w-16 h-16 rounded-md overflow-hidden border border-stone-300 bg-stone-100">
                  <img src={photo.dataUrl} alt={photo.name} className="w-full h-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => draft.setPhotosBefore(prev => prev.filter((_, i) => i !== index))}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity shadow-sm"
                  title="Eliminar fotografia"
                  aria-label={`Eliminar ${photo.name}`}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {draft.photosBefore.length === 0 && <p className="text-content text-stone-500">Sin fotografias adjuntas.</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-[44px] sm:min-h-0"
              onClick={() => cameraRef.current?.click()}
              disabled={busy}
              title="Tomar fotografia con la camara"
            >
              <Camera size={14} /> Tomar foto
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-[44px] sm:min-h-0"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              title="Subir imagenes desde el dispositivo"
            >
              <Upload size={14} /> Subir imagen
            </Button>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => { void handleFiles(e.target.files); }}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => { void handleFiles(e.target.files); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

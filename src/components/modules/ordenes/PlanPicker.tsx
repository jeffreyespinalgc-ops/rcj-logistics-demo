import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Select, TextInput } from '@/components/ui/Field';
import type { OTActivity, OTLine } from '@/types';
import {
  planSelectionResult,
  resolvePlan,
  selectionFromLine,
  type PlanSelection,
} from '@/lib/planSelection';

/**
 * Selector en cascada sobre los Planes de Mantenimiento: tipo de trabajo, un desplegable por cada
 * nivel y, al llegar a las actividades, casillas para marcar las que se van a realizar.
 * Si el tipo elegido aun no tiene plan, se ofrece un texto libre como respaldo.
 */
export function PlanPicker({ value, onChange, freeText, onFreeTextChange }: {
  value: PlanSelection;
  onChange: (next: PlanSelection) => void;
  freeText: string;
  onFreeTextChange: (text: string) => void;
}) {
  const { workTypes, maintenancePlans } = useApp();
  const activeTypes = workTypes.filter(w => w.active);
  const type = workTypes.find(w => w.code === value.workTypeCode);
  const roots = type ? (maintenancePlans[type.code] ?? []) : [];
  const { levels, leaves } = resolvePlan(roots, value.nodeIds);
  const allChecked = leaves.length > 0 && leaves.every(l => value.checkedIds.includes(l.id));
  const freeTextMode = type ? roots.length === 0 : activeTypes.length === 0;

  const selectLevel = (depth: number, id: string) => {
    onChange({ ...value, nodeIds: id ? [...value.nodeIds.slice(0, depth), id] : value.nodeIds.slice(0, depth), checkedIds: [] });
  };

  const toggleLeaf = (id: string) => {
    const checkedIds = value.checkedIds.includes(id) ? value.checkedIds.filter(c => c !== id) : [...value.checkedIds, id];
    onChange({ ...value, checkedIds });
  };

  const toggleAll = () => {
    onChange({ ...value, checkedIds: allChecked ? [] : leaves.map(l => l.id) });
  };

  return (
    <div className="space-y-3">
      <Field label="Tipo de trabajo *">
        <Select
          value={type ? type.code : ''}
          onChange={e => onChange({ workTypeCode: e.target.value, nodeIds: [], checkedIds: [] })}
        >
          <option value="">Seleccionar tipo de trabajo...</option>
          {activeTypes.map(w => <option key={w.code} value={w.code}>{w.name}</option>)}
        </Select>
      </Field>

      {freeTextMode ? (
        <Field label="Trabajo *">
          <TextInput value={freeText} onChange={e => onFreeTextChange(e.target.value)} placeholder="Ej: Cambio de llanta" />
        </Field>
      ) : type && (
        <>
          {levels.map((level, depth) => (
            <Field key={depth}>
              <Select value={level.selectedId ?? ''} onChange={e => selectLevel(depth, e.target.value)}>
                <option value="">Seleccionar...</option>
                {level.options.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
              </Select>
            </Field>
          ))}

          {leaves.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Actividades *</span>
                <button type="button" onClick={toggleAll} className="text-xs font-medium text-orange-600 hover:text-orange-700">
                  {allChecked ? 'Quitar todas' : 'Marcar todas'}
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto border border-stone-200 rounded-md divide-y divide-stone-100 bg-white">
                {leaves.map(leaf => (
                  <label key={leaf.id} className="flex items-center gap-2 px-3 py-2 text-sm text-stone-700 cursor-pointer hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={value.checkedIds.includes(leaf.id)}
                      onChange={() => toggleLeaf(leaf.id)}
                      className="rounded border-stone-300 text-orange-500 focus:ring-orange-300"
                    />
                    {leaf.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Cambia la ruta y las actividades de una linea ya creada (solo quien puede editar lineas) */
export function EditLineWorkModal({ line, onClose, onSave }: {
  line: OTLine;
  onClose: () => void;
  onSave: (patch: { work: string; workPath: string[]; activities: OTActivity[] }) => void;
}) {
  const { workTypes, maintenancePlans } = useApp();
  const [selection, setSelection] = useState<PlanSelection>(() => selectionFromLine(workTypes, maintenancePlans, line));
  const [freeText, setFreeText] = useState(line.work);

  const result = planSelectionResult(workTypes, maintenancePlans, selection, freeText);

  const handleSave = () => {
    if (!result.valid) return;
    onSave({ work: result.work, workPath: result.workPath, activities: result.activities });
  };

  return (
    <Modal open onClose={onClose} title="Editar actividades de la linea" size="md">
      <div className="space-y-4">
        <PlanPicker value={selection} onChange={setSelection} freeText={freeText} onFreeTextChange={setFreeText} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!result.valid}>Guardar</Button>
        </div>
      </div>
    </Modal>
  );
}

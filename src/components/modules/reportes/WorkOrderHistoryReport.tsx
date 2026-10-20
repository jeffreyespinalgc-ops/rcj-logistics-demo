import { useMemo, useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Field, Select, TextInput } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { DocumentPreview } from '@/components/modules/ordenes/DocumentPreview';
import { allOTStatuses, otCreatedAt, statusLabels } from '@/components/modules/ordenes/otMeta';
import { buildWorkOrderHistoryReportPdf } from '@/lib/workOrderHistoryReportPdf';
import type { OTStatus, WorkOrder } from '@/types';
import { RotateCcw } from 'lucide-react';

/** Nombres individuales a cargo de la OT (el equipo completo, no el texto ya unido con comas) */
function otAssigneeNames(ot: WorkOrder): string[] {
  if (!ot.assignedTo) return [];
  if (ot.assignedToType === 'taller_externo') return [ot.assignedTo];
  return ot.assignedTeam.length > 0 ? ot.assignedTeam : [ot.assignedTo];
}

const ALL = 'todos';

export function WorkOrderHistoryReport({ onBack, backLabel }: { onBack: () => void; backLabel: string }) {
  const { workOrders, hasPermission } = useApp();
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [vehiculo, setVehiculo] = useState(ALL);
  const [asignado, setAsignado] = useState(ALL);
  const [estado, setEstado] = useState<OTStatus | typeof ALL>(ALL);

  const vehicleOptions = useMemo(() => {
    const map = new Map<string, string>();
    workOrders.forEach(ot => map.set(ot.assetCode, `${ot.assetCode} - ${ot.assetName}`));
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [workOrders]);

  const assigneeOptions = useMemo(() => {
    const names = new Set<string>();
    workOrders.forEach(ot => otAssigneeNames(ot).forEach(n => names.add(n)));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [workOrders]);

  const filtered = useMemo(() => workOrders.filter(ot => {
    const createdDate = otCreatedAt(ot).slice(0, 10);
    if (desde && createdDate < desde) return false;
    if (hasta && createdDate > hasta) return false;
    if (vehiculo !== ALL && ot.assetCode !== vehiculo) return false;
    if (asignado !== ALL && !otAssigneeNames(ot).includes(asignado)) return false;
    if (estado !== ALL && ot.status !== estado) return false;
    return true;
  }), [workOrders, desde, hasta, vehiculo, asignado, estado]);

  const hasFilters = Boolean(desde || hasta || vehiculo !== ALL || asignado !== ALL || estado !== ALL);
  const clearFilters = () => { setDesde(''); setHasta(''); setVehiculo(ALL); setAsignado(ALL); setEstado(ALL); };

  const documentKey = [
    desde, hasta, vehiculo, asignado, estado,
    filtered.map(o => `${o.id}:${o.status}:${o.priority}:${o.lines.length}`).join(','),
  ].join('|');

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Field label="Fecha desde">
            <TextInput type="date" value={desde} onChange={e => setDesde(e.target.value)} max={hasta || undefined} />
          </Field>
          <Field label="Fecha hasta">
            <TextInput type="date" value={hasta} onChange={e => setHasta(e.target.value)} min={desde || undefined} />
          </Field>
          <Field label="Vehiculo">
            <Select value={vehiculo} onChange={e => setVehiculo(e.target.value)} aria-label="Filtrar por vehiculo">
              <option value={ALL}>Todos</option>
              {vehicleOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Asignada a">
            <Select value={asignado} onChange={e => setAsignado(e.target.value)} aria-label="Filtrar por asignado">
              <option value={ALL}>Todos</option>
              {assigneeOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={estado} onChange={e => setEstado(e.target.value as OTStatus | typeof ALL)} aria-label="Filtrar por estado">
              <option value={ALL}>Todos</option>
              {allOTStatuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
            </Select>
          </Field>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-content text-stone-500">{filtered.length} de {workOrders.length} ordenes de trabajo</p>
          {hasFilters && (
            <Button variant="outline" size="sm" className="min-h-[44px] pointer-fine:min-h-0" onClick={clearFilters}>
              <RotateCcw size={12} /> Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      <DocumentPreview
        buildDoc={() => buildWorkOrderHistoryReportPdf(filtered)}
        documentKey={documentKey}
        altPrefix="Historial de Ordenes de Trabajo"
        canDownload={hasPermission('reportes.ver')}
        onBack={onBack}
        backLabel={backLabel}
      />
    </div>
  );
}

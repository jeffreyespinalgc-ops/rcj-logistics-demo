import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Select } from '@/components/ui/Field';
import type { OTLine, RequisitionStep, WorkOrder } from '@/types';
import { AlertTriangle, ChevronDown, ChevronRight, FileSignature, PenTool, Search, SlidersHorizontal, X } from 'lucide-react';
import {
  missingSteps,
  requiresRequisition,
  requisitionStatus,
  requisitionStepLabels,
  requisitionSteps,
  signableSteps,
  signatureFor,
  signaturesOf,
  type RequisitionStatus,
} from '@/lib/requisition';
import { RequisitionProgress } from './ordenes/RequisitionProgress';
import { RequisitionPdfButton } from './ordenes/RequisitionPdfButton';
import { formatDateTime } from './ordenes/otMeta';

type StatusFilter = 'todas' | 'por_firmar' | RequisitionStatus;

const statusLabels: Record<RequisitionStatus, string> = {
  sin_solicitar: 'Sin solicitar',
  en_firma: 'En firma',
  completa: 'Firmada',
};

const statusVariants: Record<RequisitionStatus, 'gray' | 'orange' | 'green'> = {
  sin_solicitar: 'gray',
  en_firma: 'orange',
  completa: 'green',
};

const filterLabels: Record<StatusFilter, string> = {
  todas: 'Todas',
  por_firmar: 'Por firmar por mi',
  sin_solicitar: 'Sin solicitar',
  en_firma: 'En firma',
  completa: 'Firmadas',
};

const PAGE_SIZE = 10;

interface Row {
  ot: WorkOrder;
  line: OTLine;
  status: RequisitionStatus;
  mySteps: RequisitionStep[];
  activityAt: string;
}

export function RequisasModule() {
  const { workOrders, hasPermission, currentUser, setActiveModule } = useApp();
  const canAutorizar = hasPermission('requisa.autorizar');
  const canDespachar = hasPermission('requisa.despachar');
  const canSign = canAutorizar || canDespachar;
  const canSeeAll = hasPermission('ot.ver.todas');
  const canOpenOrders = hasPermission('modulo.ordenes');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>(canSign ? 'por_firmar' : 'todas');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ otId: string; lineId: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // orden por defecto: actividad mas reciente primero
  const rows = useMemo<Row[]>(() => workOrders
    .filter(ot => canSeeAll || ot.assignedTo === currentUser)
    .flatMap(ot => ot.lines.filter(requiresRequisition).map(line => {
      const signatures = signaturesOf(line);
      return {
        ot,
        line,
        status: requisitionStatus(line),
        mySteps: signableSteps(line, { autoriza: canAutorizar, despacha: canDespachar }),
        activityAt: signatures.length > 0 ? signatures[signatures.length - 1].at : line.createdAt,
      };
    }))
    .sort((a, b) => b.activityAt.localeCompare(a.activityAt)),
  [workOrders, canSeeAll, currentUser, canAutorizar, canDespachar]);

  const query = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (filter === 'por_firmar' && r.mySteps.length === 0) return false;
    if (filter !== 'todas' && filter !== 'por_firmar' && r.status !== filter) return false;
    if (!query) return true;
    const haystack = [
      r.line.requisition?.code,
      r.ot.code,
      r.ot.assetCode,
      r.ot.assetName,
      r.line.work,
      ...r.line.parts.map(p => `${p.partCode} ${p.partDescription}`),
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filterOptions = (Object.keys(filterLabels) as StatusFilter[]).filter(f => f !== 'por_firmar' || canSign);

  const clearFilters = () => {
    setFilter('todas');
    setSearch('');
    setPage(1);
  };

  return (
    <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6">
      <div className="bg-white rounded-lg shadow-card border border-stone-200">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-stone-200 bg-stone-50/50">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar requisa, OT, vehiculo, linea o repuesto"
              aria-label="Buscar requisas"
              className="w-full min-h-[44px] rounded-md border border-stone-300 bg-white pl-9 pr-9 text-sm text-stone-800 transition-colors focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-stone-200 bg-stone-50 px-1.5 text-[11px] text-stone-400 sm:block">/</kbd>
          </div>
          <Button
            variant="outline"
            className="min-h-[44px]"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen(v => !v)}
          >
            <SlidersHorizontal size={14} /> Filtros
            {filter !== 'todas' && <span className="rounded-full bg-orange-500 px-1.5 text-[11px] font-bold leading-4 text-white">1</span>}
          </Button>
        </div>

        {filtersOpen && (
          <div className="flex flex-wrap items-end gap-3 px-4 py-3 border-b border-stone-100">
            <Field label="Estado" className="w-full sm:w-56">
              <Select
                value={filter}
                onChange={e => { setFilter(e.target.value as StatusFilter); setPage(1); }}
                className="min-h-[44px]"
              >
                {filterOptions.map(f => <option key={f} value={f}>{filterLabels[f]}</option>)}
              </Select>
            </Field>
          </div>
        )}

        {filter !== 'todas' && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-stone-100 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-2.5 pr-1 font-medium text-blue-800">
              Estado: {filterLabels[filter]}
              <button
                onClick={() => { setFilter('todas'); setPage(1); }}
                aria-label={`Quitar filtro Estado: ${filterLabels[filter]}`}
                className="rounded-full p-1 hover:bg-blue-100"
              >
                <X size={12} />
              </button>
            </span>
            <button onClick={clearFilters} className="font-medium text-orange-700 hover:underline">Limpiar filtros</button>
          </div>
        )}

        {pageRows.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <FileSignature size={28} className="mx-auto mb-3 text-stone-300" />
            {rows.length === 0 ? (
              <>
                <h3 className="font-heading text-base font-bold text-stone-800">Aun no hay requisas</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
                  Aparecen aqui cuando un tecnico agrega una linea con "Requiere repuesto" y elige los repuestos.
                </p>
                {canOpenOrders && (
                  <Button className="mt-4 min-h-[44px]" onClick={() => setActiveModule('ordenes')}>
                    Ir a Ordenes de Trabajo
                  </Button>
                )}
              </>
            ) : (
              <>
                <h3 className="font-heading text-base font-bold text-stone-800">Ninguna requisa coincide con los filtros</h3>
                <Button className="mt-4 min-h-[44px]" onClick={clearFilters}>Limpiar filtros</Button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th aria-sort="descending">
                    <span className="inline-flex items-center gap-1">Requisa <ChevronDown size={12} /></span>
                  </th>
                  <th>OT y vehiculo</th>
                  <th>Linea y repuestos</th>
                  <th>Firmas</th>
                  <th className="sticky right-0 bg-stone-100"><span className="sr-only">Accion</span></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(({ ot, line, status, mySteps, activityAt }) => {
                  const first = line.parts[0];
                  const open = () => setSelected({ otId: ot.id, lineId: line.id });
                  return (
                    <tr key={`${ot.id}-${line.id}`} className="cursor-pointer" onClick={open}>
                      <td className="whitespace-nowrap">
                        <button onClick={open} className="block font-semibold text-blue-700 hover:underline">
                          {line.requisition?.code ?? <span className="font-medium text-stone-500">Sin solicitar</span>}
                        </button>
                        <span className="mt-1 flex items-center gap-2">
                          <Badge variant={statusVariants[status]}>{statusLabels[status]}</Badge>
                        </span>
                        <span className="mt-1 block text-[11px] text-stone-400">{formatDateTime(activityAt)}</span>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="block font-medium text-stone-800">{ot.code}</span>
                        <span className="block text-xs text-stone-500">{ot.assetCode} - {ot.assetName}</span>
                      </td>
                      <td className="min-w-[180px] max-w-[260px]">
                        <span className="block truncate text-stone-700" title={line.work}>{line.work}</span>
                        <span
                          className="block truncate text-xs text-stone-500"
                          title={line.parts.map(p => `${p.partDescription} x${p.quantity}`).join(', ')}
                        >
                          {first.partDescription} x{first.quantity}{line.parts.length > 1 ? ` +${line.parts.length - 1} mas` : ''}
                        </span>
                      </td>
                      <td><RequisitionProgress line={line} compact /></td>
                      <td className="sticky right-0 bg-white text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]">
                        {mySteps.length > 0 ? (
                          <Button
                            size="sm"
                            className="min-h-[44px] sm:min-h-0"
                            onClick={e => { e.stopPropagation(); open(); }}
                          >
                            <PenTool size={12} /> Firmar
                          </Button>
                        ) : (
                          <ChevronRight size={16} className="ml-auto text-stone-400" aria-hidden="true" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-stone-200 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      </div>

      {selected && (
        <RequisitionModal otId={selected.otId} lineId={selected.lineId} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/** Detalle de la requisa: stock actual a la izquierda, cantidad solicitada a la derecha, y la firma del paso que le toca al usuario */
function RequisitionModal({ otId, lineId, onClose }: { otId: string; lineId: string; onClose: () => void }) {
  const { workOrders, parts, hasPermission, signRequisition } = useApp();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ot = workOrders.find(o => o.id === otId);
  const line = ot?.lines.find(l => l.id === lineId);
  if (!ot || !line) return null;

  const step = signableSteps(line, {
    autoriza: hasPermission('requisa.autorizar'),
    despacha: hasPermission('requisa.despachar'),
  })[0];
  const status = requisitionStatus(line);
  const stockOf = (partId: string) => parts.find(p => p.id === partId)?.currentStock ?? 0;
  const shortages = line.parts.filter(p => stockOf(p.partId) < p.quantity);
  // quien despacha, o quien reune la ultima firma, confirma que hay stock para entregar
  const completes = step ? requisitionSteps.filter(s => s !== step).every(s => signatureFor(line, s)) : false;
  const blockedByStock = shortages.length > 0 && (step === 'despacha' || completes);
  const missing = missingSteps(line).map(s => requisitionStepLabels[s]);

  const handleSign = () => {
    if (!step) return;
    const result = signRequisition(ot.id, line.id, step);
    if (result) setError(result);
    else onClose();
  };

  const note = step
    ? null
    : status === 'completa'
      ? 'Requisa firmada por todas las partes: los repuestos ya salieron del inventario.'
      : status === 'sin_solicitar'
        ? 'Esperando que el tecnico firme la solicitud desde la linea de la OT.'
        : `Faltan firmas, en este orden: ${missing.join(' > ')}.`;

  return (
    <Modal open onClose={onClose} title={line.requisition?.code ?? 'Solicitud de repuestos'} size="lg">
      <div className="space-y-5">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Orden de trabajo</dt>
            <dd className="text-stone-800">{ot.code}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Vehiculo</dt>
            <dd className="text-stone-800">{ot.assetCode} - {ot.assetName}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Linea</dt>
            <dd className="break-words text-stone-800">{line.work}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Tecnico</dt>
            <dd className="text-stone-800">{line.technician || '--'}</dd>
          </div>
        </dl>

        <section aria-labelledby="req-parts">
          <h4 id="req-parts" className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Repuestos solicitados</h4>
          <div className="overflow-hidden rounded-md border border-stone-200">
            <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem] bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-600 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]">
              <span>Repuesto</span>
              <span className="text-right">Stock actual</span>
              <span className="text-right">Solicitado</span>
            </div>
            {line.parts.map(p => {
              const stock = stockOf(p.partId);
              const short = stock < p.quantity;
              return (
                <div key={p.partId} className="border-t border-stone-100 px-3 py-2.5">
                  <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem] items-center sm:grid-cols-[minmax(0,1fr)_7rem_7rem]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-stone-800">{p.partDescription}</p>
                      <p className="text-xs text-stone-500">{p.partCode}</p>
                    </div>
                    <span className={`text-right text-base font-bold ${short ? 'text-red-700' : 'text-stone-800'}`}>{stock}</span>
                    <span className="text-right text-base font-bold text-blue-700">{p.quantity}</span>
                  </div>
                  {short && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-700">
                      <AlertTriangle size={12} /> Faltan {p.quantity - stock} unidades
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="req-signatures">
          <h4 id="req-signatures" className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Firmas</h4>
          <RequisitionProgress line={line} showNames />
        </section>

        {blockedByStock && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 p-2.5 text-xs text-red-700">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            No hay stock suficiente para entregar esta solicitud. Podras firmar cuando el inventario tenga las cantidades solicitadas.
          </p>
        )}
        {!blockedByStock && step && shortages.length > 0 && (
          <p className="flex items-start gap-2 rounded-md border border-orange-100 bg-orange-50 p-2.5 text-xs text-orange-800">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            Hay repuestos con stock insuficiente. Puedes firmar, pero la ultima firma exige tener el stock disponible.
          </p>
        )}
        {note && <p className="text-sm text-stone-600">{note}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 pt-4">
          {step && <span className="mr-auto text-xs text-stone-500">Firmaras como {requisitionStepLabels[step]}</span>}
          <RequisitionPdfButton ot={ot} line={line} />
          <Button variant="outline" className="min-h-[44px]" onClick={onClose}>{step ? 'Cancelar' : 'Cerrar'}</Button>
          {step && (
            <Button className="min-h-[44px]" disabled={blockedByStock} onClick={handleSign}>
              <PenTool size={14} /> Firmar solicitud
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

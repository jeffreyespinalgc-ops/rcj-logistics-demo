import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/store/AppContext';
import { useConfirm } from '@/store/ConfirmContext';
import { useToast } from '@/store/ToastContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Select } from '@/components/ui/Field';
import { SortableTh } from '@/components/ui/SortableTh';
import { useSort } from '@/lib/useSort';
import type { OTLine, OTLinePart, RequisitionStep, WorkOrder } from '@/types';
import { AlertTriangle, ChevronRight, CircleChevronRight, Eye, FileSignature, PenBoxIcon, PenTool, Search, SlidersHorizontal, X } from 'lucide-react';
import {
  isDelivered,
  isPartial,
  isRequisitionRequester,
  missingSteps,
  quantityLabel,
  requiresRequisition,
  requisitionFieldLabels,
  requisitionSignLabels,
  requisitionStatus,
  requisitionStepLabels,
  requisitionStepRoles,
  signableSteps,
  signatureFor,
  signaturesOf,
  type RequisitionStatus,
} from '@/lib/requisition';
import { RequisitionProgress } from './ordenes/RequisitionProgress';
import { RequisitionDocumentButton, RequisitionDocumentView } from './ordenes/RequisitionDocument';

const requisitionSortGetters = {
  requisa: (r: Row) => r.code ?? '',
  ot: (r: Row) => r.ot.code,
  linea: (r: Row) => r.lines.length,
  firmas: (r: Row) => r.lines.reduce((sum, l) => sum + signaturesOf(l).length, 0),
};

type StatusFilter = 'todas' | 'por_firmar' | RequisitionStatus;

const filterLabels: Record<StatusFilter, string> = {
  todas: 'Todas',
  por_firmar: 'Por firmar por mi',
  sin_solicitar: 'Sin solicitar',
  en_firma: 'En firma',
  completa: 'Completas',
};

const PAGE_SIZE = 10;

/** Una OT rechazada o cerrada ya no se toca: tampoco se firman sus requisas */
const otAcceptsSignatures = (ot: WorkOrder): boolean => ot.status !== 'rechazada' && ot.status !== 'cerrada';

/**
 * Una sola requisa por OT: cada fila agrupa TODAS las lineas de esa OT que piden repuestos (un solo codigo,
 * un solo documento). Las firmas se mantienen por linea (cada una su propio Solicitante->Jefe->Control->
 * Receptor); esta fila solo resume: cuantas lineas hay y si a mi me toca firmar algo en cualquiera de ellas.
 */
interface Row {
  ot: WorkOrder;
  lines: OTLine[];
  code: string | null;
  status: RequisitionStatus;
  mySteps: RequisitionStep[];
  activityAt: string;
}

/** Codigo de OT como enlace: abre Ordenes de Trabajo directamente en esa OT (si el rol tiene acceso a ese modulo) */
function OTLink({ ot, className = '' }: { ot: WorkOrder; className?: string }) {
  const { hasPermission, openWorkOrder } = useApp();
  if (!hasPermission('modulo.ordenes')) return <span className={`font-normal text-stone-800 ${className}`}>{ot.code}</span>;
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); openWorkOrder(ot.id); }}
      title={`Abrir ${ot.code}`}
      className={`font-normal text-blue-700 hover:underline ${className}`}
    >
      {ot.code}
    </button>
  );
}

export function RequisasTable() {
  const { workOrders, hasPermission, currentUser, setActiveModule } = useApp();
  const canAutorizar = hasPermission('requisa.autorizar');
  const canDespachar = hasPermission('requisa.despachar');
  const canSign = canAutorizar || canDespachar;
  const canSeeAll = hasPermission('ot.ver.todas');
  const canOpenOrders = hasPermission('modulo.ordenes');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('todas');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ otId: string } | null>(null);
  const [preview, setPreview] = useState<{ otId: string } | null>(null);
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

  // orden por defecto: actividad mas reciente primero. Una fila por OT (una sola requisa por OT)
  const rows = useMemo<Row[]>(() => workOrders
    .filter(ot => canSeeAll || ot.assignedTo === currentUser)
    .map(ot => ({ ot, lines: ot.lines.filter(requiresRequisition) }))
    .filter(({ lines }) => lines.length > 0)
    .map(({ ot, lines }) => {
      const code = lines.find(l => l.requisition?.code)?.requisition?.code ?? null;
      const statuses = lines.map(requisitionStatus);
      const status: RequisitionStatus = statuses.every(s => s === 'completa')
        ? 'completa'
        : statuses.some(s => s !== 'sin_solicitar') ? 'en_firma' : 'sin_solicitar';
      const activityAt = lines.reduce((latest, l) => {
        const signatures = signaturesOf(l);
        const at = signatures.length > 0 ? signatures[signatures.length - 1].at : l.createdAt;
        return at > latest ? at : latest;
      }, '');
      return {
        ot,
        lines,
        code,
        status,
        // en esta pestana firman el Jefe de Taller y Control de Inventario; el tecnico firma desde la linea de su OT
        mySteps: otAcceptsSignatures(ot)
          ? [...new Set(lines.flatMap(l => signableSteps(l, { requester: false, autoriza: canAutorizar, despacha: canDespachar })))]
          : [],
        activityAt,
      };
    })
    .sort((a, b) => b.activityAt.localeCompare(a.activityAt)),
  [workOrders, canSeeAll, currentUser, canAutorizar, canDespachar]);

  const query = search.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (filter === 'por_firmar' && r.mySteps.length === 0) return false;
    if (filter !== 'todas' && filter !== 'por_firmar' && r.status !== filter) return false;
    if (!query) return true;
    const haystack = [
      r.code,
      r.ot.code,
      r.ot.assetCode,
      r.ot.assetName,
      ...r.lines.flatMap(l => [l.work, ...l.parts.map(p => `${p.partCode} ${p.partDescription}`)]),
    ].join(' ').toLowerCase();
    return haystack.includes(query);
  });

  // sin elegir columna, se respeta el orden por defecto (actividad mas reciente primero) de arriba
  const { sorted, sort, toggle } = useSort(filtered, requisitionSortGetters);
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filterOptions = (Object.keys(filterLabels) as StatusFilter[]).filter(f => f !== 'por_firmar' || canSign);

  const clearFilters = () => {
    setFilter('todas');
    setSearch('');
    setPage(1);
  };

  const previewOT = preview ? workOrders.find(o => o.id === preview.otId) : undefined;
  // el documento es uno solo por OT: da igual con cual de sus lineas se abra, buildRequisitionPdf junta todas
  const previewLine = previewOT?.lines.find(requiresRequisition);

  return (
    <>
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
            className="w-full min-h-[44px] rounded-md border border-stone-300 bg-white pl-9 pr-9 text-content text-stone-800 transition-colors focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-stone-200 bg-stone-50 px-1.5 text-content text-stone-400 sm:block">/</kbd>
        </div>
        <Button
          variant="outline"
          className="min-h-[44px]"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen(v => !v)}
        >
          <SlidersHorizontal size={14} /> Filtros
          {filter !== 'todas' && <span className="rounded-full bg-orange-500 px-1.5 text-content font-bold leading-4 text-white">1</span>}
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
              <h3 className="ui-title">Aun no hay requisas</h3>
              <p className="mx-auto mt-1 max-w-md text-content text-stone-500">
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
              <h3 className="ui-title">Ninguna requisa coincide con los filtros</h3>
              <Button className="mt-4 min-h-[44px]" onClick={clearFilters}>Limpiar filtros</Button>
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="Requisa" sortKey="requisa" sort={sort} onSort={toggle} />
                <SortableTh label="OT" sortKey="ot" sort={sort} onSort={toggle} />
                <SortableTh label="Lineas" sortKey="linea" sort={sort} onSort={toggle} />
                <SortableTh label="Firmas" sortKey="firmas" sort={sort} onSort={toggle} />
                <th className="sticky right-0 bg-stone-100"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(row => {
                const { ot, lines, code, mySteps } = row;
                const open = () => setSelected({ otId: ot.id });
                const completeCount = lines.filter(l => requisitionStatus(l) === 'completa').length;
                return (
                  <tr key={ot.id} className="cursor-pointer bg-white" onClick={open}>
                    <td className="whitespace-nowrap">
                      <button onClick={open} className="block font-normal text-blue-700 hover:underline">
                        {code ?? <span className="text-stone-500">Sin solicitar</span>}
                      </button>
                    </td>
                    <td className="whitespace-nowrap">
                      <OTLink ot={ot} />
                    </td>
                    <td className="min-w-[180px] max-w-[260px]">
                      <span className="block font-normal text-stone-800">{lines.length} linea{lines.length === 1 ? '' : 's'}</span>
                      <span className="block truncate text-stone-500" title={lines.map(l => l.work).join(', ')}>
                        {lines.map(l => l.work).join(', ')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-stone-700">{completeCount} / {lines.length} completas</td>
                    <td className="sticky right-0 bg-white text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]">
                      <span className="inline-flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-[44px] sm:min-h-0"
                          onClick={e => { e.stopPropagation(); setPreview({ otId: ot.id }); }}
                        >
                          <Eye size={12} /> Ver
                        </Button>
                        {mySteps.length > 0 ? (
                          <Button
                            size="sm"
                            className="min-h-[44px] sm:min-h-0"
                            onClick={e => { e.stopPropagation(); open(); }}
                          >
                            <PenBoxIcon size={12} /> Revisar
                          </Button>
                        ) : (
                          <CircleChevronRight size={12} className="text-black" aria-hidden="true" />
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-stone-200 text-content text-stone-500">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
            Anterior
          </Button>
          <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>
            Siguiente
          </Button>
        </div>
      </div>

      {selected && (
        <OTRequisitionGroupModal otId={selected.otId} onClose={() => setSelected(null)} />
      )}

      {previewOT && previewLine && (
        <Modal open onClose={() => setPreview(null)} title={`Documento ${previewLine.requisition?.code ?? 'de la requisa'}`} size="xl">
          <RequisitionDocumentView ot={previewOT} line={previewLine} onBack={() => setPreview(null)} backLabel="Cerrar" />
        </Modal>
      )}
    </>
  );
}

/** Dato de la ficha: etiqueta en negrita y valor en peso normal */
function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="sap-cell">
      <dt>{label}:</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * Una sola requisa por OT: esta ficha lista todas las lineas de la OT que piden repuestos (cada una con su
 * propio avance Solicitante->Jefe->Control->Receptor) y deja elegir en cual firmar o ver el detalle.
 */
function OTRequisitionGroupModal({ otId, onClose }: { otId: string; onClose: () => void }) {
  const { workOrders, hasPermission } = useApp();
  const [lineId, setLineId] = useState<string | null>(null);
  const canAutorizar = hasPermission('requisa.autorizar');
  const canDespachar = hasPermission('requisa.despachar');

  const ot = workOrders.find(o => o.id === otId);
  if (!ot) return null;
  const lines = ot.lines.filter(requiresRequisition);
  const code = lines.find(l => l.requisition?.code)?.requisition?.code;

  if (lineId) {
    return <RequisitionModal otId={otId} lineId={lineId} onClose={() => setLineId(null)} />;
  }

  return (
    <Modal open onClose={onClose} title={code ?? 'Requisa de repuestos'} size="lg">
      <div className="space-y-4">
        <dl className="sap-grid grid-cols-1 sm:grid-cols-2">
          <DetailField label="Orden de trabajo"><OTLink ot={ot} /></DetailField>
          <DetailField label="Vehiculo">{ot.assetCode} - {ot.assetName}</DetailField>
        </dl>
        <ul className="divide-y divide-stone-200 rounded-md border border-stone-200">
          {lines.map(line => {
            const mySteps = otAcceptsSignatures(ot)
              ? signableSteps(line, { requester: false, autoriza: canAutorizar, despacha: canDespachar })
              : [];
            return (
              <li key={line.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate font-normal text-stone-800" title={line.work}>{line.work}</p>
                  <div className="mt-1"><RequisitionProgress line={line} compact /></div>
                </div>
                <span className="flex items-center gap-2">
                  <RequisitionDocumentButton ot={ot} line={line} />
                  {mySteps.length > 0 && (
                    <Button
                      size="sm"
                      className="min-h-[44px] sm:min-h-0"
                      onClick={() => setLineId(line.id)}
                    >
                      <PenTool size={12} /> {requisitionSignLabels[mySteps[0]]}
                    </Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end">
          <Button variant="outline" className="min-h-[44px]" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  );
}

function RequisitionModal({ otId, lineId, onClose }: { otId: string; lineId: string; onClose: () => void }) {
  const { workOrders, parts, hasPermission, currentUser, signRequisition } = useApp();
  const confirm = useConfirm();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [showDocument, setShowDocument] = useState(false);
  const [delivery, setDelivery] = useState<Record<string, number>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ot = workOrders.find(o => o.id === otId);
  const line = ot?.lines.find(l => l.id === lineId);
  if (!ot || !line) return null;

  const step = otAcceptsSignatures(ot)
    ? signableSteps(line, {
        requester: hasPermission('requisa.solicitar') && isRequisitionRequester(line, ot.assignedTo, currentUser),
        autoriza: hasPermission('requisa.autorizar'),
        despacha: hasPermission('requisa.despachar'),
      })[0]
    : undefined;
  const status = requisitionStatus(line);
  const delivered = isDelivered(line);
  const stockOf = (partId: string) => parts.find(p => p.id === partId)?.currentStock ?? 0;
  /** Lo maximo que puede entregar Control: lo solicitado, sin pasar del stock */
  const maxFor = (p: OTLinePart) => Math.min(p.quantity, stockOf(p.partId));
  const toDeliver = (p: OTLinePart) => delivery[p.partId] ?? maxFor(p);
  const dispatching = step === 'despacha';
  const totalToDeliver = line.parts.reduce((sum, p) => sum + toDeliver(p), 0);
  const shortages = line.parts.filter(p => stockOf(p.partId) < p.quantity);
  const dispatchSignature = signatureFor(line, 'despacha');

  const handleSign = async () => {
    if (!step) return;
    if (!(await confirm({ title: 'Firmar requisa', message: `¿Estas seguro de firmar "${requisitionSignLabels[step]}"?`, confirmLabel: 'Firmar' }))) return;
    const result = signRequisition(ot.id, line.id, step, dispatching ? Object.fromEntries(line.parts.map(p => [p.partId, toDeliver(p)])) : undefined);
    if (result) setError(result);
    else { toast('Firma registrada correctamente'); onClose(); }
  };

  const pending = missingSteps(line).map(s => requisitionStepLabels[s]);
  const note = step
    ? null
    : status === 'completa'
      ? 'Requisa completa: Control de Inventario entrego los repuestos y el tecnico confirmo la recepcion.'
      : status === 'sin_solicitar'
        ? 'Esperando que el tecnico firme la solicitud desde la linea de la OT.'
        : `Se necesitan las siguientes firmas: ${pending.join(' > ')}.`;

  if (showDocument) {
    return (
      <Modal open onClose={onClose} title={`Documento ${line.requisition?.code ?? ''}`} size="xl">
        <RequisitionDocumentView ot={ot} line={line} onBack={() => setShowDocument(false)} backLabel="Cerrar" />
      </Modal>
    );
  }

  const gridCols = 'grid-cols-[minmax(0,1fr)_2.5rem_3.25rem_4.5rem] sm:grid-cols-[minmax(0,1fr)_6rem_6rem_7rem]';

  return (
    <Modal open onClose={onClose} title={line.requisition?.code ?? 'Solicitud de repuestos'} size="lg">
      <div className="space-y-5">
        <dl className="sap-grid grid-cols-1 sm:grid-cols-2">
          <DetailField label="Orden de trabajo"><OTLink ot={ot} /></DetailField>
          <DetailField label="Vehiculo">{ot.assetCode} - {ot.assetName}</DetailField>
          <DetailField label="Linea">{line.work}</DetailField>
          <DetailField label="Solicitado por">{signatureFor(line, 'solicitante')?.name ?? '--'}</DetailField>
          {delivered && <DetailField label="Entregado a">{dispatchSignature?.deliveredTo ?? '--'}</DetailField>}
        </dl>

        <section aria-labelledby="req-parts">
          <h4 id="req-parts" className="ui-subtitle mb-2">Repuestos</h4>
          <div className="overflow-hidden rounded-md border border-stone-200">
            <div className={`grid ${gridCols} gap-x-1 bg-stone-100 px-2 py-2 text-xs font-bold text-stone-600 sm:px-3`}>
              <span>Repuesto</span>
              <span className="text-right">Stock</span>
              <span className="text-right"><span className="sm:hidden">Pedido</span><span className="hidden sm:inline">Solicitado</span></span>
              <span className="text-right">{dispatching ? 'Entregar' : delivered ? 'Entregado' : 'Entrega'}</span>
            </div>
            {line.parts.map(p => {
              const stock = stockOf(p.partId);
              const short = stock < p.quantity;
              return (
                <div key={p.partId} className="border-t border-stone-100 px-2 py-2.5 sm:px-3">
                  <div className={`grid ${gridCols} items-center gap-x-1`}>
                    <div className="min-w-0">
                      <p className="break-words text-content font-normal text-stone-800">{p.partDescription + " - UND"}</p>
                      <p className="break-all text-content font-normal text-stone-500">{p.partCode}</p>
                    </div>
                    <span className={`text-right text-content font-normal ${short && !delivered ? 'text-red-700' : 'text-stone-800'}`}>{stock}</span>
                    <span className="text-right text-content font-normal text-stone-800">{p.quantity}</span>
                    {dispatching ? (
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={maxFor(p)}
                        value={toDeliver(p)}
                        aria-label={`Cantidad a entregar de ${p.partDescription}`}
                        onChange={e => {
                          const n = Math.floor(Number(e.target.value));
                          setDelivery(prev => ({ ...prev, [p.partId]: Number.isFinite(n) ? Math.min(Math.max(n, 0), maxFor(p)) : 0 }));
                        }}
                        className="w-full rounded-md border border-stone-300 px-2 py-1.5 text-right text-content focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300"
                      />
                    ) : (
                      <span className={`text-right text-content ${isPartial(line, p) ? 'font-bold text-orange-700' : 'font-normal text-stone-800'}`}>
                        {delivered ? quantityLabel(line, p) : '--'}
                      </span>
                    )}
                  </div>
                  {short && !delivered && (
                    <p className="mt-1 flex items-center gap-1 text-content text-red-700">
                      <AlertTriangle size={12} /> {stock === 0 ? 'Sin stock' : `Solo hay ${stock} de ${p.quantity}`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="req-signatures">
          <h4 id="req-signatures" className="ui-subtitle mb-2">Etapas</h4>
          <RequisitionProgress line={line} showNames />
        </section>

        {dispatching && shortages.length > 0 && (
          <p className="flex items-start gap-2 rounded-md border border-orange-100 bg-orange-50 p-2.5 text-content text-orange-800">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            Algunos repuestos tienen menos stock que lo solicitado. Puedes entregar solo lo disponible: la requisa
            mostrara lo entregado contra lo solicitado (por ejemplo 2 / 5).
          </p>
        )}
        {dispatching && totalToDeliver === 0 && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50 p-2.5 text-content text-red-700">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            No hay stock disponible de ninguno de los repuestos: no hay nada que entregar todavia.
          </p>
        )}
        {note && <p className="text-content text-orange-600">{note}</p>}
        {error && <p role="alert" className="text-content text-red-700">{error}</p>}

        <div className="space-y-3 border-t border-stone-100 pt-4">
          {/* {step && <p className="text-content text-stone-500">Firmaras como "{requisitionFieldLabels[step]}" ({requisitionStepRoles[step]}).</p>} */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto"><RequisitionDocumentButton ot={ot} line={line} onView={() => setShowDocument(true)} /></span>
            <Button variant="outline" className="min-h-[44px]" onClick={onClose}>{step ? 'Cancelar' : 'Cerrar'}</Button>
            {step && (
              <Button className="min-h-[44px]" disabled={dispatching && totalToDeliver === 0} onClick={handleSign}>
                <PenTool size={14} /> {requisitionSignLabels[step]}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

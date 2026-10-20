import { useState } from 'react';
import { Eye, FileText, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { WorkOrderHistoryReport } from './reportes/WorkOrderHistoryReport';

interface ReportDef {
  id: string;
  name: string;
  ready: boolean;
}

const reportList: ReportDef[] = [
  { id: 'costos-tco', name: 'Costos por Activo TCO', ready: false },
  { id: 'historial-ot', name: 'Historial de Ordenes de Trabajo', ready: true },
  { id: 'combustible', name: 'Historial de Cargas de Combustible', ready: false },
  { id: 'repuestos', name: 'Consumo de Repuestos e Inventario', ready: false },
  { id: 'activos', name: 'Estado y Disponibilidad de Activos', ready: false },
];

export function ReportesModule() {
  const [openReport, setOpenReport] = useState<ReportDef | null>(null);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="bg-surface rounded-lg shadow-card border border-stone-200">
        <div className="px-4 py-3 border-b border-stone-200">
          <h3 className="ui-title">Reportes</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4">
          {reportList.map(report => (
            <button
              key={report.id}
              type="button"
              onClick={() => setOpenReport(report)}
              className="group relative flex min-h-[44px] flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border border-stone-200 bg-surface px-3 py-5 text-center shadow-xs transition-colors hover:border-orange-300 hover:bg-stone-50 hover:shadow-card"
            >
              <FileText size={22} className="text-stone-400 shrink-0" />
              <span className="text-content font-medium text-stone-800">{report.name}</span>
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-surface px-3 py-1.5 text-content font-bold text-stone-800">
                  <Eye size={14} /> Ver
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {openReport && (
        <Modal open onClose={() => setOpenReport(null)} title={openReport.name} size="xl">
          {openReport.ready ? (
            <WorkOrderHistoryReport onBack={() => setOpenReport(null)} backLabel="Cerrar" />
          ) : (
            <div className="space-y-4 py-12 text-center">
              <FileText size={32} className="mx-auto text-stone-300" />
              <p className="text-content text-stone-500">Formato pendiente: todavia no se definio el diseno de este reporte.</p>
              <Button variant="outline" className="min-h-[44px]" onClick={() => setOpenReport(null)}>
                <X size={12} /> Cerrar
              </Button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

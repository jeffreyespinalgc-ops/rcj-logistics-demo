import { FileText } from 'lucide-react';

const reportList = [
  'Costos por Activo TCO',
  'Historial de Ordenes de Trabajo',
  'Historial de Cargas de Combustible',
  'Consumo de Repuestos e Inventario',
  'Estado y Disponibilidad de Activos',
];

export function ReportesModule() {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="bg-white rounded-lg shadow-card border border-stone-200">
        <div className="px-4 py-3 border-b border-stone-200">
          <h3 className="ui-title">Reportes</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4">
          {reportList.map(name => (
            <button
              key={name}
              type="button"
              className="flex flex-col items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-5 text-center shadow-sm hover:border-orange-300 hover:bg-stone-50 hover:shadow-card transition-colors min-h-[44px]"
            >
              <FileText size={22} className="text-stone-400 flex-shrink-0" />
              <span className="text-content font-medium text-stone-800">{name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

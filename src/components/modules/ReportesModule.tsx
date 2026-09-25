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
          <h3 className="font-heading text-base font-bold text-stone-800">Reportes</h3>
        </div>
        <ul className="divide-y divide-stone-100">
          {reportList.map(name => (
            <li key={name} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors">
              <FileText size={18} className="text-stone-400 flex-shrink-0" />
              <span className="text-sm font-medium text-stone-800">{name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { HierarchicalSelectionMenu, type HierarchicalSelectionResult, type HierarchyNode } from './HierarchicalSelectionMenu';

/**
 * Datos de ejemplo con la jerarquia completa pedida:
 * Tipo de trabajo -> Subtipo -> Formato/Plan -> Activo -> Intervalo -> Actividades
 * Incluye el camino de muestra: Mantenimiento Preventivo -> ... -> Cabezal Mack Blanco ->
 * Mantenimiento 800 Horas -> [Cambio de aceite, Ajuste de candela, ...]
 */
const sampleData: HierarchyNode[] = [
  {
    id: 'preventivo',
    label: 'Mantenimiento Preventivo',
    children: [
      {
        id: 'cabezales',
        label: 'Cabezales',
        children: [
          {
            id: 'por-horas',
            label: 'Por Horas de Uso',
            children: [
              {
                id: 'cabezal-mack-blanco',
                label: 'Cabezal Mack Blanco',
                description: 'Placa P-102',
                children: [
                  {
                    id: 'mack-400h',
                    label: 'Mantenimiento 400 Horas',
                    children: [
                      { id: 'mack400-aceite', label: 'Cambio de aceite' },
                      { id: 'mack400-filtros', label: 'Cambio de filtros' },
                      { id: 'mack400-frenos', label: 'Revision de frenos' },
                    ],
                  },
                  {
                    id: 'mack-800h',
                    label: 'Mantenimiento 800 Horas',
                    children: [
                      { id: 'mack800-aceite', label: 'Cambio de aceite' },
                      { id: 'mack800-candela', label: 'Ajuste de candela' },
                      { id: 'mack800-frenos', label: 'Revision de frenos' },
                      { id: 'mack800-filtros', label: 'Cambio de filtros' },
                      { id: 'mack800-valvulas', label: 'Calibracion de valvulas' },
                    ],
                  },
                ],
              },
              {
                id: 'cabezal-kenworth-rojo',
                label: 'Cabezal Kenworth Rojo',
                description: 'Placa P-118',
                children: [
                  {
                    id: 'kw-400h',
                    label: 'Mantenimiento 400 Horas',
                    children: [
                      { id: 'kw400-aceite', label: 'Cambio de aceite' },
                      { id: 'kw400-frenos', label: 'Revision de frenos' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            id: 'por-km',
            label: 'Por Kilometraje',
            children: [
              {
                id: 'cabezal-mack-blanco-km',
                label: 'Cabezal Mack Blanco',
                description: 'Placa P-102',
                children: [
                  {
                    id: 'mack-10k',
                    label: 'Cada 10,000 km',
                    children: [
                      { id: 'mack10k-aceite', label: 'Cambio de aceite' },
                      { id: 'mack10k-llantas', label: 'Rotacion de llantas' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'furgones',
        label: 'Furgones',
        children: [
          {
            id: 'por-horas-furgon',
            label: 'Por Horas de Uso',
            children: [
              {
                id: 'furgon-01',
                label: 'Furgon Isuzu 01',
                children: [
                  {
                    id: 'furgon-400h',
                    label: 'Mantenimiento 400 Horas',
                    children: [
                      { id: 'furgon400-aceite', label: 'Cambio de aceite' },
                      { id: 'furgon400-correa', label: 'Revision de correa de distribucion' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'correctivo',
    label: 'Mantenimiento Correctivo',
    children: [
      {
        id: 'cabezales-correctivo',
        label: 'Cabezales',
        children: [
          {
            id: 'por-sistema',
            label: 'Por Sistema',
            children: [
              {
                id: 'cabezal-mack-blanco-corr',
                label: 'Cabezal Mack Blanco',
                description: 'Placa P-102',
                children: [
                  {
                    id: 'sistema-frenos',
                    label: 'Sistema de Frenos',
                    children: [
                      { id: 'frenos-no-responden', label: 'Frenos no responden' },
                      { id: 'frenos-ruido', label: 'Ruido al frenar' },
                      { id: 'frenos-pedal', label: 'Pedal esponjoso' },
                    ],
                  },
                  {
                    id: 'sistema-motor',
                    label: 'Motor',
                    children: [
                      { id: 'motor-fuga', label: 'Fuga de aceite' },
                      { id: 'motor-sobrecalentamiento', label: 'Sobrecalentamiento' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

const levelLabels = ['Tipo de trabajo', 'Subtipo', 'Formato/Plan', 'Activo', 'Intervalo', 'Actividades'];

/**
 * Ejemplo de uso de HierarchicalSelectionMenu: cada vez que se confirma una seleccion, el resultado
 * (ruta completa + actividades marcadas) se agrega a la lista de abajo para verlo en forma de objeto.
 */
export function HierarchicalSelectionMenuExample() {
  const [results, setResults] = useState<HierarchicalSelectionResult[]>([]);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Seleccionar plan de mantenimiento</h2>
        <p className="text-sm text-slate-500">Ejemplo de uso de HierarchicalSelectionMenu con datos de un taller.</p>
      </div>

      <HierarchicalSelectionMenu
        levelLabels={levelLabels}
        data={sampleData}
        onComplete={result => setResults(prev => [result, ...prev])}
      />

      {results.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="mb-2 text-sm font-bold text-slate-700">Resultado devuelto por onComplete</h3>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
            {JSON.stringify(results[0], null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

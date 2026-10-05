import type { OTLine } from '@/types';
import { Check, Circle } from 'lucide-react';
import { requisitionFieldLabels, requisitionStepLabels, requisitionStepRoles, requisitionStepShortLabels, requisitionStepsFor, signatureFor } from '@/lib/requisition';
import { formatDateTime } from './otMeta';

/**
 * Una insignia por etapa de la requisa, con el rol que firma (Solicitante, Jefe de Taller, Control de Inventario,
 * Receptor): verde con check si ya se firmo, gris con circulo si falta. El tooltip trae el campo del documento.
 * compact: etiquetas cortas y en una sola fila, para tablas.
 */
export function RequisitionProgress({ line, showNames = false, compact = false }: {
  line: OTLine;
  showNames?: boolean;
  compact?: boolean;
}) {
  const labels = compact ? requisitionStepShortLabels : requisitionStepLabels;
  return (
    // en tablas las 4 etapas van en una cuadricula de 2 x 2: en una sola fila no caben junto a los botones de la fila
    <ul className={compact ? 'grid w-full grid-cols-4 gap-2' : 'flex flex-wrap items-center gap-2'}>
      {requisitionStepsFor(line).map(step => {
        const signature = signatureFor(line, step);
        return (
          <li
            key={step}
            title={`${requisitionFieldLabels[step]} (${requisitionStepRoles[step]}): ${signature ? `${signature.name} - ${formatDateTime(signature.at)}` : 'pendiente de firma'}`}
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-content font-medium ${
              signature
                ? 'border-green-200 bg-green-50 text-green-700'
                : 'border-stone-200 bg-stone-50 text-stone-500'
            }`}
          >
            {signature ? <Check size={11} /> : <Circle size={10} />}
            {labels[step]}
            {showNames && signature && <span className="font-normal text-green-600">· {signature.name}</span>}
          </li>
        );
      })}
    </ul>
  );
}

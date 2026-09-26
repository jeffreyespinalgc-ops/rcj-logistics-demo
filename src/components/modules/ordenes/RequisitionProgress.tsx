import type { OTLine } from '@/types';
import { Check, Circle } from 'lucide-react';
import { requisitionStepLabels, requisitionStepShortLabels, requisitionSteps, signatureFor } from '@/lib/requisition';
import { formatDateTime } from './otMeta';

/**
 * Una insignia por firma requerida: verde con check si ya firmo, gris con circulo si falta.
 * compact: etiquetas cortas y en una sola fila, para tablas.
 */
export function RequisitionProgress({ line, showNames = false, compact = false }: {
  line: OTLine;
  showNames?: boolean;
  compact?: boolean;
}) {
  const labels = compact ? requisitionStepShortLabels : requisitionStepLabels;
  return (
    <ul className={`flex items-center gap-1.5 ${compact ? 'flex-nowrap' : 'flex-wrap'}`}>
      {requisitionSteps.map(step => {
        const signature = signatureFor(line, step);
        return (
          <li
            key={step}
            title={`${requisitionStepLabels[step]}: ${signature ? `${signature.name} - ${formatDateTime(signature.at)}` : 'pendiente de firma'}`}
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-medium ${
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

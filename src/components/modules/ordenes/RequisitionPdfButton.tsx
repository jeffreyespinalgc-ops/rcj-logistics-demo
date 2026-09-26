import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { OTLine, WorkOrder } from '@/types';
import { FileDown } from 'lucide-react';
import { isRequisitionComplete } from '@/lib/requisition';
import { downloadRequisitionPdf } from '@/lib/requisitionPdf';

/** Descarga la requisa en PDF; solo aparece cuando ya firmaron las tres partes */
export function RequisitionPdfButton({ ot, line, className = '' }: { ot: WorkOrder; line: OTLine; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!isRequisitionComplete(line)) return null;

  const handleClick = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await downloadRequisitionPdf(ot, line);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" className={`min-h-[44px] sm:min-h-0 ${className}`} disabled={busy} onClick={handleClick}>
        <FileDown size={14} /> {busy ? 'Generando PDF...' : 'Descargar PDF'}
      </Button>
      {failed && <span role="alert" className="text-xs text-red-700">No se pudo generar el PDF. Intenta de nuevo.</span>}
    </span>
  );
}

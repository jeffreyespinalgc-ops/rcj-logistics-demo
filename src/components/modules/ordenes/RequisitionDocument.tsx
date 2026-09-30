import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { OTLine, WorkOrder } from '@/types';
import { Eye } from 'lucide-react';
import { requiresRequisition } from '@/lib/requisition';
import { buildRequisitionPdf } from '@/lib/requisitionPdf';
import { DocumentPreview } from './DocumentPreview';

export function RequisitionDocumentView({ ot, line, onBack, backLabel }: {
  ot: WorkOrder;
  line: OTLine;
  onBack: () => void;
  backLabel: string;
}) {
  const { hasPermission } = useApp();
  return (
    <DocumentPreview
      buildDoc={() => buildRequisitionPdf(ot, line)}
      documentKey={`${ot.id}:${line.id}:${line.requisition?.signatures.length ?? 0}:${line.parts.map(p => `${p.partId}${p.quantity}${p.deliveredQuantity ?? ''}`).join(',')}`}
      altPrefix={`Requisa ${line.requisition?.code ?? ''}`}
      canDownload={hasPermission('requisa.descargar')}
      onBack={onBack}
      backLabel={backLabel}
    />
  );
}


export function RequisitionDocumentButton({ ot, line, onView }: { ot: WorkOrder; line: OTLine; onView?: () => void }) {
  const [open, setOpen] = useState(false);

  if (!requiresRequisition(line)) return null;

  return (
    <>
      <Button size="sm" variant="primary" className="min-h-[44px] sm:min-h-0" onClick={() => (onView ? onView() : setOpen(true))}>
        <Eye size={14} /> 
      </Button>
      {open && !onView && (
        <Modal open onClose={() => setOpen(false)} title={`Documento ${line.requisition?.code ?? ''}`} size="xl">
          <RequisitionDocumentView ot={ot} line={line} onBack={() => setOpen(false)} backLabel="Cerrar" />
        </Modal>
      )}
    </>
  );
}

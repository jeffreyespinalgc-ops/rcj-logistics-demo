import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { OTLine, WorkOrder } from '@/types';
import { Eye } from 'lucide-react';
import { isRequisitionComplete } from '@/lib/requisition';
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
      documentKey={`${ot.id}:${line.id}:${line.requisition?.releasedAt ?? ''}`}
      altPrefix={`Requisa ${line.requisition?.code ?? ''}`}
      canDownload={hasPermission('requisa.descargar')}
      onBack={onBack}
      backLabel={backLabel}
    />
  );
}

/**
 * "Ver documento": aparece solo cuando ya firmaron las tres partes. Con onView el padre decide donde mostrar
 * la vista previa (dentro de su propio modal, sin apilar otro); sin onView la abre en un modal propio.
 */
export function RequisitionDocumentButton({ ot, line, onView }: { ot: WorkOrder; line: OTLine; onView?: () => void }) {
  const [open, setOpen] = useState(false);

  if (!isRequisitionComplete(line)) return null;

  return (
    <>
      <Button size="sm" variant="outline" className="min-h-[44px] sm:min-h-0" onClick={() => (onView ? onView() : setOpen(true))}>
        <Eye size={14} /> Ver documento
      </Button>
      {open && !onView && (
        <Modal open onClose={() => setOpen(false)} title={`Documento ${line.requisition?.code ?? ''}`} size="xl">
          <RequisitionDocumentView ot={ot} line={line} onBack={() => setOpen(false)} backLabel="Cerrar" />
        </Modal>
      )}
    </>
  );
}

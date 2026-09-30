import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { WorkOrder } from '@/types';
import { FileText } from 'lucide-react';
import { buildOTPdf } from '@/lib/otDocumentPdf';
import { DocumentPreview } from './DocumentPreview';

/**
 * Documento de la OT: a diferencia de la requisa, existe desde que se crea la OT (encabezado nada mas)
 * y se va completando solo; por eso "Ver Documento" siempre esta disponible, junto al titulo de la OT.
 */
export function OTDocumentView({ ot, onBack, backLabel }: { ot: WorkOrder; onBack: () => void; backLabel: string }) {
  const { hasPermission } = useApp();
  const { users } = useAuth();
  return (
    <DocumentPreview
      buildDoc={() => buildOTPdf(ot, users)}
      documentKey={`${ot.id}:${ot.status}:${ot.signedBy ?? ''}:${ot.inventorySignedBy ?? ''}:${ot.lines.length}`}
      altPrefix={`OT ${ot.code}`}
      canDownload={hasPermission('requisa.descargar')}
      onBack={onBack}
      backLabel={backLabel}
    />
  );
}

export function OTDocumentButton({ ot }: { ot: WorkOrder }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" className="min-h-[44px] sm:min-h-0" onClick={() => setOpen(true)}>
        <FileText size={14} /> Ver Documento
      </Button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title={`Documento ${ot.code}`} size="xl">
          <OTDocumentView ot={ot} onBack={() => setOpen(false)} backLabel="Cerrar" />
        </Modal>
      )}
    </>
  );
}

import { Modal } from '@/components/ui/Modal';
import { SignaturePad } from './SignaturePad';

export function SignatureModal({ mandatory, currentSignature, onSave, onClose }: {
  mandatory: boolean;
  currentSignature: string | null;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!mandatory}
      title={mandatory ? 'Registra tu firma' : 'Mi firma'}
      size="md"
    >
      <div className="space-y-4">
        {!mandatory && currentSignature && (
          <div>
            <p className="ui-label mb-1">Firma actual</p>
            <div className="flex h-20 items-center justify-center rounded-md border border-stone-200 bg-stone-50 p-2">
              <img src={currentSignature} alt="Tu firma actual" className="max-h-full max-w-full object-contain" />
            </div>
          </div>
        )}
        <SignaturePad onSave={onSave} saveLabel={mandatory ? '' : ''} />
      </div>
    </Modal>
  );
}

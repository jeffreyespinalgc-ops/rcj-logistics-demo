import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** false: sin boton de cerrar ni cierre al tocar afuera (para pasos obligatorios, como registrar la firma) */
  dismissible?: boolean;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-4xl',
  xl: 'max-w-8xl ',
};

export function Modal({ open, onClose, title, children, size = 'md', dismissible = true }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={dismissible ? onClose : undefined} />
      <div className={`relative bg-white rounded-lg shadow-xl w-full ${sizeClasses[size]} max-h-[90dvh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200">
          <h3 className="ui-title">{title}</h3>
          {dismissible && (
            <button onClick={onClose} aria-label="Cerrar" className="text-stone-400 hover:text-stone-600 transition-colors">
              <X size={20} />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

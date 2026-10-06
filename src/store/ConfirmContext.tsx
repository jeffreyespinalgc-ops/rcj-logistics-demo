import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger' | 'secondary';
}

export type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Confirmacion generica para cualquier accion de la app: `const confirm = useConfirm(); if (!(await
 * confirm('¿Estas seguro de ...?'))) return;` antes de ejecutarla. Una sola instancia del modal para toda
 * la app (no hay que manejar estado de "abierto" en cada componente que la usa).
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((input) => {
    setOptions(typeof input === 'string' ? { message: input } : input);
    return new Promise<boolean>(resolve => { resolveRef.current = resolve; });
  }, []);

  const finish = (value: boolean) => {
    setOptions(null);
    resolveRef.current?.(value);
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Modal open onClose={() => finish(false)} title={options.title ?? 'Confirmar accion'} size="sm">
          <div className="space-y-4">
            <p className="text-content text-stone-600">{options.message}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="min-h-[44px] [@media(pointer:fine)]:min-h-0" onClick={() => finish(false)}>
                {options.cancelLabel ?? 'Cancelar'}
              </Button>
              <Button variant={options.variant ?? 'primary'} className="min-h-[44px] [@media(pointer:fine)]:min-h-0" onClick={() => finish(true)}>
                {options.confirmLabel ?? 'Confirmar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

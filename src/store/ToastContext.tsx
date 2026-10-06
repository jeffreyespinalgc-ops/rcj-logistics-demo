import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle, Info, X, XCircle } from 'lucide-react';

export interface ToastOptions {
  message: string;
  variant?: 'success' | 'error' | 'info';
  /** ms visible antes de desaparecer solo */
  duration?: number;
}

export type ToastFn = (options: ToastOptions | string) => void;

interface ToastItem {
  id: number;
  message: string;
  variant: 'success' | 'error' | 'info';
}

const ToastContext = createContext<ToastFn | null>(null);

let toastSeq = 0;

const icons = { success: CheckCircle, error: XCircle, info: Info };
const styles = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
};
const iconColors = { success: 'text-green-500', error: 'text-red-500', info: 'text-blue-500' };

/**
 * Aviso flotante arriba a la derecha para confirmar que una accion se completo ("OT creada correctamente"),
 * desaparece solo (5s por defecto). `const toast = useToast(); toast('OT creada correctamente');` despues de
 * que la accion ya se ejecuto (no reemplaza a `useConfirm`, que pregunta ANTES).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback<ToastFn>((input) => {
    const opts = typeof input === 'string' ? { message: input } : input;
    const id = ++toastSeq;
    const duration = opts.duration ?? 5000;
    setToasts(prev => [...prev, { id, message: opts.message, variant: opts.variant ?? 'success' }]);
    timers.current.set(id, setTimeout(() => dismiss(id), duration));
  }, [dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:right-6 sm:top-6">
        {toasts.map(t => {
          const Icon = icons[t.variant];
          return (
            <div
              key={t.id}
              role="status"
              className={`animate-toast-in pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2.5 shadow-card-hover ${styles[t.variant]}`}
            >
              <Icon size={18} className={`mt-0.5 flex-shrink-0 ${iconColors[t.variant]}`} />
              <p className="flex-1 text-content font-medium">{t.message}</p>
              <button onClick={() => dismiss(t.id)} aria-label="Cerrar aviso" className="flex-shrink-0 text-stone-400 transition-colors hover:text-stone-600">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

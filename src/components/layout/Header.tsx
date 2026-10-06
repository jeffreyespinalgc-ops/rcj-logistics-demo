import { useApp } from '@/store/AppContext';
import type { ModuleKey } from '@/types';
import { Bell, Menu, PenLine } from 'lucide-react';
import { useEffect, useState } from 'react';

const moduleTitles: Record<ModuleKey, { title: string; subtitle: string }> = {
  activos: { title: 'Activos', subtitle: '' },
  inventario: { title: 'Repuestos e Inventario', subtitle: '' },
  ordenes: { title: 'Ordenes de Trabajo', subtitle: '' },
  combustible: { title: 'Combustible', subtitle: '' },
  reportes: { title: 'Reportes TCO', subtitle: '' },
  notificaciones: { title: 'Notificaciones', subtitle: '' },
  requisas: { title: 'Requisas de Repuestos', subtitle: '' },
  administracion: { title: 'Administracion', subtitle: '' },
};

export function Header({ onMenuClick, onSignatureClick, menuLabel = 'Abrir menu' }: {
  onMenuClick: () => void;
  onSignatureClick: () => void;
  menuLabel?: string;
}) {
  const { activeModule, setActiveModule, notifications } = useApp();
  const { title, subtitle } = moduleTitles[activeModule];
  const unreadCount = notifications.filter(n => !n.read).length;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="bg-white border-b border-stone-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label={menuLabel}
          title={menuLabel}
          className="-ml-2 flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-orange-50 hover:text-orange-600 [@media(pointer:fine)]:min-h-0 [@media(pointer:fine)]:min-w-0 sm:p-2"
        >
          <Menu size={22} />
        </button>
        <div className="min-w-0">
          <h2 className="ui-title truncate">{title}</h2>
          <p className="text-xs text-stone-500 mt-0.5 truncate">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-stone-400">Fecha</p>
          <p className="text-sm font-medium text-stone-700"> { new Intl.DateTimeFormat('es-ES', { weekday: 'long',  }).format(now) + " " + now.toLocaleDateString() + " " + now.toLocaleTimeString() }</p>
        </div>
        <button
          onClick={onSignatureClick}
          aria-label="Mi firma"
          title="Mi firma"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-orange-50 hover:text-orange-600 [@media(pointer:fine)]:min-h-0 [@media(pointer:fine)]:min-w-0 sm:p-2"
        >
          <PenLine size={20} />
        </button>
        <button
          onClick={() => setActiveModule('notificaciones')}
          className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-orange-50 hover:text-orange-600 [@media(pointer:fine)]:min-h-0 [@media(pointer:fine)]:min-w-0 sm:p-2"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 bg-orange-500 text-white text-content font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
import { useApp } from '@/store/AppContext';
import type { ModuleKey } from '@/types';
import { Bell, Menu } from 'lucide-react';

const moduleTitles: Record<ModuleKey, { title: string; subtitle: string }> = {
  activos: { title: 'Activos', subtitle: '' },
  inventario: { title: 'Repuestos e Inventario', subtitle: '' },
  ordenes: { title: 'Ordenes de Trabajo', subtitle: '' },
  combustible: { title: 'Combustible', subtitle: '' },
  reportes: { title: 'Reportes / TCO', subtitle: '' },
  notificaciones: { title: 'Notificaciones', subtitle: '' },
  administracion: { title: 'Administracion', subtitle: '' },
};

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { activeModule, setActiveModule, notifications } = useApp();
  const { title, subtitle } = moduleTitles[activeModule];
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <header className="bg-white border-b border-stone-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="lg:hidden -ml-2 p-2 text-stone-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors flex-shrink-0"
        >
          <Menu size={22} />
        </button>
        <div className="min-w-0">
          <h2 className="font-heading text-lg sm:text-xl font-bold text-stone-800 truncate">{title}</h2>
          <p className="text-xs text-stone-500 mt-0.5 truncate">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-stone-400">Fecha</p>
          <p className="text-sm font-medium text-stone-700"> { new Intl.DateTimeFormat('es-ES', { weekday: 'long',  }).format(new Date()) + " " + new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString() }</p>
        </div>
        <button
          onClick={() => setActiveModule('notificaciones')}
          className="relative p-2 text-stone-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 bg-orange-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
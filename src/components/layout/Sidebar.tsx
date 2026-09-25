import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import type { ModuleKey } from '@/types';
import { modulePermissions } from '@/lib/permissions';
import { initialsOf, roleLabels } from '@/lib/roles';
import logo from '@/assets/images/RCJ-Logistics-Blanco.png';
import {
  Truck,
  Package,
  ClipboardList,
  Fuel,
  BarChart3,
  Bell,
  Settings,
  LogOut,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  key: ModuleKey;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { key: 'activos', label: 'Activos', icon: Truck },
  { key: 'inventario', label: 'Repuestos e Inventario', icon: Package },
  { key: 'ordenes', label: 'Ordenes de Trabajo', icon: ClipboardList },
  { key: 'combustible', label: 'Combustible', icon: Fuel },
  { key: 'reportes', label: 'Reportes TCO', icon: BarChart3 },
  { key: 'notificaciones', label: 'Notificaciones', icon: Bell },
  { key: 'administracion', label: 'Administracion', icon: Settings },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeModule, setActiveModule, notifications, hasPermission, currentRole } = useApp();
  const { session, logout } = useAuth();
  const unreadCount = notifications.filter(n => !n.read).length;

  // cada rol solo ve los modulos que su permiso habilita
  const visibleItems = navItems.filter(item => hasPermission(modulePermissions[item.key]));

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-stone-900/50 lg:hidden" onClick={onClose} />}

      <aside
        className={`w-60 bg-blue-900 text-blue-50 flex flex-col flex-shrink-0 fixed top-0 left-0 z-40 h-dvh transition-transform duration-200 lg:sticky lg:z-auto lg:h-screen lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >

        <div className="px-5 py-8 border-b border-blue-800/50 flex justify-center items-center">
          <div className="flex items-center justify-center w-full">
            <div className="w-18 h-14 flex items-center justify-center flex-shrink-0">
              <img
                src={logo}
                alt="RCJ Logistics"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const active = activeModule === item.key;
            return (
              <button
                key={item.key}
                onClick={() => { setActiveModule(item.key); onClose(); }}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors duration-150 relative ${
                  active
                    ? 'bg-blue-800 text-white border-l-4 border-orange-500'
                    : 'text-blue-200 hover:bg-blue-800/50 hover:text-white border-l-4 border-transparent'
                }`}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span className="text-left flex-1">{item.label}</span>
                {item.key === 'notificaciones' && unreadCount > 0 && (
                  <span className="bg-orange-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-blue-800/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-700 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {initialsOf(session?.name ?? '')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white truncate">{session?.name}</p>
              <p className="text-xs text-blue-300 truncate">{roleLabels[currentRole]}</p>
            </div>
            <button
              onClick={logout}
              title="Cerrar sesion"
              className="text-blue-300 hover:text-white hover:bg-blue-800 rounded-md p-1.5 transition-colors flex-shrink-0"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

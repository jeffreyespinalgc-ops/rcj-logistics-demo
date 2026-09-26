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
  ChevronsLeft,
  ChevronsRight,
  FileSignature,
  Settings,
  LogOut,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Estado del menu en movil: oculto, completo (sobre el contenido) o minimizado a una franja de iconos.
 * En escritorio el menu siempre va completo y fijo.
 */
export type SidebarMode = 'hidden' | 'full' | 'mini';

interface NavItem {
  key: ModuleKey;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { key: 'activos', label: 'Vehiculos', icon: Truck },
  { key: 'inventario', label: 'Repuestos e Inventario', icon: Package },
  { key: 'ordenes', label: 'Ordenes de Trabajo', icon: ClipboardList },
  { key: 'requisas', label: 'Requisas de Repuestos', icon: FileSignature },
  { key: 'combustible', label: 'Combustible', icon: Fuel },
  { key: 'reportes', label: 'Reportes TCO', icon: BarChart3 },
  { key: 'notificaciones', label: 'Notificaciones', icon: Bell },
  { key: 'administracion', label: 'Administracion', icon: Settings },
];

export function Sidebar({ mode, onModeChange }: { mode: SidebarMode; onModeChange: (mode: SidebarMode) => void }) {
  const { activeModule, setActiveModule, notifications, hasPermission, currentRole } = useApp();
  const { session, logout } = useAuth();
  const unreadCount = notifications.filter(n => !n.read).length;
  const mini = mode === 'mini';
  // minimizado: en movil solo quedan los iconos; en escritorio el texto nunca se oculta
  const hideText = mini ? 'max-lg:hidden' : '';

  // cada rol solo ve los modulos que su permiso habilita
  const visibleItems = navItems.filter(item => hasPermission(modulePermissions[item.key]));

  return (
    <>
      {mode === 'full' && <div className="fixed inset-0 z-30 bg-stone-900/50 lg:hidden" onClick={() => onModeChange('hidden')} />}

      <aside
        className={`${mini ? 'w-14' : 'w-60'} lg:w-60 overflow-hidden bg-blue-900 text-blue-50 flex flex-col flex-shrink-0 fixed top-0 left-0 z-40 h-dvh transition-[transform,width] duration-200 motion-reduce:transition-none lg:sticky lg:z-auto lg:h-screen lg:translate-x-0 ${
          mode === 'hidden' ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        {mini && (
          <div className="border-b border-blue-800/50 lg:hidden">
            <button
              onClick={() => onModeChange('full')}
              aria-label="Expandir menu"
              title="Expandir menu"
              className="flex h-14 w-full items-center justify-center text-blue-200 transition-colors hover:bg-blue-800 hover:text-white"
            >
              <ChevronsRight size={18} />
            </button>
          </div>
        )}

        <div className={`relative px-5 py-8 border-b border-blue-800/50 justify-center items-center ${mini ? 'max-lg:hidden lg:flex' : 'flex'}`}>
          <div className="flex items-center justify-center w-full">
            <div className="w-18 h-14 flex items-center justify-center flex-shrink-0">
              <img
                src={logo}
                alt="RCJ Logistics"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
          <button
            onClick={() => onModeChange('mini')}
            aria-label="Minimizar menu"
            title="Minimizar menu"
            className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-md text-blue-200 transition-colors hover:bg-blue-800 hover:text-white lg:hidden"
          >
            <ChevronsLeft size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const active = activeModule === item.key;
            const showBadge = item.key === 'notificaciones' && unreadCount > 0;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActiveModule(item.key);
                  // el menu completo se cierra al elegir; la franja de iconos se queda
                  if (mode === 'full') onModeChange('hidden');
                }}
                aria-label={item.label}
                title={mini ? item.label : undefined}
                className={`w-full min-h-[44px] flex items-center gap-3 py-2.5 text-sm font-medium transition-colors duration-150 relative ${
                  mini ? 'justify-center px-0 lg:justify-start lg:px-5' : 'px-5'
                } ${
                  active
                    ? 'bg-blue-800 text-white border-l-4 border-orange-500'
                    : 'text-blue-200 hover:bg-blue-800/50 hover:text-white border-l-4 border-transparent'
                }`}
              >
                <Icon size={18} className="flex-shrink-0" />
                <span className={`text-left flex-1 ${hideText}`}>{item.label}</span>
                {showBadge && (
                  <span className={`bg-orange-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${hideText}`}>
                    {unreadCount}
                  </span>
                )}
                {showBadge && mini && (
                  <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-orange-500 px-1 text-center text-[10px] font-bold leading-4 text-white lg:hidden">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className={`px-5 py-4 border-t border-blue-800/50 ${hideText}`}>
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

        {mini && (
          <div className="flex flex-col items-center gap-1 border-t border-blue-800/50 py-3 lg:hidden">
            <div
              title={session?.name}
              className="w-9 h-9 bg-blue-700 rounded-full flex items-center justify-center text-sm font-bold text-white"
            >
              {initialsOf(session?.name ?? '')}
            </div>
            <button
              onClick={logout}
              aria-label="Cerrar sesion"
              title="Cerrar sesion"
              className="flex h-11 w-11 items-center justify-center rounded-md text-blue-300 transition-colors hover:bg-blue-800 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

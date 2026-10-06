import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import type { ModuleKey } from '@/types';
import { modulePermissions } from '@/lib/permissions';
import { initialsOf, roleLabels } from '@/lib/roles';
import { pendingRequisitionCount } from '@/lib/requisition';
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
  Settings,
  LogOut,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Estado del menu, igual en movil y en escritorio: oculto, completo (iconos + titulo) o minimizado a
 * una franja de iconos. En movil "full" se ve como una capa sobre el contenido (con fondo oscuro para
 * cerrarla al tocar afuera); en escritorio el menu forma parte del layout y el contenido se acomoda solo.
 */
export type SidebarMode = 'hidden' | 'full' | 'mini';

interface NavItem {
  key: ModuleKey;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { key: 'activos', label: 'Vehiculos', icon: Truck },
  { key: 'ordenes', label: 'Ordenes de Trabajo', icon: ClipboardList },
  { key: 'inventario', label: 'Repuestos e Inventario', icon: Package },
  // { key: 'combustible', label: 'Combustible', icon: Fuel },
  { key: 'reportes', label: 'Reportes TCO', icon: BarChart3 },
  // { key: 'notificaciones', label: 'Notificaciones', icon: Bell },
  { key: 'administracion', label: 'Administracion', icon: Settings },
];

export function Sidebar({ mode, onModeChange }: { mode: SidebarMode; onModeChange: (mode: SidebarMode) => void }) {
  const { activeModule, setActiveModule, notifications, hasPermission, currentRole, workOrders, currentUser } = useApp();
  const { session, logout } = useAuth();
  const unreadCount = notifications.filter(n => !n.read).length;
  // cambios de estado, firmas y hallazgos de una OT avisan en el propio modulo de Ordenes de Trabajo,
  // no solo en Notificaciones (bajo_stock es de Repuestos e Inventario; la sincronizacion SAP no es de una OT)
  const unreadOTNotifications = notifications.filter(n => !n.read && n.type !== 'bajo_stock' && n.reference !== 'SAP').length;
  const mini = mode === 'mini';
  // minimizado: solo quedan los iconos, en cualquier tamano de pantalla
  const hideText = mini ? 'hidden' : '';

  // cada rol solo ve los modulos que su permiso habilita
  const visibleItems = navItems.filter(item => hasPermission(modulePermissions[item.key]));

  // requisas sin firmas completas: quien puede verlas (pestana dentro de Repuestos e Inventario) recibe un
  // aviso en el menu, igual que las notificaciones sin leer
  const canSeeAllOT = hasPermission('ot.ver.todas');
  const pendingRequisitions = hasPermission('modulo.requisas')
    ? pendingRequisitionCount(workOrders, { canSeeAll: canSeeAllOT, currentUser })
    : 0;
  const badgeCounts: Partial<Record<ModuleKey, number>> = {
    notificaciones: unreadCount,
    inventario: pendingRequisitions,
    ordenes: unreadOTNotifications,
  };

  return (
    <>
      {mode === 'full' && <div className="animate-fade-in fixed inset-0 z-30 bg-stone-900/50 lg:hidden" onClick={() => onModeChange('hidden')} />}

      <aside
        className={`${mini ? 'w-14' : 'w-60'} ${mode === 'hidden' ? 'lg:w-0' : mini ? 'lg:w-14' : 'lg:w-60'} overflow-hidden bg-blue-900 text-blue-50 flex flex-col flex-shrink-0 fixed top-0 left-0 z-40 h-dvh transition-[transform,width] duration-200 motion-reduce:transition-none lg:sticky lg:z-auto lg:h-screen lg:translate-x-0 ${
          mode === 'hidden' ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        {mini && (
          <div className="border-b border-blue-800/50">
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

        <div className={`relative px-5 py-8 border-b border-blue-800/50 justify-center items-center ${mini ? 'hidden' : 'flex'}`}>
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
            className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-md text-blue-200 transition-colors hover:bg-blue-800 hover:text-white"
          >
            <ChevronsLeft size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const active = activeModule === item.key;
            const badgeCount = badgeCounts[item.key] ?? 0;
            const showBadge = badgeCount > 0;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActiveModule(item.key);
                  // en movil el menu completo se cierra al elegir (es una capa sobre el contenido); en
                  // escritorio el menu es parte del layout y se queda como estaba
                  if (mode === 'full' && window.matchMedia('(max-width: 1023.98px)').matches) onModeChange('hidden');
                }}
                aria-label={item.label}
                title={mini ? item.label : undefined}
                className={`w-full min-h-[44px] flex items-center gap-3 py-2.5 text-sm font-medium transition-colors duration-150 relative ${
                  mini ? 'justify-center px-0' : 'px-5'
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
                    {badgeCount}
                  </span>
                )}
                {showBadge && mini && (
                  <span className="absolute right-1 top-1 min-w-[16px] rounded-full bg-orange-500 px-1 text-center text-content font-bold leading-4 text-white">
                    {badgeCount}
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
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-blue-300 transition-colors hover:bg-blue-800 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        {mini && (
          <div className="flex flex-col items-center gap-1 border-t border-blue-800/50 py-3">
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

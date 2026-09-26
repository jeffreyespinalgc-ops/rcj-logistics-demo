import { useApp } from '@/store/AppContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import type { NotificationType } from '@/types';
import {
  Bell,
  CheckCircle,
  PenTool,
  AlertCircle,
  Package,
  Clock,
  CheckCheck,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';

const typeConfig: Record<NotificationType, { label: string; icon: LucideIcon }> = {
  aprobacion: { label: 'Aprobacion', icon: CheckCircle },
  firma: { label: 'Firma', icon: PenTool },
  hallazgo: { label: 'Hallazgo', icon: AlertCircle },
  bajo_stock: { label: 'Bajo Stock', icon: Package },
  ot_vencida: { label: 'OT Vencida', icon: Clock },
};

const priorityVariants: Record<string, 'red' | 'orange' | 'gray'> = {
  alta: 'red',
  media: 'orange',
  baja: 'gray',
};

export function NotificacionesModule() {
  const { notifications, markNotificationRead, markAllNotificationsRead, setActiveModule } = useApp();
  const [filter, setFilter] = useState<'all' | 'unread' | NotificationType>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.read);
    return notifications.filter(n => n.type === filter);
  }, [notifications, filter]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    notifications.forEach(n => { counts[n.type] = (counts[n.type] ?? 0) + 1; });
    return counts;
  }, [notifications]);

  const filterTabs: { key: 'all' | 'unread' | NotificationType; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'unread', label: 'No leidas' },
    { key: 'aprobacion', label: 'Aprobaciones' },
    { key: 'firma', label: 'Firmas' },
    { key: 'hallazgo', label: 'Hallazgos' },
    { key: 'bajo_stock', label: 'Bajo Stock' },
  ];

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4">
      <div className="hidden sm:grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Alertas" value={notifications.length} icon={<Bell size={28} />} />
        <StatCard label="No Leidas" value={unreadCount} icon={<Bell size={28} />} />
        <StatCard label="Aprobaciones Pend." value={byType['aprobacion'] ?? 0} icon={<CheckCircle size={28} />} />
        <StatCard label="Alertas Bajo Stock" value={byType['bajo_stock'] ?? 0} icon={<Package size={28} />} />
      </div>

      <div className="bg-white rounded-lg shadow-card border border-stone-200">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-stone-200">
          <div className="flex items-center gap-1 flex-wrap">
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${filter === tab.key ? 'bg-orange-50 text-orange-700' : 'text-stone-500 hover:bg-stone-100'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <Button size="sm" variant="outline" onClick={markAllNotificationsRead}>
              <CheckCheck size={14} /> Marcar todas leidas
            </Button>
          )}
        </div>

        <div className="divide-y divide-stone-100">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-sm">
              <Bell size={32} className="mx-auto mb-2 text-stone-300" />
              No hay notificaciones
            </div>
          ) : (
            filtered.map(n => {
              const config = typeConfig[n.type];
              const Icon = config.icon;
              return (
                <div
                  key={n.id}
                  className={`flex flex-wrap items-start gap-3 px-4 py-3 transition-colors ${!n.read ? 'bg-orange-50/30' : 'bg-white'} hover:bg-stone-50`}
                >
                  <div className="w-10 h-10 flex items-center justify-center flex-shrink-0 text-stone-900">
                    <Icon size={22} />
                  </div>
                  <div className="flex-1 min-w-[12rem]">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={`text-sm ${!n.read ? 'font-bold text-stone-800' : 'font-medium text-stone-700'}`}>{n.title}</p>
                      {!n.read && <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />}
                    </div>
                    <p className="text-sm text-stone-600 mb-1">{n.description}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400">
                      <span>{n.date}</span>
                      <span>·</span>
                      <span className="font-mono">{n.reference}</span>
                      <span>·</span>
                      <Badge variant={priorityVariants[n.priority]}>{n.priority}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                    {(n.type === 'aprobacion' || n.type === 'firma') && (
                      <Button size="sm" variant="outline" onClick={() => setActiveModule('ordenes')}>
                        Ir a OT
                      </Button>
                    )}
                    {n.type === 'bajo_stock' && (
                      <Button size="sm" variant="outline" onClick={() => setActiveModule('inventario')}>
                        Ver Repuesto
                      </Button>
                    )}
                    {!n.read && (
                      <button
                        onClick={() => markNotificationRead(n.id)}
                        className="text-stone-400 hover:text-green-600 transition-colors p-1"
                        title="Marcar como leida"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

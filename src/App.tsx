import { useRef, useState } from 'react';
import { AppProvider, useApp } from '@/store/AppContext';
import { AuthProvider, useAuth } from '@/store/AuthContext';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { Sidebar, type SidebarMode } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ActivosModule } from '@/components/modules/ActivosModule';
import { InventarioModule } from '@/components/modules/InventarioModule';
import { OrdenesModule } from '@/components/modules/OrdenesModule';
import { CombustibleModule } from '@/components/modules/CombustibleModule';
import { ReportesModule } from '@/components/modules/ReportesModule';
import { NotificacionesModule } from '@/components/modules/NotificacionesModule';
import { AdminModule } from '@/components/modules/AdminModule';
import { modulePermissions } from '@/lib/permissions';
import { Lock } from 'lucide-react';

function AccessDenied() {
  return (
    <div className="p-4 sm:p-6">
      <div className="bg-white rounded-lg shadow-card border border-stone-200 p-6 sm:p-10 text-center">
        <div className="w-12 h-12 text-stone-900 flex items-center justify-center mx-auto mb-3">
          <Lock size={28} />
        </div>
        <h3 className="font-heading text-base font-bold text-stone-800">Sin acceso a este modulo</h3>
        <p className="text-sm text-stone-500 mt-1">Tu rol no tiene permisos para ver esta seccion.</p>
      </div>
    </div>
  );
}

function ModuleRouter() {
  const { activeModule, hasPermission } = useApp();

  if (!hasPermission(modulePermissions[activeModule])) return <AccessDenied />;

  switch (activeModule) {
    case 'activos': return <ActivosModule />;
    case 'inventario': return <InventarioModule />;
    case 'ordenes': return <OrdenesModule />;
    case 'combustible': return <CombustibleModule />;
    case 'reportes': return <ReportesModule />;
    case 'notificaciones': return <NotificacionesModule />;
    // "requisas" ya no es un modulo con su propia pantalla: su tabla vive dentro de "Repuestos e Inventario"
    case 'requisas': return <InventarioModule />;
    case 'administracion': return <AdminModule />;
    default: return <ActivosModule />;
  }
}

function AppLayout() {
  // en movil arranca oculto (el menu es una capa que hay que abrir); en escritorio arranca completo,
  // como cualquier app de escritorio
  const [menuMode, setMenuMode] = useState<SidebarMode>(() => (
    window.matchMedia('(min-width: 1024px)').matches ? 'full' : 'hidden'
  ));
  const mini = menuMode === 'mini';
  const hidden = menuMode === 'hidden';
  // recuerda el ultimo estado visible (completo o solo iconos) para que el boton de mostrar/ocultar
  // del header vuelva a como estaba, en vez de forzar siempre "completo"
  const lastVisibleMode = useRef<'full' | 'mini'>(menuMode === 'mini' ? 'mini' : 'full');
  if (menuMode !== 'hidden') lastVisibleMode.current = menuMode;

  return (
    <div className="flex min-h-screen bg-stone-100">
      <Sidebar mode={menuMode} onModeChange={setMenuMode} />
      {/* la franja de iconos (3.5rem) empuja el contenido en movil para no taparlo; en escritorio el
          menu ya forma parte del layout (sticky) y el contenido se acomoda solo */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-200 motion-reduce:transition-none ${mini ? 'pl-14 lg:pl-0' : ''}`}>
        <Header
          menuLabel={hidden ? 'Mostrar menu' : 'Ocultar menu'}
          onMenuClick={() => setMenuMode(hidden ? lastVisibleMode.current : 'hidden')}
        />
        <main className="flex-1 overflow-y-auto">
          <ModuleRouter />
        </main>
      </div>
    </div>
  );
}

/** Enrutamiento local: sin sesion se muestra el login, con sesion la aplicacion */
function AuthGate() {
  const { session } = useAuth();
  if (!session) return <LoginScreen />;
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;

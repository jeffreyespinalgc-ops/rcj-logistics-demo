import { useState } from 'react';
import { AppProvider, useApp } from '@/store/AppContext';
import { AuthProvider, useAuth } from '@/store/AuthContext';
import { LoginScreen } from '@/components/auth/LoginScreen';
import { Sidebar } from '@/components/layout/Sidebar';
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
    case 'administracion': return <AdminModule />;
    default: return <ActivosModule />;
  }
}

function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-stone-100">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setMenuOpen(true)} />
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

import { useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { roleLabels, roleOrder } from '@/lib/roles';
import { demoCredentials } from '@/data/mockUsers';
import type { UserRole } from '@/types';
import logo from '@/assets/images/RCJ-Logistics-Full-Color.png';
import corporacion from '@/assets/images/RCJ-Corporacion-1.png';
import { ShieldCheck, ClipboardCheck, Wrench, LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const roleIcons: Record<UserRole, LucideIcon> = {
  administrador: ShieldCheck,
  jefe_taller: ClipboardCheck,
  tecnico: Wrench,
};

export function LoginScreen() {
  const { login } = useAuth();
  const [role, setRole] = useState<UserRole>('jefe_taller');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Ingresa usuario y contrasena.');
      return;
    }
    setError(login(username, password, role));
  };

  const selectRole = (r: UserRole) => {
    setRole(r);
    setError(null);
  };

  return (
    <div className="min-h-dvh flex bg-white">
      <div className="hidden lg:block lg:w-1/2 sticky top-0 h-dvh overflow-hidden bg-white">
        {/* el emblema mide 91.25% del alto de ancho; si la mitad es mas angosta se recorta por la izquierda */}
        <img
          src={corporacion}
          alt="RCJ Corporación"
          className="absolute top-0 left-[min(0px,100%_-_91.25dvh)] h-full max-w-none"
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-lg shadow-card border border-stone-200 overflow-hidden">
            <div className="bg-blue-900 px-6 py-7 flex flex-col items-center">
              <div className="w-40 h-16 flex items-center justify-center">
                <img src={logo} alt="RCJ Logistics" className="w-full h-full object-contain" />
              </div>
              {/* <p className="text-xs text-blue-200 mt-3 tracking-wide uppercase">Sistema de Gestion de Taller</p> */}
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
              <Field label="Usuario">
                <TextInput
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(null); }}
                  placeholder="noobsaibot"
                  autoComplete="username"
                  autoFocus
                />
              </Field>

              <Field label="Contrasena">
                <div className="relative">
                  <TextInput
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              {error && (
                <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-100 rounded-md">
                  <AlertCircle size={14} className="text-red-600 flex-shrink-0" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full justify-center">
                <LogIn size={16} /> Ingresar
              </Button>

              <div className="pt-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1 h-px bg-stone-200" />
                  <span className="text-xs text-stone-400 uppercase tracking-wide">Ingresar como</span>
                  <div className="flex-1 h-px bg-stone-200" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {roleOrder.map(r => {
                    const Icon = roleIcons[r];
                    const active = role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => selectRole(r)}
                        className={`flex flex-row sm:flex-col items-center justify-center gap-2 sm:gap-1.5 px-2 py-3 rounded-md border text-xs font-medium transition-colors ${
                          active
                            ? 'border-orange-400 bg-orange-50 text-orange-700 ring-2 ring-orange-200'
                            : 'border-stone-300 text-stone-500 hover:bg-stone-50 hover:text-stone-700'
                        }`}
                      >
                        <Icon size={20} />
                        <span className="text-center leading-tight">{roleLabels[r]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="text-center pt-1">
                <p className="text-[11px] text-stone-400">
                  Credenciales de prueba para {roleLabels[role]}:{' '}
                  <span className="font-mono text-stone-500">
                    {demoCredentials[role].username} / {demoCredentials[role].password}
                  </span>
                </p>
              </div>
            </form>
          </div>

          {/* <p className="text-center text-xs text-stone-400 mt-4">
            RCJ Logistics · Gestion de Activos, Mantenimiento y Taller
          </p> */}
        </div>
      </div>
    </div>
  );
}

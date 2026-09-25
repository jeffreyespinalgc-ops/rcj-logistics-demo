import { useState } from 'react';
import { useAuth } from '@/store/AuthContext';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { roleLabels, roleOrder } from '@/lib/roles';
import { demoCredentials } from '@/data/mockUsers';
import type { UserRole } from '@/types';
import logo from '@/assets/images/RCJ-Logistics-Full-Color.png';
import { ShieldCheck, ClipboardCheck, Wrench, LogIn, AlertCircle, Eye, EyeOff, User, Lock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const roleIcons: Record<UserRole, LucideIcon> = {
  administrador: ShieldCheck,
  jefe_taller: ClipboardCheck,
  tecnico: Wrench,
};

function RoadBackdrop() {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <defs>
        <radialGradient id="glow-orange" cx="0%" cy="100%" r="65%">
          <stop offset="0" stopColor="#f97316" stopOpacity="0.38" />
          <stop offset="1" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-blue" cx="100%" cy="0%" r="60%">
          <stop offset="0" stopColor="#3b82f6" stopOpacity="0.32" />
          <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="road-bed" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.03" />
        </linearGradient>
        <pattern id="dot-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="#ffffff" fillOpacity="0.08" />
        </pattern>
      </defs>

      <rect width="1440" height="900" fill="url(#dot-grid)" />
      <rect width="1440" height="900" fill="url(#glow-orange)" />
      <rect width="1440" height="900" fill="url(#glow-blue)" />

      <path
        d="M-120 940 C 260 640, 640 560, 1000 380 S 1400 60, 1560 -40"
        stroke="url(#road-bed)"
        strokeWidth="160"
        strokeLinecap="round"
      />
      <path
        d="M-120 940 C 260 640, 640 560, 1000 380 S 1400 60, 1560 -40"
        stroke="#f97316"
        strokeOpacity="0.9"
        strokeWidth="5"
        strokeDasharray="26 22"
        className="road-flow"
      />

      {/* carretera secundaria en sentido contrario, mas tenue */}
      <path
        d="M1560 980 C 1200 760, 900 830, 560 650 S 100 320, -60 270"
        stroke="#ffffff"
        strokeOpacity="0.05"
        strokeWidth="96"
        strokeLinecap="round"
      />
      <path
        d="M1560 980 C 1200 760, 900 830, 560 650 S 100 320, -60 270"
        stroke="#ffffff"
        strokeOpacity="0.3"
        strokeWidth="3"
        strokeDasharray="26 22"
        className="road-flow-rev"
      />
    </svg>
  );
}

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

  const fillDemoCredentials = () => {
    setUsername(demoCredentials[role].username);
    setPassword(demoCredentials[role].password);
    setError(null);
  };

  return (
    <div className="relative min-h-dvh flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-900 via-[#141f5a] to-[#0b1240] p-4 sm:p-6">
      <RoadBackdrop />

      <div className="login-rise relative z-10 w-full max-w-[490px]">
        <div className="relative overflow-hidden rounded-2xl bg-white/95 shadow-2xl ring-1 ring-white/40 backdrop-blur">
          <div className="h-1 bg-gradient-to-r from-orange-500 via-orange-400 to-blue-800" />

          <div className="px-6 pb-7 pt-7 sm:px-8">
            <div className="flex flex-col items-center text-center">
              <img src={logo} alt="RCJ Logistics" className="h-14 w-auto object-contain" />
              <h1 className="font-heading mt-5 text-xl font-bold text-stone-800">Bienvenido</h1>
              <p className="mt-1 text-xs text-stone-500">Sistema de Gestion de Taller</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-600">Ingresar como</p>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1">
                  {roleOrder.map(r => {
                    const Icon = roleIcons[r];
                    const active = role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={active}
                        onClick={() => selectRole(r)}
                        className={`flex flex-col items-center justify-center gap-1 rounded-lg px-1.5 py-2.5 text-[11px] font-medium leading-tight transition-all ${
                          active
                            ? 'bg-blue-900 text-white shadow-md'
                            : 'text-stone-500 hover:bg-white hover:text-stone-700'
                        }`}
                      >
                        <Icon size={18} className={active ? 'text-orange-400' : ''} />
                        <span className="text-center">{roleLabels[r]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field label="Usuario">
                <div className="relative">
                  <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <TextInput
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError(null); }}
                    placeholder="Tu usuario"
                    autoComplete="username"
                    autoFocus
                    className="w-full !rounded-lg !py-2.5 pl-10"
                  />
                </div>
              </Field>

              <Field label="Contrasena">
                <div className="relative">
                  <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <TextInput
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(null); }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full !rounded-lg !py-2.5 pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 transition-colors hover:text-stone-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              {error && (
                <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 p-2.5">
                  <AlertCircle size={14} className="flex-shrink-0 text-red-600" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full justify-center !rounded-lg !py-2.5 shadow-md shadow-orange-500/30">
                <LogIn size={16} /> Ingresar
              </Button>
            </form>

            <button
              type="button"
              onClick={fillDemoCredentials}
              className="mt-5 w-full rounded-lg border border-dashed border-stone-300 px-3 py-2 text-center text-[11px] text-stone-400 transition-colors hover:border-orange-300 hover:bg-orange-50/50 hover:text-stone-600"
              title="Autocompletar credenciales de prueba"
            >
              Credenciales de prueba para {roleLabels[role]}:{' '}
              <span className="font-mono text-stone-500">
                {demoCredentials[role].username} / {demoCredentials[role].password}
              </span>
            </button>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-blue-200/70">
          RCJ Logistics · Gestion de Activos, Mantenimiento y Taller
        </p>
      </div>
    </div>
  );
}

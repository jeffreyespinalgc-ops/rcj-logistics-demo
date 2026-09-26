import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import type { AppUser, Session, UserRole } from '@/types';
import { initialUsers } from '@/data/mockUsers';
import { clearSession, loadSession, saveSession } from '@/lib/session';
import { loadJSON, saveJSON } from '@/lib/localStore';

interface AuthState {
  session: Session | null;
  users: AppUser[];
  /** Valida credenciales contra el rol seleccionado. Devuelve el error o null. */
  login: (username: string, password: string, role: UserRole) => string | null;
  logout: () => void;
  addUser: (user: Omit<AppUser, 'id'>) => void;
  updateUser: (id: string, patch: Partial<AppUser>) => void;
  removeUser: (id: string) => void;
}

const AuthContext = createContext<AuthState | null>(null);

let userCounter = 100;

/** Cuentas de demo agregadas despues de que pudo guardarse la lista de usuarios: se incorporan si faltan */
const addedSeedUserIds = ['u7'];

function loadUsers(): AppUser[] {
  const stored = loadJSON<AppUser[]>('rcj_v1_users', initialUsers);
  const missing = initialUsers.filter(u => addedSeedUserIds.includes(u.id) && !stored.some(s => s.id === u.id));
  return missing.length > 0 ? [...stored, ...missing] : stored;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<AppUser[]>(() => loadUsers());
  const [session, setSession] = useState<Session | null>(() => loadSession());

  // Los usuarios creados/editados desde Administracion quedan disponibles tras un refresh.
  // Las cuentas de demo (mockUsers.ts) son el respaldo si aun no se guardo nada localmente.
  useEffect(() => { saveJSON('rcj_v1_users', users); }, [users]);

  // Otra pestana que crea o edita usuarios se refleja aqui sin recargar
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== window.localStorage || e.key !== 'rcj_v1_users' || e.newValue === null) return;
      try {
        setUsers(JSON.parse(e.newValue) as AppUser[]);
      } catch {
        // valor ilegible: se conserva la lista actual
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback((username: string, password: string, role: UserRole): string | null => {
    const user = users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
    if (!user || user.password !== password) return 'Usuario o contrasena incorrectos.';
    if (!user.active) return 'El usuario esta inactivo. Contacta al administrador.';
    if (user.role !== role) return 'Las credenciales no corresponden al rol seleccionado.';

    const newSession: Session = {
      userId: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      loggedAt: new Date().toISOString().slice(0, 19),
    };
    saveSession(newSession);
    setSession(newSession);
    return null;
  }, [users]);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const addUser = useCallback((user: Omit<AppUser, 'id'>) => {
    setUsers(prev => [...prev, { ...user, id: `u-${++userCounter}` }]);
  }, []);

  const updateUser = useCallback((id: string, patch: Partial<AppUser>) => {
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...patch } : u)));
    // si cambia el rol del usuario conectado, la sesion se actualiza en caliente
    setSession(prev => (prev && prev.userId === id ? { ...prev, ...('role' in patch ? { role: patch.role as UserRole } : {}), ...('name' in patch ? { name: patch.name as string } : {}) } : prev));
  }, []);

  const removeUser = useCallback((id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id));
  }, []);

  const value = useMemo<AuthState>(
    () => ({ session, users, login, logout, addUser, updateUser, removeUser }),
    [session, users, login, logout, addUser, updateUser, removeUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

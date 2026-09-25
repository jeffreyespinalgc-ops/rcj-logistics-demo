import { Fragment, useState } from 'react';
import { useApp } from '@/store/AppContext';
import { useAuth } from '@/store/AuthContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { StatCard } from '@/components/ui/StatCard';
import { SortableTh } from '@/components/ui/SortableTh';
import { useSort } from '@/lib/useSort';
import type { AppUser, UserRole } from '@/types';
import { roleLabels, roleOrder, roleShortLabels } from '@/lib/roles';
import { isLocked, permissionGroups, permissionLabels } from '@/lib/permissions';
import { PlansTab } from './admin/PlansTab';
import { Users, ListTree, ShieldCheck, Plus, Trash2, RotateCcw, Lock, UserPlus } from 'lucide-react';

type Tab = 'usuarios' | 'tipos' | 'planes' | 'permisos';

export function AdminModule() {
  const [tab, setTab] = useState<Tab>('usuarios');
  const { users } = useAuth();
  const { workTypes } = useApp();

  return (
    <div className="p-4 sm:p-6 space-y-4">

      <div className="bg-white rounded-lg shadow-card border border-stone-200">
        <div className="flex overflow-x-auto border-b border-stone-200">
          <TabButton active={tab === 'usuarios'} onClick={() => setTab('usuarios')}>Usuarios y Roles</TabButton>
          <TabButton active={tab === 'tipos'} onClick={() => setTab('tipos')}>Tipos de Trabajo</TabButton>
          <TabButton active={tab === 'planes'} onClick={() => setTab('planes')}>Planes de Mantenimiento</TabButton>
          <TabButton active={tab === 'permisos'} onClick={() => setTab('permisos')}>Permisos por Rol</TabButton>
        </div>

        {tab === 'usuarios' && <UsersTab />}
        {tab === 'tipos' && <WorkTypesTab />}
        {tab === 'planes' && <PlansTab />}
        {tab === 'permisos' && <PermissionsTab />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${active ? 'border-orange-500 text-orange-600' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
    >
      {children}
    </button>
  );
}

// ===== Usuarios y roles =====

const userSortGetters = {
  name: (u: AppUser) => u.name,
  username: (u: AppUser) => u.username,
  role: (u: AppUser) => roleLabels[u.role],
  active: (u: AppUser) => (u.active ? 0 : 1),
};

function UsersTab() {
  const { users, addUser, updateUser, removeUser, session } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const { sorted, sort, toggle } = useSort(users, userSortGetters);

  return (
    <>
      <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50/50">

        <Button size="sm" onClick={() => setShowModal(true)}>
          <UserPlus size={14} /> Nuevo usuario
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <SortableTh label="Nombre" sortKey="name" sort={sort} onSort={toggle} />
              <SortableTh label="Usuario" sortKey="username" sort={sort} onSort={toggle} />
              <SortableTh label="Rol" sortKey="role" sort={sort} onSort={toggle} />
              <SortableTh label="Estado" sortKey="active" sort={sort} onSort={toggle} />
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(u => {
              const isSelf = session?.userId === u.id;
              return (
                <tr key={u.id}>
                  <td className="font-medium text-stone-800">
                    {u.name}
                    {isSelf && <span className="ml-2 text-[11px] text-stone-400">(tu sesion)</span>}
                  </td>
                  <td className="font-mono text-xs text-stone-600">{u.username}</td>
                  <td>
                    <Select
                      value={u.role}
                      onChange={e => updateUser(u.id, { role: e.target.value as UserRole })}
                      className="!py-1 !text-xs"
                    >
                      {roleOrder.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
                    </Select>
                  </td>
                  <td>
                    <button onClick={() => updateUser(u.id, { active: !u.active })}>
                      <Badge variant={u.active ? 'green' : 'gray'}>{u.active ? 'Activo' : 'Inactivo'}</Badge>
                    </button>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => removeUser(u.id)}
                      disabled={isSelf}
                      title={isSelf ? 'No puedes eliminar tu propio usuario' : 'Eliminar usuario'}
                      className="text-stone-400 hover:text-red-600 transition-colors disabled:opacity-30 disabled:hover:text-stone-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <NewUserModal open={showModal} onClose={() => setShowModal(false)} onCreate={addUser} />
    </>
  );
}

function NewUserModal({ open, onClose, onCreate }: {
  open: boolean;
  onClose: () => void;
  onCreate: (u: Omit<AppUser, 'id'>) => void;
}) {
  const [form, setForm] = useState({ name: '', username: '', password: '', role: 'tecnico' as UserRole });

  const handleSubmit = () => {
    if (!form.name || !form.username || !form.password) return;
    onCreate({ ...form, active: true });
    onClose();
    setForm({ name: '', username: '', password: '', role: 'tecnico' });
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo usuario" size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nombre *">
            <TextInput value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: P. Soto" />
          </Field>
          <Field label="Usuario *">
            <TextInput value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Ej: psoto" />
          </Field>
          <Field label="Contrasena *">
            <TextInput value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Rol">
            <Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })}>
              {roleOrder.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}><Plus size={16} /> Crear usuario</Button>
        </div>
      </div>
    </Modal>
  );
}

// ===== Tipos de Trabajo de la OT =====

/** Convierte un nombre en el codigo tecnico que sirve de llave del plan de mantenimiento */
function slugifyWorkTypeCode(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function WorkTypesTab() {
  const { workTypes, addWorkType, updateWorkType, removeWorkType } = useApp();
  const [name, setName] = useState('');

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const code = slugifyWorkTypeCode(trimmed) || `tipo_${workTypes.length + 1}`;
    addWorkType({ code, name: trimmed, description: '', active: true });
    setName('');
  };

  return (
    <div className="p-4">
      <div className="border border-stone-200 rounded-md max-w-lg">
        <div className="px-4 py-3 border-b border-stone-200">
          <h4 className="font-heading text-sm font-bold text-stone-700">Tipos de Trabajo</h4>

        </div>

        <div className="divide-y divide-stone-100">
          {workTypes.map(item => (
            <div key={item.id} className="flex items-center gap-2 px-4 py-2">
              <TextInput
                value={item.name}
                onChange={e => updateWorkType(item.id, { name: e.target.value })}
                className="flex-1 !py-1 !text-xs"
              />
              <button onClick={() => updateWorkType(item.id, { active: !item.active })}>
                <Badge variant={item.active ? 'green' : 'gray'}>{item.active ? 'Activo' : 'Inactivo'}</Badge>
              </button>
              <button
                onClick={() => removeWorkType(item.id)}
                className="text-stone-400 hover:text-red-600 transition-colors flex-shrink-0"
                title="Eliminar"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {workTypes.length === 0 && <p className="px-4 py-6 text-center text-xs text-stone-400">Sin tipos de trabajo</p>}
        </div>

        <div className="flex flex-wrap items-end gap-2 px-4 py-3 border-t border-stone-200 bg-stone-50/50">
          <Field label="Nombre" className="flex-1">
            <TextInput value={name} onChange={e => setName(e.target.value)} placeholder="Nuevo tipo de trabajo" className="!py-1 !text-xs" />
          </Field>
          <Button size="sm" variant="outline" onClick={handleAdd}><Plus size={12} /> Agregar</Button>
        </div>
      </div>
    </div>
  );
}

// ===== Permisos por rol =====

function PermissionsTab() {
  const { permissions, setRolePermission, resetPermissions } = useApp();

  return (
    <>
      <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50/50">
        <Button size="sm" variant="outline" onClick={resetPermissions}>
          <RotateCcw size={14} /> Restaurar por defecto
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-1/2">Permiso</th>
              {roleOrder.map(r => <th key={r} className="text-center">{roleShortLabels[r]}</th>)}
            </tr>
          </thead>
          <tbody>
            {permissionGroups.map(group => (
              <Fragment key={group.title}>
                <tr className="bg-stone-50">
                  <td colSpan={4} className="font-heading text-xs font-bold text-stone-600 uppercase tracking-wide">
                    {group.title}
                  </td>
                </tr>
                {group.permissions.map(permission => (
                  <tr key={permission}>
                    <td className="text-stone-700">{permissionLabels[permission]}</td>
                    {roleOrder.map(role => {
                      const checked = permissions[role]?.includes(permission) ?? false;
                      const locked = isLocked(role, permission);
                      return (
                        <td key={role} className="text-center">
                          <label className="inline-flex items-center justify-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={locked}
                              onChange={e => setRolePermission(role, permission, e.target.checked)}
                              className="rounded border-stone-300 text-orange-500 focus:ring-orange-300 disabled:opacity-40"
                            />
                            {locked && <Lock size={10} className="ml-1 text-stone-400" />}
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

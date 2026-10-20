import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Field, TextInput } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Copy } from 'lucide-react';
import { initialsOf, roleLabels } from '@/lib/roles';

/**
 * Datos de ejemplo: el modelo de usuario (AppUser) todavia no tiene apodo, fecha de ingreso, ubicacion ni
 * telefono, asi que solo nombre, usuario y rol salen de la sesion real -- el resto es relleno de prueba, nada
 * mas para mostrar como se veria este panel.
 */
const DEMO_PROFILE = {
  nickName: 'Mécanico Automotriz',
  joinDate: '15/03/2022',
  location: 'Rio Nance, Choloma, Cortes',
  phone: '+504 9988-7766',
};

const readOnlyField = 'cursor-not-allowed! bg-stone-100! text-stone-600!';

export function UserProfileModal({ onClose }: { onClose: () => void }) {
  const { session } = useAuth();
  const toast = useToast();
  if (!session) return null;
  const email = `${session.username}@rcjlogistics.com`;

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copiado al portapapeles`);
    } catch {
      toast({ message: `No se pudo copiar el ${label.toLowerCase()}`, variant: 'error' });
    }
  };

  return (
    <Modal open onClose={onClose} title="Mi perfil" size="lg">
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xl font-bold text-white">
            {initialsOf(session.name)}
          </div>
          <div className="min-w-0">
            <p className="ui-title truncate">{session.name}</p>
            <p className="text-content text-stone-500 truncate">{email}</p>
            <p className="text-content text-stone-400">{roleLabels[session.role]}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre completo">
            <TextInput value={session.name} disabled className={`w-full ${readOnlyField}`} />
          </Field>
          <Field label="Cargo">
            <TextInput value={DEMO_PROFILE.nickName} disabled className={`w-full ${readOnlyField}`} />
          </Field>
          <Field label="Fecha de ingreso">
            <TextInput value={DEMO_PROFILE.joinDate} disabled className={`w-full ${readOnlyField}`} />
          </Field>
          <Field label="Ubicacion">
            <TextInput value={DEMO_PROFILE.location} disabled className={`w-full ${readOnlyField}`} />
          </Field>
          <Field label="Telefono">
            <div className="flex items-center gap-2">
              <TextInput value={DEMO_PROFILE.phone} disabled className={`w-full ${readOnlyField}`} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Copiar telefono"
                title="Copiar telefono"
                className="px-2.5!"
                onClick={() => copy(DEMO_PROFILE.phone, 'Telefono')}
              >
                <Copy size={14} />
              </Button>
            </div>
          </Field>
          <Field label="Correo">
            <div className="flex items-center gap-2">
              <TextInput value={email} disabled className={`w-full ${readOnlyField}`} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Copiar correo"
                title="Copiar correo"
                className="px-2.5!"
                onClick={() => copy(email, 'Correo')}
              >
                <Copy size={14} />
              </Button>
            </div>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

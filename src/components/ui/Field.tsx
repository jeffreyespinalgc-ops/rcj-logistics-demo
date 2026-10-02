import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Combobox, type ComboboxOption } from './Combobox';

interface InputProps {
  label?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, children, className = '' }: InputProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-xs font-bold text-stone-600 uppercase tracking-wide">{label}</label>}
      {children}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`px-3 py-2 text-content leading-5 border border-stone-300 rounded-md bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors ${props.className ?? ''}`}
    />
  );
}

/** Junta el texto de un <option> (strings, numeros y expresiones JSX simples) en una sola etiqueta */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf((node as ReactElement<{ children?: ReactNode }>).props.children);
  return '';
}

function optionsFromChildren(children: ReactNode): ComboboxOption[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement(child) || child.type !== 'option') return [];
    const el = child as ReactElement<{ value?: string; children?: ReactNode }>;
    return [{ value: String(el.props.value ?? ''), label: textOf(el.props.children) }];
  });
}

/**
 * Select con buscador: se usa exactamente como un <select> (value/onChange/<option> hijos) pero por dentro
 * es un `Combobox` escribible -- un solo cambio central para que toda lista seleccionable de la app se
 * pueda filtrar escribiendo, sin tocar cada sitio que ya usa `<Select>`.
 */
export function Select({ value, onChange, children, className, disabled, id, 'aria-label': ariaLabel }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Combobox
      id={id}
      value={String(value ?? '')}
      onChange={v => onChange?.({ target: { value: v } } as React.ChangeEvent<HTMLSelectElement>)}
      options={optionsFromChildren(children)}
      disabled={disabled}
      ariaLabel={ariaLabel}
      className={className}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`px-3 py-2 text-content leading-5 border border-stone-300 rounded-md bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors ${props.className ?? ''}`}
    />
  );
}

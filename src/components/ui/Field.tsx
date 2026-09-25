import type { ReactNode } from 'react';

interface InputProps {
  label?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, children, className = '' }: InputProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-xs font-semibold text-stone-600 uppercase tracking-wide">{label}</label>}
      {children}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`px-3 py-2 text-sm border border-stone-300 rounded-md bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors ${props.className ?? ''}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`px-3 py-2 text-sm border border-stone-300 rounded-md bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors ${props.className ?? ''}`}
    >
      {props.children}
    </select>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`px-3 py-2 text-sm border border-stone-300 rounded-md bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors ${props.className ?? ''}`}
    />
  );
}

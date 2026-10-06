import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-orange-500 text-white hover:bg-orange-600 active:bg-orange-700 shadow-sm',
  secondary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm',
  outline: 'border border-stone-300 text-stone-700 bg-white hover:bg-stone-50 active:bg-stone-100',
  danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 shadow-sm',
  ghost: 'text-stone-600 hover:bg-stone-100 active:bg-stone-200',
};

// en telefono el area de toque es de 44px; en escritorio vuelve al tamano compacto
const sizeStyles: Record<Size, string> = {
  sm: 'min-h-[44px] px-2.5 py-1 text-xs [@media(pointer:fine)]:min-h-0',
  md: 'min-h-[44px] px-4 py-2 text-sm [@media(pointer:fine)]:min-h-0',
};

export function Button({ variant = 'primary', size = 'md', children, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-md font-medium transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.98] motion-reduce:active:scale-100 focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children} 
    </button>
  );
}

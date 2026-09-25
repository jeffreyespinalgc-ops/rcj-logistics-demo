import type { ReactNode } from 'react';

type BadgeVariant = 'blue' | 'orange' | 'green' | 'red' | 'gray' | 'yellow' | 'purple';

const variantStyles: Record<BadgeVariant, string> = {
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  green: 'bg-green-100 text-green-800 border-green-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  gray: 'bg-stone-100 text-stone-600 border-stone-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
};

export function Badge({ variant = 'gray', children }: { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${variantStyles[variant]}`}>
      {children}
    </span>
  );
}

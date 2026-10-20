import type { ReactNode } from 'react';

type BadgeVariant = 'blue' | 'orange' | 'green' | 'red' | 'gray' | 'yellow' | 'purple';

const variantStyles: Record<BadgeVariant, string> = {
  blue: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  orange: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30',
  green: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
  red: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
  gray: 'bg-stone-100 text-stone-600 border-stone-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30',
  purple: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30',
};

export function Badge({ variant = 'gray', children }: { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-content font-medium border ${variantStyles[variant]}`}>
      {children}
    </span>
  );
}

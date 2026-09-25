import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  subtitle?: string;
}

export function StatCard({ label, value, icon, subtitle }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-card border border-stone-200 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="h-10 sm:w-10 flex items-center justify-start sm:justify-center flex-shrink-0 text-stone-900">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-stone-800 font-heading break-words">{value}</p>
        {subtitle && <p className="text-xs text-stone-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

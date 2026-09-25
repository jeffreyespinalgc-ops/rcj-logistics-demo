import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { SortState } from '@/lib/useSort';

export function SortableTh<K extends string>({ label, sortKey, sort, onSort, className = '' }: {
  label: string;
  sortKey: K;
  sort: SortState<K> | null;
  onSort: (key: K) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  return (
    <th className={className} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 hover:text-orange-600 transition-colors"
        title="Ordenar por esta columna"
      >
        {label}
        {active
          ? (sort.dir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)
          : <ChevronsUpDown size={12} className="opacity-40" />}
      </button>
    </th>
  );
}

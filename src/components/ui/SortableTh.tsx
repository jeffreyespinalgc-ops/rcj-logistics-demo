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
        className="inline-flex min-h-[44px] min-w-[44px] items-center gap-1 text-content transition-colors hover:text-orange-600 [@media(pointer:fine)]:min-h-0 [@media(pointer:fine)]:min-w-0"
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

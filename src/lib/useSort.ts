import { useCallback, useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';
export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

type SortValue = string | number | null | undefined;

/**
 * Ordenamiento de tablas por columna: clic alterna ascendente -> descendente -> sin orden.
 * `getters` debe ser una constante de modulo (referencia estable) para que el memo sirva.
 */
export function useSort<T, K extends string>(rows: T[], getters: Record<K, (row: T) => SortValue>) {
  const [sort, setSort] = useState<SortState<K> | null>(null);

  const toggle = useCallback((key: K) => {
    setSort(prev => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null;
    });
  }, []);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const get = getters[sort.key];
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      // los valores vacios van siempre al final, sin importar la direccion
      if (va == null || va === '') return vb == null || vb === '' ? 0 : 1;
      if (vb == null || vb === '') return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor;
      return String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' }) * factor;
    });
  }, [rows, sort, getters]);

  return { sorted, sort, toggle };
}

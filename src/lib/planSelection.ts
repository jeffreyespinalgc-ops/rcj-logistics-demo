import type { Asset, CatalogItem, MaintenancePlans, MaintenanceTreeNode, OTActivity } from '@/types';

/**
 * Seleccion de una linea de trabajo sobre los Planes de Mantenimiento:
 * Tipo de trabajo -> niveles (un desplegable por nivel) -> actividades (casillas del ultimo nivel).
 * Un nodo sin hijos es una actividad; un nodo con hijos es un nivel por el que se sigue bajando.
 */
export interface PlanSelection {
  workTypeCode: string;
  /** Un id por nivel elegido, empezando por los hijos del tipo de trabajo */
  nodeIds: string[];
  /** Ids de las actividades marcadas en el ultimo nivel */
  checkedIds: string[];
}

export interface PlanLevel {
  /** Hijos con sub-niveles, es decir, los que se pueden elegir para seguir bajando */
  options: MaintenanceTreeNode[];
  selectedId: string | null;
}

export interface ResolvedPlan {
  levels: PlanLevel[];
  path: MaintenanceTreeNode[];
  /** Actividades (nodos sin hijos) disponibles en el ultimo nivel alcanzado */
  leaves: MaintenanceTreeNode[];
}

export interface PlanResult {
  valid: boolean;
  work: string;
  workPath: string[];
  activities: OTActivity[];
}

export const emptyPlanSelection = (workTypeCode = ''): PlanSelection => ({ workTypeCode, nodeIds: [], checkedIds: [] });

export function resolvePlan(roots: MaintenanceTreeNode[], nodeIds: string[]): ResolvedPlan {
  const levels: PlanLevel[] = [];
  const path: MaintenanceTreeNode[] = [];
  let siblings = roots;
  // si el recorrido se detiene porque un nivel quedo sin elegir (hay hermanos con hijos, pero el usuario
  // aun no dice cual), no hay que mostrar como "actividades" a otros hermanos de ESE mismo nivel que ya
  // sean hojas (p. ej. un modelo de vehiculo al que todavia no le cargaron sus propios sub-niveles):
  // solo existen actividades marcables cuando se llego de verdad al final del camino elegido.
  let pendingLevel = false;
  for (let depth = 0; ; depth++) {
    const options = siblings.filter(n => n.children.length > 0);
    if (options.length === 0) break;
    const selected = options.find(n => n.id === nodeIds[depth]) ?? null;
    levels.push({ options, selectedId: selected?.id ?? null });
    if (!selected) { pendingLevel = true; break; }
    path.push(selected);
    siblings = selected.children;
  }
  return { levels, path, leaves: pendingLevel ? [] : siblings.filter(n => n.children.length === 0) };
}

/**
 * Convierte la seleccion en lo que se guarda en la linea. Si el tipo de trabajo aun no tiene
 * plan (o no hay tipos), la linea se describe con texto libre.
 */
export function planSelectionResult(
  workTypes: CatalogItem[],
  plans: MaintenancePlans,
  selection: PlanSelection,
  freeText: string
): PlanResult {
  const text = freeText.trim();
  const freeResult: PlanResult = { valid: text.length > 0, work: text, workPath: [], activities: [] };
  const type = workTypes.find(w => w.code === selection.workTypeCode);

  if (!type) {
    const noTypes = !workTypes.some(w => w.active);
    return noTypes ? freeResult : { valid: false, work: '', workPath: [], activities: [] };
  }
  const roots = plans[type.code] ?? [];
  if (roots.length === 0) return freeResult;

  const { path, leaves } = resolvePlan(roots, selection.nodeIds);
  const activities = leaves
    .filter(l => selection.checkedIds.includes(l.id))
    .map(l => ({ name: l.name }));
  const workPath = [type.name, ...path.map(n => n.name)];
  return { valid: activities.length > 0, work: workPath.join(' > '), workPath, activities };
}

/** Vehiculo Ligero / Vehiculo Pesado / Maquinaria / Equipo Auxiliar: mismas etiquetas que ActivosModule.tsx */
const assetTypeLabels: Record<Asset['type'], string> = {
  vehiculo_ligero: 'Vehiculo Ligero',
  vehiculo_pesado: 'Vehiculo Pesado',
  maquinaria: 'Maquinaria',
  equipo_auxiliar: 'Equipo Auxiliar',
};

/** Quita tildes/diacriticos para que "Camion"/"Camión" (o mayus/minus) se comparen igual */
const normalize = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Adivina hasta donde se puede bajar sola en el arbol segun el vehiculo elegido: en cada nivel, si el
 * nombre de UN SOLO hijo aparece dentro de la marca/modelo/nombre/tipo del vehiculo (o al reves), se
 * selecciona solo; si hay mas de una coincidencia (o ninguna), se deja ese nivel para que el usuario
 * elija a mano. El tipo de vehiculo (Vehiculo Ligero/Pesado/Maquinaria/Equipo Auxiliar) es una categoria
 * amplia: si el arbol usa categorias mas finas (p. ej. "Camion"/"Volqueta"/"Traileta", todas serian el
 * mismo "Vehiculo Pesado"), esas solo se infieren si esa palabra tambien aparece en el nombre/marca/modelo
 * del vehiculo -- no hay en el sistema un campo mas fino que el tipo para distinguirlas.
 */
export function inferNodeIds(roots: MaintenanceTreeNode[], asset: Asset): string[] {
  const haystacks = [asset.brand, asset.model, asset.name, assetTypeLabels[asset.type]].filter(Boolean).map(normalize);
  const matches = (name: string) => {
    const n = normalize(name);
    if (!n) return false;
    return haystacks.some(h => h.includes(n) || n.includes(h));
  };
  const nodeIds: string[] = [];
  let siblings = roots;
  for (;;) {
    const options = siblings.filter(n => n.children.length > 0);
    if (options.length === 0) break;
    const found = options.filter(n => matches(n.name));
    if (found.length !== 1) break;
    nodeIds.push(found[0].id);
    siblings = found[0].children;
  }
  return nodeIds;
}

/** Reconstruye la seleccion de una linea ya creada buscando su ruta por nombre en el plan actual */
export function selectionFromLine(
  workTypes: CatalogItem[],
  plans: MaintenancePlans,
  line: { workPath?: string[]; activities?: OTActivity[] }
): PlanSelection {
  const [typeName, ...names] = line.workPath ?? [];
  const type = workTypes.find(w => w.name === typeName);
  if (!type) return emptyPlanSelection();

  const nodeIds: string[] = [];
  let siblings = plans[type.code] ?? [];
  for (const name of names) {
    const next = siblings.find(n => n.name === name && n.children.length > 0);
    if (!next) break;
    nodeIds.push(next.id);
    siblings = next.children;
  }
  const activityNames = new Set((line.activities ?? []).map(a => a.name));
  const checkedIds = siblings.filter(n => n.children.length === 0 && activityNames.has(n.name)).map(n => n.id);
  return { workTypeCode: type.code, nodeIds, checkedIds };
}

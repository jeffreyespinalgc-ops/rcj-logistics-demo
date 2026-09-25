import type { CatalogItem, MaintenancePlans, MaintenanceTreeNode, OTActivity } from '@/types';

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
  for (let depth = 0; ; depth++) {
    const options = siblings.filter(n => n.children.length > 0);
    if (options.length === 0) break;
    const selected = options.find(n => n.id === nodeIds[depth]) ?? null;
    levels.push({ options, selectedId: selected?.id ?? null });
    if (!selected) break;
    path.push(selected);
    siblings = selected.children;
  }
  return { levels, path, leaves: siblings.filter(n => n.children.length === 0) };
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

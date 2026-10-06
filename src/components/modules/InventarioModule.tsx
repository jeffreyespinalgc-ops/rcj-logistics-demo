import { useApp } from '@/store/AppContext';
import { useConfirm } from '@/store/ConfirmContext';
import { useToast } from '@/store/ToastContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { StatCard } from '@/components/ui/StatCard';
import { IndicatorCards } from '@/components/ui/IndicatorCards';
import { SortableTh } from '@/components/ui/SortableTh';
import { useSort } from '@/lib/useSort';
import type { InventoryMovement, Part } from '@/types';
import {
  Package,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  History,
  Search,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { RequisasTable } from './RequisasModule';
import { pendingRequisitionCount } from '@/lib/requisition';

const formatCLP = (n: number) => 'L.' + n.toLocaleString('es-HN');

const partSortGetters = {
  code: (p: Part) => p.code,
  description: (p: Part) => p.description,
  category: (p: Part) => p.category,
  stock: (p: Part) => p.currentStock,
  cost: (p: Part) => p.unitCost,
  status: (p: Part) => (p.currentStock < p.minStock * 0.5 ? 2 : p.currentStock < p.minStock ? 1 : 0),
};

const movementSortGetters = {
  date: (m: InventoryMovement) => m.date,
  code: (m: InventoryMovement) => m.partCode,
  description: (m: InventoryMovement) => m.partDescription,
  type: (m: InventoryMovement) => m.type,
  quantity: (m: InventoryMovement) => m.quantity,
  reference: (m: InventoryMovement) => m.reference,
  user: (m: InventoryMovement) => m.user,
};

export function InventarioModule() {
  // El stock se ajusta automaticamente al consumir repuestos en lineas de OT.
  // El alta manual de repuestos (permiso 'inventario.catalogo.editar') es solo
  // para la demo: el catalogo vendra automaticamente del inventario de SAP.
  const { parts, movements, workOrders, currentUser, hasPermission, addPart, updatePart, removePart } = useApp();
  const confirm = useConfirm();
  const toast = useToast();
  const canEditCatalog = hasPermission('inventario.catalogo.editar');
  const canSeeRequisas = hasPermission('modulo.requisas');
  const canSeeAllOT = hasPermission('ot.ver.todas');
  const pendingRequisitions = canSeeRequisas ? pendingRequisitionCount(workOrders, { canSeeAll: canSeeAllOT, currentUser }) : 0;
  const [view, setView] = useState<'stock' | 'historial' | 'requisas'>('stock');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const categories = useMemo(() => [...new Set(parts.map(p => p.category))], [parts]);

  const filteredParts = useMemo(() => {
    return parts.filter(p => {
      if (search && !p.description.toLowerCase().includes(search.toLowerCase()) && !p.code.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory && p.category !== filterCategory) return false;
      if (lowStockOnly && p.currentStock >= p.minStock) return false;
      return true;
    });
  }, [parts, search, filterCategory, lowStockOnly]);

  const { sorted: sortedParts, sort: partSort, toggle: togglePartSort } = useSort(filteredParts, partSortGetters);
  const { sorted: sortedMovements, sort: movementSort, toggle: toggleMovementSort } = useSort(movements, movementSortGetters);

  const lowStockParts = parts.filter(p => p.currentStock < p.minStock);
  const totalValue = parts.reduce((sum, p) => sum + p.currentStock * p.unitCost, 0);

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4">
      <IndicatorCards>
        <StatCard label="Total Repuestos" value={parts.length} icon={<Package size={28} />} />
        <StatCard label="Alertas Bajo Stock" value={lowStockParts.length} icon={<AlertTriangle size={28} />} subtitle="" />
        <StatCard label="Valor Inventario" value={formatCLP(totalValue)} icon={<Package size={28} />} />
        <StatCard label="Movimientos Recientes" value={movements.length} icon={<History size={28} />} />
      </IndicatorCards>

      <div className="bg-white rounded-lg shadow-card border border-stone-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView('stock')}
              className={`min-h-[44px] px-3 py-1.5 text-sm rounded-md transition-colors [@media(pointer:fine)]:min-h-0 ${view === 'stock' ? 'bg-orange-50 text-orange-700' : 'text-stone-500 hover:bg-stone-100'}`}
            >
              Inventario
            </button>
            <button
              onClick={() => setView('historial')}
              className={`min-h-[44px] px-3 py-1.5 text-sm rounded-md transition-colors [@media(pointer:fine)]:min-h-0 ${view === 'historial' ? 'bg-orange-50 text-orange-700' : 'text-stone-500 hover:bg-stone-100'}`}
            >
              Historial de Movimientos
            </button>
            {canSeeRequisas && (
              <button
                onClick={() => setView('requisas')}
                className={`flex items-center gap-1.5 min-h-[44px] px-3 py-1.5 text-sm rounded-md transition-colors [@media(pointer:fine)]:min-h-0 ${view === 'requisas' ? 'bg-orange-50 text-orange-700' : 'text-stone-500 hover:bg-stone-100'}`}
              >
                Requisas de Repuestos
                {pendingRequisitions > 0 && (
                  <span className="bg-orange-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                    {pendingRequisitions}
                  </span>
                )}
              </button>
            )}
          </div>
          {canEditCatalog && view === 'stock' && (
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus size={14} /> Nuevo Repuesto
            </Button>
          )}
        </div>

        <div key={view} className="animate-fade-in">
        {view === 'stock' ? (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 bg-stone-50/50 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Field label="Buscar">
                  <Search size={16} className="absolute left-3 top-1/2 text-stone-400" />
                  <TextInput
                    placeholder="Buscar por codigo o descripcion..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9"
                  />
                </Field>
              </div>
              <Field label="Categorias">
                <Select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="w-full sm:w-auto">
                  <option value="">Todas las categorias</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </Select>
              </Field>
              {/* <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                <input type="checkbox" checked={lowStockOnly} onChange={e => setLowStockOnly(e.target.checked)} className="rounded border-stone-300 text-orange-500 focus:ring-orange-300" />
                Solo bajo stock
              </label> */}
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableTh label="Codigo" sortKey="code" sort={partSort} onSort={togglePartSort} />
                    <SortableTh label="Descripcion" sortKey="description" sort={partSort} onSort={togglePartSort} />
                    <SortableTh label="Categoria" sortKey="category" sort={partSort} onSort={togglePartSort} className="hidden md:table-cell" />
                    <SortableTh label="Stock Actual" sortKey="stock" sort={partSort} onSort={togglePartSort} className="text-right" />
                    <SortableTh label="Costo" sortKey="cost" sort={partSort} onSort={togglePartSort} className="text-right" />
                    <SortableTh label="Estado" sortKey="status" sort={partSort} onSort={togglePartSort} />
                    {canEditCatalog && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {sortedParts.map(part => {
                    const isLow = part.currentStock < part.minStock;
                    const isCritical = part.currentStock < part.minStock * 0.5;
                    return (
                      <tr key={part.id} className={isLow ? 'bg-orange-50/40' : ''}>
                        <td className="text-stone-600 font-normal">{part.code}</td>
                        <td className="font-normal text-stone-800">{part.description}</td>
                        <td className="hidden text-stone-600 md:table-cell">{part.category}</td>
                        <td className={`text-right font-normal ${isLow ? 'text-orange-700' : 'text-stone-800'}`}>
                          {canEditCatalog ? (
                            <TextInput
                              type="number"
                              min={0}
                              value={part.currentStock}
                              onChange={e => updatePart(part.id, { currentStock: Number(e.target.value) })}
                              className="w-20 !py-1 !text-content text-right ml-auto"
                            />
                          ) : part.currentStock}
                        </td>
                        <td className="text-right text-stone-600">
                          {canEditCatalog ? (
                            <TextInput
                              type="number"
                              min={0}
                              value={part.unitCost}
                              onChange={e => updatePart(part.id, { unitCost: Number(e.target.value) })}
                              className="w-24 !py-1 !text-content text-right ml-auto"
                            />
                          ) : formatCLP(part.unitCost)}
                        </td>
                        <td>
                          {isCritical ? (
                            <Badge variant="red"><AlertTriangle size={10} className="mr-1 inline" /> Critico</Badge>
                          ) : isLow ? (
                            <Badge variant="orange"><AlertTriangle size={10} className="mr-1 inline" /> Bajo</Badge>
                          ) : (
                            <Badge variant="green">OK</Badge>
                          )}
                        </td>
                        {canEditCatalog && (
                          <td className="text-right">
                            <button
                              onClick={async () => {
                                if (await confirm({ title: 'Eliminar repuesto', message: `¿Estas seguro de eliminar el repuesto "${part.description}"?`, confirmLabel: 'Eliminar', variant: 'danger' })) {
                                  removePart(part.id);
                                  toast({ message: `${part.description} eliminado`, variant: 'info' });
                                }
                              }}
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-stone-400 transition-colors hover:text-red-600 [@media(pointer:fine)]:min-h-0 [@media(pointer:fine)]:min-w-0"
                              title="Eliminar repuesto"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredParts.length === 0 && (
                <div className="text-center py-8 text-stone-400 text-content">No se encontraron repuestos con los filtros seleccionados</div>
              )}
            </div>
          </>
        ) : view === 'historial' ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <SortableTh label="Fecha" sortKey="date" sort={movementSort} onSort={toggleMovementSort} />
                  <SortableTh label="Codigo" sortKey="code" sort={movementSort} onSort={toggleMovementSort} />
                  <SortableTh label="Descripcion" sortKey="description" sort={movementSort} onSort={toggleMovementSort} />
                  <SortableTh label="Tipo" sortKey="type" sort={movementSort} onSort={toggleMovementSort} />
                  <SortableTh label="Cantidad" sortKey="quantity" sort={movementSort} onSort={toggleMovementSort} className="text-right" />
                  <SortableTh label="Referencia" sortKey="reference" sort={movementSort} onSort={toggleMovementSort} />
                  <SortableTh label="Usuario" sortKey="user" sort={movementSort} onSort={toggleMovementSort} />
                </tr>
              </thead>
              <tbody>
                {sortedMovements.map(m => (
                  <tr key={m.id}>
                    <td className="text-stone-500">{m.date}</td>
                    <td className="font-normal text-blue-700">{m.partCode}</td>
                    <td className="font-normal text-stone-800">{m.partDescription}</td>
                    <td>
                      {m.type === 'entrada' ? (
                        <Badge variant="green"><ArrowUpCircle size={10} className="mr-1 inline" /> Entrada</Badge>
                      ) : (
                        <Badge variant="orange"><ArrowDownCircle size={10} className="mr-1 inline" /> Salida</Badge>
                      )}
                    </td>
                    <td className={`text-right font-normal ${m.type === 'entrada' ? 'text-green-700' : 'text-orange-700'}`}>
                      {m.type === 'entrada' ? '+' : '-'}{m.quantity}
                    </td>
                    <td className="font-normal text-stone-500">{m.reference}</td>
                    <td className="text-stone-600">{m.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <RequisasTable />
        )}
        </div>
      </div>

      <CreatePartModal open={showCreateModal} onClose={() => setShowCreateModal(false)} onCreate={addPart} />
    </div>
  );
}

function CreatePartModal({ open, onClose, onCreate }: {
  open: boolean;
  onClose: () => void;
  onCreate: (p: Omit<Part, 'id'>) => void;
}) {
  const [form, setForm] = useState({
    code: '',
    description: '',
    category: '',
    currentStock: 0,
    minStock: 0,
    maxStock: 0,
    unitCost: 0,
    warehouse: '',
    location: '',
    unit: 'UND',
  });
  const confirm = useConfirm();
  const toast = useToast();

  const handleSubmit = async () => {
    if (!form.code || !form.description) return;
    if (!(await confirm({ title: 'Crear repuesto', message: '¿Estas seguro de crear este repuesto?', confirmLabel: 'Crear repuesto' }))) return;
    onCreate(form);
    toast(`${form.description} creado correctamente`);
    onClose();
    setForm({ code: '', description: '', category: '', currentStock: 0, minStock: 0, maxStock: 0, unitCost: 0, warehouse: '', location: '', unit: 'UND' });
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Repuesto" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Codigo *">
            <TextInput value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="REP-XXX" />
          </Field>
          <Field label="Descripcion *">
            <TextInput value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ej: Filtro de aceite" />
          </Field>
          <Field label="Categoria">
            <TextInput value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Ej: Filtros" />
          </Field>
          <Field label="Bodega">
            <TextInput value={form.warehouse} onChange={e => setForm({ ...form, warehouse: e.target.value })} placeholder="Ej: Almacen Central" />
          </Field>
          <Field label="Ubicacion">
            <TextInput value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Ej: A-01-03" />
          </Field>
          <Field label="Costo Unitario">
            <TextInput type="number" min={0} value={form.unitCost} onChange={e => setForm({ ...form, unitCost: Number(e.target.value) })} />
          </Field>
          <Field label="Stock Inicial">
            <TextInput type="number" min={0} value={form.currentStock} onChange={e => setForm({ ...form, currentStock: Number(e.target.value) })} />
          </Field>
          <Field label="Stock Minimo">
            <TextInput type="number" min={0} value={form.minStock} onChange={e => setForm({ ...form, minStock: Number(e.target.value) })} />
          </Field>
          <Field label="Stock Maximo">
            <TextInput type="number" min={0} value={form.maxStock} onChange={e => setForm({ ...form, maxStock: Number(e.target.value) })} />
          </Field>
          <Field label="Unidad de Medida">
            <Select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
              <option value="UND">UND</option>
              <option value="KG">KG</option>
              <option value="LB">LB</option>
              <option value="FARDO">FARDO</option>
              <option value="GALONES">GALONES</option>
              <option value="LITROS">LITROS</option>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}><Plus size={16} /> Crear Repuesto</Button>
        </div>
      </div>
    </Modal>
  );
}

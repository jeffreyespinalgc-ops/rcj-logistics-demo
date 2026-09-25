import { useApp } from '@/store/AppContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { StatCard } from '@/components/ui/StatCard';
import { SortableTh } from '@/components/ui/SortableTh';
import { useSort } from '@/lib/useSort';
import type { FuelLoad } from '@/types';
import {
  Fuel,
  Plus,
  TrendingUp,
  DollarSign,
  ArrowLeft,
  History,
} from 'lucide-react';
import { useState, useMemo } from 'react';

const formatCLP = (n: number) => '$' + n.toLocaleString('es-CL');

interface ConsumptionRow {
  assetId: string;
  assetCode: string;
  assetName: string;
  totalLiters: number;
  totalCost: number;
  loads: number;
  lastLoad: string;
}

const consumptionSortGetters = {
  code: (a: ConsumptionRow) => a.assetCode,
  asset: (a: ConsumptionRow) => a.assetName,
  loads: (a: ConsumptionRow) => a.loads,
  liters: (a: ConsumptionRow) => a.totalLiters,
  cost: (a: ConsumptionRow) => a.totalCost,
  avg: (a: ConsumptionRow) => a.totalLiters / a.loads,
  lastLoad: (a: ConsumptionRow) => a.lastLoad,
};

const fuelLoadSortGetters = {
  date: (f: FuelLoad) => f.date,
  fuelType: (f: FuelLoad) => f.fuelType,
  liters: (f: FuelLoad) => f.liters,
  unitPrice: (f: FuelLoad) => f.unitPrice,
  cost: (f: FuelLoad) => f.cost,
  odometer: (f: FuelLoad) => f.odometer,
  provider: (f: FuelLoad) => f.provider,
};

export function CombustibleModule() {
  const { fuelLoads, assets, addFuelLoad, currentRole } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const canRegister = currentRole !== 'administrador';

  const totalLiters = fuelLoads.reduce((sum, f) => sum + f.liters, 0);
  const totalCost = fuelLoads.reduce((sum, f) => sum + f.cost, 0);

  const consumptionByAsset = useMemo(() => {
    const map = new Map<string, ConsumptionRow>();
    fuelLoads.forEach(f => {
      const existing = map.get(f.assetId);
      if (existing) {
        existing.totalLiters += f.liters;
        existing.totalCost += f.cost;
        existing.loads += 1;
        if (f.date > existing.lastLoad) existing.lastLoad = f.date;
      } else {
        map.set(f.assetId, {
          assetId: f.assetId,
          assetCode: f.assetCode,
          assetName: f.assetName,
          totalLiters: f.liters,
          totalCost: f.cost,
          loads: 1,
          lastLoad: f.date,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.totalLiters - a.totalLiters);
  }, [fuelLoads]);

  const topConsumer = consumptionByAsset[0];
  const { sorted: sortedConsumption, sort, toggle } = useSort(consumptionByAsset, consumptionSortGetters);

  if (selectedAssetId) {
    const asset = consumptionByAsset.find(a => a.assetId === selectedAssetId);
    return (
      <AssetFuelHistory
        assetLabel={asset ? `${asset.assetCode} - ${asset.assetName}` : ''}
        loads={fuelLoads.filter(f => f.assetId === selectedAssetId).sort((a, b) => b.date.localeCompare(a.date))}
        onBack={() => setSelectedAssetId(null)}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Cargas Registradas" value={fuelLoads.length} icon={<Fuel size={28} />} />
        <StatCard label="Total Litros" value={totalLiters.toLocaleString() + ' L'} icon={<TrendingUp size={28} />} />
        <StatCard label="Costo Total" value={formatCLP(totalCost)} icon={<DollarSign size={28} />} />
        <StatCard label="Mayor Consumo" value={topConsumer?.assetName.split(' ').slice(0, 2).join(' ') ?? 'N/A'} icon={<Fuel size={28} />} subtitle={topConsumer ? `${topConsumer.totalLiters.toLocaleString()} L` : ''} />
      </div>

      <div className="bg-white rounded-lg shadow-card border border-stone-200">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-stone-200">
          <h3 className="font-heading text-base font-bold text-stone-800">Resumen de Consumo por Activo</h3>
          {canRegister && (
            <Button onClick={() => setShowModal(true)}>
              <Plus size={16} /> Registrar Carga
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="Codigo" sortKey="code" sort={sort} onSort={toggle} />
                <SortableTh label="Activo" sortKey="asset" sort={sort} onSort={toggle} />
                <SortableTh label="Cargas" sortKey="loads" sort={sort} onSort={toggle} className="text-right" />
                <SortableTh label="Total Litros" sortKey="liters" sort={sort} onSort={toggle} className="text-right" />
                <SortableTh label="Costo Total" sortKey="cost" sort={sort} onSort={toggle} className="text-right" />
                <SortableTh label="Prom. L/Carga" sortKey="avg" sort={sort} onSort={toggle} className="text-right" />
                <SortableTh label="Ultima Carga" sortKey="lastLoad" sort={sort} onSort={toggle} />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedConsumption.map(a => (
                <tr key={a.assetId}>
                  <td className="font-mono text-xs font-semibold text-blue-700">{a.assetCode}</td>
                  <td className="font-medium text-stone-800">{a.assetName}</td>
                  <td className="text-right text-stone-600">{a.loads}</td>
                  <td className="text-right font-semibold text-stone-800">{a.totalLiters.toLocaleString()} L</td>
                  <td className="text-right text-stone-700">{formatCLP(a.totalCost)}</td>
                  <td className="text-right text-stone-500">{Math.round(a.totalLiters / a.loads).toLocaleString()} L</td>
                  <td className="text-stone-500 text-xs">{a.lastLoad}</td>
                  <td className="text-right">
                    <button
                      onClick={() => setSelectedAssetId(a.assetId)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 hover:text-orange-800"
                    >
                      <History size={14} /> Historial
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {consumptionByAsset.length === 0 && (
            <div className="text-center py-8 text-stone-400 text-sm">No hay cargas registradas</div>
          )}
        </div>
      </div>

      <FuelLoadModal
        open={showModal}
        onClose={() => setShowModal(false)}
        assets={assets}
        onCreate={addFuelLoad}
      />
    </div>
  );
}

function AssetFuelHistory({ assetLabel, loads, onBack }: {
  assetLabel: string;
  loads: FuelLoad[];
  onBack: () => void;
}) {
  const { sorted, sort, toggle } = useSort(loads, fuelLoadSortGetters);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-600 hover:text-orange-600 transition-colors">
        <ArrowLeft size={16} /> Volver al resumen
      </button>

      <div className="bg-white rounded-lg shadow-card border border-stone-200">
        <div className="px-4 py-3 border-b border-stone-200">
          <h3 className="font-heading text-base font-bold text-stone-800">Historial de Cargas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="Fecha" sortKey="date" sort={sort} onSort={toggle} />
                <SortableTh label="Tipo" sortKey="fuelType" sort={sort} onSort={toggle} />
                <SortableTh label="Litros" sortKey="liters" sort={sort} onSort={toggle} className="text-right" />
                <SortableTh label="Precio/L" sortKey="unitPrice" sort={sort} onSort={toggle} className="text-right" />
                <SortableTh label="Costo" sortKey="cost" sort={sort} onSort={toggle} className="text-right" />
                <SortableTh label="Odometro" sortKey="odometer" sort={sort} onSort={toggle} className="text-right" />
                <SortableTh label="Proveedor" sortKey="provider" sort={sort} onSort={toggle} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(f => (
                <tr key={f.id}>
                  <td className="text-stone-500 text-xs">{f.date}</td>
                  <td className="text-stone-600 uppercase text-xs">{f.fuelType.replace('_', ' ')}</td>
                  <td className="text-right font-semibold text-stone-800">{f.liters} L</td>
                  <td className="text-right text-stone-500">{formatCLP(f.unitPrice)}</td>
                  <td className="text-right text-stone-700 font-medium">{formatCLP(f.cost)}</td>
                  <td className="text-right text-stone-500">{f.odometer.toLocaleString()}</td>
                  <td className="text-stone-600">{f.provider}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loads.length === 0 && (
            <div className="text-center py-8 text-stone-400 text-sm">No hay cargas registradas para este activo</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FuelLoadModal({ open, onClose, assets, onCreate }: {
  open: boolean;
  onClose: () => void;
  assets: { id: string; code: string; name: string }[];
  onCreate: (f: Omit<import('@/types').FuelLoad, 'id'>) => void;
}) {
  const [assetId, setAssetId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [liters, setLiters] = useState(0);
  const [fuelType, setFuelType] = useState<'diesel' | 'gasolina_87' | 'gasolina_91' | 'gasolina_95'>('diesel');
  const [unitPrice, setUnitPrice] = useState(1100);
  const [odometer, setOdometer] = useState(0);
  const [provider, setProvider] = useState('Copec');

  const cost = liters * unitPrice;

  const handleSubmit = () => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset || liters <= 0) return;
    onCreate({
      assetId: asset.id,
      assetCode: asset.code,
      assetName: asset.name,
      date,
      liters,
      fuelType,
      cost,
      odometer,
      provider,
      unitPrice,
    });
    onClose();
    setAssetId('');
    setLiters(0);
    setOdometer(0);
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar Carga de Combustible" size="md">
      <div className="space-y-4">
        <Field label="Activo *">
          <Select value={assetId} onChange={e => setAssetId(e.target.value)}>
            <option value="">Seleccionar activo...</option>
            {assets.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Fecha *">
            <TextInput type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
          <Field label="Tipo de Combustible">
            <Select value={fuelType} onChange={e => setFuelType(e.target.value as 'diesel' | 'gasolina_87' | 'gasolina_91' | 'gasolina_95')}>
              <option value="diesel">Diesel</option>
              <option value="gasolina_87">Gasolina 87</option>
              <option value="gasolina_91">Gasolina 91</option>
              <option value="gasolina_95">Gasolina 95</option>
            </Select>
          </Field>
          <Field label="Litros *">
            <TextInput type="number" min={0} value={liters} onChange={e => setLiters(Number(e.target.value))} />
          </Field>
          <Field label="Precio por Litro (CLP)">
            <TextInput type="number" min={0} value={unitPrice} onChange={e => setUnitPrice(Number(e.target.value))} />
          </Field>
          <Field label="Odometro / Horometro">
            <TextInput type="number" min={0} value={odometer} onChange={e => setOdometer(Number(e.target.value))} />
          </Field>
          <Field label="Proveedor">
            <Select value={provider} onChange={e => setProvider(e.target.value)}>
              <option value="Copec">Copec</option>
              <option value="Shell">Shell</option>
              <option value="Petrobras">Petrobras</option>
              <option value="Otro">Otro</option>
            </Select>
          </Field>
        </div>
        <div className="p-3 bg-blue-50 rounded-md border border-blue-100 flex items-center justify-between">
          <span className="text-sm text-blue-700 font-medium">Costo total de la carga:</span>
          <span className="text-lg font-bold text-blue-800 font-heading">{formatCLP(cost)}</span>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}><Plus size={16} /> Registrar Carga</Button>
        </div>
      </div>
    </Modal>
  );
}

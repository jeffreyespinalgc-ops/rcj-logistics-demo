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
import { PhotoCarousel } from '@/components/ui/PhotoCarousel';
import type { Asset, AssetPhoto, AssetStatus, AssetType } from '@/types';
import { fileToCompressedDataUrl } from '@/lib/image';
import { useSort } from '@/lib/useSort';
import {
  Plus,
  Search,
  ArrowLeft,
  Truck,
  Package,
  Fuel,
  Wrench,
  Link2,
  RefreshCw,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';

const statusLabels: Record<AssetStatus, string> = {
  operativo: 'Operativo',
  en_mantenimiento: 'En Mantenimiento',
  fuera_de_servicio: 'Fuera de Servicio',
  baja: 'Dada de Baja',
};

const statusVariants: Record<AssetStatus, 'green' | 'orange' | 'red' | 'gray'> = {
  operativo: 'green',
  en_mantenimiento: 'orange',
  fuera_de_servicio: 'red',
  baja: 'gray',
};

const typeLabels: Record<AssetType, string> = {
  vehiculo_ligero: 'Vehiculo Ligero',
  vehiculo_pesado: 'Vehiculo Pesado',
  maquinaria: 'Maquinaria',
  equipo_auxiliar: 'Equipo Auxiliar',
};

const formatCLP = (n: number) => 'L.' + n.toLocaleString('es-HN');

const formatDateTime = (iso: string | null) => {
  if (!iso) return 'Nunca';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const assetSortGetters = {
  code: (a: Asset) => a.code,
  name: (a: Asset) => a.name,
  type: (a: Asset) => typeLabels[a.type],
  status: (a: Asset) => statusLabels[a.status],
  lastMaintenance: (a: Asset) => a.lastMaintenance,
  sap: (a: Asset) => a.sapCode,
};

export function ActivosModule() {
  const { assets, assetHistory, addAsset, syncAssetsFromSAP, syncingAssets, lastAssetSync, hasPermission, pendingAssetId, clearPendingAsset } = useApp();
  const confirm = useConfirm();
  const canSync = hasPermission('activos.sap.vincular');
  const canCreateAsset = hasPermission('activos.crear');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailTab, setDetailTab] = useState<'ficha' | 'historial'>('ficha');

  // otro modulo (p. ej. Ordenes de Trabajo) puede pedir abrir un activo concreto
  useEffect(() => {
    if (!pendingAssetId) return;
    const asset = assets.find(a => a.id === pendingAssetId);
    if (asset) { setSelectedAsset(asset); setDetailTab('ficha'); }
    clearPendingAsset();
  }, [pendingAssetId, assets, clearPendingAsset]);

  const locations = useMemo(() => [...new Set(assets.map(a => a.location))], [assets]);

  const filtered = useMemo(() => {
    return assets.filter(a => {
      if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.code.toLowerCase().includes(search.toLowerCase()) && !a.plate.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType && a.type !== filterType) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      if (filterLocation && a.location !== filterLocation) return false;
      return true;
    });
  }, [assets, search, filterType, filterStatus, filterLocation]);

  const stats = useMemo(() => ({
    total: assets.length,
    operativos: assets.filter(a => a.status === 'operativo').length,
    mantenimiento: assets.filter(a => a.status === 'en_mantenimiento').length,
    fueraServicio: assets.filter(a => a.status === 'fuera_de_servicio').length,
  }), [assets]);

  const { sorted, sort, toggle } = useSort(filtered, assetSortGetters);

  if (selectedAsset) {
    // se relee del store para reflejar el resultado de una sincronizacion
    const current = assets.find(a => a.id === selectedAsset.id) ?? selectedAsset;
    const assetHistoryFiltered = assetHistory.filter(h => h.assetId === current.id);
    return (
      <AssetDetail
        asset={current}
        history={assetHistoryFiltered}
        onBack={() => { setSelectedAsset(null); setDetailTab('ficha'); }}
        detailTab={detailTab}
        setDetailTab={setDetailTab}
        onSync={async () => {
          // syncAssetsFromSAP simula la demora con setTimeout y avisa sola por notificacion al terminar
          // de verdad (no es awaitable): un toast aqui mismo saldria antes de que la sincronizacion termine.
          if (await confirm({ title: 'Sincronizar con SAP', message: '¿Estas seguro de sincronizar este activo con SAP?', confirmLabel: 'Sincronizar' })) syncAssetsFromSAP(current.id);
        }}
        syncing={syncingAssets}
        canSync={canSync}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4">
      <IndicatorCards>
        <StatCard label="Total Activos" value={stats.total} icon={<Truck size={28} />} />
        <StatCard label="Operativos" value={stats.operativos} icon={<Truck size={28} />} />
        <StatCard label="En Mantenimiento" value={stats.mantenimiento} icon={<Wrench size={28} />} />
        <StatCard label="Fuera de Servicio" value={stats.fueraServicio} icon={<Truck size={28} />} />
      </IndicatorCards>

      <div className="bg-white rounded-lg shadow-card border border-stone-200">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-stone-200">
          <div>
            <h3 className="ui-title text-content">LISTADO DE ACTIVOS</h3>
          </div>
          <div className="flex items-center gap-2">
            {canCreateAsset && (
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                <Plus size={16} /> CREAR FICHA
              </Button>
            )}
            {canSync ? (
              <Button
                onClick={async () => {
                  if (await confirm({ title: 'Sincronizar con SAP', message: '¿Estas seguro de sincronizar todos los activos con SAP?', confirmLabel: 'Sincronizar' })) syncAssetsFromSAP();
                }}
                disabled={syncingAssets}
                aria-busy={syncingAssets}
              >
                <RefreshCw size={16} className={syncingAssets ? 'animate-spin' : ''} />
                {syncingAssets ? 'Sincronizando...' : 'Sincronizar'}
              </Button>
            ) : ""}
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 bg-stone-50/50 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 text-stone-400" />
              <TextInput
                placeholder="Buscar por codigo, nombre o patente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9"
              />
          </div>
          <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full sm:w-auto">
            <option value="">TIPOS</option>
            <option value="vehiculo_ligero">VEHICULO LIGERO</option>
            <option value="vehiculo_pesado">Vehiculo Pesado</option>
            <option value="maquinaria">Maquinaria</option>
            <option value="equipo_auxiliar">Equipo Auxiliar</option>
          </Select>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full sm:w-auto">
            <option value="">Todos los estados</option>
            <option value="operativo">Operativo</option>
            <option value="en_mantenimiento">En Mantenimiento</option>
            <option value="fuera_de_servicio">Fuera de Servicio</option>
            <option value="baja">Dada de Baja</option>
          </Select>
          <Select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="w-full sm:w-auto">
            <option value="">Todas las ubicaciones</option>
            {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="Codigo" sortKey="code" sort={sort} onSort={toggle} />
                <SortableTh label="Nombre" sortKey="name" sort={sort} onSort={toggle} />
                <SortableTh label="Tipo" sortKey="type" sort={sort} onSort={toggle} className="hidden md:table-cell" />
                <SortableTh label="Estado" sortKey="status" sort={sort} onSort={toggle} />
                <SortableTh label="Ult. Mant." sortKey="lastMaintenance" sort={sort} onSort={toggle} className="hidden md:table-cell" />
                <SortableTh label="Código de SAP" sortKey="sap" sort={sort} onSort={toggle} className="hidden lg:table-cell" />
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(asset => (
                <tr key={asset.id} className="cursor-pointer" onClick={() => setSelectedAsset(asset)}>
                  <td className="text-stone-600 font-normal">{asset.code}</td>
                  <td className="text-stone-600">{asset.name}</td>
                  <td className="hidden text-stone-600 md:table-cell">{typeLabels[asset.type]}</td>
                  <td><Badge>{statusLabels[asset.status]}</Badge></td>
                  <td className="hidden text-stone-500 md:table-cell">{asset.lastMaintenance}</td>
                  <td className="hidden lg:table-cell">
                    {asset.sapCode ? (
                      <Badge><Link2 size={10} className="mr-1 inline" />{asset.sapCode}</Badge>
                    ) : (
                      <Badge>No vinculado</Badge>
                    )}
                  </td>
                  <td className="text-right">
                    <span className="text-orange-600 font-semibold hover:underline">Ver</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-8 text-stone-400 text-content">No se encontraron activos con los filtros seleccionados</div>
          )}
        </div>
      </div>

      <CreateAssetModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={addAsset}
        locations={locations}
      />
    </div>
  );
}

function AssetDetail({ asset, history, onBack, detailTab, setDetailTab, onSync, syncing, canSync }: {
  asset: Asset;
  history: { id: string; date: string; type: string; description: string; reference: string }[];
  onBack: () => void;
  detailTab: 'ficha' | 'historial';
  setDetailTab: (t: 'ficha' | 'historial') => void;
  onSync: () => void;
  syncing: boolean;
  canSync: boolean;
}) {
  return (
    <div className="p-4 sm:p-6 space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-stone-600 hover:text-orange-600 transition-colors">
        <ArrowLeft size={16} /> Volver al listado
      </button>

      <div className="bg-white rounded-lg shadow-card border border-stone-200">
        <div className="px-4 sm:px-5 py-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 text-stone-900 flex items-center justify-center flex-shrink-0">
              <Truck size={30} />
            </div>
            <div className="min-w-0">
              <h3 className="ui-title">{asset.name}</h3>
              <p className="text-sm font-normal text-stone-500">{asset.code} · {asset.plate}</p>
            </div>
          </div>
        </div>

        <div className="flex border-b border-stone-200">
          <button
            onClick={() => setDetailTab('ficha')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${detailTab === 'ficha' ? 'border-orange-500 text-orange-600' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
          >
            Ficha Tecnica
          </button>
          <button
            onClick={() => setDetailTab('historial')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${detailTab === 'historial' ? 'border-orange-500 text-orange-600' : 'border-transparent text-stone-500 hover:text-stone-700'}`}
          >
            Historial
          </button>
        </div>

        {detailTab === 'ficha' ? (
          <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
            <div className="space-y-5">
              <dl className="sap-grid grid-cols-1 sm:grid-cols-2">
                <InfoField label="Marca" value={asset.brand} />
                <InfoField label="Modelo" value={asset.model} />
                <InfoField label="Año" value={String(asset.year)} />
                <InfoField label="Patente" value={asset.plate} />
                <InfoField label="Motor" value={asset.engine} />
                <InfoField label="Chasis" value={asset.chassis} />
                <InfoField label="Kilometraje" value={asset.odometer > 0 ? asset.odometer.toLocaleString() + (asset.type === 'maquinaria' || asset.type === 'equipo_auxiliar' ? ' hrs' : ' km') : 'N/A'} />
                <InfoField label="Ubicacion" value={asset.location} />
                <InfoField label="Tipo" value={typeLabels[asset.type]} />
                <InfoField label="Fecha de Adquisicion" value={asset.acquisitionDate} />
                <InfoField label="Costo de Adquisicion" value={formatCLP(asset.acquisitionCost)} />
                <InfoField label="Ultimo Mantenimiento" value={asset.lastMaintenance} />
              </dl>

              <div className="border-t border-stone-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  {/* <h4 className="font-heading text-sm font-bold text-stone-700 flex items-center gap-2">
                    <Link2 size={16} className="text-blue-600" /> Vinculacion SAP
                  </h4> */}
                  {canSync && (
                    <Button size="sm" variant="outline" onClick={onSync} disabled={syncing}>
                      <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                      {syncing ? 'Sincronizando...' : 'Sincronizar'}
                    </Button>
                  )}
                </div>
                <dl className="sap-grid grid-cols-1 sm:grid-cols-2">
                  <InfoField label="Codigo SAP" value={asset.sapCode ?? 'No vinculado'} />
                  <div className="sap-cell">
                    <dt>Estado de sincronizacion:</dt>
                    <dd>
                      {asset.sapSynced ? (
                        <Badge variant="green"><Link2 size={10} className="mr-1 inline" /> Sincronizado</Badge>
                      ) : (
                        <Badge variant="orange">Pendiente</Badge>
                      )}
                    </dd>
                  </div>
                  <InfoField label="Ultima Sincronizacion" value={formatDateTime(asset.lastSyncAt)} />
                </dl>
              </div>
            </div>

            <div>
              <AssetPhotoGallery asset={asset} />
            </div>
          </div>
        ) : (
          <div className="p-5">
            {history.length === 0 ? (
              <div className="text-center py-8 text-stone-400 text-content">Sin historial registrado</div>
            ) : (
              <div className="relative pl-8 space-y-4 before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-stone-200">
                {history.map(entry => {
                  const icon = entry.type === 'ot' ? <Wrench size={16} /> : entry.type === 'movimiento' ? <Package size={16} /> : <Fuel size={16} />;
                  return (
                    <div key={entry.id} className="relative">
                      <div className="absolute -left-[22px] top-0.5 w-6 h-6 rounded-full flex items-center justify-center bg-white text-stone-900">
                        {icon}
                      </div>
                      <div className="bg-stone-50 rounded-lg p-3 border border-stone-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-content font-bold text-stone-700">{entry.reference}</span>
                          <span className="text-content text-stone-400">{entry.date}</span>
                        </div>
                        <p className="text-content text-stone-600">{entry.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Fotografias del estado actual del activo, en un carrusel: todas se ven al mismo tamano, una a la vez. */
function AssetPhotoGallery({ asset }: { asset: Asset }) {
  const { addAssetPhoto, removeAssetPhoto, hasPermission } = useApp();
  const confirm = useConfirm();
  const toast = useToast();
  const canEdit = hasPermission('activos.fotos.gestionar');
  const [busy, setBusy] = useState(false);

  const handleAddFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      try {
        const dataUrl = await fileToCompressedDataUrl(file);
        addAssetPhoto(asset.id, { dataUrl, name: file.name });
      } catch {
        // archivo invalido: se omite
      }
    }
    setBusy(false);
  };

  const handleRemove = async (photo: AssetPhoto) => {
    if (await confirm({ title: 'Eliminar fotografia', message: '¿Estas seguro de eliminar esta fotografia?', confirmLabel: 'Eliminar', variant: 'danger' })) {
      removeAssetPhoto(asset.id, photo.id);
      toast({ message: 'Fotografia eliminada', variant: 'info' });
    }
  };

  return (
    <PhotoCarousel
      photos={asset.photos}
      canEdit={canEdit}
      busy={busy}
      onAddFiles={files => { void handleAddFiles(files); }}
      onRemove={photo => { void handleRemove(photo); }}
    />
  );
}

/** Dato de la ficha: etiqueta en negrita y valor en peso normal (formato de ficha, como SAP) */
function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <>
      <div className="sap-cell">
        <dt>{label}:</dt>
        <dd>{value}</dd>
      </div>
    </>
  );
}

function CreateAssetModal({ open, onClose, onCreate, locations }: {
  open: boolean;
  onClose: () => void;
  onCreate: (a: Omit<Asset, 'id'>) => void;
  locations: string[];
}) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    type: 'vehiculo_ligero' as AssetType,
    location: '',
    status: 'operativo' as AssetStatus,
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    plate: '',
    engine: '',
    chassis: '',
    odometer: 0,
    acquisitionDate: new Date().toISOString().slice(0, 10),
    acquisitionCost: 0,
  });
  const confirm = useConfirm();
  const toast = useToast();

  const handleSubmit = async () => {
    if (!form.code || !form.name) return;
    if (!(await confirm({ title: 'Crear activo', message: '¿Estas seguro de crear la ficha de este vehiculo?', confirmLabel: 'Crear ficha' }))) return;
    onCreate({
      ...form,
      lastMaintenance: new Date().toISOString().slice(0, 10),
      sapCode: null,
      sapSynced: false,
      lastSyncAt: null,
      photos: [],
    });
    toast(`${form.name} creado correctamente`);
    onClose();
    setForm({ ...form, code: '', name: '', brand: '', model: '', plate: '', engine: '', chassis: '' });
  };

  return (
    <Modal open={open} onClose={onClose} title="Crear Ficha de Vehiculo" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Codigo *">
            <TextInput value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="ACT-XXX" />
          </Field>
          <Field label="Nombre *">
            <TextInput value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Camion Ford F-350" />
          </Field>
          <Field label="Tipo">
            <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as AssetType })}>
              <option value="vehiculo_ligero">Vehiculo Ligero</option>
              <option value="vehiculo_pesado">Vehiculo Pesado</option>
              <option value="maquinaria">Maquinaria</option>
              <option value="equipo_auxiliar">Equipo Auxiliar</option>
            </Select>
          </Field>
          <Field label="Ubicacion">
            <Select value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}>
              <option value=""> --- Seleccionar ---</option>
              {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              <option value="Nueva">Otra (especificar en notas)</option>
            </Select>
          </Field>
          <Field label="Marca">
            <TextInput value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
          </Field>
          <Field label="Modelo">
            <TextInput value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
          </Field>
          <Field label="Año">
            <TextInput type="number" value={form.year} onChange={e => setForm({ ...form, year: Number(e.target.value) })} />
          </Field>
          <Field label="Patente">
            <TextInput value={form.plate} onChange={e => setForm({ ...form, plate: e.target.value })} />
          </Field>
          <Field label="Motor">
            <TextInput value={form.engine} onChange={e => setForm({ ...form, engine: e.target.value })} />
          </Field>
          <Field label="Chasis">
            <TextInput value={form.chassis} onChange={e => setForm({ ...form, chassis: e.target.value })} />
          </Field>
          <Field label="Kilometraje">
            <TextInput type="number" value={form.odometer} onChange={e => setForm({ ...form, odometer: Number(e.target.value) })} />
          </Field>
          <Field label="Costo de Adquisicion">
            <TextInput type="number" value={form.acquisitionCost} onChange={e => setForm({ ...form, acquisitionCost: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}><Plus size={16} /> Crear Activo</Button>
        </div>
      </div>
    </Modal>
  );
}

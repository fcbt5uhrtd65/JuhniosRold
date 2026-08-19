import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Beaker,
  Filter,
  FlaskConical,
  Loader2,
  PackageCheck,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import { getPublicRawMaterials, type PublicRawMaterial } from '../services/inventory-masters.service';
import { navigateBack } from '../services/navigate';
import { NavigationBar } from './NavigationBar';
import { Footer } from './Footer';
import { WhatsAppButton } from './WhatsAppButton';

type CostFilter = 'all' | 'low' | 'mid' | 'high';
type SortKey = 'name' | 'code' | 'cost';

function normalize(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' }));
}

function formatCost(value: number): string {
  if (value <= 0) return 'Consultar';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

function costMatches(item: PublicRawMaterial, filter: CostFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'low') return item.cost > 0 && item.cost < 10000;
  if (filter === 'mid') return item.cost >= 10000 && item.cost < 50000;
  return item.cost >= 50000;
}

export function RawMaterialsPage({ onLoginClick }: { onLoginClick: () => void }) {
  const [items, setItems] = useState<PublicRawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [costFilter, setCostFilter] = useState<CostFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErrorMessage(null);
    getPublicRawMaterials()
      .then((materials) => {
        if (mounted) setItems(materials);
      })
      .catch((error) => {
        if (mounted) setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar las materias primas.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const typeOptions = useMemo(() => uniqueSorted(items.map((item) => item.itemTypeName)), [items]);
  const groupOptions = useMemo(() => uniqueSorted(items.map((item) => item.itemGroupName)), [items]);
  const supplierOptions = useMemo(() => uniqueSorted(items.map((item) => item.supplierName)), [items]);
  const unitOptions = useMemo(() => uniqueSorted(items.map((item) => item.unitAbbreviation || item.unitName)), [items]);

  const filteredItems = useMemo(() => {
    const query = normalize(search);
    return items
      .filter((item) => {
        const searchable = normalize(`${item.code} ${item.name} ${item.description} ${item.itemTypeName} ${item.itemGroupName} ${item.supplierName} ${item.unitName}`);
        const unitLabel = item.unitAbbreviation || item.unitName;
        const matchesSearch = !query || searchable.includes(query);
        const matchesType = typeFilter === 'all' || item.itemTypeName === typeFilter;
        const matchesGroup = groupFilter === 'all' || item.itemGroupName === groupFilter;
        const matchesSupplier = supplierFilter === 'all' || item.supplierName === supplierFilter;
        const matchesUnit = unitFilter === 'all' || unitLabel === unitFilter;
        const matchesBatch = batchFilter === 'all' || (batchFilter === 'batch' ? item.tracksBatches : !item.tracksBatches);
        return matchesSearch && matchesType && matchesGroup && matchesSupplier && matchesUnit && matchesBatch && costMatches(item, costFilter);
      })
      .sort((left, right) => {
        if (sortKey === 'cost') return right.cost - left.cost;
        const leftValue = sortKey === 'code' ? left.code : left.name;
        const rightValue = sortKey === 'code' ? right.code : right.name;
        return leftValue.localeCompare(rightValue, 'es', { numeric: true, sensitivity: 'base' });
      });
  }, [batchFilter, costFilter, groupFilter, items, search, sortKey, supplierFilter, typeFilter, unitFilter]);

  const activeFilters = [search, typeFilter !== 'all', groupFilter !== 'all', supplierFilter !== 'all', unitFilter !== 'all', batchFilter !== 'all', costFilter !== 'all'].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setGroupFilter('all');
    setSupplierFilter('all');
    setUnitFilter('all');
    setBatchFilter('all');
    setCostFilter('all');
    setSortKey('name');
  };

  return (
    <div className="min-h-screen bg-[#F7F5F1] text-stone-950">
      <NavigationBar variant="solid" onLoginClick={onLoginClick} />
      <main className="px-4 pb-12 pt-24 md:px-8 lg:px-14">
        <section className="mx-auto max-w-7xl">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigateBack('/')}
                className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500 transition-colors hover:text-stone-950"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Inicio
              </button>
              <div>
                <h1 className="text-2xl font-semibold leading-tight text-stone-950 md:text-3xl">Materias primas</h1>
                <p className="mt-1 max-w-2xl text-sm text-stone-600">
                  Insumos, fragancias, colorantes y extractos administrados desde el panel interno.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-stone-200 bg-white p-2 shadow-sm">
              <div className="px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Total</p>
                <p className="text-lg font-semibold text-stone-950">{items.length}</p>
              </div>
              <div className="px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Filtradas</p>
                <p className="text-lg font-semibold text-stone-950">{filteredItems.length}</p>
              </div>
              <div className="px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Con lote</p>
                <p className="text-lg font-semibold text-stone-950">{items.filter((item) => item.tracksBatches).length}</p>
              </div>
            </div>
          </div>

          <div className="mb-5 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-8">
              <div className="relative xl:col-span-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" strokeWidth={1.7} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar materia prima..."
                  className="h-11 w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
                />
              </div>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="all">Todos los tipos</option>
                {typeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="all">Todos los grupos</option>
                {groupOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="all">Todos los proveedores</option>
                {supplierOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="all">Todas las unidades</option>
                {unitOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={batchFilter} onChange={(event) => setBatchFilter(event.target.value)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="all">Todos los controles</option>
                <option value="batch">Maneja lote</option>
                <option value="no-batch">Sin lote</option>
              </select>
              <select value={costFilter} onChange={(event) => setCostFilter(event.target.value as CostFilter)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="all">Todos los costos</option>
                <option value="low">Menos de $10.000</option>
                <option value="mid">$10.000 a $49.999</option>
                <option value="high">$50.000 o mas</option>
              </select>
              <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="name">Ordenar por nombre</option>
                <option value="code">Ordenar por codigo</option>
                <option value="cost">Ordenar por costo</option>
              </select>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500">
                <Filter className="h-3.5 w-3.5" />
                {activeFilters ? `${activeFilters} filtro(s) activo(s)` : 'Sin filtros activos'}
              </p>
              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-stone-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-500">
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.8} />
                Cargando materias primas...
              </div>
            </div>
          ) : errorMessage ? (
            <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
              <div>
                <p className="font-semibold">No pudimos cargar las materias primas.</p>
                <p className="mt-1 text-red-800">{errorMessage}</p>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white px-5 py-12 text-center shadow-sm">
              <SlidersHorizontal className="mx-auto mb-3 h-8 w-8 text-stone-300" strokeWidth={1.6} />
              <p className="text-sm font-semibold text-stone-900">No hay materias primas con esos filtros.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => (
                <article key={item.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#eef4f1] text-[#2a4038]">
                        <Beaker className="h-5 w-5" strokeWidth={1.7} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="line-clamp-2 text-sm font-semibold text-stone-950">{item.name}</h2>
                        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{item.code}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-semibold text-stone-600">
                      {item.unitAbbreviation || item.unitName}
                    </span>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[#eef4f1] px-2.5 py-1 text-[10px] font-semibold text-[#2a4038]">{item.itemTypeName}</span>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-semibold text-stone-600">{item.itemGroupName}</span>
                    {item.tracksBatches && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                        <PackageCheck className="h-3 w-3" />
                        Lote
                      </span>
                    )}
                  </div>
                  {item.description && <p className="mb-4 line-clamp-3 text-sm leading-6 text-stone-600">{item.description}</p>}
                  <div className="grid grid-cols-2 gap-2 border-t border-stone-100 pt-3 text-xs">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Costo ref.</p>
                      <p className="mt-0.5 font-semibold text-stone-900">{formatCost(item.cost)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Proveedor</p>
                      <p className="mt-0.5 truncate font-medium text-stone-700">{item.supplierName ?? 'Sin proveedor'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Minimo</p>
                      <p className="mt-0.5 font-medium text-stone-700">{item.minimumQuantity}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Maximo</p>
                      <p className="mt-0.5 font-medium text-stone-700">{item.maximumQuantity}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-[#2a4038]/15 bg-[#eef4f1] px-4 py-4 text-sm text-[#2a4038]">
            <div className="flex items-start gap-3">
              <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
              <p>
                Este listado se alimenta desde Admin &gt; Materias primas. Los productos comerciales siguen separados en la pagina de Productos.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

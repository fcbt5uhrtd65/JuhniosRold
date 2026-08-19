import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Beaker,
  CheckCircle,
  FlaskConical,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import { getPublicRawMaterials, type PublicRawMaterial } from '../services/inventory-masters.service';
import { navigateBack } from '../services/navigate';
import { openWhatsApp } from '../utils/whatsapp';
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

function unitText(item: PublicRawMaterial): string {
  return (item.unitAbbreviation || item.unitName || 'unidad').toLowerCase();
}

function presentationText(item: PublicRawMaterial): string {
  const unit = unitText(item);
  return unit.includes('kg') || unit.includes('kilo')
    ? 'Presentacion: 1 kg'
    : unit.includes('g')
      ? 'Presentacion: 100 g'
      : unit.includes('l')
        ? 'Presentacion: 1 L'
        : 'Presentacion: 1 und';
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
  const [selectedItem, setSelectedItem] = useState<PublicRawMaterial | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<Record<string, number>>({});

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

  const getQuantity = (id: string) => quantities[id] ?? 1;
  const setQuantity = (id: string, value: number) => {
    setQuantities((current) => ({ ...current, [id]: Math.max(1, value) }));
  };
  const addToCart = (item: PublicRawMaterial) => {
    const quantity = getQuantity(item.id);
    setCart((current) => ({ ...current, [item.id]: (current[item.id] ?? 0) + quantity }));
  };
  const cartCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const cartItems = useMemo(
    () => Object.entries(cart)
      .map(([id, quantity]) => ({ item: items.find((material) => material.id === id), quantity }))
      .filter((entry): entry is { item: PublicRawMaterial; quantity: number } => Boolean(entry.item)),
    [cart, items],
  );
  const requestQuote = () => {
    if (cartItems.length === 0) return;
    const lines = cartItems.map(({ item, quantity }) => `- ${item.name} (${presentationText(item)}) x ${quantity}`);
    openWhatsApp([
      'Hola, quiero cotizar estas materias primas:',
      ...lines,
    ].join('\n'));
  };

  return (
    <div className="min-h-screen bg-[#F7F5F1] text-stone-950">
      <NavigationBar variant="solid" onLoginClick={onLoginClick} />
      <main className="px-4 pb-12 pt-24 md:px-8 lg:px-14">
        <section className="mx-auto max-w-7xl">
          <div className="mb-8 space-y-5">
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => navigateBack('/')}
                className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500 transition-colors hover:text-stone-950"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Inicio
              </button>
              <div>
                <h1 className="font-serif text-4xl font-semibold leading-tight text-[#17351f] md:text-5xl">Materias primas</h1>
                <p className="mt-2 max-w-2xl text-base text-stone-600">Insumos profesionales para tus formulas.</p>
              </div>
              <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-[#1f4b24] px-4 py-2 text-sm font-medium text-white shadow-sm">
                <FlaskConical className="h-4 w-4" strokeWidth={1.7} />
                <span>Compra por unidad o por volumen</span>
                <span className="hidden h-1 w-1 rounded-full bg-white/70 sm:block" />
                <span>Envios a toda Colombia</span>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(260px,2fr)_repeat(4,minmax(150px,0.85fr))_auto]">
              <div className="relative sm:col-span-2 lg:col-span-4 xl:col-span-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" strokeWidth={1.7} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar materia prima..."
                  className="h-11 w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
                />
              </div>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="all">Categoria</option>
                {typeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="all">Uso</option>
                {groupOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="all">Presentacion</option>
                {unitOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={batchFilter} onChange={(event) => setBatchFilter(event.target.value)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="all">Disponibilidad</option>
                <option value="batch">Maneja lote</option>
                <option value="no-batch">Sin lote</option>
              </select>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold text-stone-600 transition-colors hover:bg-white sm:col-span-2 lg:col-span-4 xl:col-span-1"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar filtros
              </button>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-serif text-xl font-semibold text-[#17351f]">
                {filteredItems.length} <span className="font-sans text-sm font-normal text-stone-600">materias primas</span>
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-stone-500">Ordenar por:</span>
                <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                  <option value="name">Mas relevantes</option>
                  <option value="code">Codigo</option>
                  <option value="cost">Mayor precio</option>
                </select>
              </div>
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
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filteredItems.map((item) => (
                <article
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedItem(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedItem(item);
                    }
                  }}
                  className="grid cursor-pointer gap-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#1f4b24]/20 sm:grid-cols-[minmax(140px,38%)_minmax(0,1fr)] md:grid-cols-1 lg:grid-cols-[minmax(160px,40%)_minmax(0,1fr)] 2xl:grid-cols-1"
                >
                  <div className="flex aspect-[4/3] min-h-[180px] items-center justify-center overflow-hidden rounded-lg bg-[#f5f4ef] sm:min-h-0">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain p-2" />
                    ) : (
                      <div className="text-center text-[#1f4b24]/35">
                        <Beaker className="mx-auto mb-2 h-12 w-12" strokeWidth={1.4} />
                        <p className="text-[11px] font-semibold uppercase tracking-wider">Materia prima</p>
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <div className="min-w-0">
                      <h2 className="font-serif text-xl font-semibold leading-tight text-[#17351f] line-clamp-2">{item.name}</h2>
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-green-600">
                        <span className="h-2 w-2 rounded-full bg-green-500" />
                        Disponible
                      </p>
                    </div>
                    <div className="my-4 h-px bg-stone-100" />
                    <div>
                      <p className="text-sm text-stone-500">Precio por {unitText(item)}</p>
                      <p className="font-serif text-3xl font-semibold leading-tight text-[#17351f]">{formatCost(item.cost)}</p>
                      <span className="mt-3 inline-flex rounded-full bg-[#edf2ec] px-4 py-1.5 text-xs font-medium text-[#1f4b24]">
                        {presentationText(item)}
                      </span>
                    </div>
                    <div className="mt-auto grid gap-3 pt-5 sm:grid-cols-[132px_minmax(0,1fr)] md:grid-cols-1 lg:grid-cols-[132px_minmax(0,1fr)] 2xl:grid-cols-1">
                      <div
                        className="grid h-11 min-w-[132px] grid-cols-3 overflow-hidden rounded-lg border border-stone-200 bg-white text-[#17351f]"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button type="button" onClick={() => setQuantity(item.id, getQuantity(item.id) - 1)} className="flex items-center justify-center hover:bg-stone-50">
                          <Minus className="h-4 w-4" />
                        </button>
                        <div className="flex items-center justify-center border-x border-stone-200 font-serif text-lg font-semibold">{getQuantity(item.id)}</div>
                        <button type="button" onClick={() => setQuantity(item.id, getQuantity(item.id) + 1)} className="flex items-center justify-center hover:bg-stone-50">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          addToCart(item);
                        }}
                        className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-lg bg-[#1f4b24] px-3 text-sm font-semibold leading-tight text-white shadow-sm transition-colors hover:bg-[#17351f]"
                      >
                        <ShoppingCart className="h-4 w-4" strokeWidth={1.8} />
                        <span>Agregar</span>
                      </button>
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

          {selectedItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={() => setSelectedItem(null)} />
              <div className="relative grid max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl md:grid-cols-[42%_1fr]">
                <div className="flex min-h-[340px] items-center justify-center bg-[#f5f4ef] p-6">
                  {selectedItem.imageUrl ? (
                    <img src={selectedItem.imageUrl} alt={selectedItem.name} className="max-h-[420px] w-full object-contain" />
                  ) : (
                    <Beaker className="h-24 w-24 text-[#1f4b24]/25" strokeWidth={1.4} />
                  )}
                </div>
                <div className="overflow-y-auto p-6">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="absolute right-4 top-4 rounded-full border border-stone-200 bg-white p-2 text-stone-500 shadow-sm hover:bg-stone-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{selectedItem.code}</p>
                  <h2 className="font-serif text-3xl font-semibold leading-tight text-[#17351f]">{selectedItem.name}</h2>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Disponible
                  </p>
                  <div className="my-5 h-px bg-stone-100" />
                  <p className="text-sm text-stone-500">Precio por {unitText(selectedItem)}</p>
                  <p className="mt-1 font-serif text-4xl font-semibold text-[#17351f]">{formatCost(selectedItem.cost)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#edf2ec] px-3 py-1.5 text-xs font-semibold text-[#1f4b24]">{presentationText(selectedItem)}</span>
                    <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">{selectedItem.itemTypeName}</span>
                    <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">{selectedItem.itemGroupName}</span>
                    {selectedItem.tracksBatches && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">Maneja lote</span>}
                  </div>
                  {selectedItem.description && (
                    <p className="mt-5 text-sm leading-7 text-stone-600">{selectedItem.description}</p>
                  )}
                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-stone-100 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Proveedor</p>
                      <p className="mt-1 font-medium text-stone-800">{selectedItem.supplierName ?? 'Sin proveedor'}</p>
                    </div>
                    <div className="rounded-xl border border-stone-100 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Unidad</p>
                      <p className="mt-1 font-medium text-stone-800">{selectedItem.unitName}</p>
                    </div>
                    <div className="rounded-xl border border-stone-100 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Stock minimo</p>
                      <p className="mt-1 font-medium text-stone-800">{selectedItem.minimumQuantity}</p>
                    </div>
                    <div className="rounded-xl border border-stone-100 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">Stock maximo</p>
                      <p className="mt-1 font-medium text-stone-800">{selectedItem.maximumQuantity}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      addToCart(selectedItem);
                      setSelectedItem(null);
                    }}
                    className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1f4b24] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#17351f]"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Agregar al carrito
                  </button>
                </div>
              </div>
            </div>
          )}

          {showCart && (
            <div className="fixed inset-0 z-50 flex justify-end">
              <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={() => setShowCart(false)} />
              <aside className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
                  <div>
                    <p className="font-serif text-2xl font-semibold text-[#17351f]">Tu compra</p>
                    <p className="text-sm text-stone-500">{cartCount} producto{cartCount === 1 ? '' : 's'}</p>
                  </div>
                  <button type="button" onClick={() => setShowCart(false)} className="rounded-full border border-stone-200 p-2 text-stone-500 hover:bg-stone-50">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  {cartItems.length === 0 ? (
                    <div className="rounded-xl border border-stone-100 px-4 py-10 text-center text-sm text-stone-500">
                      No has agregado materias primas todavia.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cartItems.map(({ item, quantity }) => (
                        <div key={item.id} className="grid grid-cols-[64px_1fr_auto] gap-3 rounded-xl border border-stone-100 p-3">
                          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-[#f5f4ef]">
                            {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="h-full w-full object-contain p-1" /> : <Beaker className="h-6 w-6 text-[#1f4b24]/30" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-stone-900">{item.name}</p>
                            <p className="mt-1 text-xs text-stone-500">{formatCost(item.cost)} / {unitText(item)}</p>
                            <p className="mt-1 text-xs text-stone-400">{presentationText(item)}</p>
                          </div>
                          <p className="font-serif text-lg font-semibold text-[#17351f]">x{quantity}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border-t border-stone-100 p-5">
                  <button type="button" onClick={requestQuote} disabled={cartItems.length === 0} className="h-12 w-full rounded-lg bg-[#1f4b24] text-sm font-semibold text-white hover:bg-[#17351f] disabled:cursor-not-allowed disabled:bg-stone-300">
                    Solicitar cotizacion
                  </button>
                </div>
              </aside>
            </div>
          )}
        </section>
      </main>
      {cartCount > 0 && (
        <button
          type="button"
          onClick={() => setShowCart(true)}
          className="fixed bottom-20 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center justify-between rounded-xl border border-[#1f4b24]/20 bg-white px-4 py-3 text-left shadow-xl shadow-stone-900/10 transition-transform hover:-translate-x-1/2 hover:-translate-y-0.5 sm:bottom-6 sm:left-auto sm:right-24 sm:w-80 sm:translate-x-0 sm:hover:translate-x-0"
        >
          <span>
            <span className="block text-sm font-semibold text-[#17351f]">Cotizacion de materias primas</span>
            <span className="block text-xs text-stone-500">{cartCount} producto{cartCount === 1 ? '' : 's'} agregado{cartCount === 1 ? '' : 's'}</span>
          </span>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#1f4b24] text-white">
            <ShoppingCart className="h-4 w-4" strokeWidth={1.8} />
          </span>
        </button>
      )}
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

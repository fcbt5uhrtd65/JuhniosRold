import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Beaker,
  CheckCircle,
  FlaskConical,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import { getPublicRawMaterials, type PublicRawMaterial } from '../services/inventory-masters.service';
import { navigateBack } from '../services/navigate';
import { openWhatsApp } from '../utils/whatsapp';
import { Footer } from './Footer';
import { NavigationBar } from './NavigationBar';
import { WhatsAppButton } from './WhatsAppButton';

type PriceFilter = 'all' | 'low' | 'mid' | 'high';
type SortKey = 'name' | 'price' | 'recent';

function normalize(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatPrice(value: number | null | undefined): string {
  if (!value || value <= 0) return 'Consultar';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

function unitLabel(material: PublicRawMaterial): string {
  return material.unitAbbreviation || material.unitName || 'unidad';
}

function groupLabel(material: PublicRawMaterial): string {
  return material.itemGroupName || material.itemTypeName || 'Materia prima';
}

function matchesPrice(material: PublicRawMaterial, filter: PriceFilter): boolean {
  if (filter === 'all') return true;
  const price = material.cost;
  if (filter === 'low') return price > 0 && price < 25000;
  if (filter === 'mid') return price >= 25000 && price < 100000;
  return price >= 100000;
}

function contactForMaterial(material: PublicRawMaterial): void {
  openWhatsApp(
    [
      'Hola, quiero comprar materia prima.',
      `Producto: ${material.name}`,
      `Codigo: ${material.code || 'sin codigo'}`,
      `Unidad: ${unitLabel(material)}`,
    ].join('\n'),
  );
}

export function RawMaterialsPage({ onLoginClick }: { onLoginClick: () => void }) {
  const [materials, setMaterials] = useState<PublicRawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [selectedMaterial, setSelectedMaterial] = useState<PublicRawMaterial | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErrorMessage(null);
    getPublicRawMaterials()
      .then(nextMaterials => {
        if (mounted) setMaterials(nextMaterials);
      })
      .catch(error => {
        if (mounted) {
          setErrorMessage(error instanceof Error ? error.message : 'No pudimos cargar la informacion.');
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const groupOptions = useMemo(() => (
    [...new Set(materials.map(groupLabel).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' }))
  ), [materials]);

  const unitOptions = useMemo(() => (
    [...new Set(materials.map(unitLabel).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' }))
  ), [materials]);

  const filteredMaterials = useMemo(() => {
    const query = normalize(search);
    return materials
      .filter(material => {
        const text = normalize([
          material.code,
          material.name,
          material.description,
          material.itemTypeName,
          material.itemGroupName,
          material.unitName,
          material.unitAbbreviation,
        ].join(' '));
        const matchesSearch = !query || text.includes(query);
        const matchesGroup = groupFilter === 'all' || groupLabel(material) === groupFilter;
        const matchesUnit = unitFilter === 'all' || unitLabel(material) === unitFilter;
        return matchesSearch && matchesGroup && matchesUnit && matchesPrice(material, priceFilter);
      })
      .sort((left, right) => {
        if (sortKey === 'price') return left.cost - right.cost;
        if (sortKey === 'recent') return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        return left.name.localeCompare(right.name, 'es', { numeric: true, sensitivity: 'base' });
      });
  }, [groupFilter, materials, priceFilter, search, sortKey, unitFilter]);

  const clearFilters = () => {
    setSearch('');
    setGroupFilter('all');
    setUnitFilter('all');
    setPriceFilter('all');
    setSortKey('name');
  };

  const activeFilters = [search, groupFilter !== 'all', unitFilter !== 'all', priceFilter !== 'all'].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-[#F7F5F1] text-stone-950">
      <NavigationBar variant="solid" onLoginClick={onLoginClick} />
      <main className="px-4 pb-12 pt-24 md:px-8 lg:px-14">
        <section className="mx-auto max-w-7xl">
          <div className="mb-8 space-y-5">
            <button
              type="button"
              onClick={() => navigateBack('/')}
              className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500 transition-colors hover:text-stone-950"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Inicio
            </button>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <h1 className="font-serif text-4xl font-semibold leading-tight text-[#17351f] md:text-5xl">Materias primas</h1>
                <p className="mt-2 max-w-2xl text-base text-stone-600">
                  Insumos profesionales para fabricacion cosmetica, cuidado personal y desarrollo de formulas.
                </p>
              </div>
              <div className="inline-flex w-fit flex-wrap items-center gap-2 rounded-full bg-[#1f4b24] px-4 py-2 text-sm font-medium text-white shadow-sm">
                <FlaskConical className="h-4 w-4" strokeWidth={1.7} />
                <span>Venta por unidad o volumen</span>
                <span className="hidden h-1 w-1 rounded-full bg-white/70 sm:block" />
                <span>Envios a toda Colombia</span>
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(260px,2fr)_repeat(3,minmax(150px,1fr))_auto]">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" strokeWidth={1.7} />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Buscar materia prima..."
                  className="h-11 w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
                />
              </div>
              <select value={groupFilter} onChange={event => setGroupFilter(event.target.value)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="all">Categoria</option>
                {groupOptions.map(group => <option key={group} value={group}>{group}</option>)}
              </select>
              <select value={unitFilter} onChange={event => setUnitFilter(event.target.value)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="all">Unidad</option>
                {unitOptions.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              </select>
              <select value={priceFilter} onChange={event => setPriceFilter(event.target.value as PriceFilter)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="all">Precio</option>
                <option value="low">Menos de $25k</option>
                <option value="mid">$25k a $100k</option>
                <option value="high">Mas de $100k</option>
              </select>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold text-stone-600 transition-colors hover:bg-white sm:col-span-2 lg:col-span-1"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar filtros
              </button>
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-serif text-xl font-semibold text-[#17351f]">
                {filteredMaterials.length} <span className="font-sans text-sm font-normal text-stone-600">materias primas</span>
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-stone-500">Ordenar por:</span>
                <select value={sortKey} onChange={event => setSortKey(event.target.value as SortKey)} className="h-10 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                  <option value="name">Mas relevantes</option>
                  <option value="price">Menor precio</option>
                  <option value="recent">Recientes</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-stone-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-500">
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.8} />
                Cargando materias primas...
              </div>
            </div>
          ) : errorMessage ? (
            <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
              <div>
                <p className="font-semibold">No pudimos cargar las materias primas.</p>
                <p className="mt-1 text-red-800">{errorMessage}</p>
              </div>
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="rounded-lg border border-stone-200 bg-white px-5 py-12 text-center shadow-sm">
              <SlidersHorizontal className="mx-auto mb-3 h-8 w-8 text-stone-300" strokeWidth={1.6} />
              <p className="text-sm font-semibold text-stone-900">No encontramos resultados con esos filtros.</p>
              <p className="mt-2 text-sm text-stone-500">Prueba otra busqueda o limpia los filtros.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredMaterials.map(material => (
                <article
                  key={material.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedMaterial(material)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedMaterial(material);
                    }
                  }}
                  className="flex min-h-[430px] cursor-pointer flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#1f4b24]/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#1f4b24]/20"
                >
                  <div className="flex aspect-[4/3] items-center justify-center bg-[#f3f1ec]">
                    {material.imageUrl ? (
                      <img src={material.imageUrl} alt={material.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-center text-[#1f4b24]/35">
                        <Beaker className="mx-auto mb-2 h-10 w-10" strokeWidth={1.4} />
                        <p className="text-[10px] font-semibold uppercase tracking-wider">Materia prima</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-stone-400">{groupLabel(material)}</p>
                        <h2 className="mt-1 min-h-[3.2rem] font-serif text-xl font-semibold leading-tight text-[#17351f] line-clamp-2">{material.name}</h2>
                      </div>
                      <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                        <CheckCircle className="h-3 w-3" />
                        Disponible
                      </span>
                    </div>

                    <div className="my-4 h-px bg-stone-100" />

                    <div className="grid gap-3">
                      <div>
                        <p className="text-xs text-stone-500">Precio por {unitLabel(material)}</p>
                        <p className="mt-1 font-serif text-3xl font-semibold leading-none text-[#17351f]">{formatPrice(material.cost)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#eef4ee] px-3 py-1.5 text-xs font-semibold text-[#1f4b24]">
                          Unidad: {unitLabel(material)}
                        </span>
                        {material.tracksBatches && (
                          <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600">
                            Por lote
                          </span>
                        )}
                      </div>
                    </div>

                    {material.description && (
                      <p className="mt-4 line-clamp-2 text-sm leading-6 text-stone-500">{material.description}</p>
                    )}

                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        contactForMaterial(material);
                      }}
                      className="mt-auto inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#1f4b24] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#17351f]"
                    >
                      Solicitar informacion
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {activeFilters > 0 && (
            <p className="mt-4 text-xs font-medium text-stone-500">{activeFilters} filtro(s) activo(s)</p>
          )}

          {selectedMaterial && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={() => setSelectedMaterial(null)} />
              <div className="relative grid max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-2xl md:grid-cols-[42%_1fr]">
                <div className="flex min-h-[320px] items-center justify-center bg-[#f3f1ec] p-6">
                  {selectedMaterial.imageUrl ? (
                    <img src={selectedMaterial.imageUrl} alt={selectedMaterial.name} className="max-h-[420px] w-full object-contain" />
                  ) : (
                    <Beaker className="h-24 w-24 text-[#1f4b24]/25" strokeWidth={1.4} />
                  )}
                </div>
                <div className="overflow-y-auto p-6">
                  <button
                    type="button"
                    onClick={() => setSelectedMaterial(null)}
                    className="absolute right-4 top-4 rounded-full border border-stone-200 bg-white p-2 text-stone-500 shadow-sm hover:bg-stone-50"
                    aria-label="Cerrar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{groupLabel(selectedMaterial)}</p>
                  <h2 className="font-serif text-3xl font-semibold leading-tight text-[#17351f]">{selectedMaterial.name}</h2>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Disponible
                  </p>
                  <div className="my-5 h-px bg-stone-100" />
                  <p className="text-sm text-stone-500">Precio por {unitLabel(selectedMaterial)}</p>
                  <p className="mt-1 font-serif text-4xl font-semibold text-[#17351f]">{formatPrice(selectedMaterial.cost)}</p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Unidad</p>
                      <p className="mt-1 text-sm font-semibold text-stone-800">{unitLabel(selectedMaterial)}</p>
                    </div>
                    <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">Codigo</p>
                      <p className="mt-1 text-sm font-semibold text-stone-800">{selectedMaterial.code || 'Disponible'}</p>
                    </div>
                  </div>
                  {selectedMaterial.description && (
                    <p className="mt-5 text-sm leading-7 text-stone-600">{selectedMaterial.description}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => contactForMaterial(selectedMaterial)}
                    className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#1f4b24] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#17351f]"
                  >
                    Solicitar informacion
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

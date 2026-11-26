import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Beaker,
  Eye,
  Grid,
  List,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import { useCart } from '../contexts/CartContext';
import { useToast } from '../contexts/ToastContext';
import { useUser } from '../contexts/UserContext';
import { getPublicRawMaterials, type PublicRawMaterial } from '../services/inventory-masters.service';
import { navigateBack } from '../services/navigate';
import { Footer } from './Footer';
import { NavigationBar } from './NavigationBar';
import { WhatsAppButton } from './WhatsAppButton';

type PriceFilter = 'all' | 'low' | 'mid' | 'high';
type SortKey = 'name' | 'price' | 'recent';
type ViewMode = 'grid' | 'list';

// Mismo color y lenguaje visual que el catálogo de productos (ProductCatalog).
const OLIVE = '#2D3A1F';

function normalize(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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
  const price = material.price;
  if (filter === 'low') return price > 0 && price < 25000;
  if (filter === 'mid') return price >= 25000 && price < 100000;
  return price >= 100000;
}

function isOutOfStock(material: PublicRawMaterial): boolean {
  return material.availableQuantity !== null && material.availableQuantity <= 0;
}

function pillCls(active: boolean): string {
  return `px-3.5 py-1.5 text-[11px] border rounded-lg transition-all ${
    active ? 'text-white border-transparent' : 'border-stone-200 text-stone-500 hover:border-stone-400'
  }`;
}

function MaterialImage({ material, className }: { material: PublicRawMaterial; className: string }) {
  if (!material.imageUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center text-stone-300">
        <Beaker className="h-10 w-10" strokeWidth={1.2} />
      </div>
    );
  }
  return (
    <motion.img
      whileHover={{ scale: 1.06 }}
      transition={{ duration: 0.55 }}
      src={material.imageUrl}
      alt={material.name}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}

function MaterialPrice({ material, className }: { material: PublicRawMaterial; className: string }) {
  return (
    <span className={`font-semibold text-stone-900 ${className}`}>
      {formatPrice(material.price)}
      <span className="ml-1 text-[10px] font-normal text-stone-400">/ {unitLabel(material)}</span>
    </span>
  );
}

export function RawMaterialsPage({ onLoginClick }: { onLoginClick: () => void }) {
  const toast = useToast();
  const { currentUser } = useUser();
  const { addItem } = useCart();
  const [materials, setMaterials] = useState<PublicRawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedMaterial, setSelectedMaterial] = useState<PublicRawMaterial | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

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

  const categoryTabs = useMemo(() => [
    { id: 'all', label: 'Todas', count: materials.length },
    ...groupOptions.map(group => ({
      id: group,
      label: group,
      count: materials.filter(material => groupLabel(material) === group).length,
    })),
  ], [groupOptions, materials]);

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
        if (sortKey === 'price') return left.price - right.price;
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

  const getQuantity = (id: string) => quantities[id] ?? 1;
  const setQuantity = (id: string, value: number) => {
    setQuantities(current => ({ ...current, [id]: Math.max(1, value) }));
  };

  const handleAddToCart = async (material: PublicRawMaterial) => {
    if (!currentUser) {
      toast.info('Inicia sesion para agregar productos al carrito.');
      onLoginClick();
      return;
    }
    if (!material.variantId) {
      toast.warning('Esta materia prima no esta disponible para compra en este momento.');
      return;
    }
    if (!material.price || material.price <= 0) {
      toast.warning('Esta materia prima aun no tiene precio disponible.');
      return;
    }
    if (isOutOfStock(material)) {
      toast.warning('Esta materia prima esta agotada.');
      return;
    }

    const added = await addItem({
      variantId: material.variantId,
      name: material.name,
      category: groupLabel(material),
      size: material.presentation || unitLabel(material),
      price: material.price,
      image: material.imageUrl,
      quantity: getQuantity(material.id),
    });
    if (added) toast.success(`${material.name} agregado al carrito`);
  };

  const activeFilters = [search, groupFilter !== 'all', unitFilter !== 'all', priceFilter !== 'all'].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-white text-stone-950">
      <NavigationBar variant="solid" onLoginClick={onLoginClick} />
      <main className="pb-20 pt-24">
        <section className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-14">
          <button
            type="button"
            onClick={() => navigateBack('/')}
            className="mb-8 inline-flex items-center gap-2 text-[11px] tracking-[0.12em] uppercase text-stone-400 transition-colors hover:text-stone-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
            Inicio
          </button>

          {/* ── HEADER editorial ── */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65 }}
            className="mb-12"
          >
            <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end mb-10">
              <div>
                <p className="text-[9px] tracking-[0.4em] uppercase text-stone-400 mb-4">
                  Para fabricantes · B2B
                </p>
                <h1
                  className="text-[56px] md:text-[72px] lg:text-[84px] font-light text-stone-900 leading-[0.92] tracking-tight"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Materias<br />
                  <em style={{ fontStyle: 'italic', color: OLIVE }}>primas</em>
                </h1>
              </div>
              <p className="text-sm text-stone-400 leading-relaxed max-w-[240px] lg:mb-2">
                Insumos profesionales para fabricación cosmética, cuidado personal y desarrollo de fórmulas.
              </p>
            </div>

            {/* Barra búsqueda + controles */}
            <div className="flex flex-col sm:flex-row gap-3 mb-7">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" strokeWidth={1.3} />
                <input
                  type="search"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Buscar materias primas..."
                  className="w-full pl-11 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-base sm:text-[13px] text-stone-700 placeholder:text-stone-300 focus:outline-none focus:border-stone-400 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-3 text-[11px] tracking-[0.12em] uppercase font-medium border rounded-xl transition-all ${
                    showFilters ? 'text-white border-transparent' : 'border-stone-200 text-stone-500 hover:border-stone-400 bg-white'
                  }`}
                  style={showFilters ? { backgroundColor: OLIVE } : {}}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
                  Filtros{activeFilters > 0 ? ` (${activeFilters})` : ''}
                </button>
                <div className="flex gap-1">
                  {(['grid', 'list'] as ViewMode[]).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      className={`p-3 rounded-xl border transition-all ${
                        viewMode === mode ? 'text-white border-transparent' : 'border-stone-200 text-stone-400 hover:border-stone-300 bg-white'
                      }`}
                      style={viewMode === mode ? { backgroundColor: OLIVE } : {}}
                      aria-label={mode === 'grid' ? 'Vista en cuadrícula' : 'Vista en lista'}
                    >
                      {mode === 'grid' ? <Grid className="w-4 h-4" strokeWidth={1.5} /> : <List className="w-4 h-4" strokeWidth={1.5} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Panel filtros desplegable */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-5"
                >
                  <div className="grid sm:grid-cols-3 gap-6 p-6 bg-white rounded-2xl border border-stone-200">
                    <div>
                      <p className="text-[9px] tracking-[0.24em] uppercase text-stone-400 mb-3">Precio</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'all', label: 'Todos' },
                          { value: 'low', label: '< $25k' },
                          { value: 'mid', label: '$25k – $100k' },
                          { value: 'high', label: '> $100k' },
                        ].map(option => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setPriceFilter(option.value as PriceFilter)}
                            className={pillCls(priceFilter === option.value)}
                            style={priceFilter === option.value ? { backgroundColor: OLIVE } : {}}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] tracking-[0.24em] uppercase text-stone-400 mb-3">Unidad</p>
                      <div className="flex flex-wrap gap-2">
                        {['all', ...unitOptions].map(unit => (
                          <button
                            key={unit}
                            type="button"
                            onClick={() => setUnitFilter(unit)}
                            className={pillCls(unitFilter === unit)}
                            style={unitFilter === unit ? { backgroundColor: OLIVE } : {}}
                          >
                            {unit === 'all' ? 'Todas' : unit}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] tracking-[0.24em] uppercase text-stone-400 mb-3">Ordenar</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: 'name', label: 'Nombre' },
                          { value: 'price', label: 'Menor precio' },
                          { value: 'recent', label: 'Novedades' },
                        ].map(option => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSortKey(option.value as SortKey)}
                            className={pillCls(sortKey === option.value)}
                            style={sortKey === option.value ? { backgroundColor: OLIVE } : {}}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {activeFilters > 0 && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex w-fit items-center gap-1.5 text-[11px] tracking-[0.12em] uppercase text-stone-400 hover:text-stone-800 sm:col-span-3"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pestañas por categoría */}
            <div className="flex items-center gap-0 border-b border-stone-200 overflow-x-auto">
              {categoryTabs.map(tab => {
                const active = groupFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setGroupFilter(tab.id)}
                    className="relative flex items-center gap-1.5 px-4 py-3 text-[11px] tracking-[0.12em] uppercase whitespace-nowrap transition-colors flex-shrink-0"
                    style={{ color: active ? OLIVE : '#9ca3af' }}
                  >
                    {tab.label}
                    <span className={`text-[9px] ${active ? 'text-stone-400' : 'text-stone-300'}`}>({tab.count})</span>
                    {active && (
                      <motion.div
                        layoutId="rawMaterialsTab"
                        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                        style={{ backgroundColor: OLIVE }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* ── SKELETON loading ── */}
          {loading && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="bg-white rounded-2xl overflow-hidden border border-stone-100">
                  <div className="aspect-[3/4] bg-stone-100 animate-pulse" />
                  <div className="p-4 space-y-3">
                    <div className="h-2 w-16 bg-stone-100 animate-pulse rounded" />
                    <div className="h-4 w-3/4 bg-stone-100 animate-pulse rounded" />
                    <div className="h-3 w-24 bg-stone-100 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── ERROR ── */}
          {!loading && errorMessage && (
            <div className="text-center py-20">
              <Beaker className="w-10 h-10 mx-auto mb-4 text-stone-300" strokeWidth={1} />
              <p className="text-sm text-stone-400">No pudimos cargar las materias primas. {errorMessage}</p>
            </div>
          )}

          {/* ── VACÍO ── */}
          {!loading && !errorMessage && filteredMaterials.length === 0 && (
            <div className="text-center py-20">
              <SlidersHorizontal className="w-10 h-10 mx-auto mb-4 text-stone-300" strokeWidth={1} />
              <p className="text-sm text-stone-400">No encontramos materias primas con esos filtros.</p>
            </div>
          )}

          {!loading && !errorMessage && search && filteredMaterials.length > 0 && (
            <p className="text-[11px] text-stone-400 mb-5">
              {filteredMaterials.length} resultado{filteredMaterials.length !== 1 ? 's' : ''} para «{search}»
            </p>
          )}

          {/* ── GRID / LIST ── */}
          {!loading && !errorMessage && filteredMaterials.length > 0 && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${groupFilter}-${viewMode}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className={viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3'
                  : 'flex flex-col gap-3'}
              >
                {filteredMaterials.map((material, index) => {
                  const outOfStock = isOutOfStock(material);
                  const cannotBuy = !material.variantId || !material.price || outOfStock;
                  const open = () => setSelectedMaterial(material);
                  const onKeyDown = (event: React.KeyboardEvent) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      open();
                    }
                  };
                  const presentation = material.presentation || `1 ${unitLabel(material)}`;

                  if (viewMode === 'list') {
                    return (
                      <motion.div
                        key={material.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={open}
                        role="button"
                        tabIndex={0}
                        onKeyDown={onKeyDown}
                        className="group flex gap-4 bg-white rounded-2xl p-4 shadow-[0_12px_34px_rgba(28,25,23,0.06)] hover:shadow-[0_18px_48px_rgba(28,25,23,0.09)] active:bg-stone-50/60 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-200 touch-manipulation"
                      >
                        <div className="w-24 h-24 rounded-xl overflow-hidden bg-white flex-shrink-0 relative">
                          <MaterialImage material={material} className="w-full h-full object-contain p-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] tracking-[0.22em] uppercase text-stone-400 mb-0.5">{groupLabel(material)}</p>
                          <h3 className="text-sm font-medium text-stone-900 mb-2 leading-snug">{material.name}</h3>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="px-2.5 py-0.5 text-[9px] rounded-full text-white" style={{ backgroundColor: OLIVE }}>
                              {presentation}
                            </span>
                            {material.tracksBatches && (
                              <span className="px-2.5 py-0.5 text-[9px] rounded-full bg-stone-100 text-stone-500">Por lote</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end justify-between gap-2 flex-shrink-0">
                          <MaterialPrice material={material} className="text-base" />
                          {outOfStock && <p className="text-[10px] font-semibold text-red-600">Agotado</p>}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={event => { event.stopPropagation(); open(); }}
                              className="p-2 rounded-xl bg-stone-100 text-stone-500 hover:bg-stone-200/70 hover:text-stone-700 transition-all"
                              aria-label="Vista rápida"
                            >
                              <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                            </button>
                            <button
                              type="button"
                              onClick={event => { event.stopPropagation(); void handleAddToCart(material); }}
                              disabled={cannotBuy}
                              className="flex items-center gap-1.5 px-4 py-2 text-white text-[10px] tracking-wide font-medium rounded-xl transition-opacity hover:opacity-85 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{ backgroundColor: OLIVE }}
                            >
                              <ShoppingBag className="w-3 h-3" strokeWidth={1.5} />
                              {outOfStock ? 'Agotado' : 'Añadir'}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  }

                  /* GRID CARD — misma tarjeta que los productos normales */
                  return (
                    <motion.div
                      key={material.id}
                      initial={{ opacity: 0, y: 28 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      whileTap={{ scale: 0.985 }}
                      onClick={open}
                      role="button"
                      tabIndex={0}
                      onKeyDown={onKeyDown}
                      className="group flex flex-col bg-white rounded-2xl overflow-hidden shadow-[0_12px_34px_rgba(28,25,23,0.06)] hover:shadow-[0_20px_54px_rgba(28,25,23,0.1)] active:bg-stone-50/60 transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-200 touch-manipulation"
                    >
                      <div className="relative overflow-hidden bg-white aspect-[4/5]">
                        <MaterialImage material={material} className="w-full h-full object-contain p-4" />
                        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 p-2 opacity-0 pointer-events-none transition-all duration-300 group-hover:bg-black/15 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:bg-black/15 group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={event => { event.stopPropagation(); open(); }}
                            className="p-2 md:p-3 bg-white rounded-full text-stone-700 shadow-md hover:bg-stone-50 transition-colors"
                            aria-label="Vista rápida"
                          >
                            <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={1.5} />
                          </motion.button>
                        </div>
                      </div>

                      <div className="flex flex-col flex-1 p-3">
                        <p className="text-[9px] tracking-[0.2em] uppercase text-stone-400 mb-1">{groupLabel(material)}</p>
                        <h3 className="text-[13.5px] font-medium text-stone-900 leading-snug mb-3">{material.name}</h3>

                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <span className="px-2.5 py-0.5 text-[9.5px] rounded-full text-white" style={{ backgroundColor: OLIVE }}>
                            {presentation}
                          </span>
                          {material.tracksBatches && (
                            <span className="px-2.5 py-0.5 text-[9.5px] rounded-full bg-stone-100 text-stone-500">Por lote</span>
                          )}
                        </div>

                        {outOfStock && <p className="text-[10px] font-semibold text-red-600 mb-2">Agotado</p>}

                        <div className="flex flex-wrap items-center justify-between gap-2 mt-auto pt-3 border-t border-stone-100">
                          <MaterialPrice material={material} className="text-lg" />
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={event => { event.stopPropagation(); void handleAddToCart(material); }}
                            disabled={cannotBuy}
                            className="flex items-center gap-1.5 px-3.5 py-2 text-white text-[10px] font-semibold rounded-xl opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                            style={{ backgroundColor: OLIVE }}
                          >
                            {outOfStock ? 'Agotado' : 'Añadir al carrito'}
                            {!outOfStock && (
                              <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold leading-none flex-shrink-0">+</span>
                            )}
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          )}

          {/* ── Vista rápida ── */}
          <AnimatePresence>
            {selectedMaterial && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
              >
                <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={() => setSelectedMaterial(null)} />
                <motion.div
                  initial={{ scale: 0.96, opacity: 0, y: 14 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.96, opacity: 0, y: 14 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  className="relative grid max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl md:grid-cols-[45%_1fr]"
                >
                  <div className="flex min-h-[320px] items-center justify-center bg-white p-6">
                    {selectedMaterial.imageUrl ? (
                      <img src={selectedMaterial.imageUrl} alt={selectedMaterial.name} className="max-h-[420px] w-full object-contain" />
                    ) : (
                      <Beaker className="h-24 w-24 text-stone-200" strokeWidth={1.2} />
                    )}
                  </div>
                  <div className="overflow-y-auto border-l border-stone-100 p-7">
                    <button
                      type="button"
                      onClick={() => setSelectedMaterial(null)}
                      className="absolute right-4 top-4 rounded-full p-2 transition-colors hover:bg-stone-100"
                      aria-label="Cerrar"
                    >
                      <X className="h-4 w-4 text-stone-400" strokeWidth={1.5} />
                    </button>
                    <p className="mb-2 text-[9px] uppercase tracking-[0.24em] text-stone-400">{groupLabel(selectedMaterial)}</p>
                    <h2
                      className="text-3xl font-light leading-tight text-stone-900"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      {selectedMaterial.name}
                    </h2>
                    {isOutOfStock(selectedMaterial) && (
                      <p className="mt-2 text-[11px] font-semibold text-red-600">Agotado</p>
                    )}
                    <div className="my-5 h-px bg-stone-100" />
                    <p className="text-2xl font-semibold text-stone-900">
                      {formatPrice(selectedMaterial.price)}
                      <span className="ml-1 text-xs font-normal text-stone-400">/ {unitLabel(selectedMaterial)}</span>
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-stone-200 px-3 py-3">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-stone-400">Presentación</p>
                        <p className="mt-1 text-sm font-medium text-stone-800">{selectedMaterial.presentation || unitLabel(selectedMaterial)}</p>
                      </div>
                      <div className="rounded-xl border border-stone-200 px-3 py-3">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-stone-400">Código</p>
                        <p className="mt-1 text-sm font-medium text-stone-800">{selectedMaterial.code || '—'}</p>
                      </div>
                    </div>
                    {selectedMaterial.description && (
                      <p className="mt-5 text-sm leading-7 text-stone-500">{selectedMaterial.description}</p>
                    )}
                    <div className="mt-6 flex items-center gap-3">
                      <div className="grid h-11 w-[120px] grid-cols-3 overflow-hidden rounded-xl border border-stone-200 text-stone-800">
                        <button
                          type="button"
                          onClick={() => setQuantity(selectedMaterial.id, getQuantity(selectedMaterial.id) - 1)}
                          className="flex items-center justify-center hover:bg-stone-50"
                          aria-label="Disminuir cantidad"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <div className="flex items-center justify-center border-x border-stone-200 text-sm font-semibold">
                          {getQuantity(selectedMaterial.id)}
                        </div>
                        <button
                          type="button"
                          onClick={() => setQuantity(selectedMaterial.id, getQuantity(selectedMaterial.id) + 1)}
                          className="flex items-center justify-center hover:bg-stone-50"
                          aria-label="Aumentar cantidad"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void handleAddToCart(selectedMaterial);
                          setSelectedMaterial(null);
                        }}
                        disabled={!selectedMaterial.variantId || !selectedMaterial.price || isOutOfStock(selectedMaterial)}
                        className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ backgroundColor: OLIVE }}
                      >
                        <ShoppingBag className="h-4 w-4" strokeWidth={1.5} />
                        Añadir al carrito
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

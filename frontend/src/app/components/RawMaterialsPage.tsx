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

import { useCart } from '../contexts/CartContext';
import { useToast } from '../contexts/ToastContext';
import { useUser } from '../contexts/UserContext';
import { navigateBack } from '../services/navigate';
import {
  getAllProducts,
  getCategories,
  type Product,
  type ProductCategory,
  type ProductVariant,
} from '../services/products.service';
import { NavigationBar } from './NavigationBar';
import { Footer } from './Footer';
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

function formatPrice(value: number | null | undefined, currency = 'COP'): string {
  if (value === null || value === undefined) return 'Consultar';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function isRawMaterialCategory(category: Pick<ProductCategory, 'name' | 'slug'>): boolean {
  const text = normalize(`${category.name} ${category.slug}`);
  return text.includes('materia') || text.includes('prima') || text.includes('insumo') || text.includes('raw material');
}

function buildCategoryDescendants(categories: ProductCategory[]): Map<string, Set<string>> {
  const childrenByParent = new Map<string, string[]>();
  categories.forEach(category => {
    if (!category.parent) return;
    childrenByParent.set(category.parent, [...(childrenByParent.get(category.parent) ?? []), category.id]);
  });

  const collect = (id: string): Set<string> => {
    const ids = new Set<string>([id]);
    (childrenByParent.get(id) ?? []).forEach(childId => {
      collect(childId).forEach(nextId => ids.add(nextId));
    });
    return ids;
  };

  return new Map(categories.map(category => [category.id, collect(category.id)]));
}

function getProductSizes(product: Product): string[] {
  return product.sizes.length > 0 ? product.sizes : ['Presentacion unica'];
}

function getSelectedVariant(product: Product, selectedSizes: Record<string, string>): ProductVariant | undefined {
  const size = selectedSizes[product.id] ?? getProductSizes(product)[0];
  return product.variants.find(variant => variant.presentation === size) ?? product.variants[0];
}

function getVariantPrice(product: Product, variant?: ProductVariant): number | null {
  return variant?.discounted_price ?? variant?.current_price ?? product.price ?? null;
}

function getProductImage(product: Product, variant?: ProductVariant): string {
  const primaryVariantImage = [...(variant?.images ?? [])]
    .sort((left, right) => (left.is_primary === right.is_primary ? left.position - right.position : left.is_primary ? -1 : 1))[0]?.image;
  return primaryVariantImage || variant?.image_url || product.primary_image || product.image_url || product.image_urls[0] || '';
}

function isOutOfStock(variant?: ProductVariant): boolean {
  return variant?.available_quantity !== null && variant?.available_quantity !== undefined && variant.available_quantity <= 0;
}

function matchesPrice(product: Product, variant: ProductVariant | undefined, filter: PriceFilter): boolean {
  if (filter === 'all') return true;
  const price = getVariantPrice(product, variant) ?? 0;
  if (filter === 'low') return price > 0 && price < 25000;
  if (filter === 'mid') return price >= 25000 && price < 100000;
  return price >= 100000;
}

export function RawMaterialsPage({ onLoginClick }: { onLoginClick: () => void }) {
  const toast = useToast();
  const { currentUser } = useUser();
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [presentationFilter, setPresentationFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErrorMessage(null);
    Promise.all([getAllProducts(), getCategories()])
      .then(([nextProducts, nextCategories]) => {
        if (!mounted) return;
        setProducts(nextProducts.filter(product => product.is_active));
        setCategories(nextCategories.filter(category => category.is_active));
      })
      .catch(error => {
        if (mounted) setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar las materias primas.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const rawCategoryIds = useMemo(() => {
    const descendants = buildCategoryDescendants(categories);
    const ids = new Set<string>();
    categories.filter(isRawMaterialCategory).forEach(category => {
      (descendants.get(category.id) ?? new Set([category.id])).forEach(id => ids.add(id));
    });
    return ids;
  }, [categories]);

  const rawProducts = useMemo(() => (
    products.filter(product => (
      rawCategoryIds.has(product.category_id) ||
      isRawMaterialCategory({ name: product.category_name, slug: product.category_slug })
    ))
  ), [products, rawCategoryIds]);

  const categoryOptions = useMemo(() => (
    [...new Map(rawProducts.map(product => [product.category_id, product.category_name])).entries()]
      .sort((left, right) => left[1].localeCompare(right[1], 'es', { sensitivity: 'base' }))
  ), [rawProducts]);

  const presentationOptions = useMemo(() => (
    [...new Set(rawProducts.flatMap(getProductSizes))]
      .sort((left, right) => left.localeCompare(right, 'es', { sensitivity: 'base' }))
  ), [rawProducts]);

  const filteredProducts = useMemo(() => {
    const query = normalize(search);
    return rawProducts
      .filter(product => {
        const variant = getSelectedVariant(product, selectedSizes);
        const price = getVariantPrice(product, variant);
        const text = normalize(`${product.name} ${product.description} ${product.category_name} ${getProductSizes(product).join(' ')}`);
        const matchesSearch = !query || text.includes(query);
        const matchesCategory = categoryFilter === 'all' || product.category_id === categoryFilter;
        const matchesPresentation = presentationFilter === 'all' || getProductSizes(product).includes(presentationFilter);
        const matchesAvailability = availabilityFilter === 'all' || (availabilityFilter === 'available' ? !isOutOfStock(variant) : isOutOfStock(variant));
        const hasPrice = price !== null && price !== undefined;
        return matchesSearch && matchesCategory && matchesPresentation && matchesAvailability && hasPrice && matchesPrice(product, variant, priceFilter);
      })
      .sort((left, right) => {
        if (sortKey === 'price') {
          return (getVariantPrice(left, getSelectedVariant(left, selectedSizes)) ?? 0) -
            (getVariantPrice(right, getSelectedVariant(right, selectedSizes)) ?? 0);
        }
        if (sortKey === 'recent') return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
        return left.name.localeCompare(right.name, 'es', { numeric: true, sensitivity: 'base' });
      });
  }, [availabilityFilter, categoryFilter, presentationFilter, priceFilter, rawProducts, search, selectedSizes, sortKey]);

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setPresentationFilter('all');
    setAvailabilityFilter('all');
    setPriceFilter('all');
    setSortKey('name');
  };

  const getQuantity = (id: string) => quantities[id] ?? 1;
  const setQuantity = (id: string, value: number) => {
    setQuantities(current => ({ ...current, [id]: Math.max(1, value) }));
  };

  const handleSelectSize = (product: Product, size: string) => {
    setSelectedSizes(current => ({ ...current, [product.id]: size }));
  };

  const handleAddToCart = async (product: Product) => {
    if (!currentUser) {
      toast.info('Inicia sesion para agregar productos al carrito.');
      onLoginClick();
      return;
    }

    const variant = getSelectedVariant(product, selectedSizes);
    if (!variant) {
      toast.error('Este producto no tiene una presentacion disponible.');
      return;
    }

    const price = getVariantPrice(product, variant);
    if (price === null || price === undefined) {
      toast.warning('Este producto necesita un precio en Admin > Productos antes de venderse.');
      return;
    }

    if (isOutOfStock(variant)) {
      toast.warning('Este producto esta agotado.');
      return;
    }

    const added = await addItem({
      variantId: variant.id,
      name: product.name,
      category: product.category_name,
      size: variant.presentation,
      price,
      image: getProductImage(product, variant),
      quantity: getQuantity(product.id),
    });

    if (added) toast.success(`${product.name} agregado al carrito`);
  };

  const activeFilters = [search, categoryFilter !== 'all', presentationFilter !== 'all', availabilityFilter !== 'all', priceFilter !== 'all'].filter(Boolean).length;

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
            <div>
              <h1 className="font-serif text-4xl font-semibold leading-tight text-[#17351f] md:text-5xl">Materias primas</h1>
              <p className="mt-2 max-w-2xl text-base text-stone-600">
                Productos profesionales con precio y presentaciones administradas desde el catalogo.
              </p>
            </div>
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-[#1f4b24] px-4 py-2 text-sm font-medium text-white shadow-sm">
              <FlaskConical className="h-4 w-4" strokeWidth={1.7} />
              <span>Compra directa por el carrito</span>
              <span className="hidden h-1 w-1 rounded-full bg-white/70 sm:block" />
              <span>Envios a toda Colombia</span>
            </div>
          </div>

          <div className="mb-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(260px,2fr)_repeat(4,minmax(150px,0.85fr))_auto]">
              <div className="relative sm:col-span-2 lg:col-span-4 xl:col-span-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" strokeWidth={1.7} />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Buscar materia prima..."
                  className="h-11 w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
                />
              </div>
              <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="all">Categoria</option>
                {categoryOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              <select value={presentationFilter} onChange={event => setPresentationFilter(event.target.value)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="all">Presentacion</option>
                {presentationOptions.map(item => <option key={item} value={item}>{item}</option>)}
              </select>
              <select value={availabilityFilter} onChange={event => setAvailabilityFilter(event.target.value)} className="h-11 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-800 outline-none focus:border-stone-900">
                <option value="all">Disponibilidad</option>
                <option value="available">Disponible</option>
                <option value="out">Agotado</option>
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
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold text-stone-600 transition-colors hover:bg-white sm:col-span-2 lg:col-span-4 xl:col-span-1"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar filtros
              </button>
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-serif text-xl font-semibold text-[#17351f]">
                {filteredProducts.length} <span className="font-sans text-sm font-normal text-stone-600">materias primas</span>
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
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white px-5 py-12 text-center shadow-sm">
              <SlidersHorizontal className="mx-auto mb-3 h-8 w-8 text-stone-300" strokeWidth={1.6} />
              <p className="text-sm font-semibold text-stone-900">No hay materias primas publicadas como productos.</p>
              <p className="mt-2 text-sm text-stone-500">Crea productos en Admin &gt; Productos dentro de una categoria como Materias primas o Insumos.</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredProducts.map(product => {
                const variant = getSelectedVariant(product, selectedSizes);
                const price = getVariantPrice(product, variant);
                const image = getProductImage(product, variant);
                const sizes = getProductSizes(product);
                const out = isOutOfStock(variant);
                return (
                  <article
                    key={product.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedProduct(product)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedProduct(product);
                      }
                    }}
                    className="grid min-h-[184px] cursor-pointer grid-cols-[104px_minmax(0,1fr)] gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#1f4b24]/25 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#1f4b24]/20 sm:grid-cols-[128px_minmax(0,1fr)]"
                  >
                    <div className="flex h-full min-h-[160px] items-center justify-center overflow-hidden rounded-lg bg-[#f5f4ef]">
                      {image ? (
                        <img src={image} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-center text-[#1f4b24]/35">
                          <Beaker className="mx-auto mb-2 h-8 w-8" strokeWidth={1.4} />
                          <p className="text-[9px] font-semibold uppercase tracking-wider">Materia prima</p>
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col py-0.5">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="min-w-0 font-serif text-lg font-semibold leading-tight text-[#17351f] line-clamp-2">{product.name}</h2>
                          <span className={`mt-0.5 inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[10px] font-semibold ${out ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {out ? 'Agotado' : 'Stock'}
                          </span>
                        </div>
                        <p className="truncate text-[11px] font-medium uppercase tracking-wider text-stone-400">{product.category_name}</p>
                      </div>
                      <div className="my-3 h-px bg-stone-100" />
                      <div className="grid gap-2">
                        <div>
                          <p className="text-xs text-stone-500">Precio</p>
                          <p className="font-serif text-2xl font-semibold leading-none text-[#17351f]">{formatPrice(price, product.currency ?? 'COP')}</p>
                        </div>
                        <select
                          value={variant?.presentation ?? sizes[0]}
                          onClick={event => event.stopPropagation()}
                          onChange={event => handleSelectSize(product, event.target.value)}
                          className="h-9 w-full rounded-lg border border-stone-200 bg-white px-2 text-xs font-semibold text-[#1f4b24] outline-none"
                        >
                          {sizes.map(size => <option key={size} value={size}>{size}</option>)}
                        </select>
                      </div>
                      <div className="mt-auto grid gap-2 pt-4 sm:grid-cols-[116px_minmax(0,1fr)]">
                        <div
                          className="grid h-10 min-w-[116px] grid-cols-3 overflow-hidden rounded-lg border border-stone-200 bg-white text-[#17351f]"
                          onClick={event => event.stopPropagation()}
                        >
                          <button type="button" onClick={() => setQuantity(product.id, getQuantity(product.id) - 1)} className="flex items-center justify-center hover:bg-stone-50">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <div className="flex items-center justify-center border-x border-stone-200 font-serif text-base font-semibold">{getQuantity(product.id)}</div>
                          <button type="button" onClick={() => setQuantity(product.id, getQuantity(product.id) + 1)} className="flex items-center justify-center hover:bg-stone-50">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            void handleAddToCart(product);
                          }}
                          disabled={out}
                          className="inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg bg-[#1f4b24] px-3 text-sm font-semibold leading-tight text-white shadow-sm transition-colors hover:bg-[#17351f] disabled:cursor-not-allowed disabled:bg-stone-300"
                        >
                          <ShoppingCart className="h-4 w-4" strokeWidth={1.8} />
                          <span>Agregar</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {activeFilters > 0 && (
            <p className="mt-4 text-xs font-medium text-stone-500">{activeFilters} filtro(s) activo(s)</p>
          )}

          {selectedProduct && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
              <div className="relative grid max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl md:grid-cols-[42%_1fr]">
                <div className="flex min-h-[340px] items-center justify-center bg-[#f5f4ef] p-6">
                  {getProductImage(selectedProduct, getSelectedVariant(selectedProduct, selectedSizes)) ? (
                    <img src={getProductImage(selectedProduct, getSelectedVariant(selectedProduct, selectedSizes))} alt={selectedProduct.name} className="max-h-[420px] w-full object-contain" />
                  ) : (
                    <Beaker className="h-24 w-24 text-[#1f4b24]/25" strokeWidth={1.4} />
                  )}
                </div>
                <div className="overflow-y-auto p-6">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="absolute right-4 top-4 rounded-full border border-stone-200 bg-white p-2 text-stone-500 shadow-sm hover:bg-stone-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">{selectedProduct.category_name}</p>
                  <h2 className="font-serif text-3xl font-semibold leading-tight text-[#17351f]">{selectedProduct.name}</h2>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Producto del catalogo
                  </p>
                  <div className="my-5 h-px bg-stone-100" />
                  <p className="text-sm text-stone-500">Precio</p>
                  <p className="mt-1 font-serif text-4xl font-semibold text-[#17351f]">
                    {formatPrice(getVariantPrice(selectedProduct, getSelectedVariant(selectedProduct, selectedSizes)), selectedProduct.currency ?? 'COP')}
                  </p>
                  <div className="mt-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">Presentacion</p>
                    <div className="flex flex-wrap gap-2">
                      {getProductSizes(selectedProduct).map(size => {
                        const active = (getSelectedVariant(selectedProduct, selectedSizes)?.presentation ?? getProductSizes(selectedProduct)[0]) === size;
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => handleSelectSize(selectedProduct, size)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${active ? 'bg-[#1f4b24] text-white' : 'bg-stone-100 text-stone-600'}`}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {selectedProduct.description && (
                    <p className="mt-5 text-sm leading-7 text-stone-600">{selectedProduct.description}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      void handleAddToCart(selectedProduct);
                      setSelectedProduct(null);
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
        </section>
      </main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}

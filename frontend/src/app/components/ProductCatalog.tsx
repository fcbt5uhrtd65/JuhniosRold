import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Search,
  Filter,
  Grid,
  List,
  Heart,
  Eye,
  ShoppingCart as CartIcon,
  TrendingUp,
  Package,
} from 'lucide-react';

import { useCart } from '../contexts/CartContext';
import { useSearch } from '../contexts/SearchContext';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import {
  getCategories,
  getProducts,
  type Product as CatalogProduct,
  type ProductCategory,
} from '../services/products.service';

type ViewMode = 'grid' | 'list';
type PriceRange = 'all' | 'low' | 'mid' | 'high';
type CollectionFilter = 'all' | 'featured' | 'recent';
type CatalogBadge = 'nuevo' | 'destacado';

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=900&q=80';

function formatPrice(price: number | null, currency = 'COP'): string {
  if (price === null) {
    return 'Consultar';
  }

  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

function isRecentProduct(createdAt: string): boolean {
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) {
    return false;
  }

  const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30;
  return Date.now() - createdTime <= THIRTY_DAYS;
}

function getProductBadge(product: CatalogProduct): CatalogBadge | undefined {
  if (product.is_featured) {
    return 'destacado';
  }

  if (isRecentProduct(product.created_at)) {
    return 'nuevo';
  }

  return undefined;
}

function getProductImage(product: CatalogProduct): string {
  return product.primary_image ?? product.image_urls[0] ?? FALLBACK_IMAGE;
}

function getProductSizes(product: CatalogProduct): string[] {
  return product.sizes.length > 0 ? product.sizes : ['Presentación única'];
}

function getProductDescription(product: CatalogProduct): string {
  if (product.description.trim()) {
    return product.description;
  }

  return `Disponible en ${getProductSizes(product).length} presentación(es).`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'No se pudo cargar el catálogo en este momento.';
}

interface ProductCatalogProps {
  onLoginRequired?: () => void;
}

export function ProductCatalog({ onLoginRequired }: ProductCatalogProps = {}) {
  const { addItem } = useCart();
  const { searchQuery: globalSearchQuery } = useSearch();
  const { currentUser, toggleSaveProduct, isProductSaved } = useUser();
  const toast = useToast();

  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [priceRange, setPriceRange] = useState<PriceRange>('all');
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<CatalogProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      setIsLoading(true);
      setError(null);

      try {
        const [catalogCategories, catalogProducts] = await Promise.all([
          getCategories(),
          getProducts({
            limit: 100,
            active: true,
            ordering: 'name',
          }),
        ]);

        if (!isMounted) {
          return;
        }

        setCategories(catalogCategories.filter((category) => category.is_active));
        setProducts(catalogProducts.data.filter((product) => product.is_active));
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(getErrorMessage(loadError));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (globalSearchQuery) {
      setLocalSearchQuery(globalSearchQuery);
    }
  }, [globalSearchQuery]);

  useEffect(() => {
    if (
      activeCategory !== 'all' &&
      categories.length > 0 &&
      !categories.some((category) => category.id === activeCategory)
    ) {
      setActiveCategory('all');
    }
  }, [activeCategory, categories]);

  const categoryTabs = useMemo(
    () => [
      { id: 'all', label: 'Todos' },
      ...categories.map((category) => ({
        id: category.id,
        label: category.name,
      })),
    ],
    [categories],
  );

  const productsByCategory = useMemo(() => {
    return products.reduce<Record<string, CatalogProduct[]>>((accumulator, product) => {
      if (!accumulator[product.category_id]) {
        accumulator[product.category_id] = [];
      }

      accumulator[product.category_id].push(product);
      return accumulator;
    }, {});
  }, [products]);

  const currentProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === 'all' || product.category_id === activeCategory;

      const normalizedSearch = localSearchQuery.trim().toLowerCase();
      const sizes = getProductSizes(product);

      const matchesSearch =
        normalizedSearch.length === 0 ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.category_name.toLowerCase().includes(normalizedSearch) ||
        product.description.toLowerCase().includes(normalizedSearch) ||
        sizes.some((size) => size.toLowerCase().includes(normalizedSearch));

      const productPrice = product.price ?? 0;
      let matchesPrice = true;

      if (priceRange === 'low') {
        matchesPrice = productPrice < 25000;
      } else if (priceRange === 'mid') {
        matchesPrice = productPrice >= 25000 && productPrice < 100000;
      } else if (priceRange === 'high') {
        matchesPrice = productPrice >= 100000;
      }

      let matchesCollection = true;
      if (collectionFilter === 'featured') {
        matchesCollection = product.is_featured;
      } else if (collectionFilter === 'recent') {
        matchesCollection = isRecentProduct(product.created_at);
      }

      return matchesCategory && matchesSearch && matchesPrice && matchesCollection;
    });
  }, [activeCategory, collectionFilter, localSearchQuery, priceRange, products]);

  const handleAddToCart = async (product: CatalogProduct, closeModal?: boolean) => {
    if (!currentUser) {
      if (closeModal) {
        setQuickViewProduct(null);
      }
      toast.info('Inicia sesion para anadir productos al carrito');
      onLoginRequired?.();
      return;
    }

    const sizes = getProductSizes(product);
    const size = selectedSizes[product.id] || sizes[0];
    const variant =
      product.variants.find((item) => item.presentation === size) ??
      product.variants[0];

    if (!variant) {
      toast.error('Este producto no tiene una variante disponible.');
      return;
    }

    const added = await addItem({
      variantId: variant.id,
      name: product.name,
      category: product.category_name,
      size,
      price: variant?.current_price ?? product.price ?? 0,
      image: getProductImage(product),
    });

    if (added) {
      toast.success(`${product.name} añadido al carrito`);
    }

    if (closeModal) {
      setQuickViewProduct(null);
    }
  };

  const handleToggleSave = (productId: string, productName: string) => {
    if (!currentUser) {
      toast.info('Inicia sesion para guardar productos');
      onLoginRequired?.();
      return;
    }

    const wasSaved = isProductSaved(productId);
    toggleSaveProduct(productId);

    if (wasSaved) {
      toast.info(`${productName} eliminado de guardados`);
    } else {
      toast.success(`${productName} guardado para después`);
    }
  };

  return (
    <section id="catalogo" className="py-20 bg-secondary">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
            CATÁLOGO COMPLETO
          </div>

          <h2 className="text-4xl md:text-5xl font-bold leading-none mb-8">
            Todos los
            <br />
            Productos
          </h2>

          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                strokeWidth={1}
              />

              <input
                type="search"
                value={localSearchQuery}
                onChange={(event) => setLocalSearchQuery(event.target.value)}
                placeholder="Buscar productos..."
                className="w-full pl-10 pr-4 py-3 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-3 border border-border transition-colors ${
                  showFilters ? 'bg-foreground text-background' : 'hover:bg-secondary'
                }`}
                title="Filtros"
              >
                <Filter className="w-4 h-4" strokeWidth={1} />
              </button>

              <button
                onClick={() => setViewMode('grid')}
                className={`p-3 border border-border transition-colors ${
                  viewMode === 'grid' ? 'bg-foreground text-background' : 'hover:bg-secondary'
                }`}
                title="Vista en cuadrícula"
              >
                <Grid className="w-4 h-4" strokeWidth={1} />
              </button>

              <button
                onClick={() => setViewMode('list')}
                className={`p-3 border border-border transition-colors ${
                  viewMode === 'list' ? 'bg-foreground text-background' : 'hover:bg-secondary'
                }`}
                title="Vista en lista"
              >
                <List className="w-4 h-4" strokeWidth={1} />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid md:grid-cols-2 gap-6 p-6 bg-background border border-border mt-4">
                  <div>
                    <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                      Precio
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'all', label: 'Todos' },
                        { value: 'low', label: 'Menos de $25k' },
                        { value: 'mid', label: '$25k - $100k' },
                        { value: 'high', label: 'Más de $100k' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setPriceRange(option.value as PriceRange)}
                          className={`px-3 py-1.5 text-xs border transition-colors ${
                            priceRange === option.value
                              ? 'bg-foreground text-background border-foreground'
                              : 'border-border hover:border-foreground'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                      Colección
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'all', label: 'Todos' },
                        { value: 'featured', label: 'Destacados' },
                        { value: 'recent', label: 'Novedades' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setCollectionFilter(option.value as CollectionFilter)}
                          className={`px-3 py-1.5 text-xs border transition-colors ${
                            collectionFilter === option.value
                              ? 'bg-foreground text-background border-foreground'
                              : 'border-border hover:border-foreground'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-4 border-b border-border overflow-x-auto scrollbar-hide mt-8">
            {categoryTabs.map((category) => {
              const count =
                category.id === 'all'
                  ? products.length
                  : productsByCategory[category.id]?.length || 0;

              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`pb-3 px-2 text-xs tracking-wider uppercase transition-all relative whitespace-nowrap flex-shrink-0 ${
                    activeCategory === category.id
                      ? 'opacity-100'
                      : 'opacity-40 hover:opacity-70'
                  }`}
                >
                  {category.label}
                  <span className="ml-2 text-[10px] opacity-60">({count})</span>

                  {activeCategory === category.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-px bg-foreground"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="bg-background">
                <div className="aspect-[3/4] bg-muted animate-pulse" />
                <div className="p-4 border-t border-border space-y-3">
                  <div className="h-3 w-20 bg-muted animate-pulse" />
                  <div className="h-5 w-3/4 bg-muted animate-pulse" />
                  <div className="h-4 w-24 bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20 border border-border bg-background"
          >
            <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" strokeWidth={1} />
            <div className="text-sm mb-2">No pudimos cargar el catálogo.</div>
            <div className="text-xs text-muted-foreground">{error}</div>
          </motion.div>
        )}

        {!isLoading && !error && localSearchQuery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground mb-4"
          >
            {currentProducts.length} resultado{currentProducts.length !== 1 ? 's' : ''}{' '}
            encontrado{currentProducts.length !== 1 ? 's' : ''}
          </motion.div>
        )}

        {!isLoading && !error && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeCategory}-${viewMode}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-2 md:grid-cols-3 gap-px bg-border'
                  : 'space-y-px bg-border'
              }
            >
              {currentProducts.map((product, index) => {
                const sizes = getProductSizes(product);
                const badge = getProductBadge(product);

                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={`group bg-background ${viewMode === 'list' ? 'flex' : ''} relative`}
                  >
                    <div
                      className={`bg-secondary overflow-hidden relative ${
                        viewMode === 'grid' ? 'aspect-[3/4]' : 'w-32 h-32'
                      }`}
                    >
                      <motion.img
                        whileHover={{ scale: 1.08 }}
                        transition={{ duration: 0.6 }}
                        src={getProductImage(product)}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />

                      {badge && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="absolute top-3 left-3 px-3 py-1.5 bg-foreground text-background text-[9px] tracking-[0.2em] uppercase font-medium flex items-center gap-1.5"
                        >
                          {badge === 'nuevo' ? (
                            <Sparkles className="w-3 h-3" strokeWidth={1.5} />
                          ) : (
                            <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
                          )}
                          {badge}
                        </motion.div>
                      )}

                      <motion.div
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                        className="absolute inset-0 bg-foreground/60 backdrop-blur-sm flex items-center justify-center gap-2 opacity-0 transition-opacity"
                      >
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setQuickViewProduct(product)}
                          className="p-3 bg-background text-foreground rounded-full hover:bg-background/90 transition-colors"
                          aria-label="Vista rápida"
                        >
                          <Eye className="w-4 h-4" strokeWidth={1.5} />
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleToggleSave(product.id, product.name)}
                          className="p-3 bg-background text-foreground rounded-full hover:bg-background/90 transition-colors"
                          aria-label={isProductSaved(product.id) ? 'Quitar de guardados' : 'Guardar producto'}
                        >
                          <Heart
                            className={`w-4 h-4 ${isProductSaved(product.id) ? 'fill-current' : ''}`}
                            strokeWidth={1.5}
                          />
                        </motion.button>
                      </motion.div>
                    </div>

                    <div
                      className={`p-4 border-t border-border ${
                        viewMode === 'list'
                          ? 'flex-1 border-t-0 border-l flex flex-col justify-center'
                          : ''
                      }`}
                    >
                      <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1.5">
                        {product.category_name}
                      </div>

                      <h3 className={viewMode === 'grid' ? 'text-sm mb-2' : 'text-base mb-3'}>
                        {product.name}
                      </h3>

                      <div className="flex items-center gap-1.5 mb-2 text-[10px] text-muted-foreground">
                        <Package className="w-3 h-3" strokeWidth={1.25} />
                        {sizes.length} presentación{sizes.length !== 1 ? 'es' : ''}
                      </div>

                      <div className={`flex flex-wrap gap-1.5 mb-3 ${viewMode === 'list' ? 'mb-4' : ''}`}>
                        {sizes.map((size) => (
                          <button
                            key={size}
                            onClick={() => setSelectedSizes({ ...selectedSizes, [product.id]: size })}
                            className={`text-[10px] border px-1.5 py-0.5 transition-colors ${
                              (selectedSizes[product.id] ?? sizes[0]) === size
                                ? 'bg-foreground text-background border-foreground'
                                : 'text-muted-foreground border-border hover:border-foreground'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <div className={viewMode === 'grid' ? 'text-xs' : 'text-sm'}>
                          {formatPrice(product.price, product.currency ?? 'COP')}
                        </div>

                        <motion.button
                          whileHover={{ x: 3 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleAddToCart(product)}
                          className="text-[10px] tracking-wider uppercase hover:opacity-50 transition-opacity"
                        >
                          Añadir →
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}

        {!isLoading && !error && currentProducts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Search
              className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20"
              strokeWidth={1}
            />

            <div className="text-sm text-muted-foreground">No se encontraron productos</div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {quickViewProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQuickViewProduct(null)}
              className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-50"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-background border border-border z-50 max-h-[90vh] overflow-y-auto"
            >
              <div className="grid md:grid-cols-2">
                <div className="aspect-[4/3] md:aspect-square bg-secondary relative">
                  <img
                    src={getProductImage(quickViewProduct)}
                    alt={quickViewProduct.name}
                    className="w-full h-full object-cover"
                  />

                  {getProductBadge(quickViewProduct) && (
                    <div className="absolute top-6 left-6 px-4 py-2 bg-foreground text-background text-[10px] tracking-[0.2em] uppercase font-medium flex items-center gap-2">
                      {getProductBadge(quickViewProduct) === 'nuevo' ? (
                        <Sparkles className="w-3 h-3" strokeWidth={1.5} />
                      ) : (
                        <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
                      )}
                      {getProductBadge(quickViewProduct)}
                    </div>
                  )}
                </div>

                <div className="p-6 md:p-12 flex flex-col relative">
                  <button
                    onClick={() => setQuickViewProduct(null)}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Cerrar vista rápida"
                  >
                    ✕
                  </button>

                  <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
                    {quickViewProduct.category_name}
                  </div>

                  <h2 className="text-3xl md:text-4xl mb-4 leading-tight">
                    {quickViewProduct.name}
                  </h2>

                  <div className="flex items-center gap-2 mb-6 text-xs text-muted-foreground">
                    <Package className="w-4 h-4" strokeWidth={1.25} />
                    {getProductSizes(quickViewProduct).length} presentación
                    {getProductSizes(quickViewProduct).length !== 1 ? 'es' : ''}
                  </div>

                  <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                    {getProductDescription(quickViewProduct)}
                  </p>

                  <div className="text-3xl mb-6">
                    {formatPrice(quickViewProduct.price, quickViewProduct.currency ?? 'COP')}
                  </div>

                  <div className="mb-8">
                    <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                      Presentación
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {getProductSizes(quickViewProduct).map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSizes({ ...selectedSizes, [quickViewProduct.id]: size })}
                          className={`px-4 py-2 text-xs border transition-all ${
                            (selectedSizes[quickViewProduct.id] ?? getProductSizes(quickViewProduct)[0]) === size
                              ? 'bg-foreground text-background border-foreground'
                              : 'border-border hover:border-foreground'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-auto">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAddToCart(quickViewProduct, true)}
                      className="flex-1 py-4 bg-foreground text-background text-xs tracking-[0.25em] uppercase hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      <CartIcon className="w-4 h-4" strokeWidth={1.5} />
                      Añadir al carrito
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleToggleSave(quickViewProduct.id, quickViewProduct.name)}
                      className={`p-4 border border-border hover:border-foreground transition-colors ${
                        isProductSaved(quickViewProduct.id)
                          ? 'bg-foreground text-background border-foreground'
                          : ''
                      }`}
                      aria-label="Guardar"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          isProductSaved(quickViewProduct.id) ? 'fill-current' : ''
                        }`}
                        strokeWidth={1.5}
                      />
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, SlidersHorizontal, Grid, List,
  Heart, Eye, ShoppingBag,
  Package, Star, X, ChevronLeft, ChevronRight,
  Minus, Plus, ChevronUp, ChevronDown, Truck, ShieldCheck, Leaf,
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
  type ProductVariant,
} from '../services/products.service';
import {
  getProductReviews,
  createProductReview,
  updateProductReview,
  deleteProductReview,
  type ProductReview,
} from '../services/reviews.service';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

const OLIVE = '#2D3A1F';

type ViewMode = 'grid' | 'list';
type PriceRange = 'all' | 'low' | 'mid' | 'high';
type CollectionFilter = 'all' | 'featured' | 'recent';
type CatalogBadge = 'nuevo' | 'destacado' | 'oferta';
type ProductGalleryItem = {
  src: string;
  size: string | null;
  variantId?: string;
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=900&q=80';
const PRODUCTS_PER_PAGE = 6;

/* ── Helpers ── */
function formatPrice(price: number | null, currency = 'COP'): string {
  if (price === null) return 'Consultar';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(price);
}

const STOCK_DISPLAY_CAP = 1000;

function formatStockLabel(quantity: number): string {
  if (quantity > STOCK_DISPLAY_CAP) return `+${STOCK_DISPLAY_CAP.toLocaleString('es-CO')} disponibles`;
  return `${Math.floor(quantity).toLocaleString('es-CO')} disponible${quantity === 1 ? '' : 's'}`;
}

function isRecentProduct(createdAt: string): boolean {
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= 1000 * 60 * 60 * 24 * 30;
}

function hasActivePromotion(product: CatalogProduct): boolean {
  if (product.active_promotion) return true;
  return product.variants.some(v => v.active_promotion != null);
}

function getDiscountedPrice(product: CatalogProduct, variant?: ProductVariant | null): number | null {
  if (variant !== undefined) return variant?.discounted_price ?? null;
  const promoVariant = product.variants.find(v => v.discounted_price != null);
  return promoVariant?.discounted_price ?? null;
}

function getDiscountPercentage(product: CatalogProduct, variant?: ProductVariant | null): number | null {
  const original = variant?.current_price ?? product.price;
  const discounted = getDiscountedPrice(product, variant);
  if (original === null || discounted === null || original <= 0) return null;
  return Math.round(((original - discounted) / original) * 100);
}

/**
 * Fotos del carrusel principal: todas pertenecen a la MISMA variante/presentación
 * seleccionada (su propia galería de hasta 3 fotos). No mezcla fotos de otras
 * presentaciones ni fotos genéricas del producto.
 */
function getVariantGallery(product: CatalogProduct, selectedVariant?: ProductVariant | null): ProductGalleryItem[] {
  const items: ProductGalleryItem[] = [];
  const seen = new Set<string>();

  const add = (src: string | null | undefined, size: string | null, variantId?: string) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    items.push({ src, size, variantId });
  };

  const variantImages = selectedVariant?.images ?? [];
  if (variantImages.length > 0) {
    [...variantImages]
      .sort((a, b) => (a.is_primary === b.is_primary ? a.position - b.position : a.is_primary ? -1 : 1))
      .forEach(img => add(img.image, selectedVariant?.presentation ?? null, selectedVariant?.id));
  } else {
    add(selectedVariant?.image_url, selectedVariant?.presentation ?? null, selectedVariant?.id);
  }
  if (items.length === 0) {
    add(product.primary_image, selectedVariant?.presentation ?? null);
  }
  if (items.length === 0) {
    add(FALLBACK_IMAGE, selectedVariant?.presentation ?? null);
  }

  return items;
}

/**
 * Una imagen representativa por cada variante/presentación distinta del MISMO
 * producto. Solo tiene sentido mostrarla si el producto tiene más de una variante.
 */
function getSiblingVariantThumbnails(product: CatalogProduct): ProductGalleryItem[] {
  if (product.variants.length <= 1) return [];
  const items: ProductGalleryItem[] = [];
  const seen = new Set<string>();

  product.variants.forEach(variant => {
    const primaryImage = [...variant.images].sort((a, b) => (a.is_primary === b.is_primary ? a.position - b.position : a.is_primary ? -1 : 1))[0];
    const src = primaryImage?.image || variant.image_url || FALLBACK_IMAGE;
    if (seen.has(variant.presentation)) return;
    seen.add(variant.presentation);
    items.push({ src, size: variant.presentation, variantId: variant.id });
  });

  return items;
}

function getDisplayedPrice(product: CatalogProduct, variant?: ProductVariant | null): number | null {
  return getDiscountedPrice(product, variant) ?? variant?.current_price ?? product.price;
}

function getProductOriginalPrice(product: CatalogProduct, variant?: ProductVariant | null): number | null {
  return variant?.current_price ?? product.price;
}

function getProductBadge(product: CatalogProduct): CatalogBadge | undefined {
  if (hasActivePromotion(product)) return 'oferta';
  if (product.is_featured) return 'destacado';
  if (isRecentProduct(product.created_at)) return 'nuevo';
  return undefined;
}

function getProductImage(product: CatalogProduct, variant?: ProductVariant | null): string {
  return variant?.image_url || product.primary_image || product.image_urls[0] || FALLBACK_IMAGE;
}


function getProductSizes(product: CatalogProduct): string[] {
  return product.sizes.length > 0 ? product.sizes : ['Presentación única'];
}

function getProductDescription(product: CatalogProduct): string {
  if (product.description.trim()) return product.description;
  return `Disponible en ${getProductSizes(product).length} presentación(es).`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No se pudo cargar el catálogo en este momento.';
}

/* ── Stars ── */
function Stars({ n = 4, size = 'w-3 h-3' }: { n?: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i}
          className={`${size} ${i < n ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200'}`}
          strokeWidth={0}
        />
      ))}
    </div>
  );
}

/* ── Acordeón ── */
function Accordion({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-200">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-4 text-[13px] text-stone-700 font-medium hover:text-stone-900 transition-colors"
      >
        {label}
        <span className="text-stone-400 text-lg leading-none">{open ? '−' : '+'}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pb-4 text-[12.5px] text-stone-500 leading-relaxed">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Selector de estrellas interactivo ── */
function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
      {Array.from({ length: 5 }, (_, i) => {
        const n = i + 1;
        const filled = n <= (hover || value);
        return (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            className="p-0.5"
            aria-label={`${n} estrella${n === 1 ? '' : 's'}`}
          >
            <Star
              className={`w-6 h-6 transition-colors ${filled ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200'}`}
              strokeWidth={0}
            />
          </button>
        );
      })}
    </div>
  );
}

function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Sección de reseñas estilo Play Store ── */
function ProductReviewsSection({
  productId,
  reviews,
  loading,
  currentUserId,
  onLoginRequired,
  onSubmit,
  onDelete,
}: {
  productId: string;
  reviews: ProductReview[];
  loading: boolean;
  currentUserId: string | null | undefined;
  onLoginRequired: () => void;
  onSubmit: (rating: number, comment: string) => Promise<void>;
  onDelete: (reviewId: string) => Promise<void>;
}) {
  const myReview = reviews.find(r => r.user === currentUserId) ?? null;
  const [rating, setRating] = useState(myReview?.rating ?? 0);
  const [comment, setComment] = useState(myReview?.comment ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setRating(myReview?.rating ?? 0);
    setComment(myReview?.comment ?? '');
  }, [myReview?.id, productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUserId === null || currentUserId === undefined) {
      onLoginRequired();
      return;
    }
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await onSubmit(rating, comment.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-16 pt-10 border-t border-stone-100">
      <h2 className="text-[20px] font-light text-stone-900 mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>
        Reseñas de clientes
      </h2>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Formulario para escribir/editar reseña */}
        <div className="bg-stone-50 rounded-xl p-5">
          <p className="text-[12.5px] font-semibold text-stone-700 mb-3">
            {myReview ? 'Edita tu reseña' : '¿Ya probaste este producto?'}
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <StarPicker value={rating} onChange={setRating} />
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Cuéntanos qué te pareció..."
              rows={3}
              className="w-full rounded-lg border border-stone-200 px-3 py-2.5 text-[13px] text-stone-700 outline-none focus:border-stone-400 resize-none bg-white"
            />
            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="px-5 py-2.5 text-[11px] tracking-[0.2em] uppercase font-semibold rounded-lg text-white disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: OLIVE }}
            >
              {submitting ? 'Enviando...' : myReview ? 'Actualizar reseña' : 'Publicar reseña'}
            </button>
          </form>
        </div>

        {/* Resumen */}
        <div className="flex items-center justify-center bg-stone-50 rounded-xl p-5">
          {reviews.length > 0 ? (
            <div className="text-center">
              <p className="text-[36px] font-semibold text-stone-900 leading-none mb-1">
                {(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)}
              </p>
              <Stars n={Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length)} size="w-4 h-4" />
              <p className="text-[11.5px] text-stone-500 mt-2">{reviews.length} reseña{reviews.length === 1 ? '' : 's'}</p>
            </div>
          ) : (
            <p className="text-[13px] text-stone-400">Aún no hay reseñas para este producto.</p>
          )}
        </div>
      </div>

      {/* Lista de reseñas */}
      <div className="mt-8 space-y-5">
        {loading && <p className="text-[13px] text-stone-400">Cargando reseñas...</p>}
        {!loading && reviews.map(review => (
          <div key={review.id} className="border-b border-stone-100 pb-5">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-[12px] font-semibold text-stone-600">
                  {review.userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[12.5px] font-semibold text-stone-800">{review.userName}</p>
                  <div className="flex items-center gap-2">
                    <Stars n={review.rating} size="w-3 h-3" />
                    <span className="text-[10.5px] text-stone-400">{formatReviewDate(review.createdAt)}</span>
                  </div>
                </div>
              </div>
              {review.user === currentUserId && (
                <button
                  onClick={() => onDelete(review.id)}
                  className="text-[10.5px] text-stone-400 hover:text-rose-500 transition-colors"
                >
                  Eliminar
                </button>
              )}
            </div>
            {review.comment && (
              <p className="text-[13px] text-stone-600 leading-relaxed pl-[42px]">{review.comment}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Página de producto completa (overlay) ── */
export function ProductPage({
  product,
  allProducts,
  selectedSizes,
  onSelectSize,
  onAddToCart,
  onToggleSave,
  isSaved,
  onClose,
  isProductSaved,
  onNavigateTo,
  onLoginRequired,
}: {
  product: CatalogProduct;
  allProducts: CatalogProduct[];
  selectedSizes: Record<string, string>;
  onSelectSize: (id: string, size: string) => void;
  onAddToCart: (p: CatalogProduct) => void;
  onToggleSave: (id: string, name: string) => void;
  isSaved: boolean;
  onClose: () => void;
  isProductSaved: (id: string) => boolean;
  onNavigateTo: (p: CatalogProduct) => void;
  onLoginRequired?: () => void;
}) {
  const sizes = getProductSizes(product);
  const selSize = selectedSizes[product.id] ?? sizes[0];
  const selVariant = product.variants.find(v => v.presentation === selSize) ?? product.variants[0];
  const gallery = useMemo(() => getVariantGallery(product, selVariant), [product, selVariant]);
  const images = gallery.map(item => item.src);
  const siblingThumbnails = useMemo(() => getSiblingVariantThumbnails(product), [product]);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useUser();
  const toast = useToast();

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const related = allProducts
    .filter(p => p.id !== product.id && p.category_id === product.category_id)
    .slice(0, 3);

  // Resetear estado al cambiar de producto y scrollear arriba
  useEffect(() => {
    setActiveImg(0);
    setQty(1);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [product.id]);

  // Volver a la imagen principal al cambiar de talla/variante
  useEffect(() => {
    setActiveImg(0);
  }, [selSize]);

  useEffect(() => {
    if (activeImg >= images.length) setActiveImg(0);
  }, [activeImg, images.length]);

  const activateGalleryImage = (index: number) => {
    const safeIndex = ((index % images.length) + images.length) % images.length;
    const item = gallery[safeIndex];
    setActiveImg(safeIndex);
    if (item?.size && item.size !== selSize) {
      onSelectSize(product.id, item.size);
    }
  };

  useEffect(() => {
    let isMounted = true;
    setReviewsLoading(true);
    getProductReviews(product.id)
      .then(data => { if (isMounted) setReviews(data); })
      .catch(() => { if (isMounted) toast.error('No se pudieron cargar las reseñas.'); })
      .finally(() => { if (isMounted) setReviewsLoading(false); });
    return () => { isMounted = false; };
  }, [product.id]);

  const reviewSummary = useMemo(() => {
    if (reviews.length === 0) return { average: null as number | null, count: 0 };
    const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    return { average, count: reviews.length };
  }, [reviews]);

  const handleReviewSubmit = async (rating: number, comment: string) => {
    const existing = reviews.find(r => r.user === currentUser?.id);
    try {
      if (existing) {
        const updated = await updateProductReview(existing.id, { rating, comment });
        setReviews(prev => prev.map(r => (r.id === updated.id ? updated : r)));
        toast.success('Reseña actualizada');
      } else {
        const created = await createProductReview(product.id, { rating, comment });
        setReviews(prev => [created, ...prev]);
        toast.success('¡Gracias por tu reseña!');
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const handleReviewDelete = async (reviewId: string) => {
    try {
      await deleteProductReview(reviewId);
      setReviews(prev => prev.filter(r => r.id !== reviewId));
      toast.success('Reseña eliminada');
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  useBodyScrollLock(true);

  return (
    <motion.div
      ref={scrollRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-[80] bg-white overflow-y-auto"
    >
      {/* ── Top bar: breadcrumb + cerrar ── */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-stone-100 px-6 md:px-10 lg:px-16 py-3 flex items-center justify-between">
        <nav className="flex items-center gap-1.5 text-[11.5px] text-stone-400">
          <button onClick={onClose} className="hover:text-stone-700 transition-colors">Inicio</button>
          <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
          <span className="text-stone-500">{product.category_name}</span>
          <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
          <span className="text-stone-800 font-medium truncate max-w-[200px]">{product.name}</span>
        </nav>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-stone-100 transition-colors text-stone-400 hover:text-stone-700"
        >
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* ── CUERPO PRINCIPAL ── */}
      <div className="max-w-[1160px] mx-auto px-6 md:px-10 lg:px-16 py-10">
        <div className="grid lg:grid-cols-[auto_1fr_380px] gap-6 lg:gap-10 items-start">

          {/* Columna 1: Thumbnail rail vertical */}
          <div className="hidden lg:flex flex-col items-center gap-2 w-[104px]">
            <button
              onClick={() => activateGalleryImage(Math.max(0, activeImg - 1))}
              disabled={activeImg === 0}
              className="p-1.5 text-stone-300 hover:text-stone-600 disabled:opacity-20 transition-colors"
            >
              <ChevronUp className="w-5 h-5" strokeWidth={1.5} />
            </button>
            {(siblingThumbnails.length > 0 ? siblingThumbnails : gallery).map((item, i) => {
              const isSiblingMode = siblingThumbnails.length > 0;
              const isActive = isSiblingMode ? item.size === selSize : activeImg === i;
              return (
                <button
                  key={item.variantId ?? i}
                  onClick={() => (isSiblingMode ? item.size && onSelectSize(product.id, item.size) : activateGalleryImage(i))}
                  className={`w-[100px] h-[100px] rounded-xl overflow-hidden border-2 transition-all duration-150 flex-shrink-0 ${
                    isActive
                      ? 'border-stone-800 shadow-sm'
                      : 'border-stone-200 opacity-55 hover:opacity-100 hover:border-stone-400'
                  }`}
                >
                  <img src={item.src} alt="" className="w-full h-full object-cover" draggable={false} />
                </button>
              );
            })}
            <button
              onClick={() => activateGalleryImage(Math.min(images.length - 1, activeImg + 1))}
              disabled={activeImg === images.length - 1}
              className="p-1.5 text-stone-300 hover:text-stone-600 disabled:opacity-20 transition-colors"
            >
              <ChevronDown className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Columna 2: Imagen principal */}
          <div className="relative rounded-2xl overflow-hidden bg-[#F4F1EC]" style={{ aspectRatio: '3/4' }}>
            <AnimatePresence mode="wait">
              <motion.img
                key={`${product.id}-${activeImg}`}
                src={images[activeImg]}
                alt={product.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </AnimatePresence>
            <button
              onClick={() => activateGalleryImage(activeImg - 1)}
              className="lg:hidden absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/85 rounded-full text-stone-600 shadow"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => activateGalleryImage(activeImg + 1)}
              className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/85 rounded-full text-stone-600 shadow"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, i) => (
                <button key={i} onClick={() => activateGalleryImage(i)}
                  className={`rounded-full transition-all duration-300 ${
                    activeImg === i ? 'w-6 h-1.5 bg-stone-700' : 'w-1.5 h-1.5 bg-stone-300/70 hover:bg-stone-400'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Columna 3: Panel derecho */}
          <div className="flex flex-col">
            <p className="text-[10px] tracking-[0.28em] uppercase text-stone-400 mb-2">{product.category_name}</p>
            <h1 className="text-[32px] font-light text-stone-900 leading-tight mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
              {product.name}
            </h1>
            <p className="text-[13px] text-stone-500 leading-relaxed mb-4">{getProductDescription(product)}</p>

            <button
              onClick={() => reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="flex items-center gap-2 mb-5 w-fit"
            >
              <Stars n={Math.round(reviewSummary.average ?? 0)} size="w-3.5 h-3.5" />
              <span className="text-[11.5px] text-stone-500 hover:text-stone-700 transition-colors">
                {reviewSummary.count > 0
                  ? `${reviewSummary.average?.toFixed(1)} · ${reviewSummary.count} reseña${reviewSummary.count === 1 ? '' : 's'}`
                  : 'Sé el primero en opinar'}
              </span>
            </button>

            {getDiscountedPrice(product, selVariant) !== null ? (
              <p className="flex items-center gap-3 mb-6">
                <span className="text-[16px] text-red-500 line-through">
                  {formatPrice(getProductOriginalPrice(product, selVariant), product.currency ?? 'COP')}
                </span>
                <span className="text-[28px] font-semibold text-emerald-600">
                  {formatPrice(getDisplayedPrice(product, selVariant), product.currency ?? 'COP')}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold text-white bg-red-600 border border-red-600 rounded-full">
                  -{getDiscountPercentage(product, selVariant)}%
                </span>
              </p>
            ) : (
              <p className="text-[28px] font-semibold text-stone-900 mb-6">
                {formatPrice(getDisplayedPrice(product, selVariant), product.currency ?? 'COP')}
              </p>
            )}
            <div className="w-full h-px bg-stone-100 mb-6" />

            {sizes.length > 0 && (
              <div className="mb-5">
                <p className="text-[9.5px] tracking-[0.28em] uppercase text-stone-500 font-semibold mb-3">Tamaño</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map(size => (
                    <button key={size} onClick={() => onSelectSize(product.id, size)}
                      className={`px-4 py-2 text-[12.5px] rounded-lg border transition-all font-semibold ${
                        selSize === size ? 'border-[#2D3A1F] bg-[#2D3A1F] text-white shadow-sm' : 'border-stone-200 text-stone-500 hover:border-stone-400'
                      }`}
                      aria-pressed={selSize === size}
                    >{size}</button>
                  ))}
                </div>
              </div>
            )}

            {selVariant?.available_quantity !== null && selVariant?.available_quantity !== undefined && (
              <p className={`text-[11.5px] mb-5 ${selVariant.available_quantity <= 0 ? 'text-red-600 font-semibold' : 'text-stone-500'}`}>
                {selVariant.available_quantity <= 0 ? 'Agotado' : `Stock: ${formatStockLabel(selVariant.available_quantity)}`}
              </p>
            )}

            <div className="mb-6">
              <p className="text-[9.5px] tracking-[0.28em] uppercase text-stone-500 font-semibold mb-3">Cantidad</p>
              <div className="flex items-center border border-stone-200 rounded-xl w-fit overflow-hidden">
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="px-4 py-3 text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors">
                  <Minus className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
                <span className="px-5 py-3 text-[13px] font-medium text-stone-800 border-x border-stone-200 min-w-[52px] text-center">{qty}</span>
                <button onClick={() => setQty(q => q + 1)}
                  className="px-4 py-3 text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors">
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            <div className="flex gap-2 mb-6">
              <motion.button whileHover={{ opacity: 0.88 }} whileTap={{ scale: 0.97 }}
                onClick={() => onAddToCart(product)}
                className="flex-1 py-4 text-white text-[11px] tracking-[0.26em] uppercase font-semibold rounded-xl"
                style={{ backgroundColor: OLIVE }}
              >
                Añadir al carrito
              </motion.button>
              <button onClick={() => onToggleSave(product.id, product.name)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  isSaved ? 'bg-rose-500 border-rose-500 text-white' : 'border-stone-200 text-stone-400 hover:border-rose-300 hover:text-rose-400'
                }`}
              >
                <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} strokeWidth={1.5} />
              </button>
            </div>

            <div className="bg-stone-50 rounded-xl px-5 py-4 space-y-3 mb-6">
              {[
                { Icon: Truck, text: 'Envíos a toda Colombia' },
                { Icon: ShieldCheck, text: 'Pagos seguros' },
                { Icon: Leaf, text: 'Ingredientes naturales' },
              ].map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-stone-400 flex-shrink-0" strokeWidth={1.3} />
                  <span className="text-[12px] text-stone-600">{text}</span>
                </div>
              ))}
            </div>

            <div>
              <Accordion label="Descripción">{getProductDescription(product)}</Accordion>
              <Accordion label="Ingredientes">
                Fórmula con ingredientes de origen botánico seleccionados por su eficacia. Libre de sulfatos, parabenos y siliconas.
              </Accordion>
              <Accordion label="Modo de uso">
                Aplicar sobre el cabello húmedo o seco. Masajear suavemente y dejar actuar. Enjuagar si es necesario.
              </Accordion>
              <Accordion label="Envíos y devoluciones">
                Envío estándar 3–5 días hábiles. Express 24–48 h. Devoluciones gratuitas los primeros 30 días.
              </Accordion>
            </div>
          </div>
        </div>

        <div ref={reviewsRef}>
          <ProductReviewsSection
            productId={product.id}
            reviews={reviews}
            loading={reviewsLoading}
            currentUserId={currentUser?.id}
            onLoginRequired={() => {
              toast.info('Inicia sesión para escribir una reseña');
              onLoginRequired?.();
            }}
            onSubmit={handleReviewSubmit}
            onDelete={handleReviewDelete}
          />
        </div>

        {/* ── También te puede interesar ── */}
        {related.length > 0 && (
          <div className="mt-20 pt-10 border-t border-stone-100">
            <div className="flex items-end justify-between mb-8">
              <h2 className="text-[22px] font-light text-stone-900" style={{ fontFamily: "'Playfair Display', serif" }}>
                También te puede interesar
              </h2>
              <span className="text-[11px] text-stone-400">{related.length} producto{related.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {related.map(rp => {
                const rpSaved = isProductSaved(rp.id);
                return (
                  <div key={rp.id}
                    className="group flex flex-col bg-white rounded-2xl border border-stone-100 overflow-hidden hover:border-stone-200 hover:shadow-sm transition-all duration-300 cursor-pointer"
                    onClick={() => onNavigateTo(rp)}
                  >
                    {/* Imagen con overlay interactivo */}
                    <div className="relative overflow-hidden bg-[#FAFAF8] aspect-[3/4]">
                      <motion.img
                        whileHover={{ scale: 1.05 }} transition={{ duration: 0.45 }}
                        src={getProductImage(rp)} alt={rp.name}
                        className="w-full h-full object-cover"
                      />
                      {/* Overlay hover */}
                      <motion.div
                        initial={{ opacity: 0 }} whileHover={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/20 flex items-center justify-center gap-2"
                      >
                        <div className="p-2.5 bg-white rounded-full shadow-md text-stone-700">
                          <Eye className="w-4 h-4" strokeWidth={1.5} />
                        </div>
                      </motion.div>
                      {/* Corazón */}
                      <button
                        onClick={e => { e.stopPropagation(); onToggleSave(rp.id, rp.name); }}
                        className={`absolute top-3 right-3 p-2 rounded-full shadow transition-all ${
                          rpSaved ? 'bg-rose-500 text-white' : 'bg-white text-stone-400 opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${rpSaved ? 'fill-current' : ''}`} strokeWidth={1.5} />
                      </button>
                    </div>
                    {/* Info */}
                    <div className="flex flex-col flex-1 p-4">
                      <p className="text-[9px] tracking-[0.2em] uppercase text-stone-400 mb-1">{rp.category_name}</p>
                      <h3 className="text-[13.5px] font-medium text-stone-900 mb-2 leading-snug">{rp.name}</h3>
                      <div className="flex items-center gap-1.5 mb-3">
                        <Stars n={Math.round(rp.rating_average ?? 0)} size="w-3 h-3" />
                        <span className="text-[9px] text-stone-400">
                          {rp.rating_average !== null ? rp.rating_average.toFixed(1) : 'Nuevo'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-3 border-t border-stone-100">
                        <span className="text-sm font-semibold text-stone-900">
                          {formatPrice(rp.price, rp.currency ?? 'COP')}
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          onClick={e => { e.stopPropagation(); onAddToCart(rp); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-white text-[10px] font-semibold rounded-lg"
                          style={{ backgroundColor: OLIVE }}
                        >
                          <ShoppingBag className="w-3 h-3" strokeWidth={1.5} />
                          Añadir
                        </motion.button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Props ── */
interface ProductCatalogProps {
  onLoginRequired?: () => void;
}

export function ProductCatalog({ onLoginRequired }: ProductCatalogProps = {}) {
  const { addItem } = useCart();
  const { searchQuery: globalSearchQuery } = useSearch();
  const { currentUser, toggleSaveProduct, isProductSaved } = useUser();
  const toast = useToast();

  const [categories, setCategories]       = useState<ProductCategory[]>([]);
  const [products, setProducts]           = useState<CatalogProduct[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [viewMode, setViewMode]           = useState<ViewMode>('grid');
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [priceRange, setPriceRange]       = useState<PriceRange>('all');
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>('all');
  const [showFilters, setShowFilters]     = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<CatalogProduct | null>(null);
  const [isLoading, setIsLoading]         = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [currentPage, setCurrentPage]     = useState(1);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true); setError(null);
      try {
        const [cats, prods] = await Promise.all([
          getCategories(),
          getProducts({ limit: 100, active: true, ordering: 'name' }),
        ]);
        if (!isMounted) return;
        setCategories(cats.filter(c => c.is_active));
        setProducts(prods.data.filter(p => p.is_active));
      } catch (e) {
        if (isMounted) setError(getErrorMessage(e));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (globalSearchQuery) setLocalSearchQuery(globalSearchQuery);
  }, [globalSearchQuery]);

  useEffect(() => {
    if (activeCategory !== 'all' && categories.length > 0 &&
      !categories.some(c => c.id === activeCategory)) {
      setActiveCategory('all');
    }
  }, [activeCategory, categories]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, collectionFilter, localSearchQuery, priceRange]);

  const categoryTabs = useMemo(() => [
    { id: 'all', label: 'Todos', count: products.length },
    ...categories.map(c => ({
      id: c.id,
      label: c.name,
      count: products.filter(p => p.category_id === c.id).length,
    })),
  ], [categories, products]);

  const currentProducts = useMemo(() => {
    return products.filter(product => {
      const matchCat = activeCategory === 'all' || product.category_id === activeCategory;
      const q = localSearchQuery.trim().toLowerCase();
      const matchSearch = !q ||
        product.name.toLowerCase().includes(q) ||
        product.category_name.toLowerCase().includes(q) ||
        product.description.toLowerCase().includes(q) ||
        getProductSizes(product).some(s => s.toLowerCase().includes(q));
      const price = product.price ?? 0;
      const matchPrice =
        priceRange === 'all' ? true :
        priceRange === 'low' ? price < 25000 :
        priceRange === 'mid' ? price >= 25000 && price < 100000 :
        price >= 100000;
      const matchCol =
        collectionFilter === 'all' ? true :
        collectionFilter === 'featured' ? product.is_featured :
        isRecentProduct(product.created_at);
      return matchCat && matchSearch && matchPrice && matchCol;
    });
  }, [activeCategory, collectionFilter, localSearchQuery, priceRange, products]);

  const totalPages = Math.max(1, Math.ceil(currentProducts.length / PRODUCTS_PER_PAGE));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PRODUCTS_PER_PAGE;
    return currentProducts.slice(start, start + PRODUCTS_PER_PAGE);
  }, [currentPage, currentProducts]);
  const pageNumbers = useMemo(() => (
    Array.from({ length: totalPages }, (_, index) => index + 1)
  ), [totalPages]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleAddToCart = async (product: CatalogProduct, closeModal?: boolean) => {
    if (!currentUser) {
      if (closeModal) setQuickViewProduct(null);
      toast.info('Inicia sesión para añadir productos al carrito');
      onLoginRequired?.();
      return;
    }
    const sizes = getProductSizes(product);
    const size  = selectedSizes[product.id] || sizes[0];
    const variant = product.variants.find(v => v.presentation === size) ?? product.variants[0];
    if (!variant) { toast.error('Este producto no tiene una variante disponible.'); return; }
    const added = await addItem({
      variantId: variant.id,
      name: product.name,
      category: product.category_name,
      size,
      price: variant.discounted_price ?? variant.current_price ?? product.price ?? 0,
      image: getProductImage(product, variant),
    });
    if (added) toast.success(`${product.name} añadido al carrito`);
    if (closeModal) setQuickViewProduct(null);
  };

  const handleToggleSave = (productId: string, productName: string) => {
    if (!currentUser) {
      toast.info('Inicia sesión para guardar productos');
      onLoginRequired?.();
      return;
    }
    const was = isProductSaved(productId);
    toggleSaveProduct(productId);
    toast[was ? 'info' : 'success'](was ? `${productName} eliminado de guardados` : `${productName} guardado`);
  };

  return (
    <section id="catalogo" className="py-20" style={{ backgroundColor: '#F7F5F1' }}>
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-14">

        {/* ── HEADER editorial ── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65 }}
          className="mb-12"
        >
          {/* Hero title */}
          <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end mb-10">
            <div>
              <p className="text-[9px] tracking-[0.4em] uppercase text-stone-400 mb-4">
                Catálogo completo
              </p>
              <h2
                className="text-[56px] md:text-[72px] lg:text-[84px] font-light text-stone-900 leading-[0.92] tracking-tight"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Todos los<br />
                <em style={{ fontStyle: 'italic', color: OLIVE }}>productos</em>
              </h2>
            </div>
            <p className="text-sm text-stone-400 leading-relaxed max-w-[240px] lg:mb-2">
              Descubre nuestra línea completa de cuidado capilar natural.
              Fórmulas efectivas, ingredientes conscientes y resultados que se sienten.
            </p>
          </div>

          {/* Barra búsqueda + controles */}
          <div className="flex flex-col sm:flex-row gap-3 mb-7">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" strokeWidth={1.3} />
              <input
                type="search"
                value={localSearchQuery}
                onChange={e => setLocalSearchQuery(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full pl-11 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-base sm:text-[13px] text-stone-700 placeholder:text-stone-300 focus:outline-none focus:border-stone-400 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-3 text-[11px] tracking-[0.12em] uppercase font-medium border rounded-xl transition-all ${
                  showFilters
                    ? 'text-white border-transparent'
                    : 'border-stone-200 text-stone-500 hover:border-stone-400 bg-white'
                }`}
                style={showFilters ? { backgroundColor: OLIVE } : {}}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
                Filtros
              </button>
              <div className="flex gap-1">
                {(['grid', 'list'] as ViewMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`p-3 rounded-xl border transition-all ${
                      viewMode === mode
                        ? 'text-white border-transparent'
                        : 'border-stone-200 text-stone-400 hover:border-stone-300 bg-white'
                    }`}
                    style={viewMode === mode ? { backgroundColor: OLIVE } : {}}
                  >
                    {mode === 'grid'
                      ? <Grid className="w-4 h-4" strokeWidth={1.5} />
                      : <List className="w-4 h-4" strokeWidth={1.5} />
                    }
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
                <div className="grid sm:grid-cols-2 gap-6 p-6 bg-white rounded-2xl border border-stone-200">
                  <div>
                    <p className="text-[9px] tracking-[0.24em] uppercase text-stone-400 mb-3">Precio</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'all', label: 'Todos' },
                        { value: 'low', label: '< $25k' },
                        { value: 'mid', label: '$25k – $100k' },
                        { value: 'high', label: '> $100k' },
                      ].map(o => (
                        <button key={o.value}
                          onClick={() => setPriceRange(o.value as PriceRange)}
                          className={`px-3.5 py-1.5 text-[11px] border rounded-lg transition-all ${
                            priceRange === o.value
                              ? 'text-white border-transparent'
                              : 'border-stone-200 text-stone-500 hover:border-stone-400'
                          }`}
                          style={priceRange === o.value ? { backgroundColor: OLIVE } : {}}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] tracking-[0.24em] uppercase text-stone-400 mb-3">Colección</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'all', label: 'Todos' },
                        { value: 'featured', label: 'Destacados' },
                        { value: 'recent', label: 'Novedades' },
                      ].map(o => (
                        <button key={o.value}
                          onClick={() => setCollectionFilter(o.value as CollectionFilter)}
                          className={`px-3.5 py-1.5 text-[11px] border rounded-lg transition-all ${
                            collectionFilter === o.value
                              ? 'text-white border-transparent'
                              : 'border-stone-200 text-stone-500 hover:border-stone-400'
                          }`}
                          style={collectionFilter === o.value ? { backgroundColor: OLIVE } : {}}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Category tabs */}
          <div className="flex items-center gap-0 border-b border-stone-200 overflow-x-auto">
            {categoryTabs.map(tab => {
              const active = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  className="relative flex items-center gap-1.5 px-4 py-3 text-[11px] tracking-[0.12em] uppercase whitespace-nowrap transition-colors flex-shrink-0"
                  style={{ color: active ? OLIVE : '#9ca3af' }}
                >
                  {tab.label}
                  <span className={`text-[9px] ${active ? 'text-stone-400' : 'text-stone-300'}`}>
                    ({tab.count})
                  </span>
                  {active && (
                    <motion.div
                      layoutId="catalogTab"
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
        {isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-stone-100">
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
        {!isLoading && error && (
          <div className="text-center py-20">
            <Package className="w-10 h-10 mx-auto mb-4 text-stone-300" strokeWidth={1} />
            <p className="text-sm text-stone-400">{error}</p>
          </div>
        )}

        {/* ── Resultado búsqueda ── */}
        {!isLoading && !error && localSearchQuery && (
          <p className="text-[11px] text-stone-400 mb-5">
            {currentProducts.length} resultado{currentProducts.length !== 1 ? 's' : ''} para «{localSearchQuery}»
          </p>
        )}

        {/* ── GRID / LIST ── */}
        {!isLoading && !error && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeCategory}-${viewMode}-${currentPage}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={viewMode === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3'
                : 'flex flex-col gap-3'
              }
            >
              {paginatedProducts.map((product, index) => {
                const sizes  = getProductSizes(product);
                const badge  = getProductBadge(product);
                const saved  = isProductSaved(product.id);
                const selSize = selectedSizes[product.id] ?? sizes[0];
                const selVariant = product.variants.find(v => v.presentation === selSize) ?? product.variants[0];
                const originalPrice = getProductOriginalPrice(product, selVariant);
                const displayedPrice = getDisplayedPrice(product, selVariant);
                const hasSelectedDiscount = getDiscountedPrice(product, selVariant) !== null;
                const availableQty = selVariant?.available_quantity ?? null;
                const minimumQty = selVariant?.minimum_quantity ?? 0;
                const isLowStock = availableQty !== null && availableQty > 0 && availableQty <= minimumQty;
                const isOutOfStock = availableQty !== null && availableQty <= 0;

                if (viewMode === 'list') {
                  return (
                    <motion.div
                      key={product.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => setQuickViewProduct(product)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setQuickViewProduct(product); } }}
                      className="group flex gap-4 bg-white rounded-2xl border border-stone-100 p-4 hover:border-stone-200 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300"
                    >
                      <div className="w-24 h-24 rounded-xl overflow-hidden bg-stone-50 flex-shrink-0 relative">
                        <motion.img
                          whileHover={{ scale: 1.06 }} transition={{ duration: 0.4 }}
                          src={getProductImage(product, selVariant)} alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] tracking-[0.22em] uppercase text-stone-400 mb-0.5">{product.category_name}</p>
                        <h3 className="text-sm font-medium text-stone-900 mb-1 leading-snug">{product.name}</h3>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Stars n={Math.round(product.rating_average ?? 0)} />
                          <span className="text-[9px] text-stone-400">
                            {product.rating_average !== null ? product.rating_average.toFixed(1) : 'Nuevo'}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {sizes.slice(0, 3).map(s => (
                            <button key={s}
                              onClick={e => { e.stopPropagation(); setSelectedSizes({ ...selectedSizes, [product.id]: s }); }}
                              className={`px-2.5 py-0.5 text-[9px] border rounded-md transition-colors ${
                                selSize === s ? 'text-white border-transparent' : 'border-stone-200 text-stone-500'
                              }`}
                              style={selSize === s ? { backgroundColor: OLIVE } : {}}
                            >{s}</button>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between gap-2 flex-shrink-0">
                        {hasSelectedDiscount ? (
                          <span className="flex flex-col items-end">
                            <span className="text-[10px] text-red-500 line-through">
                              {formatPrice(originalPrice, product.currency ?? 'COP')}
                            </span>
                            <span className="text-base font-semibold text-emerald-600">
                              {formatPrice(displayedPrice, product.currency ?? 'COP')}
                            </span>
                          </span>
                        ) : (
                          <span className="text-base font-semibold text-stone-900">
                            {formatPrice(displayedPrice, product.currency ?? 'COP')}
                          </span>
                        )}
                        {isLowStock && !isOutOfStock && (
                          <p className="text-[10px] font-semibold text-amber-600">¡Solo quedan {availableQty}!</p>
                        )}
                        {isOutOfStock && (
                          <p className="text-[10px] font-semibold text-red-600">Agotado</p>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={e => { e.stopPropagation(); setQuickViewProduct(product); }}
                            className="p-2 border border-stone-200 rounded-lg text-stone-400 hover:border-stone-400 hover:text-stone-700 transition-all"
                          >
                            <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleAddToCart(product); }}
                            disabled={isOutOfStock}
                            className="flex items-center gap-1.5 px-4 py-2 text-white text-[10px] tracking-wide font-medium rounded-lg transition-opacity hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ backgroundColor: OLIVE }}
                          >
                            <ShoppingBag className="w-3 h-3" strokeWidth={1.5} />
                            {isOutOfStock ? 'Agotado' : 'Añadir'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                /* GRID CARD */
                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => setQuickViewProduct(product)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setQuickViewProduct(product); } }}
                    className="group flex flex-col bg-white rounded-2xl border border-stone-100 overflow-hidden hover:border-stone-200 hover:shadow-sm transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300"
                  >
                    {/* Imagen */}
                    <div className="relative overflow-hidden bg-[#FAFAF8] aspect-[4/5]">
                      <motion.img
                        whileHover={{ scale: 1.06 }}
                        transition={{ duration: 0.55 }}
                        src={getProductImage(product, selVariant)}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />

                      {/* Badge: solo se muestra cuando el producto está en oferta */}
                      {badge === 'oferta' && (
                        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-semibold border bg-red-600 text-white border-red-600">
                          {`-${getDiscountPercentage(product) ?? ''}% OFERTA`}
                        </div>
                      )}

                      {/* Overlay con botones: siempre visible en mobile/touch, hover en desktop */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        whileHover={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/10 md:bg-transparent md:hover:bg-black/25 backdrop-blur-[1px] md:backdrop-blur-0 md:hover:backdrop-blur-[1px] flex items-start justify-end md:items-center md:justify-center gap-2 p-2 md:p-0 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                      >
                        <motion.button
                          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                          onClick={e => { e.stopPropagation(); setQuickViewProduct(product); }}
                          className="p-2 md:p-3 bg-white rounded-full text-stone-700 shadow-md hover:bg-stone-50 transition-colors"
                          aria-label="Vista rápida"
                        >
                          <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={1.5} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                          onClick={e => { e.stopPropagation(); handleToggleSave(product.id, product.name); }}
                          className={`p-2 md:p-3 rounded-full shadow-md transition-all ${
                            saved ? 'bg-rose-500 text-white' : 'bg-white text-stone-400 hover:bg-stone-50'
                          }`}
                          aria-label="Guardar"
                        >
                          <Heart className={`w-3.5 h-3.5 md:w-4 md:h-4 ${saved ? 'fill-current' : ''}`} strokeWidth={1.5} />
                        </motion.button>
                      </motion.div>
                    </div>

                    {/* Info */}
                    <div className="flex flex-col flex-1 p-3">
                      <p className="text-[9px] tracking-[0.2em] uppercase text-stone-400 mb-1">
                        {product.category_name}
                      </p>
                      <h3 className="text-[13.5px] font-medium text-stone-900 leading-snug mb-2">
                        {product.name}
                      </h3>

                      {/* Stars */}
                      <div className="flex items-center gap-1.5 mb-3">
                        <Stars n={Math.round(product.rating_average ?? 0)} />
                        <span className="text-[9px] text-stone-400">
                          {product.rating_average !== null ? product.rating_average.toFixed(1) : 'Nuevo'}
                        </span>
                      </div>

                      {/* Tallas pill */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {sizes.slice(0, 3).map(s => (
                          <button
                            key={s}
                            onClick={e => { e.stopPropagation(); setSelectedSizes({ ...selectedSizes, [product.id]: s }); }}
                            className={`px-2.5 py-0.5 text-[9.5px] border rounded-md transition-colors ${
                              selSize === s ? 'text-white border-transparent' : 'border-stone-200 text-stone-500 hover:border-stone-400'
                            }`}
                            style={selSize === s ? { backgroundColor: OLIVE } : {}}
                          >
                            {s}
                          </button>
                        ))}
                      </div>

                      {/* Indicador de stock */}
                      {isOutOfStock && (
                        <p className="text-[10px] font-semibold text-red-600 mb-2">Agotado</p>
                      )}
                      {isLowStock && !isOutOfStock && (
                        <p className="text-[10px] font-semibold text-amber-600 mb-2">
                          ¡Solo quedan {availableQty} unidades!
                        </p>
                      )}

                      {/* Precio + botón */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mt-auto pt-3 border-t border-stone-100">
                        {hasSelectedDiscount ? (
                          <span className="flex flex-col">
                            <span className="text-[10px] text-red-500 line-through">
                              {formatPrice(originalPrice, product.currency ?? 'COP')}
                            </span>
                            <span className="text-lg font-semibold text-emerald-600">
                              {formatPrice(displayedPrice, product.currency ?? 'COP')}
                            </span>
                          </span>
                        ) : (
                          <span className="text-lg font-semibold text-stone-900">
                            {formatPrice(displayedPrice, product.currency ?? 'COP')}
                          </span>
                        )}
                        <motion.button
                          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                          onClick={e => { e.stopPropagation(); handleAddToCart(product); }}
                          disabled={isOutOfStock}
                          className="flex items-center gap-1.5 px-3.5 py-2 text-white text-[10px] font-semibold rounded-xl transition-opacity hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                          style={{ backgroundColor: OLIVE }}
                        >
                          {isOutOfStock ? 'Agotado' : 'Añadir al carrito'}
                          {!isOutOfStock && <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold leading-none flex-shrink-0">+</span>}
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Paginacion ── */}
        {!isLoading && !error && currentProducts.length > PRODUCTS_PER_PAGE && (
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[11px] text-stone-400">
              Mostrando {(currentPage - 1) * PRODUCTS_PER_PAGE + 1}-{Math.min(currentPage * PRODUCTS_PER_PAGE, currentProducts.length)} de {currentProducts.length} productos
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="p-2.5 rounded-xl border border-stone-200 bg-white text-stone-500 transition-all hover:border-stone-400 hover:text-stone-800 disabled:opacity-35 disabled:hover:border-stone-200 disabled:hover:text-stone-500"
                aria-label="Pagina anterior"
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
              </button>
              <div className="flex items-center gap-1">
                {pageNumbers.map(page => {
                  const active = currentPage === page;
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-10 h-10 rounded-xl border text-[12px] font-medium transition-all ${
                        active
                          ? 'text-white border-transparent'
                          : 'border-stone-200 bg-white text-stone-500 hover:border-stone-400 hover:text-stone-800'
                      }`}
                      style={active ? { backgroundColor: OLIVE } : {}}
                      aria-current={active ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="p-2.5 rounded-xl border border-stone-200 bg-white text-stone-500 transition-all hover:border-stone-400 hover:text-stone-800 disabled:opacity-35 disabled:hover:border-stone-200 disabled:hover:text-stone-500"
                aria-label="Pagina siguiente"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!isLoading && !error && currentProducts.length === 0 && (
          <div className="text-center py-20">
            <Search className="w-10 h-10 mx-auto mb-4 text-stone-200" strokeWidth={1} />
            <p className="text-sm text-stone-400">No se encontraron productos</p>
          </div>
        )}
      </div>

      {/* ── PÁGINA DE PRODUCTO ── */}
      <AnimatePresence>
        {quickViewProduct && (
          <ProductPage
            product={quickViewProduct}
            allProducts={products}
            selectedSizes={selectedSizes}
            onSelectSize={(id, size) => setSelectedSizes(prev => ({ ...prev, [id]: size }))}
            onAddToCart={handleAddToCart}
            onToggleSave={handleToggleSave}
            isSaved={isProductSaved(quickViewProduct.id)}
            onClose={() => setQuickViewProduct(null)}
            isProductSaved={isProductSaved}
            onNavigateTo={p => setQuickViewProduct(p)}
            onLoginRequired={onLoginRequired}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

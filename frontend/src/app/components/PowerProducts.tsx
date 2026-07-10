import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag, Heart, Star, X, Eye,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Minus, Plus, Truck, ShieldCheck, Leaf,
} from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import {
  getFeaturedProducts,
  getProducts,
  type Product as CatalogProduct,
} from '../services/products.service';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

const OLIVE = '#2D3A1F';
const FALLBACK_PRODUCT_IMAGE = 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=900&q=85';

interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  shortDesc: string;
  price: string;
  priceValue: number;
  originalPriceValue: number | null;
  discountPercent: number | null;
  currency: string;
  rating: number;
  reviews: number;
  badge: 'top' | 'nuevo' | 'pocas' | 'oferta';
  images: string[];
  imageItems: Array<{ src: string; size: string | null; variantId?: string }>;
  siblingVariantItems: Array<{ src: string; size: string | null; variantId?: string }>;
  sizes?: string[];
  variants?: CatalogProduct['variants'];
  description?: string;
  benefits?: string[];
  ingredients?: string[];
  stock?: number;
}

function formatPrice(value: number | null): string {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value ?? 0);
}

const STOCK_DISPLAY_CAP = 1000;

function formatStockLabel(quantity: number): string {
  if (quantity > STOCK_DISPLAY_CAP) return `+${STOCK_DISPLAY_CAP.toLocaleString('es-CO')} disponibles`;
  return `${Math.floor(quantity).toLocaleString('es-CO')} disponible${quantity === 1 ? '' : 's'}`;
}

function splitTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[,;|]/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  return [];
}

function pickVariantList(product: CatalogProduct, keys: string[]): string[] {
  const wanted = keys.map(key => key.toLowerCase());
  for (const variant of product.variants) {
    for (const [key, value] of Object.entries(variant.attributes ?? {})) {
      if (wanted.includes(key.toLowerCase())) {
        const list = splitTextList(value);
        if (list.length > 0) return list;
      }
    }
  }
  return [];
}

function buildShortDescription(description: string): string {
  const clean = description.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Producto de cuidado capilar disponible en nuestro catálogo.';
  return clean.length > 110 ? `${clean.slice(0, 107).trim()}...` : clean;
}

function productBadge(product: CatalogProduct): Product['badge'] {
  if (product.active_promotion || product.variants.some(variant => variant.active_promotion)) return 'oferta';
  const createdAt = new Date(product.created_at).getTime();
  const daysSinceCreated = Number.isFinite(createdAt)
    ? (Date.now() - createdAt) / (1000 * 60 * 60 * 24)
    : 999;

  if (daysSinceCreated <= 45) return 'nuevo';
  return product.is_featured ? 'top' : 'top';
}

function mapCatalogProduct(product: CatalogProduct): Product {
  const promoVariant = product.variants.find(variant => variant.discounted_price != null);
  const discountedPrice = promoVariant?.discounted_price ?? null;
  const displayPrice = discountedPrice ?? product.price ?? 0;
  const originalPriceValue = discountedPrice != null ? (promoVariant?.current_price ?? product.price ?? null) : null;
  const discountPercent = discountedPrice != null && originalPriceValue
    ? Math.round(((originalPriceValue - discountedPrice) / originalPriceValue) * 100)
    : null;
  const imageItems: Product['imageItems'] = [];
  const seen = new Set<string>();
  const addImage = (src: string | null | undefined, size: string | null, variantId?: string) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    imageItems.push({ src, size, variantId });
  };

  const firstVariant = product.variants[0];
  const firstVariantImages = [...(firstVariant?.images ?? [])].sort((a, b) =>
    a.is_primary === b.is_primary ? a.position - b.position : a.is_primary ? -1 : 1,
  );
  if (firstVariantImages.length > 0) {
    firstVariantImages.forEach(img => addImage(img.image, firstVariant?.presentation ?? null, firstVariant?.id));
  } else {
    addImage(firstVariant?.image_url, firstVariant?.presentation ?? null, firstVariant?.id);
  }
  if (imageItems.length === 0) {
    addImage(product.primary_image, null);
  }
  if (imageItems.length === 0) {
    addImage(FALLBACK_PRODUCT_IMAGE, null);
  }

  const images = imageItems.map(item => item.src);

  const siblingVariantItems: Product['imageItems'] = [];
  if (product.variants.length > 1) {
    const seenPresentation = new Set<string>();
    product.variants.forEach(variant => {
      if (seenPresentation.has(variant.presentation)) return;
      seenPresentation.add(variant.presentation);
      const primaryImage = [...variant.images].sort((a, b) => (a.is_primary === b.is_primary ? a.position - b.position : a.is_primary ? -1 : 1))[0];
      const src = primaryImage?.image || variant.image_url || FALLBACK_PRODUCT_IMAGE;
      siblingVariantItems.push({ src, size: variant.presentation, variantId: variant.id });
    });
  }

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category_name,
    shortDesc: buildShortDescription(product.description),
    price: formatPrice(displayPrice),
    priceValue: displayPrice,
    originalPriceValue,
    discountPercent,
    currency: product.currency ?? 'COP',
    rating: product.rating_average ?? 5,
    reviews: product.rating_count,
    badge: productBadge(product),
    images,
    imageItems,
    siblingVariantItems,
    sizes: product.sizes,
    variants: product.variants,
    description: product.description,
    benefits: pickVariantList(product, ['benefits', 'beneficios', 'beneficio']),
    ingredients: pickVariantList(product, ['ingredients', 'ingredientes', 'ingrediente']),
  };
}

/**
 * Descripciones creativas por presentación de la Loción Térmica de Cannabis,
 * usadas en el carrusel "Productos estrella". Se emparejan por tamaño (ml)
 * detectado en el nombre real del producto que trae el catálogo.
 */
const STAR_PRODUCT_TAGLINES: Record<string, { tag: string; description: string }> = {
  '60': {
    tag: 'De bolsillo',
    description: 'Tu dosis de calor y cuidado para el día a día. Cabe en cualquier bolso y protege del calor de la plancha o el secador en segundos.',
  },
  '150': {
    tag: 'El clásico',
    description: 'El tamaño ideal para el hogar. Termoprotección diaria que sella la fibra capilar y prepara tu cabello para cualquier herramienta de calor.',
  },
  '375': {
    tag: 'Para toda la familia',
    description: 'Rinde más, cuida más. Pensada para uso frecuente en casa o en el salón, con la misma fórmula de cannabis que calma y protege el cuero cabelludo.',
  },
};

function starProductTagline(name: string): { tag: string; description: string } {
  const match = name.match(/(\d+)\s*ML/i);
  const size = match?.[1];
  return (size && STAR_PRODUCT_TAGLINES[size]) || {
    tag: 'Producto estrella',
    description: 'Fórmula con extracto de cannabis que calma, protege y prepara tu cabello para el calor del día a día.',
  };
}

/**
 * Distancia circular más corta entre dos índices (mismo patrón que VideoRodillo),
 * para que el carrusel "envuelva" sin saltos largos al pasar del último al primero.
 */
function circularOffset(index: number, active: number, length: number): number {
  const raw = index - active;
  if (raw > length / 2) return raw - length;
  if (raw < -length / 2) return raw + length;
  return raw;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i}
          className={`w-3 h-3 ${i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200'}`}
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
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pb-4 text-[12.5px] text-stone-500 leading-relaxed">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Página de producto completa (overlay full-screen) ── */
function ProductPage({
  product,
  allProducts,
  selectedSizes,
  onSelectSize,
  onAddToCart,
  onToggleSave,
  isSaved,
  isProductSavedFn,
  onClose,
  onNavigateTo,
}: {
  product: Product;
  allProducts: Product[];
  selectedSizes: Record<string, string>;
  onSelectSize: (id: string, size: string) => void;
  onAddToCart: (p: Product) => void;
  onToggleSave: (id: string, name: string) => void;
  isSaved: boolean;
  isProductSavedFn: (id: string) => boolean;
  onClose: () => void;
  onNavigateTo: (p: Product) => void;
}) {
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sizes = product.sizes ?? [];
  const selSize = selectedSizes[product.id] ?? sizes[0] ?? '';
  const selectedVariant = product.variants?.find(v => v.presentation === selSize) ?? product.variants?.[0];
  const selectedPrice = selectedVariant?.discounted_price ?? selectedVariant?.current_price ?? product.priceValue;

  // Fotos de la variante/presentación seleccionada (carrusel principal): no mezcla
  // fotos de otras presentaciones, solo genéricas del producto + la propia de esa variante.
  const gallery = (() => {
    const items: Product['imageItems'] = [];
    const seen = new Set<string>();
    const add = (src: string | null | undefined, size: string | null, variantId?: string) => {
      if (!src || seen.has(src)) return;
      seen.add(src);
      items.push({ src, size, variantId });
    };
    const variantImages = [...(selectedVariant?.images ?? [])].sort((a, b) =>
      a.is_primary === b.is_primary ? a.position - b.position : a.is_primary ? -1 : 1,
    );
    if (variantImages.length > 0) {
      variantImages.forEach(img => add(img.image, selSize || null, selectedVariant?.id));
    } else {
      add(selectedVariant?.image_url, selSize || null, selectedVariant?.id);
    }
    if (items.length === 0) product.images.forEach(src => add(src, null));
    return items;
  })();
  const images = gallery.map(item => item.src);

  // Miniaturas de variantes hermanas (barra lateral): una por presentación distinta.
  const siblingThumbnails = product.siblingVariantItems;

  const related = allProducts.filter(p => p.id !== product.id && p.category === product.category).slice(0, 3);

  useEffect(() => {
    setActiveImg(0);
    setQty(1);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [product.id]);

  useEffect(() => {
    if (activeImg >= images.length) setActiveImg(0);
  }, [activeImg, images.length]);

  const activateGalleryImage = (index: number) => {
    const safeIndex = ((index % images.length) + images.length) % images.length;
    setActiveImg(safeIndex);
  };

  useBodyScrollLock(true);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      ref={scrollRef}
      className="fixed inset-0 z-[80] bg-white overflow-y-auto"
    >
      {/* Breadcrumb + cerrar */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-stone-100 px-6 md:px-10 lg:px-16 py-3 flex items-center justify-between">
        <nav className="flex items-center gap-1.5 text-[11.5px] text-stone-400">
          <button onClick={onClose} className="hover:text-stone-700 transition-colors">Inicio</button>
          <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
          <span className="text-stone-500">{product.category}</span>
          <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
          <span className="text-stone-800 font-medium">{product.name}</span>
        </nav>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-stone-100 transition-colors text-stone-400 hover:text-stone-700">
          <X className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="max-w-[1160px] mx-auto px-6 md:px-10 lg:px-16 py-10">
        <div className="grid lg:grid-cols-[auto_1fr_380px] gap-6 lg:gap-8 items-start">

          {/* Thumbnails verticales */}
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
                  className={`w-[100px] h-[100px] rounded-xl overflow-hidden border-2 bg-white transition-all flex-shrink-0 ${
                    isActive ? 'border-stone-800 shadow-sm' : 'border-stone-200 opacity-55 hover:opacity-100 hover:border-stone-400'
                  }`}
                >
                  <img src={item.src} alt="" className="w-full h-full object-contain p-2" draggable={false} />
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

          {/* Imagen principal */}
          <div className="relative rounded-2xl overflow-hidden bg-white" style={{ aspectRatio: '3/4' }}>
            <AnimatePresence mode="wait">
              <motion.img
                key={activeImg}
                src={images[activeImg]}
                alt={product.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="w-full h-full object-contain p-5 sm:p-7 lg:p-8"
                draggable={false}
              />
            </AnimatePresence>
            {/* Flechas móvil */}
            <button onClick={() => activateGalleryImage(activeImg - 1)}
              className="lg:hidden absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow">
              <ChevronLeft className="w-4 h-4 text-stone-600" strokeWidth={1.5} />
            </button>
            <button onClick={() => activateGalleryImage(activeImg + 1)}
              className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow">
              <ChevronRight className="w-4 h-4 text-stone-600" strokeWidth={1.5} />
            </button>
            {/* Dots */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, i) => (
                <button key={i} onClick={() => activateGalleryImage(i)}
                  className={`rounded-full transition-all duration-300 ${activeImg === i ? 'w-6 h-1.5 bg-stone-700' : 'w-1.5 h-1.5 bg-stone-300'}`}
                />
              ))}
            </div>
          </div>

          {/* Panel derecho */}
          <div className="flex flex-col">
            <p className="text-[10px] tracking-[0.28em] uppercase text-stone-400 mb-2">{product.category}</p>
            <h1 className="text-[32px] font-light text-stone-900 leading-tight mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
              {product.name}
            </h1>
            <p className="text-[13px] text-stone-500 leading-relaxed mb-4">{product.shortDesc}</p>

            {/* Estrellas */}
            <div className="flex items-center gap-2 mb-5">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(product.rating) ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200'}`} strokeWidth={0} />
                ))}
              </div>
              <span className="text-[11.5px] text-stone-500">({product.reviews} reseñas)</span>
            </div>

            <p className="text-[28px] font-semibold text-stone-900 mb-6">${formatPrice(selectedPrice)} <span className="text-xs text-stone-400 font-normal">COP</span></p>
            <div className="w-full h-px bg-stone-100 mb-6" />

            {/* Tallas */}
            {sizes.length > 0 && (
              <div className="mb-5">
                <p className="text-[9.5px] tracking-[0.28em] uppercase text-stone-500 font-semibold mb-3">Tamaño</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map(size => (
                    <button key={size}
                      onClick={() => onSelectSize(product.id, size)}
                      className={`px-4 py-2 text-[12.5px] rounded-lg border transition-all font-semibold ${
                        selSize === size ? 'border-[#2D3A1F] bg-[#2D3A1F] text-white shadow-sm' : 'border-stone-200 text-stone-500 hover:border-stone-400'
                      }`}
                      aria-pressed={selSize === size}
                    >{size}</button>
                  ))}
                </div>
              </div>
            )}

            {selectedVariant?.available_quantity !== null && selectedVariant?.available_quantity !== undefined && (
              <p className={`text-[11.5px] mb-5 ${selectedVariant.available_quantity <= 0 ? 'text-red-600 font-semibold' : 'text-stone-500'}`}>
                {selectedVariant.available_quantity <= 0 ? 'Agotado' : `Stock: ${formatStockLabel(selectedVariant.available_quantity)}`}
              </p>
            )}

            {/* Cantidad */}
            <div className="mb-6">
              <p className="text-[9.5px] tracking-[0.28em] uppercase text-stone-500 font-semibold mb-3">Cantidad</p>
              <div className="flex items-center border border-stone-200 rounded-xl w-fit overflow-hidden">
                <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-4 py-3 text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors">
                  <Minus className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
                <span className="px-5 py-3 text-[13px] font-medium text-stone-800 border-x border-stone-200 min-w-[52px] text-center">{qty}</span>
                <button onClick={() => setQty(q => q + 1)} className="px-4 py-3 text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors">
                  <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Botones */}
            <div className="flex gap-2 mb-6">
              <motion.button
                whileHover={{ opacity: 0.88 }} whileTap={{ scale: 0.97 }}
                onClick={() => onAddToCart(product)}
                className="flex-1 py-4 text-white text-[11px] tracking-[0.26em] uppercase font-semibold rounded-xl"
                style={{ backgroundColor: OLIVE }}
              >
                Añadir al carrito
              </motion.button>
              <button
                onClick={() => onToggleSave(product.id, product.name)}
                className={`p-4 rounded-xl border-2 transition-all ${isSaved ? 'bg-rose-500 border-rose-500 text-white' : 'border-stone-200 text-stone-400 hover:border-rose-300 hover:text-rose-400'}`}
              >
                <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} strokeWidth={1.5} />
              </button>
            </div>

            {/* Trust */}
            <div className="bg-stone-50 rounded-xl px-5 py-4 space-y-3 mb-6">
              {[
                { Icon: Truck,       text: 'Envíos a toda Colombia' },
                { Icon: ShieldCheck, text: 'Pagos seguros' },
                { Icon: Leaf,        text: 'Ingredientes naturales' },
              ].map(({ Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-stone-400 flex-shrink-0" strokeWidth={1.3} />
                  <span className="text-[12px] text-stone-600">{text}</span>
                </div>
              ))}
            </div>

            {/* Acordeones */}
            <div>
              <Accordion label="Descripción">{product.description ?? product.shortDesc}</Accordion>
              <Accordion label="Ingredientes">
                {product.ingredients ? product.ingredients.join(', ') : 'Fórmula con ingredientes de origen botánico seleccionados por su eficacia.'}
              </Accordion>
              <Accordion label="Modo de uso">
                Aplicar sobre el cabello húmedo o seco. Masajear suavemente y dejar actuar según el tipo de tratamiento.
              </Accordion>
              <Accordion label="Envíos y devoluciones">
                Envío estándar 3–5 días hábiles. Express 24–48 h. Devoluciones gratuitas en los primeros 30 días si el producto no ha sido abierto.
              </Accordion>
            </div>
          </div>
        </div>

        {/* También te puede interesar */}
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
                const rpSaved = isProductSavedFn(rp.id);
                return (
                  <div key={rp.id}
                    className="group flex flex-col bg-white rounded-2xl border border-stone-100 overflow-hidden hover:border-stone-200 hover:shadow-sm transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300"
                    onClick={() => onNavigateTo(rp)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigateTo(rp); } }}
                  >
                    <div className="relative overflow-hidden bg-white aspect-[3/4]">
                      <motion.img
                        whileHover={{ scale: 1.05 }} transition={{ duration: 0.45 }}
                        src={rp.images[0]} alt={rp.name}
                        className="w-full h-full object-contain p-4"
                      />
                      {/* Overlay eye */}
                      <motion.div
                        initial={{ opacity: 0 }} whileHover={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/20 flex items-center justify-center"
                      >
                        <div className="p-2.5 bg-white rounded-full shadow-md text-stone-700">
                          <Eye className="w-4 h-4" strokeWidth={1.5} />
                        </div>
                      </motion.div>
                      <button
                        onClick={e => { e.stopPropagation(); onToggleSave(rp.id, rp.name); }}
                        className={`absolute top-3 right-3 p-2 rounded-full shadow transition-all ${rpSaved ? 'bg-rose-500 text-white' : 'bg-white text-stone-400 opacity-0 group-hover:opacity-100'}`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${rpSaved ? 'fill-current' : ''}`} strokeWidth={1.5} />
                      </button>
                    </div>
                    <div className="flex flex-col flex-1 p-4">
                      <p className="text-[9px] tracking-[0.2em] uppercase text-stone-400 mb-1">{rp.category}</p>
                      <h3 className="text-[13.5px] font-medium text-stone-900 mb-2 leading-snug">{rp.name}</h3>
                      <div className="flex items-center gap-1.5 mb-3">
                        <Stars rating={rp.rating} />
                        <span className="text-[9px] text-stone-400">{rp.rating} ({rp.reviews})</span>
                      </div>
                      <div className="flex items-center justify-between mt-auto pt-3 border-t border-stone-100">
                        <span className="text-[15px] font-semibold text-stone-900">${rp.price} <span className="text-[9px] text-stone-400 font-normal">COP</span></span>
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

/* ── Carrusel 3D "Productos estrella": rota solo, imagen + descripción al lado ── */
function StarProductsCarousel({ products, onView, onAddToCart }: {
  products: Product[];
  onView: (p: Product) => void;
  onAddToCart: (p: Product) => void;
}) {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const total = products.length;

  const goTo = useCallback((index: number) => {
    setActive(((index % total) + total) % total);
  }, [total]);

  useEffect(() => {
    if (total <= 1) return;
    const timer = setInterval(() => {
      setActive(current => (current + 1) % total);
    }, 4500);
    return () => clearInterval(timer);
  }, [total]);

  useEffect(() => {
    if (active >= total) setActive(0);
  }, [active, total]);

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    goTo(active + (delta < 0 ? 1 : -1));
  };

  if (total === 0) return null;
  const current = products[active];
  const { tag, description } = starProductTagline(current.name);

  return (
    <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
      {/* Carrusel de imágenes: planas, sin efecto 3D */}
      <div
        className="relative flex items-center justify-center select-none"
        style={{ height: 'min(92vw, 460px)', touchAction: 'pan-y' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          onClick={() => goTo(active - 1)}
          aria-label="Producto anterior"
          className="hidden sm:flex absolute left-0 z-20 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center hover:scale-105 transition-transform"
          style={{ color: OLIVE }}
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={2} />
        </button>

        <div className="relative w-full h-full flex items-center justify-center">
          {products.map((product, index) => {
            const offset = circularOffset(index, active, total);
            const isActive = offset === 0;
            const visible = Math.abs(offset) <= 2;
            if (!visible) return null;

            const baseSize = isActive ? 'min(74vw, 420px)' : 'min(42vw, 220px)';

            return (
              <motion.div
                key={product.id}
                className="absolute overflow-visible"
                style={{ zIndex: 10 - Math.abs(offset) }}
                animate={{
                  x: `${offset * 130}%`,
                  opacity: isActive ? 1 : 0.85,
                }}
                initial={false}
                transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                onClick={() => (isActive ? onView(product) : goTo(index))}
              >
                <div
                  className="relative"
                  style={{ width: baseSize, height: baseSize, cursor: 'pointer' }}
                >
                  <motion.img
                    src={product.images[0]}
                    alt={product.name}
                    className="absolute inset-0 w-full h-full object-contain p-6"
                    draggable={false}
                    initial={{ y: 0, rotate: 0, scale: 1 }}
                    whileHover={isActive ? {
                      y: [-24, 0, -6, 0],
                      rotate: [-4, 3, -1.5, 0],
                      scale: [1.04, 0.97, 1.01, 1],
                      transition: { duration: 0.7, ease: [0.34, 1.56, 0.64, 1] },
                    } : undefined}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        <button
          onClick={() => goTo(active + 1)}
          aria-label="Siguiente producto"
          className="hidden sm:flex absolute right-0 z-20 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center hover:scale-105 transition-transform"
          style={{ color: OLIVE }}
        >
          <ChevronRight className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>

      {/* Descripción del producto activo */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
        >
          <span
            className="inline-block text-[10px] tracking-[0.28em] uppercase font-semibold px-3.5 py-1.5 rounded-full mb-5"
            style={{ backgroundColor: `${OLIVE}12`, color: OLIVE }}
          >
            {tag}
          </span>
          <h3 className="text-3xl md:text-4xl lg:text-5xl font-light text-stone-900 leading-tight mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            {current.name}
          </h3>
          <p className="text-base text-stone-500 leading-relaxed mb-7 max-w-lg">
            {description}
          </p>
          <p className="text-3xl md:text-4xl font-semibold text-stone-900 mb-7">
            ${current.price} <span className="text-sm text-stone-400 font-normal">COP</span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => onAddToCart(current)}
              className="flex items-center gap-2.5 px-7 py-4 text-white text-[12px] tracking-[0.2em] uppercase font-semibold rounded-full"
              style={{ backgroundColor: OLIVE }}
            >
              <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
              Añadir al carrito
            </motion.button>
            <button
              onClick={() => onView(current)}
              className="flex items-center gap-2 px-6 py-4 border border-stone-300 text-stone-700 text-[12px] tracking-[0.18em] uppercase font-medium rounded-full hover:border-stone-700 transition-all"
            >
              Ver detalle
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Indicadores */}
      <div className="lg:col-span-2 flex items-center justify-center gap-2 -mt-2">
        {products.map((product, index) => (
          <button
            key={product.id}
            onClick={() => goTo(index)}
            aria-label={`Ver ${product.name}`}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: index === active ? 20 : 6,
              backgroundColor: index === active ? OLIVE : '#D8D3C8',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ProductCardSkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className="bg-white rounded-2xl border border-stone-100 overflow-hidden"
    >
      <div className="aspect-[3/4] bg-stone-100 animate-pulse" />
      <div className="p-3.5 space-y-3">
        <div className="h-3 w-24 bg-stone-100 rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-stone-100 rounded animate-pulse" />
        <div className="h-3 w-full bg-stone-100 rounded animate-pulse" />
        <div className="h-8 w-full bg-stone-100 rounded animate-pulse" />
      </div>
    </motion.div>
  );
}

/* ── Componente principal ── */
export function PowerProducts({ onLoginRequired }: { onLoginRequired?: () => void } = {}) {
  const { currentUser, toggleSaveProduct, isProductSaved } = useUser();
  const { addItem } = useCart();
  const toast = useToast();
  const [selectedSize, setSelectedSize] = useState<Record<string, string>>({});
  const [viewProduct, setViewProduct]   = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProducts() {
      try {
        setIsLoading(true);
        setLoadError(null);

        // "Productos estrella": las presentaciones de la Loción Térmica de Cannabis.
        // Se prueban varios términos porque el nombre exacto puede variar en el catálogo
        // (p.ej. "Menthus Loción Térmica de Cannabis" vs "Loción Térmica de Cannabis").
        const searchTerms = ['termica de cannabis', 'locion termica cannabis', 'cannabis'];
        const found = new Map<string, CatalogProduct>();
        for (const term of searchTerms) {
          const result = await getProducts({ search: term, active: true, limit: 20, ordering: 'name' });
          for (const item of result.data) {
            if (!found.has(item.id) && /cannabis/i.test(`${item.name} ${item.description ?? ''}`)) {
              found.set(item.id, item);
            }
          }
          if (found.size >= 3) break;
        }

        let source = Array.from(found.values()).sort((a, b) => a.name.localeCompare(b.name));

        if (source.length === 0) {
          // Fallback por si el catálogo aún no tiene esos productos sembrados.
          const featured = await getFeaturedProducts(3);
          source = featured;
        }

        if (mounted) {
          setProducts(source.slice(0, 3).map(mapCatalogProduct));
        }
      } catch (error) {
        if (mounted) {
          setLoadError(error instanceof Error ? error.message : 'No fue posible cargar los productos destacados.');
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void loadProducts();

    return () => {
      mounted = false;
    };
  }, []);

  const handleAddToCart = async (product: Product) => {
    const size = selectedSize[product.id] || product.sizes?.[0] || '';
    try {
      const variant =
        product.variants?.find(v => v.is_active && v.presentation === size) ??
        product.variants?.find(v => v.is_active);
      if (!variant) { toast.warning('Sin presentación disponible.'); return; }
      const added = await addItem({
        variantId: variant.id,
        name: product.name,
        category: product.category,
        size: variant.presentation,
        price: variant.discounted_price ?? variant.current_price ?? product.priceValue,
        image: product.images[0],
      });
      if (added) toast.success(`${product.name} añadido al carrito`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No fue posible cargar el producto.');
    }
  };

  const handleToggleSave = (id: string, name: string) => {
    if (!currentUser) {
      toast.info('Inicia sesión para guardar productos');
      onLoginRequired?.();
      return;
    }
    const was = isProductSaved(id);
    toggleSaveProduct(id);
    toast[was ? 'info' : 'success'](was ? `${name} eliminado de guardados` : `${name} guardado`);
  };

  return (
    <section id="productos" className="py-20 bg-white">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-14">

        {/* Encabezado */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-10"
        >
          <div>
            <p className="text-[9px] tracking-[0.38em] uppercase text-stone-400 font-medium mb-3">
              Productos estrella
            </p>
            <h2
              className="text-4xl md:text-5xl font-light text-stone-900 leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Loción Térmica{' '}
              <em style={{ fontStyle: 'italic', color: OLIVE }}>de Cannabis</em>
            </h2>
            <p className="text-sm text-stone-500 mt-3 max-w-md leading-relaxed">
              La misma fórmula, en el tamaño perfecto para cada momento de tu rutina.
            </p>
          </div>
          <motion.a
            href="#catalogo"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="self-start sm:self-auto flex-shrink-0 flex items-center gap-2 px-5 py-2.5 border border-stone-300 text-stone-700 text-[11px] tracking-wide font-medium rounded-full hover:border-stone-700 transition-all whitespace-nowrap"
          >
            Ver catálogo completo →
          </motion.a>
        </motion.div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {Array.from({ length: 3 }, (_, i) => <ProductCardSkeleton key={i} index={i} />)}
          </div>
        ) : (
          <StarProductsCarousel
            products={products}
            onView={setViewProduct}
            onAddToCart={handleAddToCart}
          />
        )}

        {!isLoading && loadError && (
          <div className="mt-8 rounded-xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {loadError}
          </div>
        )}

        {!isLoading && !loadError && products.length === 0 && (
          <div className="mt-8 rounded-xl border border-stone-100 bg-white px-5 py-4 text-sm text-stone-500">
            Aún no hay productos destacados disponibles.
          </div>
        )}
      </div>

      {/* Página de producto */}
      <AnimatePresence>
        {viewProduct && (
          <ProductPage
            product={viewProduct}
            allProducts={products}
            selectedSizes={selectedSize}
            onSelectSize={(id, size) => setSelectedSize(s => ({ ...s, [id]: size }))}
            onAddToCart={handleAddToCart}
            onToggleSave={handleToggleSave}
            isSaved={isProductSaved(viewProduct.id)}
            isProductSavedFn={isProductSaved}
            onClose={() => setViewProduct(null)}
            onNavigateTo={p => setViewProduct(p)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

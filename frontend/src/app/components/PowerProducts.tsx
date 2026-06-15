import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag, Heart, Star, X,
  TrendingUp, Sparkles, Clock, Eye,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
  Minus, Plus, Truck, ShieldCheck, Leaf, Check,
} from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';
import { getProductBySlug } from '../services/products.service';

const OLIVE = '#2D3A1F';

interface Product {
  id: string;
  name: string;
  category: string;
  shortDesc: string;
  price: string;
  rating: number;
  reviews: number;
  badge: 'top' | 'nuevo' | 'pocas';
  images: string[];
  sizes?: string[];
  description?: string;
  benefits?: string[];
  ingredients?: string[];
  stock?: number;
}

const BADGE_CONFIG = {
  top:   { label: 'Más vendido',       icon: TrendingUp, bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  nuevo: { label: 'Nuevo',             icon: Sparkles,   bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pocas: { label: 'Últimas unidades',  icon: Clock,      bg: 'bg-rose-50 text-rose-700 border-rose-200' },
};

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

  const related = allProducts.filter(p => p.id !== product.id && p.category === product.category).slice(0, 3);

  useEffect(() => {
    setActiveImg(0);
    setQty(1);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [product.id]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

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
              onClick={() => setActiveImg(i => Math.max(0, i - 1))}
              disabled={activeImg === 0}
              className="p-1.5 text-stone-300 hover:text-stone-600 disabled:opacity-20 transition-colors"
            >
              <ChevronUp className="w-5 h-5" strokeWidth={1.5} />
            </button>
            {product.images.map((src, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(i)}
                className={`w-[100px] h-[100px] rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                  activeImg === i ? 'border-stone-800 shadow-sm' : 'border-stone-200 opacity-55 hover:opacity-100 hover:border-stone-400'
                }`}
              >
                <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
              </button>
            ))}
            <button
              onClick={() => setActiveImg(i => Math.min(product.images.length - 1, i + 1))}
              disabled={activeImg === product.images.length - 1}
              className="p-1.5 text-stone-300 hover:text-stone-600 disabled:opacity-20 transition-colors"
            >
              <ChevronDown className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* Imagen principal */}
          <div className="relative rounded-2xl overflow-hidden bg-[#F4F1EC]" style={{ aspectRatio: '3/4' }}>
            <AnimatePresence mode="wait">
              <motion.img
                key={activeImg}
                src={product.images[activeImg]}
                alt={product.name}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </AnimatePresence>
            {/* Flechas móvil */}
            <button onClick={() => setActiveImg(i => (i - 1 + product.images.length) % product.images.length)}
              className="lg:hidden absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow">
              <ChevronLeft className="w-4 h-4 text-stone-600" strokeWidth={1.5} />
            </button>
            <button onClick={() => setActiveImg(i => (i + 1) % product.images.length)}
              className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow">
              <ChevronRight className="w-4 h-4 text-stone-600" strokeWidth={1.5} />
            </button>
            {/* Dots */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {product.images.map((_, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
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

            <p className="text-[28px] font-semibold text-stone-900 mb-6">${product.price} <span className="text-xs text-stone-400 font-normal">COP</span></p>
            <div className="w-full h-px bg-stone-100 mb-6" />

            {/* Tallas */}
            {sizes.length > 0 && (
              <div className="mb-5">
                <p className="text-[9.5px] tracking-[0.28em] uppercase text-stone-500 font-semibold mb-3">Tamaño</p>
                <div className="flex flex-wrap gap-2">
                  {sizes.map(size => (
                    <button key={size}
                      onClick={() => onSelectSize(product.id, size)}
                      className={`px-4 py-2 text-[12.5px] rounded-lg border transition-all font-medium ${
                        selSize === size ? 'border-stone-800 text-stone-900 bg-white shadow-sm' : 'border-stone-200 text-stone-500 hover:border-stone-400'
                      }`}
                    >{size}</button>
                  ))}
                </div>
              </div>
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
                    className="group flex flex-col bg-white rounded-2xl border border-stone-100 overflow-hidden hover:border-stone-200 hover:shadow-sm transition-all duration-300 cursor-pointer"
                    onClick={() => onNavigateTo(rp)}
                  >
                    <div className="relative overflow-hidden bg-[#FAFAF8] aspect-[3/4]">
                      <motion.img
                        whileHover={{ scale: 1.05 }} transition={{ duration: 0.45 }}
                        src={rp.images[0]} alt={rp.name}
                        className="w-full h-full object-cover"
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
                        <span className="text-[13px] font-semibold text-stone-900">${rp.price} <span className="text-[9px] text-stone-400 font-normal">COP</span></span>
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

/* ── Card limpia: una sola imagen, hover overlay con ojo + corazón ── */
function ProductCard({ product, index, isSaved, onToggleSave, onAddToCart, onView }: {
  product: Product;
  index: number;
  isSaved: boolean;
  onToggleSave: (id: string, name: string) => void;
  onAddToCart: (p: Product) => void;
  onView: (p: Product) => void;
}) {
  const badge = BADGE_CONFIG[product.badge];

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
      className="group flex flex-col bg-white rounded-2xl border border-stone-100 overflow-hidden hover:border-stone-200 hover:shadow-sm transition-all duration-300"
    >
      {/* Imagen única */}
      <div className="relative aspect-[3/4] overflow-hidden bg-[#FAFAF8]">
        <motion.img
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.5 }}
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover"
          draggable={false}
        />

        {/* Badge */}
        <div className="absolute top-3 left-3">
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-semibold border ${badge.bg}`}>
            <badge.icon className="w-2.5 h-2.5" strokeWidth={2} />
            {badge.label}
          </span>
        </div>

        {/* Hover overlay: ojo + corazón */}
        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className="absolute inset-0 bg-black/22 backdrop-blur-[1px] flex items-center justify-center gap-3"
        >
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => onView(product)}
            className="p-3 bg-white rounded-full text-stone-700 shadow-md"
            aria-label="Ver producto"
          >
            <Eye className="w-4 h-4" strokeWidth={1.5} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => onToggleSave(product.id, product.name)}
            className={`p-3 rounded-full shadow-md transition-all ${isSaved ? 'bg-rose-500 text-white' : 'bg-white text-stone-400'}`}
            aria-label="Guardar"
          >
            <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} strokeWidth={1.5} />
          </motion.button>
        </motion.div>
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 p-4">
        <p className="text-[9px] tracking-[0.2em] uppercase text-stone-400 mb-1">{product.category}</p>
        <h3 className="text-[14px] font-medium text-stone-900 leading-snug mb-1">{product.name}</h3>
        <p className="text-[11px] text-stone-400 leading-snug mb-3 line-clamp-1">{product.shortDesc}</p>

        <div className="flex items-center gap-2 mb-3">
          <Stars rating={product.rating} />
          <span className="text-[9.5px] text-stone-400">{product.rating} ({product.reviews})</span>
        </div>

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-stone-100">
          <span className="text-[15px] font-semibold text-stone-900">${product.price} <span className="text-[9px] text-stone-400 font-normal">COP</span></span>
          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => onAddToCart(product)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-white text-[10px] font-semibold rounded-xl hover:opacity-85 transition-opacity"
            style={{ backgroundColor: OLIVE }}
          >
            <ShoppingBag className="w-3 h-3" strokeWidth={1.5} />
            Añadir
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Componente principal ── */
export function PowerProducts() {
  const { toggleSaveProduct, isProductSaved } = useUser();
  const { addItem } = useCart();
  const toast = useToast();
  const [selectedSize, setSelectedSize] = useState<Record<string, string>>({});
  const [viewProduct, setViewProduct]   = useState<Product | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const products: Product[] = [
    {
      id: 'aceite-romero',
      name: 'Aceite de Romero',
      category: 'Aceites Capilares',
      shortDesc: 'Estimula el crecimiento y fortalece desde la raíz.',
      price: '28.900',
      rating: 4.9,
      reviews: 128,
      badge: 'top',
      stock: 8,
      images: [
        'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=800&q=85',
        'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&q=80',
        'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=800&q=80',
      ],
      sizes: ['8ml', '60ml', '120ml'],
      description: 'Estimula el crecimiento capilar de forma natural. Rico en antioxidantes y nutrientes esenciales para fortalecer el cabello desde la raíz.',
      benefits: ['Estimula el crecimiento', 'Fortalece las raíces', 'Previene la caída', 'Aporta brillo natural'],
      ingredients: ['Aceite de romero', 'Vitamina E', 'Extracto de menta', 'Aceite de jojoba'],
    },
    {
      id: 'silicona-lino',
      name: 'Mascarilla Restaurativa',
      category: 'Tratamientos',
      shortDesc: 'Repara, hidrata y devuelve la vitalidad natural.',
      price: '24.900',
      rating: 4.8,
      reviews: 96,
      badge: 'nuevo',
      images: [
        'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=800&q=85',
        'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80',
        'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&q=80',
      ],
      sizes: ['8ml', '30ml', '50ml'],
      description: 'Mascarilla restaurativa de acción profunda que repara el cabello dañado y devuelve su vitalidad desde la primera aplicación.',
      benefits: ['Reparación profunda', 'Hidratación intensiva', 'Brillo y suavidad', 'Reduce el quiebre'],
      ingredients: ['Aceite de oliva', 'Manteca de karité', 'Queratina', 'Aloe vera'],
    },
    {
      id: 'tratamiento-keratina',
      name: 'Tratamiento Keratina',
      category: 'Tratamientos',
      shortDesc: 'Reconstrucción profunda, brillo y suavidad extrema.',
      price: '33.900',
      rating: 4.9,
      reviews: 72,
      badge: 'pocas',
      stock: 3,
      images: [
        'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=800&q=85',
        'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=800&q=80',
        'https://images.unsplash.com/photo-1585751119414-ef2636f8aede?w=800&q=80',
      ],
      sizes: ['30gr', '220gr'],
      description: 'Reconstrucción profunda del cabello dañado con keratina hidrolizada. Resultados visibles desde la primera aplicación.',
      benefits: ['Repara el cabello dañado', 'Reconstrucción profunda', 'Suavidad extrema', 'Efecto liso prolongado'],
      ingredients: ['Keratina hidrolizada', 'Colágeno', 'Aminoácidos', 'Pantenol', 'Aceite de argán'],
    },
  ];

  const handleAddToCart = async (product: Product) => {
    const size = selectedSize[product.id] || product.sizes?.[0] || '';
    try {
      const catalogProduct = await getProductBySlug(product.id);
      const variant =
        catalogProduct.variants.find(v => v.is_active && v.presentation === size) ??
        catalogProduct.variants.find(v => v.is_active);
      if (!variant) { toast.warning('Sin presentación disponible.'); return; }
      const added = await addItem({
        variantId: variant.id,
        name: catalogProduct.name,
        category: catalogProduct.category_name,
        size: variant.presentation,
        price: variant.current_price ?? catalogProduct.price ?? 0,
        image: catalogProduct.primary_image ?? product.images[0],
      });
      if (added) toast.success(`${catalogProduct.name} añadido al carrito`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No fue posible cargar el producto.');
    }
  };

  const handleToggleSave = (id: string, name: string) => {
    const was = isProductSaved(id);
    toggleSaveProduct(id);
    toast[was ? 'info' : 'success'](was ? `${name} eliminado de guardados` : `${name} guardado`);
  };

  const total = products.length;

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
              Productos destacados
            </p>
            <h2
              className="text-4xl md:text-5xl font-light text-stone-900 leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Esenciales para tu{' '}
              <em style={{ fontStyle: 'italic', color: OLIVE }}>rutina capilar</em>
            </h2>
            <p className="text-sm text-stone-500 mt-3 max-w-md leading-relaxed">
              Fórmulas naturales seleccionadas para nutrir, reparar y transformar tu cabello.
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

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          {products.map((p, i) => (
            <ProductCard
              key={p.id}
              product={p}
              index={i}
              isSaved={isProductSaved(p.id)}
              onToggleSave={handleToggleSave}
              onAddToCart={handleAddToCart}
              onView={setViewProduct}
            />
          ))}
        </div>

        {/* Dots nav */}
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setCurrentSlide(s => (s - 1 + total) % total)} className="p-1.5 text-stone-400 hover:text-stone-700 transition-colors">
            <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <div className="flex items-center gap-2">
            {Array.from({ length: total }, (_, i) => (
              <button key={i} onClick={() => setCurrentSlide(i)}
                className={`rounded-full transition-all duration-300 ${currentSlide === i ? 'w-5 h-1.5' : 'w-1.5 h-1.5 bg-stone-200 hover:bg-stone-400'}`}
                style={currentSlide === i ? { backgroundColor: OLIVE } : {}}
              />
            ))}
          </div>
          <button onClick={() => setCurrentSlide(s => (s + 1) % total)} className="p-1.5 text-stone-400 hover:text-stone-700 transition-colors">
            <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
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

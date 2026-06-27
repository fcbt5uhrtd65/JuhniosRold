import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  Minus,
  PackageCheck,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  Truck,
  X,
  Loader2,
} from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useSearch } from '../contexts/SearchContext';
import { Checkout } from './Checkout';

interface ShoppingCartProps {
  onLoginRequired?: () => void;
}

const SHIPPING_THRESHOLD = 80000;
const SHIPPING_COST = 100;

const recommendedProducts = [
  {
    id: 'argan-oil',
    name: 'Aceite de Argán',
    benefit: 'Brillo y suavidad',
    price: 32900,
    promo: 'Rutina nutritiva',
    query: 'aceite argán',
    image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=240&q=80',
  },
  {
    id: 'hair-mask',
    name: 'Mascarilla nutritiva',
    benefit: 'Reparación profunda',
    price: 26900,
    promo: 'Ideal post-lavado',
    query: 'mascarilla nutritiva',
    image: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=240&q=80',
  },
  {
    id: 'hair-serum',
    name: 'Sérum capilar',
    benefit: 'Control de frizz',
    price: 29900,
    promo: 'Acabado ligero',
    query: 'sérum capilar',
    image: 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=240&q=80',
  },
  {
    id: 'repair-shampoo',
    name: 'Shampoo reparador',
    benefit: 'Limpieza fortalecedora',
    price: 34900,
    promo: 'Más vendido',
    query: 'shampoo reparador',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=240&q=80',
  },
  {
    id: 'hydrating-conditioner',
    name: 'Acondicionador hidratante',
    benefit: 'Desenreda y suaviza',
    price: 31900,
    promo: 'Complemento clave',
    query: 'acondicionador hidratante',
    image: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=240&q=80',
  },
];

function formatMoney(value: number): string {
  return `$${Math.max(0, value).toLocaleString('es-CO')}`;
}

export function ShoppingCart({ onLoginRequired }: ShoppingCartProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const { items, updateQuantity, removeItem, subtotal, total, wholesaleDiscount, itemCount, reloadCart, isLoading } = useCart();
  const { setSearchQuery } = useSearch();

  const shippingProgress = Math.min((total / SHIPPING_THRESHOLD) * 100, 100);
  const remaining = Math.max(SHIPPING_THRESHOLD - total, 0);
  const freeShipping = total >= SHIPPING_THRESHOLD;
  const shippingCost = freeShipping ? 0 : SHIPPING_COST;
  const finalTotal = total + shippingCost;
  const primaryItem = items[0];
  const restItems = items.slice(1);

  const freeShippingText = freeShipping
    ? 'Ya tienes envío gratis en esta compra'
    : `Agrega ${formatMoney(remaining)} más y recibe envío gratis`;

  const itemLabel = useMemo(() => {
    if (itemCount === 0) return '0 productos';
    if (itemCount === 1) return '1 producto';
    return `${itemCount} productos`;
  }, [itemCount]);

  const openCart = () => {
    setIsOpen(true);
    void reloadCart();
  };

  const goToRecommendedProduct = (query: string) => {
    setSearchQuery(query);
    setIsOpen(false);
    window.setTimeout(() => {
      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
    }, 120);
  };

  const applyCoupon = () => {
    const code = couponCode.trim();
    if (!code) {
      setCouponMessage('Ingresa un código de cupón para validarlo.');
      return;
    }
    if (code === wholesaleDiscount.settings.minimumPurchase.toString() || code.toUpperCase().startsWith('JR-MAY')) {
      setCouponMessage(
        wholesaleDiscount.isActive
          ? 'Descuento mayorista aplicado.'
          : `Te faltan ${formatMoney(wholesaleDiscount.remaining)} para activar tu descuento mayorista.`,
      );
      return;
    }
    setCouponMessage('El cupón se validará antes del pago. No modifica el total hasta ser aprobado.');
  };

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={openCart}
        className="relative flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-stone-100 text-muted-foreground hover:text-foreground transition-all duration-200"
      >
        <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
        <span className="hidden sm:inline text-[11px] tracking-wide">Carrito</span>
        {itemCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[9px] font-semibold flex items-center justify-center border-2 border-white shadow-sm"
          >
            {itemCount > 9 ? '9+' : itemCount}
          </motion.span>
        )}
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 bg-stone-950/45 backdrop-blur-sm z-[100]"
              />

              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-0 z-[100] mx-auto flex h-[100dvh] w-full max-w-4xl flex-col bg-[#F7F5F1] shadow-2xl sm:inset-4 sm:h-[calc(100dvh-2rem)] sm:rounded-[32px] sm:border sm:border-white/70 overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 bg-white/95 border-b border-stone-200 sm:rounded-t-[32px] md:px-8">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#2D3A1F]/10 text-[#2D3A1F] flex items-center justify-center">
                      <ShoppingBag className="w-4 h-4" strokeWidth={1.7} />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-stone-950">Carrito</p>
                      <p className="text-[11px] text-stone-500">{itemLabel}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-full hover:bg-stone-100 transition-colors"
                    aria-label="Cerrar carrito"
                  >
                    <X className="w-4 h-4 text-stone-500" strokeWidth={1.6} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6">
                  {isLoading ? (
                    <div className="h-full min-h-[420px] flex flex-col items-center justify-center gap-4 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                        <Loader2 className="w-7 h-7 text-stone-300 animate-spin" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-stone-800 mb-1">Cargando carrito</p>
                        <p className="text-xs text-stone-500">Estamos trayendo tus productos</p>
                      </div>
                    </div>
                  ) : items.length === 0 ? (
                    <div className="h-full min-h-[520px] flex flex-col items-center justify-center gap-4 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                        <ShoppingBag className="w-7 h-7 text-stone-300" strokeWidth={1.3} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-stone-800 mb-1">Tu carrito está vacío</p>
                        <p className="text-xs text-stone-500">Agrega productos para comenzar tu rutina capilar.</p>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          setIsOpen(false);
                          document.getElementById('productos')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="flex items-center gap-2 px-5 py-3 bg-[#2D3A1F] text-white text-[11px] tracking-wider uppercase rounded-full hover:opacity-90 transition-opacity"
                      >
                        Ver productos
                        <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                      </motion.button>
                    </div>
                  ) : (
                    <div className="space-y-4 pb-3">
                      <div className="rounded-3xl bg-white p-4 shadow-sm border border-stone-100">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-[#2D3A1F]">
                            <Truck className="w-4 h-4" strokeWidth={1.7} />
                            <span className="text-[12px] font-semibold">{freeShipping ? 'Envío gratis desbloqueado' : freeShippingText}</span>
                          </div>
                          <span className="text-[10px] text-stone-400">{Math.round(shippingProgress)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${shippingProgress}%` }}
                            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                            className="h-full rounded-full bg-[#2D3A1F]"
                          />
                        </div>
                      </div>

                      {primaryItem && (
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="rounded-3xl bg-white p-4 shadow-sm border border-stone-100"
                        >
                          <div className="flex gap-3">
                            <div className="w-[92px] h-[92px] rounded-2xl overflow-hidden bg-stone-100 flex-shrink-0">
                              <img
                                src={primaryItem.image}
                                alt={primaryItem.name}
                                onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=300&q=80'; }}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-[13px] font-bold text-stone-950 leading-snug uppercase line-clamp-2">{primaryItem.name}</p>
                                  <p className="text-[11px] text-stone-500 mt-1">{primaryItem.size || 'Unidad'}</p>
                                </div>
                                <button
                                  onClick={() => removeItem(primaryItem.id)}
                                  className="p-2 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                  aria-label="Eliminar producto"
                                >
                                  <Trash2 className="w-4 h-4" strokeWidth={1.6} />
                                </button>
                              </div>

                              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                                Disponible
                              </div>

                              <div className="mt-4 flex items-center justify-between gap-3">
                                <div className="flex items-center bg-[#F8F7F4] rounded-full border border-stone-200 overflow-hidden">
                                  <button
                                    onClick={() => updateQuantity(primaryItem.id, primaryItem.quantity - 1)}
                                    className="px-3 py-2 text-stone-500 hover:text-stone-900 transition-colors"
                                    aria-label="Disminuir cantidad"
                                  >
                                    <Minus className="w-3.5 h-3.5" strokeWidth={2} />
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    value={primaryItem.quantity}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10);
                                      if (!isNaN(val) && val >= 1) updateQuantity(primaryItem.id, val);
                                    }}
                                    className="text-sm font-semibold w-14 text-center text-stone-900 bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  />
                                  <button
                                    onClick={() => updateQuantity(primaryItem.id, primaryItem.quantity + 1)}
                                    className="px-3 py-2 text-stone-500 hover:text-stone-900 transition-colors"
                                    aria-label="Aumentar cantidad"
                                  >
                                    <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                                  </button>
                                </div>
                                <p className="text-[15px] font-bold text-stone-950">
                                  {formatMoney(primaryItem.price * primaryItem.quantity)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {restItems.map((item) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm border border-stone-100"
                        >
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-stone-100 flex-shrink-0">
                            <img
                              src={item.image}
                              alt={item.name}
                              onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=300&q=80'; }}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-[12px] font-semibold text-stone-900 truncate">{item.name}</p>
                                <p className="text-[10px] text-stone-500">{item.size || 'Unidad'}</p>
                              </div>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="p-1.5 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                aria-label="Eliminar producto"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                              </button>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <div className="flex items-center bg-[#F8F7F4] rounded-full border border-stone-200 overflow-hidden">
                                <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-2.5 py-1.5 text-stone-500">
                                  <Minus className="w-3 h-3" strokeWidth={2} />
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val) && val >= 1) updateQuantity(item.id, val);
                                  }}
                                  className="text-xs font-semibold w-12 text-center bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-2.5 py-1.5 text-stone-500">
                                  <Plus className="w-3 h-3" strokeWidth={2} />
                                </button>
                              </div>
                              <p className="text-[13px] font-bold text-stone-900">{formatMoney(item.price * item.quantity)}</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      <section className="rounded-3xl bg-[#FFFDF4] border border-amber-100 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-amber-500" strokeWidth={1.7} />
                          <h3 className="text-[12px] tracking-[0.14em] uppercase font-bold text-stone-800">Completa tu rutina capilar</h3>
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-1 snap-x">
                          {recommendedProducts.map((product) => (
                            <article
                              key={product.id}
                              className="snap-start flex-shrink-0 w-[172px] rounded-2xl bg-white border border-amber-100 p-3 shadow-sm"
                            >
                              <div className="relative mb-2">
                                <div className="w-full aspect-square rounded-xl overflow-hidden bg-stone-100">
                                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                </div>
                                <span className="absolute top-2 left-2 rounded-full bg-amber-100 px-2 py-1 text-[9px] font-semibold text-amber-800">
                                  {product.promo}
                                </span>
                              </div>
                              <p className="text-[12px] font-bold text-stone-950 leading-tight line-clamp-2">{product.name}</p>
                              <p className="mt-1 text-[10px] text-stone-500">{product.benefit}</p>
                              <div className="mt-3 flex items-center justify-between">
                                <span className="text-[13px] font-bold text-stone-950">{formatMoney(product.price)}</span>
                                <button
                                  type="button"
                                  onClick={() => goToRecommendedProduct(product.query)}
                                  className="w-9 h-9 rounded-full bg-stone-950 text-white flex items-center justify-center hover:bg-[#2D3A1F] transition-colors"
                                  aria-label={`Buscar ${product.name}`}
                                >
                                  <Plus className="w-4 h-4" strokeWidth={2.2} />
                                </button>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-3xl bg-white p-4 shadow-sm border border-stone-100">
                        <div className="flex items-center gap-2 mb-3">
                          <Tag className="w-4 h-4 text-[#2D3A1F]" strokeWidth={1.7} />
                          <h3 className="text-[13px] font-bold text-stone-900">Cupón de descuento</h3>
                        </div>
                        <div className={`mb-3 rounded-2xl border px-3 py-2 text-[11px] ${
                          wholesaleDiscount.isActive
                            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                            : 'border-amber-100 bg-amber-50 text-amber-700'
                        }`}>
                          {wholesaleDiscount.isActive
                            ? 'Ya activaste tu descuento mayorista.'
                            : `Te faltan ${formatMoney(wholesaleDiscount.remaining)} para activar tu descuento mayorista.`}
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={couponCode}
                            onChange={(event) => {
                              setCouponCode(event.target.value.toUpperCase());
                              setCouponMessage('');
                            }}
                            placeholder="Ingresa tu código"
                            className="min-w-0 flex-1 rounded-2xl border border-stone-200 bg-[#F8F7F4] px-4 py-3 text-[13px] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#2D3A1F]"
                          />
                          <button
                            type="button"
                            onClick={applyCoupon}
                            className="rounded-2xl bg-stone-950 px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-[#2D3A1F] transition-colors"
                          >
                            Aplicar
                          </button>
                        </div>
                        {couponMessage && (
                          <p className="mt-2 text-[11px] leading-relaxed text-stone-500">{couponMessage}</p>
                        )}
                      </section>
                    </div>
                  )}
                </div>

                {items.length > 0 && (
                  <div className="border-t border-stone-200 bg-white px-4 py-4 sm:rounded-b-[32px] md:px-8">
                    <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-[1fr_auto] md:items-end">
                      <div className="rounded-3xl border border-stone-200 bg-[#F8F7F4] p-4">
                        <h3 className="mb-3 text-sm font-semibold text-stone-950">Resumen del pedido</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-stone-500">Subtotal</span>
                            <span className="font-medium text-stone-900">{formatMoney(subtotal)}</span>
                          </div>
                          {wholesaleDiscount.discount > 0 && (
                            <div className="flex justify-between text-sm text-emerald-700">
                              <span>Descuento mayorista aplicado</span>
                              <span className="font-semibold">-{formatMoney(wholesaleDiscount.discount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm">
                            <span className="text-stone-500">Subtotal con descuento</span>
                            <span className="font-medium text-stone-900">{formatMoney(total)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-stone-500">Envío</span>
                            <span className={freeShipping ? 'font-semibold text-emerald-700' : 'font-medium text-stone-900'}>
                              {freeShipping ? 'Gratis' : formatMoney(shippingCost)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-stone-200 pt-3 text-lg font-bold text-stone-950">
                            <span>Total</span>
                            <span>{formatMoney(finalTotal)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-[260px]">
                        <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5 text-center text-[11px] text-stone-500 md:justify-end">
                          <ShieldCheck className="h-3.5 w-3.5 text-[#2D3A1F]" strokeWidth={1.8} />
                          <span>Compra segura</span>
                          <span>|</span>
                          <PackageCheck className="h-3.5 w-3.5 text-[#2D3A1F]" strokeWidth={1.8} />
                          <span>Pago protegido</span>
                          <span>|</span>
                          <MessageCircle className="h-3.5 w-3.5 text-[#2D3A1F]" strokeWidth={1.8} />
                          <span>Soporte por WhatsApp</span>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setIsOpen(false);
                            setCheckoutOpen(true);
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2D3A1F] px-6 py-4 text-sm font-bold uppercase tracking-[0.12em] text-white shadow-lg shadow-[#2D3A1F]/15 transition-opacity hover:opacity-95"
                        >
                          Finalizar compra segura
                          <ArrowRight className="h-4 w-4" strokeWidth={2} />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}

      <Checkout
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onLoginRequired={onLoginRequired}
      />
    </>
  );
}

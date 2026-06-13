import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Minus, Plus, ShoppingBag, Package, ArrowRight, Sparkles } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { Checkout } from './Checkout';

interface ShoppingCartProps {
  onLoginRequired?: () => void;
}

const SHIPPING_THRESHOLD = 80000;

const suggestedProducts = [
  {
    id: 'sugg-1',
    name: 'Aceite de Argán',
    price: 32900,
    image: 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=200&q=80',
    promo: 'Complementa tu rutina',
  },
  {
    id: 'sugg-2',
    name: 'Mascarilla Nutritiva',
    price: 26900,
    image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=200&q=80',
    promo: 'Agrega 1 más → envío gratis',
  },
  {
    id: 'sugg-3',
    name: 'Sérum Capilar',
    price: 29900,
    image: 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=200&q=80',
    promo: 'Lleva 2 → 10% OFF',
  },
];

export function ShoppingCart({ onLoginRequired }: ShoppingCartProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { items, updateQuantity, removeItem, total, itemCount } = useCart();

  const shippingProgress = Math.min((total / SHIPPING_THRESHOLD) * 100, 100);
  const remaining = SHIPPING_THRESHOLD - total;
  const freeShipping = total >= SHIPPING_THRESHOLD;

  return (
    <>
      {/* Trigger button */}
      <motion.button
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
        onClick={() => setIsOpen(true)}
        className="relative flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-stone-100 text-muted-foreground hover:text-foreground transition-all duration-200"
      >
        <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
        <span className="hidden sm:inline text-[11px] tracking-wide">Carrito</span>
        {itemCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-foreground text-background text-[9px] font-medium flex items-center justify-center"
          >
            {itemCount > 9 ? '9+' : itemCount}
          </motion.span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[100]"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-0 right-0 h-screen w-full max-w-md bg-white z-[100] flex flex-col shadow-2xl rounded-l-3xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-7 py-6 border-b border-stone-100">
                <div className="flex items-center gap-3">
                  <ShoppingBag className="w-4 h-4 text-stone-500" strokeWidth={1.5} />
                  <span className="text-sm font-medium text-foreground">
                    Carrito
                    {itemCount > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">({itemCount} {itemCount === 1 ? 'producto' : 'productos'})</span>
                    )}
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-full hover:bg-stone-100 transition-colors"
                  aria-label="Cerrar carrito"
                >
                  <X className="w-4 h-4 text-stone-400" strokeWidth={1.5} />
                </button>
              </div>

              {/* Shipping progress bar */}
              {items.length > 0 && (
                <div className="px-7 py-4 bg-stone-50 border-b border-stone-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-stone-500" strokeWidth={1.5} />
                      <span className="text-[11px] text-stone-600">
                        {freeShipping
                          ? '¡Envío gratis aplicado!'
                          : `Faltan $${remaining.toLocaleString('es-CO')} para envío gratis`}
                      </span>
                    </div>
                    {freeShipping && (
                      <span className="text-[10px] text-emerald-600 font-medium">✓ Gratis</span>
                    )}
                  </div>
                  <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${shippingProgress}%` }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className={`h-full rounded-full ${freeShipping ? 'bg-emerald-500' : 'bg-stone-700'}`}
                    />
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="flex-1 overflow-y-auto px-7 py-5">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-stone-50 flex items-center justify-center">
                      <ShoppingBag className="w-7 h-7 text-stone-300" strokeWidth={1} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-700 mb-1">Tu carrito está vacío</p>
                      <p className="text-xs text-muted-foreground">Agrega productos para comenzar tu rutina</p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      onClick={() => { setIsOpen(false); document.getElementById('productos')?.scrollIntoView({ behavior: 'smooth' }); }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background text-[11px] tracking-wider uppercase rounded-xl hover:opacity-90 transition-opacity"
                    >
                      Ver productos
                      <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                    </motion.button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {items.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex gap-4 p-4 bg-stone-50 rounded-2xl"
                      >
                        <div className="w-18 h-18 rounded-xl overflow-hidden bg-stone-100 flex-shrink-0" style={{ width: 72, height: 72 }}>
                          <img
                            src={item.image}
                            alt={item.name}
                            onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=300&q=80'; }}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-medium text-foreground leading-snug truncate">{item.name}</p>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="p-1 rounded-lg hover:bg-stone-200 transition-colors flex-shrink-0"
                              aria-label="Eliminar"
                            >
                              <X className="w-3.5 h-3.5 text-stone-400" strokeWidth={1.5} />
                            </button>
                          </div>
                          <p className="text-[11px] text-muted-foreground mb-3">{item.size}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-0 bg-white rounded-xl border border-stone-200 overflow-hidden">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="px-2.5 py-1.5 hover:bg-stone-50 transition-colors text-stone-500"
                              >
                                <Minus className="w-3 h-3" strokeWidth={2} />
                              </button>
                              <span className="text-xs font-medium w-6 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="px-2.5 py-1.5 hover:bg-stone-50 transition-colors text-stone-500"
                              >
                                <Plus className="w-3 h-3" strokeWidth={2} />
                              </button>
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              ${(item.price * item.quantity).toLocaleString('es-CO')}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}

                    {/* Suggested products */}
                    <div className="pt-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.5} />
                        <span className="text-[11px] tracking-[0.2em] uppercase text-stone-500 font-medium">Completa tu rutina</span>
                      </div>
                      <div className="space-y-3">
                        {suggestedProducts.map((p) => (
                          <div key={p.id} className="flex items-center gap-3 p-3 bg-amber-50/60 border border-amber-100 rounded-xl">
                            <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 flex-shrink-0">
                              <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                              <p className="text-[10px] text-amber-700 mb-0.5">{p.promo}</p>
                              <p className="text-xs text-stone-600">${p.price.toLocaleString('es-CO')}</p>
                            </div>
                            <button className="flex-shrink-0 p-1.5 rounded-lg bg-foreground text-background hover:opacity-80 transition-opacity">
                              <Plus className="w-3 h-3" strokeWidth={2} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer — totals + checkout */}
              {items.length > 0 && (
                <div className="px-7 py-6 border-t border-stone-100 bg-white">
                  <div className="space-y-2 mb-5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">${total.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Envío</span>
                      <span className={freeShipping ? 'text-emerald-600 font-medium' : ''}>
                        {freeShipping ? 'Gratis' : '$10.000'}
                      </span>
                    </div>
                    <div className="flex justify-between text-base font-semibold pt-3 border-t border-stone-100">
                      <span>Total</span>
                      <span>${(freeShipping ? total : total + 10000).toLocaleString('es-CO')}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                      onClick={() => { setIsOpen(false); setCheckoutOpen(true); }}
                      className="w-full py-4 bg-foreground text-background text-[11px] tracking-[0.2em] uppercase font-medium rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      Finalizar compra
                      <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                    </motion.button>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="w-full py-3 text-[11px] tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors text-center"
                    >
                      Seguir comprando
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Checkout
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        onLoginRequired={onLoginRequired}
      />
    </>
  );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Minus, Plus } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { Checkout } from './Checkout';

interface ShoppingCartProps {
  onLoginRequired?: () => void;
}

export function ShoppingCart({ onLoginRequired }: ShoppingCartProps = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { items, updateQuantity, removeItem, total, itemCount } = useCart();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="relative text-xs tracking-wider uppercase hover:opacity-50 transition-opacity"
      >
        Carrito ({itemCount})
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-foreground/20 z-[100]"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3 }}
              className="fixed top-0 right-0 h-screen w-full max-w-md bg-background z-[100] flex flex-col"
            >
              <div className="p-8 border-b border-border flex items-center justify-between">
                <div className="text-xs tracking-[0.2em] uppercase">
                  Carrito ({itemCount})
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="hover:opacity-50 transition-opacity"
                >
                  <X className="w-5 h-5" strokeWidth={1} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                {items.length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-20">
                    Tu carrito está vacío
                  </div>
                ) : (
                  <div className="space-y-6">
                    {items.map((item) => (
                      <div key={item.id} className="flex gap-4 pb-6 border-b border-border">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-20 h-20 object-cover bg-secondary"
                        />
                        <div className="flex-1">
                          <div className="text-sm mb-1">{item.name}</div>
                          <div className="text-xs text-muted-foreground mb-3">
                            {item.size}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 border border-border">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="p-2 hover:bg-secondary transition-colors"
                              >
                                <Minus className="w-3 h-3" strokeWidth={1} />
                              </button>
                              <span className="text-xs w-6 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="p-2 hover:bg-secondary transition-colors"
                              >
                                <Plus className="w-3 h-3" strokeWidth={1} />
                              </button>
                            </div>
                            <div className="text-sm">
                              ${(item.price * item.quantity).toLocaleString('es-CO')}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeItem(item.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="w-4 h-4" strokeWidth={1} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {items.length > 0 && (
                <div className="p-8 border-t border-border">
                  <div className="mb-6">
                    <div className="flex justify-between mb-2 text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${total.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="flex justify-between mb-4 text-sm">
                      <span className="text-muted-foreground">Envío</span>
                      <span>{total >= 80000 ? 'Gratis' : '$10.000'}</span>
                    </div>
                    <div className="flex justify-between text-lg pt-4 border-t border-border">
                      <span>Total</span>
                      <span>${(total >= 80000 ? total : total + 10000).toLocaleString('es-CO')}</span>
                    </div>
                  </div>

                  {total < 80000 && (
                    <div className="mb-4 p-4 bg-secondary text-xs text-center">
                      Faltan ${(80000 - total).toLocaleString('es-CO')} para envío gratis
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setCheckoutOpen(true);
                    }}
                    className="w-full py-4 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90 transition-opacity"
                  >
                    Finalizar compra
                  </button>
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

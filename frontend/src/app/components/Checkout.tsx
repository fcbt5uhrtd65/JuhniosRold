import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, CreditCard, Lock, Truck, X, XCircle } from 'lucide-react';

import { useCart } from '../contexts/CartContext';
import { useUser } from '../contexts/UserContext';
import { checkoutActiveCart } from '../services/cart.service';
import {
  initiatePayment,
  resolveMockPayment,
} from '../services/payments.service';

interface CheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginRequired?: () => void;
}

interface MockPayment {
  paymentId: string;
  orderId: string;
}

export function Checkout({ isOpen, onClose, onLoginRequired }: CheckoutProps) {
  const { items, total, reloadCart } = useCart();
  const { currentUser } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mockPayment, setMockPayment] = useState<MockPayment | null>(null);
  const [formData, setFormData] = useState({
    fullName: currentUser?.nombre ?? '',
    email: currentUser?.email ?? '',
    phone: currentUser?.telefono ?? '',
    address: currentUser?.direccion ?? '',
    city: currentUser?.ciudad ?? '',
    department: '',
    zipCode: '',
  });

  const shippingCost = total >= 80000 ? 0 : 100;
  const finalTotal = total + shippingCost;

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const close = () => {
    if (!isSubmitting) {
      setError('');
      setMockPayment(null);
      onClose();
    }
  };

  const shippingAddress = () =>
    JSON.stringify({
      full_name: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      address_line1: formData.address,
      city: formData.city,
      department: formData.department,
      postal_code: formData.zipCode,
      country: 'CO',
    });

  const handlePayment = async () => {
    if (!currentUser?.fromApi) {
      onClose();
      onLoginRequired?.();
      return;
    }
    if (
      [
        formData.fullName,
        formData.email,
        formData.phone,
        formData.address,
        formData.city,
        formData.department,
      ].some((value) => !value.trim())
    ) {
      setError('Completa todos los datos obligatorios de envío.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const order = await checkoutActiveCart(shippingAddress());
      const payment = await initiatePayment(order.id);
      await reloadCart();
      if (payment.requires_redirect) {
        window.location.assign(payment.checkout_url);
        return;
      }
      setMockPayment({ paymentId: payment.payment_id, orderId: order.id });
      setIsSubmitting(false);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : 'No fue posible iniciar el pago.',
      );
      setIsSubmitting(false);
    }
  };

  const resolveMock = async (outcome: 'approved' | 'declined') => {
    if (!mockPayment) return;
    setIsSubmitting(true);
    setError('');
    try {
      await resolveMockPayment(mockPayment.paymentId, outcome);
      await reloadCart();
      window.history.pushState(
        {},
        '',
        `/pago/resultado?pedido_id=${mockPayment.orderId}`,
      );
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : 'No fue posible resolver el pago simulado.',
      );
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 bg-foreground/50 backdrop-blur-sm z-[200]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-[#fafaf9] z-[210] flex flex-col shadow-2xl"
          >
            <div className="p-8 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-xs tracking-[0.2em] uppercase mb-2">
                  Pago seguro
                </div>
                <h2 className="text-2xl">
                  {mockPayment ? 'Proveedor simulado' : 'Finaliza tu compra'}
                </h2>
              </div>
              <button onClick={close} disabled={isSubmitting}>
                <X className="w-5 h-5" strokeWidth={1} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {mockPayment ? (
                <div className="space-y-6">
                  <div className="p-5 border border-amber-300 bg-amber-50">
                    <div className="text-sm font-medium mb-2">Modo de pruebas</div>
                    <p className="text-xs text-amber-800">
                      Elige el resultado que debe devolver el proveedor simulado.
                      La aprobación descontará inventario y generará la factura;
                      el rechazo liberará la reserva.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => resolveMock('approved')}
                      disabled={isSubmitting}
                      className="py-5 bg-green-700 text-white text-xs uppercase flex justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Aprobar pago
                    </button>
                    <button
                      onClick={() => resolveMock('declined')}
                      disabled={isSubmitting}
                      className="py-5 bg-red-700 text-white text-xs uppercase flex justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" />
                      Rechazar pago
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <Truck className="w-5 h-5" strokeWidth={1} />
                    <h3 className="text-xl">Información de envío</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      ['fullName', 'Nombre completo *', 'text'],
                      ['email', 'Email *', 'email'],
                      ['phone', 'Teléfono *', 'tel'],
                      ['address', 'Dirección *', 'text'],
                      ['city', 'Ciudad *', 'text'],
                      ['department', 'Departamento *', 'text'],
                      ['zipCode', 'Código postal', 'text'],
                    ].map(([field, label, type]) => (
                      <label
                        key={field}
                        className={field === 'address' ? 'md:col-span-2' : ''}
                      >
                        <span className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                          {label}
                        </span>
                        <input
                          type={type}
                          value={formData[field as keyof typeof formData]}
                          onChange={(event) =>
                            setFormData((current) => ({
                              ...current,
                              [field]: event.target.value,
                            }))
                          }
                          className="w-full px-4 py-3 bg-transparent border border-border text-sm"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="p-5 bg-secondary flex gap-4">
                    <CreditCard className="w-5 h-5 flex-shrink-0" strokeWidth={1} />
                    <p className="text-xs text-muted-foreground">
                      El backend elegirá el proveedor configurado. En modo Wompi
                      los datos sensibles se procesan fuera de Juhnios Rold.
                    </p>
                  </div>
                </>
              )}

              {error && (
                <div className="p-4 border border-red-300 bg-red-50 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            {!mockPayment && (
              <div className="p-8 border-t border-border">
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>${total.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Envío</span>
                    <span>
                      {shippingCost === 0
                        ? 'Gratis'
                        : `$${shippingCost.toLocaleString('es-CO')}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg pt-3 border-t">
                    <span>Total</span>
                    <span>${finalTotal.toLocaleString('es-CO')}</span>
                  </div>
                </div>
                <button
                  onClick={handlePayment}
                  disabled={isSubmitting || items.length === 0}
                  className="w-full py-4 bg-foreground text-background text-xs uppercase disabled:opacity-50 flex justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  {isSubmitting ? 'Preparando pago...' : 'Continuar al pago'}
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

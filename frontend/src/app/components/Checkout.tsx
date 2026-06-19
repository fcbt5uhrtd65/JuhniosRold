import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check, CheckCircle2, Clock3, CreditCard, ExternalLink, Lock, Truck, X, XCircle,
} from 'lucide-react';

import { useCart } from '../contexts/CartContext';
import { useUser } from '../contexts/UserContext';
import { checkoutActiveCart } from '../services/cart.service';
import {
  initiatePayment,
  resolveMockPayment,
} from '../services/payments.service';
import { usePaymentStatusPolling } from '../hooks/usePaymentStatusPolling';
import { LocationPicker } from './ui/LocationPicker';
import { EMPTY_LOCATION, type LocationValue } from '../services/geography.types';

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
  const [wompiOrderId, setWompiOrderId] = useState<string | null>(null);
  const [wompiCheckoutUrl, setWompiCheckoutUrl] = useState<string | null>(null);
  const [wompiPopupBlocked, setWompiPopupBlocked] = useState(false);
  const { state: wompiState, errorMessage: wompiErrorMessage } = usePaymentStatusPolling(wompiOrderId);
  const [formData, setFormData] = useState({
    fullName: currentUser?.nombre ?? '',
    email: currentUser?.email ?? '',
    phone: currentUser?.telefono ?? '',
    address: currentUser?.direccion ?? '',
    zipCode: '',
  });
  const [shippingLocation, setShippingLocation] = useState<LocationValue>(EMPTY_LOCATION);

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
      setWompiOrderId(null);
      setWompiCheckoutUrl(null);
      setWompiPopupBlocked(false);
      onClose();
    }
  };

  const shippingAddress = () =>
    JSON.stringify({
      full_name: formData.fullName,
      email: formData.email,
      phone: formData.phone,
      address_line1: formData.address,
      city: shippingLocation.cityName,
      department: shippingLocation.stateName,
      postal_code: formData.zipCode,
      country: shippingLocation.countryName || 'Colombia',
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
        shippingLocation.cityName,
        shippingLocation.stateName,
      ].some((value) => !value.trim())
    ) {
      setError('Completa todos los datos obligatorios de envío, incluyendo ciudad y departamento.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    // Abrir la pestaña sincrónicamente (dentro del gesto del usuario) para evitar
    // que el navegador bloquee el popup; se le asigna la URL real más adelante.
    const wompiTab = window.open('about:blank', '_blank');

    try {
      const order = await checkoutActiveCart(shippingAddress());
      const payment = await initiatePayment(order.id);
      await reloadCart();
      if (payment.requires_redirect) {
        setWompiCheckoutUrl(payment.checkout_url);
        if (wompiTab && !wompiTab.closed) {
          wompiTab.location.href = payment.checkout_url;
          setWompiPopupBlocked(false);
        } else {
          setWompiPopupBlocked(true);
        }
        setWompiOrderId(order.id);
        setIsSubmitting(false);
        return;
      }
      wompiTab?.close();
      setMockPayment({ paymentId: payment.payment_id, orderId: order.id });
      setIsSubmitting(false);
    } catch (paymentError) {
      wompiTab?.close();
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
                  {wompiOrderId
                    ? 'Pago con Wompi'
                    : mockPayment
                      ? 'Proveedor simulado'
                      : 'Finaliza tu compra'}
                </h2>
              </div>
              <button onClick={close} disabled={isSubmitting}>
                <X className="w-5 h-5" strokeWidth={1} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {wompiOrderId ? (
                <div className="space-y-6 text-center py-6">
                  {wompiState === 'approved' ? (
                    <>
                      <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
                      <h3 className="text-xl">¡Pago exitoso!</h3>
                      <p className="text-sm text-muted-foreground">
                        Tu pago fue aprobado. Puedes rastrear el estado de tu pedido
                        en la opción <strong>Mis pedidos</strong> de tu perfil.
                      </p>
                    </>
                  ) : wompiState === 'failed' ? (
                    <>
                      <XCircle className="w-14 h-14 text-red-600 mx-auto" />
                      <h3 className="text-xl">No pudimos procesar tu pago</h3>
                      <p className="text-sm text-muted-foreground">
                        Parece que hubo un inconveniente con tu pago. Verifica tus datos
                        e intenta de nuevo más tarde.
                      </p>
                    </>
                  ) : wompiState === 'timeout' || wompiState === 'error' ? (
                    <>
                      <Clock3 className="w-14 h-14 text-amber-600 mx-auto" />
                      <h3 className="text-xl">Aún no hay confirmación</h3>
                      <p className="text-sm text-muted-foreground">
                        {wompiErrorMessage ||
                          'No detectamos una respuesta a tiempo. Si ya pagaste, revisa el estado en Mis pedidos en unos minutos.'}
                      </p>
                    </>
                  ) : (
                    <>
                      <Clock3 className="w-14 h-14 text-amber-600 mx-auto animate-pulse" />
                      <h3 className="text-xl">Esperando respuesta de Wompi</h3>
                      <p className="text-sm text-muted-foreground">
                        Completa tu pago en la pestaña que se abrió. No cierres esta
                        ventana, aquí verás el resultado automáticamente.
                      </p>
                    </>
                  )}

                  {wompiPopupBlocked && wompiState === 'polling' && wompiCheckoutUrl && (
                    <div className="p-4 border border-amber-300 bg-amber-50 text-left">
                      <p className="text-xs text-amber-800 mb-3">
                        Tu navegador bloqueó la ventana de pago.
                      </p>
                      <a
                        href={wompiCheckoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background text-xs uppercase"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Abrir pago de Wompi
                      </a>
                    </div>
                  )}

                  {(wompiState === 'approved' || wompiState === 'failed' ||
                    wompiState === 'timeout' || wompiState === 'error') && (
                    <button
                      type="button"
                      onClick={close}
                      className="inline-block px-8 py-4 bg-foreground text-background text-xs tracking-wider uppercase"
                    >
                      Volver a la tienda
                    </button>
                  )}
                </div>
              ) : mockPayment ? (
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
                    <div className="md:col-span-2">
                      <LocationPicker
                        value={shippingLocation}
                        onChange={setShippingLocation}
                        required
                      />
                    </div>
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

            {!mockPayment && !wompiOrderId && (
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

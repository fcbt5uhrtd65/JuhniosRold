import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Home,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  ShieldCheck,
  Truck,
  User,
  X,
  XCircle,
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

type CheckoutFormField =
  | 'fullName'
  | 'email'
  | 'phone'
  | 'address'
  | 'country'
  | 'state'
  | 'city';

const inputBaseClass =
  'w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-[#2D3A1F] focus:ring-2 focus:ring-[#2D3A1F]/10';

function formatMoney(value: number): string {
  return `$${value.toLocaleString('es-CO')}`;
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
    reference: '',
  });
  const [shippingLocation, setShippingLocation] = useState<LocationValue>(EMPTY_LOCATION);
  const [formErrors, setFormErrors] = useState<Partial<Record<CheckoutFormField, string>>>({});
  const [showAddressForm, setShowAddressForm] = useState(!currentUser?.direccion);

  const shippingCost = total >= 80000 ? 0 : 100;
  const finalTotal = total + shippingCost;
  const hasRegisteredAddress = Boolean(currentUser?.direccion);
  const registeredAddress = {
    fullName: currentUser?.nombre ?? '',
    email: currentUser?.email ?? '',
    phone: currentUser?.telefono ?? '',
    address: currentUser?.direccion ?? '',
    city: currentUser?.ciudad ?? '',
    country: 'Colombia',
  };

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setFormData((current) => ({
      ...current,
      fullName: current.fullName || currentUser?.nombre || '',
      email: current.email || currentUser?.email || '',
      phone: current.phone || currentUser?.telefono || '',
      address: current.address || currentUser?.direccion || '',
    }));
    setShowAddressForm(!currentUser?.direccion);
  }, [currentUser, isOpen]);

  const close = () => {
    if (!isSubmitting) {
      setError('');
      setFormErrors({});
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
      address_line2: formData.reference,
      city: shippingLocation.cityName,
      department: shippingLocation.stateName,
      postal_code: formData.zipCode,
      country: shippingLocation.countryName || 'Colombia',
    });

  const updateFormField = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: undefined }));
  };

  const useRegisteredAddress = () => {
    setFormData((current) => ({
      ...current,
      fullName: registeredAddress.fullName,
      email: registeredAddress.email,
      phone: registeredAddress.phone,
      address: registeredAddress.address,
    }));
    setShowAddressForm(true);
    setFormErrors({});
    setError('');
  };

  const validateShippingForm = () => {
    const errors: Partial<Record<CheckoutFormField, string>> = {};
    if (!formData.fullName.trim()) errors.fullName = 'Ingresa tu nombre completo.';
    if (!formData.email.trim()) errors.email = 'Ingresa tu correo electrónico.';
    if (!formData.phone.trim()) errors.phone = 'Ingresa tu número de teléfono.';
    if (!formData.address.trim()) errors.address = 'Escribe tu dirección completa.';
    if (!shippingLocation.countryName.trim()) errors.country = 'Selecciona el país.';
    if (!shippingLocation.stateName.trim()) errors.state = 'Selecciona el departamento o estado.';
    if (!shippingLocation.cityName.trim()) errors.city = 'Selecciona la ciudad o municipio.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePayment = async () => {
    if (!currentUser?.fromApi) {
      onClose();
      onLoginRequired?.();
      return;
    }
    if (!validateShippingForm()) {
      setError('Revisa los datos obligatorios de envío para continuar.');
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
            className="fixed inset-0 bg-stone-950/45 backdrop-blur-sm z-[200]"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[210] mx-auto flex h-[100dvh] w-full max-w-4xl flex-col bg-[#F7F5F1] shadow-2xl sm:inset-4 sm:h-[calc(100dvh-2rem)] sm:rounded-[32px] sm:border sm:border-white/70"
          >
            <div className="flex items-center justify-between border-b border-stone-200 bg-white/95 px-5 py-4 sm:rounded-t-[32px] md:px-8">
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2D3A1F]">
                  Checkout seguro
                </div>
                <h2 className="text-lg font-semibold text-stone-950 md:text-xl">
                  {wompiOrderId
                    ? 'Pago con Wompi'
                    : mockPayment
                      ? 'Proveedor simulado'
                      : 'Información de envío'}
                </h2>
              </div>
              <button
                onClick={close}
                disabled={isSubmitting}
                className="rounded-full p-2 text-stone-500 transition-colors hover:bg-stone-100 disabled:opacity-40"
                aria-label="Cerrar checkout"
              >
                <X className="w-5 h-5" strokeWidth={1.6} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5 md:p-8 md:space-y-6">
              {wompiOrderId ? (
                <div className="space-y-6 text-center py-6">
                  {wompiState === 'approved' ? (
                    <>
                      <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
                      <h3 className="text-xl">Pago exitoso</h3>
                      <p className="text-sm text-muted-foreground">
                        El pago fue exitoso y el estado cambió de pago rechazado
                        a pago aprobado.
                      </p>
                    </>
                  ) : wompiState === 'failed' ? (
                    <>
                      <XCircle className="w-14 h-14 text-red-600 mx-auto" />
                      <h3 className="text-xl">Hubo un inconveniente con el pago</h3>
                      <p className="text-sm text-muted-foreground">
                        Hubo un inconveniente con el pago, intente de nuevo más tarde.
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
                      <h3 className="text-xl">Esperando confirmación de pago</h3>
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
                  <div className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
                    <div className="mb-6 flex items-center justify-between gap-2 overflow-x-auto pb-1">
                      {['Carrito', 'Envío', 'Pago', 'Confirmación'].map((step, index) => {
                        const active = step === 'Envío';
                        const done = index === 0;
                        return (
                          <div key={step} className="flex min-w-fit items-center gap-2">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-bold ${
                                active
                                  ? 'border-[#2D3A1F] bg-[#2D3A1F] text-white'
                                  : done
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-stone-200 bg-stone-50 text-stone-400'
                              }`}
                            >
                              {done ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : index + 1}
                            </div>
                            <span className={`text-[11px] font-semibold ${active ? 'text-stone-950' : 'text-stone-400'}`}>
                              {step}
                            </span>
                            {index < 3 && <div className="h-px w-7 bg-stone-200" />}
                          </div>
                        );
                      })}
                    </div>

                    <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#2D3A1F]/10 px-3 py-1 text-[11px] font-semibold text-[#2D3A1F]">
                      <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
                      Compra segura con Wompi
                    </p>
                    <h2 className="text-2xl font-semibold text-stone-950">Datos de envío</h2>
                    <p className="mt-1 text-sm text-stone-500">Confirma dónde deseas recibir tu pedido.</p>
                  </div>

                  {hasRegisteredAddress && (
                    <section className="rounded-[28px] border border-[#2D3A1F]/15 bg-[#F3F7EF] p-5 shadow-sm md:p-6">
                      <div className="mb-4 flex items-start gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white text-[#2D3A1F] shadow-sm">
                          <Home className="h-5 w-5" strokeWidth={1.7} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-stone-950">Usar mi dirección registrada</h3>
                          <p className="mt-1 text-sm leading-relaxed text-stone-600">
                            Hemos encontrado una dirección asociada a tu cuenta. Puedes usarla para completar tu compra más rápido.
                          </p>
                        </div>
                      </div>
                      <div className="rounded-3xl border border-white/80 bg-white p-4 text-sm text-stone-700">
                        <div className="grid gap-2">
                          <p className="font-semibold text-stone-950">{registeredAddress.fullName || 'Nombre por completar'}</p>
                          <p>{registeredAddress.phone || 'Teléfono por completar'}</p>
                          <p>{registeredAddress.address}</p>
                          <p>{registeredAddress.city ? `${registeredAddress.city}, departamento por confirmar` : 'Ciudad y departamento por confirmar'}</p>
                          <p>{registeredAddress.country}</p>
                          <p>Código postal por completar</p>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={useRegisteredAddress}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#2D3A1F] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                        >
                          <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                          Usar esta dirección
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddressForm(true)}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 transition-colors hover:border-stone-400"
                        >
                          <Pencil className="h-4 w-4" strokeWidth={1.8} />
                          Editar dirección
                        </button>
                      </div>
                    </section>
                  )}

                  {showAddressForm && (
                    <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
                      <div className="mb-5 flex items-center gap-2">
                        <Truck className="h-5 w-5 text-[#2D3A1F]" strokeWidth={1.7} />
                        <h3 className="text-lg font-semibold text-stone-950">Información de envío</h3>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label>
                          <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                            <User className="h-3.5 w-3.5" /> Nombre completo *
                          </span>
                          <input type="text" value={formData.fullName} onChange={(event) => updateFormField('fullName', event.target.value)} placeholder="Ingresa tu nombre completo" className={inputBaseClass} />
                          {formErrors.fullName && <p className="mt-1.5 text-xs text-red-600">{formErrors.fullName}</p>}
                        </label>
                        <label>
                          <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                            <Mail className="h-3.5 w-3.5" /> Email *
                          </span>
                          <input type="email" value={formData.email} onChange={(event) => updateFormField('email', event.target.value)} placeholder="Ingresa tu correo electrónico" className={inputBaseClass} />
                          {formErrors.email && <p className="mt-1.5 text-xs text-red-600">{formErrors.email}</p>}
                        </label>
                        <label>
                          <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                            <Phone className="h-3.5 w-3.5" /> Teléfono *
                          </span>
                          <input type="tel" value={formData.phone} onChange={(event) => updateFormField('phone', event.target.value)} placeholder="Ingresa tu número de teléfono" className={inputBaseClass} />
                          {formErrors.phone && <p className="mt-1.5 text-xs text-red-600">{formErrors.phone}</p>}
                        </label>
                        <label>
                          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-stone-500">Código postal</span>
                          <input type="text" value={formData.zipCode} onChange={(event) => updateFormField('zipCode', event.target.value)} placeholder="Ej. 110111" className={inputBaseClass} />
                        </label>
                        <label className="md:col-span-2">
                          <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">
                            <Home className="h-3.5 w-3.5" /> Dirección *
                          </span>
                          <input type="text" value={formData.address} onChange={(event) => updateFormField('address', event.target.value)} placeholder="Escribe tu dirección completa" className={inputBaseClass} />
                          {formErrors.address && <p className="mt-1.5 text-xs text-red-600">{formErrors.address}</p>}
                        </label>
                        <label className="md:col-span-2">
                          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-stone-500">Referencia adicional</span>
                          <input type="text" value={formData.reference} onChange={(event) => updateFormField('reference', event.target.value)} placeholder="Apartamento, torre, barrio o indicaciones para el repartidor" className={inputBaseClass} />
                        </label>
                        <div className="rounded-3xl border border-stone-200 bg-[#F8F7F4] p-4 md:col-span-2">
                          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-900">
                            <MapPin className="h-4 w-4 text-[#2D3A1F]" strokeWidth={1.7} />
                            Ubicación
                          </div>
                          {!shippingLocation.countryName && (
                            <p className="mb-3 rounded-2xl bg-white px-3 py-2 text-xs text-stone-500">Selecciona primero el país para continuar.</p>
                          )}
                          <LocationPicker
                            value={shippingLocation}
                            onChange={(value) => {
                              setShippingLocation(value);
                              setFormErrors((current) => ({ ...current, country: undefined, state: undefined, city: undefined }));
                            }}
                            required
                          />
                          {(formErrors.country || formErrors.state || formErrors.city) && (
                            <p className="mt-3 text-xs text-red-600">{formErrors.country || formErrors.state || formErrors.city}</p>
                          )}
                        </div>
                      </div>
                    </section>
                  )}

                  <div className="rounded-3xl border border-stone-200 bg-white px-4 py-3 text-xs leading-relaxed text-stone-500">
                    Tus datos se usarán únicamente para gestionar el envío de tu pedido.
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
              <div className="border-t border-stone-200 bg-white px-4 py-4 sm:rounded-b-[32px] md:px-8">
                <div className="mx-auto grid max-w-3xl gap-4 md:grid-cols-[1fr_auto] md:items-end">
                  <div className="rounded-3xl border border-stone-200 bg-[#F8F7F4] p-4">
                    <h3 className="mb-3 text-sm font-semibold text-stone-950">Resumen del pedido</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Subtotal</span>
                        <span className="font-medium text-stone-900">{formatMoney(total)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-500">Envío</span>
                        <span className={shippingCost === 0 ? 'font-semibold text-emerald-700' : 'font-medium text-stone-900'}>
                          {shippingCost === 0 ? 'Gratis' : formatMoney(shippingCost)}
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
                      <Lock className="h-3.5 w-3.5 text-[#2D3A1F]" strokeWidth={1.8} />
                      <span>Pago protegido por Wompi</span>
                      <span>|</span>
                      <MessageCircle className="h-3.5 w-3.5 text-[#2D3A1F]" strokeWidth={1.8} />
                      <span>Soporte por WhatsApp</span>
                    </div>
                    <button
                      onClick={handlePayment}
                      disabled={isSubmitting || items.length === 0}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2D3A1F] px-6 py-4 text-sm font-bold uppercase tracking-[0.12em] text-white shadow-lg shadow-[#2D3A1F]/15 transition-opacity hover:opacity-95 disabled:opacity-50"
                    >
                      <Lock className="h-4 w-4" />
                      {isSubmitting ? 'Preparando pago...' : 'Continuar al pago'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

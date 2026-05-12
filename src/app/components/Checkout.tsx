import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, CreditCard, Truck, MapPin, Lock } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useUser } from '../contexts/UserContext';
import type { CreateOrderPayload } from '../services/orders.service';

interface CheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginRequired?: () => void;
}

export function Checkout({ isOpen, onClose, onLoginRequired }: CheckoutProps) {
  const { items, total, clearCart } = useCart();
  const { currentUser, addOrder } = useUser();
  const [step, setStep] = useState<'shipping' | 'payment' | 'confirmation'>('shipping');
  const [formData, setFormData] = useState({
    // Shipping
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    department: '',
    zipCode: '',
    // Payment
    cardNumber: '',
    cardName: '',
    expiryDate: '',
    cvv: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateShipping = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'Nombre requerido';
    if (!formData.email.trim()) newErrors.email = 'Email requerido';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email inválido';
    if (!formData.phone.trim()) newErrors.phone = 'Teléfono requerido';
    if (!formData.address.trim()) newErrors.address = 'Dirección requerida';
    if (!formData.city.trim()) newErrors.city = 'Ciudad requerida';
    if (!formData.department.trim()) newErrors.department = 'Departamento requerido';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePayment = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.cardNumber.trim()) newErrors.cardNumber = 'Número de tarjeta requerido';
    else if (formData.cardNumber.replace(/\s/g, '').length < 16) newErrors.cardNumber = 'Número de tarjeta inválido';
    if (!formData.cardName.trim()) newErrors.cardName = 'Nombre requerido';
    if (!formData.expiryDate.trim()) newErrors.expiryDate = 'Fecha requerida';
    if (!formData.cvv.trim()) newErrors.cvv = 'CVV requerido';
    else if (formData.cvv.length < 3) newErrors.cvv = 'CVV inválido';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    // Require login before proceeding
    if (!currentUser) {
      onClose();
      if (onLoginRequired) {
        onLoginRequired();
      }
      return;
    }

    if (step === 'shipping') {
      if (validateShipping()) {
        setStep('payment');
      }
    } else if (step === 'payment') {
      if (validatePayment()) {
        setStep('confirmation');
      }
    }
  };

  const handleFinish = () => {
    // Build API payload for real backend
    const apiPayload: CreateOrderPayload = {
      items: items.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
      })),
      shipping_address: {
        full_name: formData.fullName,
        address_line1: formData.address,
        city: formData.city,
        department: formData.department,
        postal_code: formData.zipCode || undefined,
        phone: formData.phone,
        country: 'CO',
      },
      payment_method: 'card',
    };

    // Save order to user's order history (API or localStorage fallback)
    if (currentUser) {
      addOrder({
        productos: items.map(item => ({
          productoId: item.id,
          nombre: item.name,
          cantidad: item.quantity,
          precio: item.price,
        })),
        total: finalTotal,
        estado: 'procesando',
        direccionEnvio: `${formData.address}, ${formData.city}, ${formData.department}`,
        apiPayload,
      });
    }

    clearCart();
    onClose();
    setStep('shipping');
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      department: '',
      zipCode: '',
      cardNumber: '',
      cardName: '',
      expiryDate: '',
      cvv: '',
    });
  };

  const shippingCost = total >= 80000 ? 0 : 10000;
  const finalTotal = total + shippingCost;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-foreground/40 z-50"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-background z-50 flex flex-col overflow-hidden"
          >
            {/* Login Required Warning */}
            {!currentUser && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-amber-50 border-b border-amber-200"
              >
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" strokeWidth={1} />
                  <div>
                    <div className="text-sm font-medium text-amber-900 mb-1">
                      Inicia sesión para continuar
                    </div>
                    <div className="text-xs text-amber-700 mb-3">
                      Necesitas una cuenta para completar tu compra y hacer seguimiento de tus pedidos
                    </div>
                    <button
                      onClick={() => {
                        onClose();
                        if (onLoginRequired) onLoginRequired();
                      }}
                      className="px-4 py-2 bg-amber-600 text-white text-xs tracking-wider uppercase hover:bg-amber-700 transition-colors"
                    >
                      Iniciar sesión
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Header */}
            <div className="p-8 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-xs tracking-[0.2em] uppercase mb-2">
                  {step === 'shipping' && 'Datos de envío'}
                  {step === 'payment' && 'Método de pago'}
                  {step === 'confirmation' && 'Confirmación'}
                </div>
                <div className="flex gap-2">
                  <div className={`h-1 w-16 ${step === 'shipping' ? 'bg-foreground' : 'bg-border'}`}></div>
                  <div className={`h-1 w-16 ${step === 'payment' ? 'bg-foreground' : 'bg-border'}`}></div>
                  <div className={`h-1 w-16 ${step === 'confirmation' ? 'bg-foreground' : 'bg-border'}`}></div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="hover:opacity-50 transition-opacity"
              >
                <X className="w-5 h-5" strokeWidth={1} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
              {step === 'shipping' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <Truck className="w-5 h-5" strokeWidth={1} />
                    <h2 className="text-xl">Información de envío</h2>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Nombre completo *
                      </label>
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="w-full px-4 py-3 bg-transparent border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                      />
                      {errors.fullName && <div className="text-xs text-red-500 mt-1">{errors.fullName}</div>}
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 bg-transparent border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                      />
                      {errors.email && <div className="text-xs text-red-500 mt-1">{errors.email}</div>}
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Teléfono *
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-3 bg-transparent border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                      />
                      {errors.phone && <div className="text-xs text-red-500 mt-1">{errors.phone}</div>}
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Dirección *
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full px-4 py-3 bg-transparent border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                      />
                      {errors.address && <div className="text-xs text-red-500 mt-1">{errors.address}</div>}
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Ciudad *
                      </label>
                      <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full px-4 py-3 bg-transparent border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                      />
                      {errors.city && <div className="text-xs text-red-500 mt-1">{errors.city}</div>}
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Departamento *
                      </label>
                      <input
                        type="text"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="w-full px-4 py-3 bg-transparent border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                      />
                      {errors.department && <div className="text-xs text-red-500 mt-1">{errors.department}</div>}
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Código postal (opcional)
                      </label>
                      <input
                        type="text"
                        value={formData.zipCode}
                        onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                        className="w-full px-4 py-3 bg-transparent border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 'payment' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <CreditCard className="w-5 h-5" strokeWidth={1} />
                    <h2 className="text-xl">Información de pago</h2>
                  </div>

                  <div className="p-4 bg-secondary border border-border text-xs">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4" strokeWidth={1} />
                      <span className="font-medium">Enviar a:</span>
                    </div>
                    <div className="text-muted-foreground">
                      {formData.fullName}<br />
                      {formData.address}, {formData.city}, {formData.department}
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Número de tarjeta *
                      </label>
                      <input
                        type="text"
                        value={formData.cardNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
                          setFormData({ ...formData, cardNumber: value });
                        }}
                        maxLength={19}
                        placeholder="1234 5678 9012 3456"
                        className="w-full px-4 py-3 bg-transparent border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                      />
                      {errors.cardNumber && <div className="text-xs text-red-500 mt-1">{errors.cardNumber}</div>}
                    </div>

                    <div>
                      <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                        Nombre en la tarjeta *
                      </label>
                      <input
                        type="text"
                        value={formData.cardName}
                        onChange={(e) => setFormData({ ...formData, cardName: e.target.value.toUpperCase() })}
                        placeholder="NOMBRE APELLIDO"
                        className="w-full px-4 py-3 bg-transparent border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                      />
                      {errors.cardName && <div className="text-xs text-red-500 mt-1">{errors.cardName}</div>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                          Fecha de vencimiento *
                        </label>
                        <input
                          type="text"
                          value={formData.expiryDate}
                          onChange={(e) => {
                            let value = e.target.value.replace(/\D/g, '');
                            if (value.length >= 2) {
                              value = value.slice(0, 2) + '/' + value.slice(2, 4);
                            }
                            setFormData({ ...formData, expiryDate: value });
                          }}
                          maxLength={5}
                          placeholder="MM/AA"
                          className="w-full px-4 py-3 bg-transparent border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                        />
                        {errors.expiryDate && <div className="text-xs text-red-500 mt-1">{errors.expiryDate}</div>}
                      </div>

                      <div>
                        <label className="block text-xs uppercase tracking-wider text-muted-foreground mb-2">
                          CVV *
                        </label>
                        <input
                          type="text"
                          value={formData.cvv}
                          onChange={(e) => setFormData({ ...formData, cvv: e.target.value.replace(/\D/g, '') })}
                          maxLength={4}
                          placeholder="123"
                          className="w-full px-4 py-3 bg-transparent border border-border text-sm focus:outline-none focus:border-foreground transition-colors"
                        />
                        {errors.cvv && <div className="text-xs text-red-500 mt-1">{errors.cvv}</div>}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-secondary text-xs text-muted-foreground">
                    🔒 Tu información de pago está segura y encriptada
                  </div>
                </motion.div>
              )}

              {step === 'confirmation' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6"
                  >
                    <Check className="w-10 h-10 text-green-600" strokeWidth={1} />
                  </motion.div>

                  <h2 className="text-2xl mb-3">¡Pedido confirmado!</h2>
                  <p className="text-sm text-muted-foreground mb-8 max-w-md mx-auto">
                    Gracias por tu compra. Hemos enviado un correo de confirmación a <strong>{formData.email}</strong>
                  </p>

                  <div className="bg-secondary p-6 text-left max-w-md mx-auto mb-8">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
                      Resumen del pedido
                    </div>
                    <div className="space-y-3 mb-4">
                      {items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span>{item.name} ({item.size}) x{item.quantity}</span>
                          <span>${(item.price * item.quantity).toLocaleString('es-CO')}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>${total.toLocaleString('es-CO')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Envío</span>
                        <span>{shippingCost === 0 ? 'Gratis' : `$${shippingCost.toLocaleString('es-CO')}`}</span>
                      </div>
                      <div className="flex justify-between text-lg pt-2 border-t border-border">
                        <span>Total</span>
                        <span>${finalTotal.toLocaleString('es-CO')}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleFinish}
                    className="px-8 py-4 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90 transition-opacity"
                  >
                    Continuar comprando
                  </button>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            {step !== 'confirmation' && (
              <div className="p-8 border-t border-border">
                <div className="mb-6">
                  <div className="flex justify-between mb-2 text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${total.toLocaleString('es-CO')}</span>
                  </div>
                  <div className="flex justify-between mb-4 text-sm">
                    <span className="text-muted-foreground">Envío</span>
                    <span>{shippingCost === 0 ? 'Gratis' : `$${shippingCost.toLocaleString('es-CO')}`}</span>
                  </div>
                  <div className="flex justify-between text-lg pt-4 border-t border-border">
                    <span>Total</span>
                    <span>${finalTotal.toLocaleString('es-CO')}</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  {step === 'payment' && (
                    <button
                      onClick={() => setStep('shipping')}
                      className="flex-1 py-4 border border-border text-xs tracking-wider uppercase hover:bg-secondary transition-colors"
                    >
                      Volver
                    </button>
                  )}
                  <button
                    onClick={handleContinue}
                    className="flex-1 py-4 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90 transition-opacity"
                  >
                    {step === 'shipping' ? 'Continuar' : 'Pagar ahora'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
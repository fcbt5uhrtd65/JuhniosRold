import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  CreditCard,
  Hash,
  Heart,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Save,
  ShoppingCart,
  Store,
  Trash2,
  Truck,
  Clock,
  AlertCircle,
  User as UserIcon,
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useCart } from '../contexts/CartContext';
import { useAdmin } from '../contexts/AdminContext';
import { useToast } from '../contexts/ToastContext';
import { LocationPicker } from './ui/LocationPicker';
import { DeliveryLocationSection } from './ui/DeliveryLocationSection';
import { EMPTY_LOCATION, type LocationValue } from '../services/geography.types';
import { EMPTY_DELIVERY_LOCATION, type DeliveryLocationValue } from '../services/delivery-location.types';
import { geographyService, type City } from '../services/geography.service';
import { getProductById } from '../services/products.service';
import { initiatePayment, resolveMockPayment } from '../services/payments.service';
import { TrackingPedidoPage } from './TrackingPedidoPage';

/* ─── tipos ─── */
type Section = 'datos' | 'pedidos' | 'guardados' | 'mayorista';

const DOCUMENT_TYPES: Record<string, string> = {
  CC: 'Cédula de Ciudadanía',
  CE: 'Cédula de Extranjería',
  PASSPORT: 'Pasaporte',
  NIT: 'NIT',
  OTHER: 'Otro',
  PENDING: 'Sin definir',
};

const input =
  'w-full border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-stone-400 focus:bg-white placeholder:text-stone-400 rounded-xl';

/* ─── helpers de estado pedido ─── */
function statusIcon(s: string) {
  if (['pendiente','pending','payment_pending','failed'].includes(s))
    return s === 'failed'
      ? <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
      : <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />;
  if (['procesando','processing','confirmed','packed'].includes(s))
    return <Package className="w-3.5 h-3.5" strokeWidth={1.5} />;
  if (['enviado','shipped','in_transit'].includes(s))
    return <Truck className="w-3.5 h-3.5" strokeWidth={1.5} />;
  if (['entregado','delivered'].includes(s))
    return <Check className="w-3.5 h-3.5" strokeWidth={1.5} />;
  return <Package className="w-3.5 h-3.5" strokeWidth={1.5} />;
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pendiente: 'Pendiente', pending: 'Pendiente', payment_pending: 'Pend. pago',
    paid: 'Pagado', failed: 'Rechazado',
    procesando: 'Procesando', processing: 'Procesando',
    confirmed: 'Confirmado', packed: 'Empacado',
    enviado: 'En camino', shipped: 'En camino', in_transit: 'En tránsito',
    entregado: 'Entregado', delivered: 'Entregado',
    cancelado: 'Cancelado', cancelled: 'Cancelado',
    returned: 'Devuelto', refunded: 'Reembolsado',
  };
  return map[s] ?? s;
}

function statusCls(s: string) {
  if (['pendiente','pending','payment_pending'].includes(s))
    return 'bg-amber-50 text-amber-700 border-amber-200';
  if (s === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (s === 'failed') return 'bg-red-50 text-red-600 border-red-200';
  if (['procesando','processing','confirmed','packed'].includes(s))
    return 'bg-blue-50 text-blue-700 border-blue-200';
  if (['enviado','shipped','in_transit'].includes(s))
    return 'bg-violet-50 text-violet-700 border-violet-200';
  if (['entregado','delivered'].includes(s))
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-stone-100 text-stone-600 border-stone-200';
}

const canPay = (s: string) =>
  ['pendiente','pending','payment_pending','failed'].includes(s);

/* ═══════════════════════════════════════════════════════ */
export function ProfilePage({ onLoginClick: _onLoginClick }: { onLoginClick: () => void }) {
  const { currentUser, updateProfile, orders, loadOrders, backendOnline, savedProducts, toggleSaveProduct } = useUser();
  const { addItem } = useCart();
  const { products } = useAdmin();
  const toast = useToast();

  const initialSection = (): Section => {
    const s = new URLSearchParams(window.location.search).get('s');
    return (['datos', 'pedidos', 'guardados', 'mayorista'] as Section[]).includes(s as Section)
      ? (s as Section)
      : 'datos';
  };
  const [section, setSection] = useState<Section>(initialSection);

  /* ── formulario datos ── */
  const [form, setForm] = useState({ firstName: '', lastName: '', telefono: '' });
  const [profileLoc, setProfileLoc] = useState<LocationValue>(EMPTY_LOCATION);
  const [deliveryLoc, setDeliveryLoc] = useState<DeliveryLocationValue>(EMPTY_DELIVERY_LOCATION);
  const [cities, setCities] = useState<City[]>([]);
  const cityNames = useMemo(() => cities.map((c) => c.name), [cities]);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  /* ── pedidos ── */
  const [payingId, setPayingId] = useState<string | null>(null);
  const [mockPay, setMockPay] = useState<{ orderId: string; paymentId: string } | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);

  /* ── redirect si no logueado ── */
  useEffect(() => {
    if (!currentUser) {
      window.history.replaceState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [currentUser]);

  /* ── cargar datos form ── */
  useEffect(() => {
    if (!currentUser) return;
    setSaveErr(''); setSaveOk(false);
    setForm({ firstName: currentUser.firstName || '', lastName: currentUser.lastName || '', telefono: currentUser.telefono || '' });
    setDeliveryLoc({ ...EMPTY_DELIVERY_LOCATION, address: currentUser.direccion || '', reference: currentUser.referencia || '', city: currentUser.ciudad || '', state: currentUser.departamento || '', country: currentUser.pais || '', lat: currentUser.latitud ?? null, lng: currentUser.longitud ?? null, confirmed: Boolean(currentUser.latitud && currentUser.longitud) });
    if (!currentUser.pais && !currentUser.departamento && !currentUser.ciudad) { setProfileLoc(EMPTY_LOCATION); return; }
    let alive = true; setLoadingLoc(true);
    geographyService.resolveLocationByNames({ country: currentUser.pais, state: currentUser.departamento, city: currentUser.ciudad })
      .then((r) => { if (alive) setProfileLoc(r); })
      .catch(() => { if (alive) setProfileLoc({ ...EMPTY_LOCATION, countryName: currentUser.pais ?? '', stateName: currentUser.departamento ?? '', cityName: currentUser.ciudad ?? '' }); })
      .finally(() => { if (alive) setLoadingLoc(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!profileLoc.stateId) { setCities([]); return; }
    let c = true;
    geographyService.getCities(profileLoc.stateId).then((r) => { if (c) setCities(r); }).catch(() => { if (c) setCities([]); });
    return () => { c = false; };
  }, [profileLoc.stateId]);

  /* ── cargar pedidos al entrar a sección ── */
  useEffect(() => { if (section === 'pedidos') loadOrders(); }, [section, loadOrders]);

  if (!currentUser) return null;

  const docLabel = currentUser.tipoDocumento ? DOCUMENT_TYPES[currentUser.tipoDocumento] ?? currentUser.tipoDocumento : null;
  const isWholesale = currentUser.modoCompra === 'WHOLESALE' || Boolean(currentUser.codigoMayorista);

  /* ── guardar datos ── */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaveErr('');
    if (!form.firstName.trim()) { setSaveErr('Ingresa tus nombres.'); return; }
    if (!form.lastName.trim()) { setSaveErr('Ingresa tus apellidos.'); return; }
    setSaving(true);
    const r = await updateProfile({ firstName: form.firstName, lastName: form.lastName, telefono: form.telefono, direccion: deliveryLoc.address || undefined, referencia: deliveryLoc.reference || undefined, ciudad: profileLoc.cityName || deliveryLoc.city || undefined, departamento: profileLoc.stateName || deliveryLoc.state || undefined, pais: deliveryLoc.country || profileLoc.countryName || undefined, latitud: deliveryLoc.lat, longitud: deliveryLoc.lng });
    setSaving(false);
    if (!r.ok) { setSaveErr(r.message || 'No fue posible guardar.'); return; }
    setSaveOk(true); setTimeout(() => setSaveOk(false), 3000);
  };

  /* ── pago ── */
  const handlePay = async (orderId: string) => {
    setPayingId(orderId);
    const tab = window.open('about:blank', '_blank');
    try {
      const p = await initiatePayment(orderId);
      if (p.requires_redirect && p.checkout_url) {
        if (tab && !tab.closed) { tab.location.href = p.checkout_url; window.history.pushState({}, '', `/pago/resultado?pedido_id=${orderId}`); window.dispatchEvent(new PopStateEvent('popstate')); }
        else toast.warning('El navegador bloqueó la pestaña. Permite pop-ups e intenta de nuevo.');
        return;
      }
      tab?.close(); setMockPay({ orderId, paymentId: p.payment_id }); toast.info('Pago simulado listo.');
    } catch (err) { tab?.close(); toast.error(err instanceof Error ? err.message : 'Error al iniciar pago.'); }
    finally { setPayingId(null); }
  };

  const handleMock = async (outcome: 'approved' | 'declined') => {
    if (!mockPay) return; setPayingId(mockPay.orderId);
    try {
      const r = await resolveMockPayment(mockPay.paymentId, outcome);
      await loadOrders();
      outcome === 'approved' ? toast.success(r.invoice_number ? `Aprobado — Factura ${r.invoice_number}` : 'Pago aprobado.') : toast.warning('Pago rechazado.');
      setMockPay(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error.'); }
    finally { setPayingId(null); }
  };

  /* ── guardados ── */
  const savedWithDetail = savedProducts.map((s) => { const p = products.find((x) => x.id === s.productoId); return p ? { ...p, savedDate: s.fecha } : null; }).filter(Boolean) as any[];

  const handleAddToCart = async (product: any) => {
    try {
      const cp = await getProductById(product.id);
      const v = cp.variants.find((i: any) => i.is_active && i.presentation === product.presentacion) ?? cp.variants.find((i: any) => i.is_active);
      if (!v) { toast.warning('Sin presentación disponible.'); return; }
      const added = await addItem({ variantId: v.id, name: cp.name, category: cp.category_name, price: v.current_price ?? cp.price ?? 0, image: cp.primary_image || product.imagen || 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=600&q=80', size: v.presentation, quantity: 1 });
      if (added) toast.success(`${cp.name} añadido al carrito`);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error al cargar producto.'); }
  };

  /* ─── nav items ─── */
  const navItems: { id: Section; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'datos',      label: 'Mis datos',    icon: <UserIcon className="w-4 h-4" strokeWidth={1.5} /> },
    { id: 'pedidos',    label: 'Pedidos',      icon: <Package className="w-4 h-4" strokeWidth={1.5} />, count: orders.length },
    { id: 'guardados',  label: 'Guardados',    icon: <Heart className="w-4 h-4" strokeWidth={1.5} />, count: savedProducts.length || undefined },
    { id: 'mayorista',  label: 'Plan mayorista', icon: <Store className="w-4 h-4" strokeWidth={1.5} /> },
  ];

  return (
    <div className="min-h-screen bg-[#F4F3F0] flex flex-col">

      {/* ── top bar minimalista ── */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <button
            onClick={() => { window.history.back(); }}
            className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-stone-400 transition-colors hover:text-stone-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver
          </button>
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">
            Mi cuenta
          </span>
          <div className="w-16" />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-0 px-5 py-8">

        {/* ══ SIDEBAR ══ */}
        <aside className="hidden w-60 flex-shrink-0 md:flex md:flex-col gap-1 pr-8">

          {/* Avatar */}
          <div className="mb-6">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-stone-900 text-white">
              <UserIcon className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-semibold text-stone-900 truncate">{currentUser.nombre}</p>
            <p className="text-xs text-stone-400 truncate">{currentUser.email}</p>
            {isWholesale && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-stone-900 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-white">
                <Store className="w-3 h-3" /> Mayorista
              </span>
            )}
          </div>

          {/* Nav */}
          <nav className="space-y-0.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${
                  section === item.id
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                <span className="flex items-center gap-2.5 text-sm font-medium">
                  {item.icon}
                  {item.label}
                </span>
                {item.count !== undefined && item.count > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                    section === item.id ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-600'
                  }`}>
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Badges */}
          <div className="mt-auto pt-8 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-stone-400">
              <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" strokeWidth={2} />
              Cuenta verificada
            </div>
            {docLabel && currentUser.numeroDocumento && (
              <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                <Hash className="w-3 h-3" /> {docLabel} · {currentUser.numeroDocumento}
              </div>
            )}
          </div>
        </aside>

        {/* ── Mobile nav ── */}
        <div className="mb-5 flex gap-1 overflow-x-auto pb-1 md:hidden w-full">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                section === item.id ? 'bg-stone-900 text-white' : 'bg-white text-stone-500 border border-stone-200'
              }`}
            >
              {item.icon}
              {item.label}
              {item.count !== undefined && item.count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${section === item.id ? 'bg-white/20' : 'bg-stone-100'}`}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══ CONTENT ══ */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">

            {/* ─── DATOS ─── */}
            {section === 'datos' && (
              <motion.div key="datos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                <form onSubmit={handleSave} className="space-y-4">

                  <div className="mb-6">
                    <h1 className="text-xl font-semibold text-stone-900">Mis datos</h1>
                    <p className="mt-0.5 text-sm text-stone-400">Información personal y dirección de envío</p>
                  </div>

                  <AnimatePresence>
                    {saveOk && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                        <Check className="h-4 w-4 flex-shrink-0" strokeWidth={2.5} /> Cambios guardados
                      </motion.div>
                    )}
                    {saveErr && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" strokeWidth={1.8} /> {saveErr}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Card datos personales */}
                  <div className="rounded-2xl border border-stone-200 bg-white p-6">
                    <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-stone-400">Datos personales</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-stone-500">Nombres *</span>
                        <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={input} placeholder="María Fernanda" required />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium text-stone-500">Apellidos *</span>
                        <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={input} placeholder="García López" required />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="flex items-center gap-1 text-xs font-medium text-stone-500"><Lock className="w-3 h-3" /> Email</span>
                        <input type="email" value={currentUser.email} disabled className={input + ' cursor-not-allowed opacity-50'} />
                      </label>
                      <label className="flex flex-col gap-1.5">
                        <span className="flex items-center gap-1 text-xs font-medium text-stone-500"><Phone className="w-3 h-3" /> Teléfono</span>
                        <input type="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className={input} placeholder="3001234567" />
                      </label>
                      {docLabel && currentUser.numeroDocumento && (
                        <label className="flex flex-col gap-1.5 sm:col-span-2">
                          <span className="flex items-center gap-1 text-xs font-medium text-stone-500"><Hash className="w-3 h-3" /> Documento</span>
                          <input type="text" value={`${docLabel} · ${currentUser.numeroDocumento}`} disabled className={input + ' cursor-not-allowed opacity-50'} />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Card dirección */}
                  <div className="rounded-2xl border border-stone-200 bg-white p-6">
                    <div className="mb-5 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">Dirección de envío</p>
                      {loadingLoc && (
                        <span className="flex items-center gap-1.5 text-[10px] text-stone-400">
                          <Loader2 className="h-3 w-3 animate-spin" /> Cargando…
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      <LocationPicker value={profileLoc} onChange={setProfileLoc} />
                      <DeliveryLocationSection value={deliveryLoc} onChange={setDeliveryLoc} searchScope={{ state: profileLoc.stateName, country: profileLoc.countryName }} cityOptions={cityNames} onCityResolved={(cn) => setProfileLoc((p) => ({ ...p, cityId: null, cityName: cn }))} />
                    </div>
                  </div>

                  <button type="submit" disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-40">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={2} />}
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ─── PEDIDOS ─── */}
            {section === 'pedidos' && (
              <motion.div key="pedidos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-semibold text-stone-900">Pedidos</h1>
                    <p className="mt-0.5 text-sm text-stone-400">{orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'} en total</p>
                  </div>
                  <button onClick={loadOrders} className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-900">
                    <RefreshCw className="w-3.5 h-3.5" /> Actualizar
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <Package className="mb-4 h-10 w-10 text-stone-300" strokeWidth={1} />
                    <p className="text-sm font-medium text-stone-500">Sin pedidos aún</p>
                    <p className="mt-1 text-xs text-stone-400">Tu historial de compras aparecerá aquí</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <div key={order.id} className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
                        {/* Header pedido */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
                          <div>
                            <p className="text-sm font-semibold text-stone-900">
                              {order.order_number ? `#${order.order_number}` : `#${order.id.slice(0, 8)}`}
                            </p>
                            <p className="mt-0.5 text-xs text-stone-400">
                              {new Date(order.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                          </div>
                          <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${statusCls(order.estado)}`}>
                            {statusIcon(order.estado)}
                            {statusLabel(order.estado)}
                          </span>
                        </div>

                        {/* Productos */}
                        <div className="px-5 py-4 space-y-2">
                          {order.productos.map((p, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-stone-700">{p.nombre} <span className="text-stone-400">×{p.cantidad}</span></span>
                              <span className="font-medium text-stone-900">${(p.precio * p.cantidad).toLocaleString('es-CO')}</span>
                            </div>
                          ))}
                        </div>

                        {/* Total + acciones */}
                        <div className="border-t border-stone-100 bg-stone-50 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-sm font-semibold text-stone-900">Total: ${order.total.toLocaleString('es-CO')}</span>
                          <div className="flex items-center gap-2">
                            {backendOnline && canPay(order.estado) && (
                              mockPay?.orderId === order.id ? (
                                <>
                                  <button onClick={() => handleMock('approved')} disabled={payingId === order.id} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Aprobar</button>
                                  <button onClick={() => handleMock('declined')} disabled={payingId === order.id} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-40">Rechazar</button>
                                </>
                              ) : (
                                <button onClick={() => handlePay(order.id)} disabled={payingId === order.id} className="flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                                  <CreditCard className="w-3.5 h-3.5" strokeWidth={1.5} />
                                  {payingId === order.id ? 'Iniciando…' : 'Pagar ahora'}
                                </button>
                              )
                            )}
                            {backendOnline && !canPay(order.estado) && (
                              <button onClick={() => setTrackingId(trackingId === order.id ? null : order.id)} className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 transition-colors hover:border-stone-300">
                                <Truck className="w-3.5 h-3.5" strokeWidth={1.5} />
                                {trackingId === order.id ? 'Ocultar' : 'Seguimiento'}
                              </button>
                            )}
                          </div>
                        </div>

                        {trackingId === order.id && (
                          <div className="border-t border-stone-100 p-4">
                            <TrackingPedidoPage pedidoId={order.id} onClose={() => setTrackingId(null)} />
                          </div>
                        )}

                        {order.direccionEnvio && (
                          <div className="border-t border-stone-100 px-5 py-3 flex items-start gap-2">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-stone-400" strokeWidth={1.5} />
                            <p className="text-xs text-stone-400">{order.direccionEnvio}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── GUARDADOS ─── */}
            {section === 'guardados' && (
              <motion.div key="guardados" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                <div className="mb-6">
                  <h1 className="text-xl font-semibold text-stone-900">Guardados</h1>
                  <p className="mt-0.5 text-sm text-stone-400">{savedWithDetail.length} {savedWithDetail.length === 1 ? 'producto' : 'productos'}</p>
                </div>

                {savedWithDetail.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <Heart className="mb-4 h-10 w-10 text-stone-300" strokeWidth={1} />
                    <p className="text-sm font-medium text-stone-500">Sin productos guardados</p>
                    <p className="mt-1 text-xs text-stone-400">Toca el corazón en cualquier producto para guardarlo aquí</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {savedWithDetail.map((p: any) => (
                      <div key={p.id} className="group rounded-2xl border border-stone-200 bg-white overflow-hidden">
                        <div className="relative aspect-square bg-stone-100 overflow-hidden">
                          <img src={p.imagen || 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=600&q=80'} alt={p.nombre} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          <button onClick={() => toggleSaveProduct(p.id)} className="absolute right-2.5 top-2.5 rounded-full bg-white/90 p-2 shadow-sm transition-opacity hover:opacity-70">
                            <Trash2 className="h-3.5 w-3.5 text-stone-600" strokeWidth={1.5} />
                          </button>
                        </div>
                        <div className="p-4">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{p.tipo}</p>
                          <p className="mt-1 text-sm font-medium text-stone-900">{p.nombre}</p>
                          <p className="text-xs text-stone-400">{p.presentacion}</p>
                          <div className="mt-3 flex items-center justify-between">
                            <span className="text-base font-semibold text-stone-900">${p.precio.toLocaleString('es-CO')}</span>
                            <button onClick={() => handleAddToCart(p)} className="flex items-center gap-1.5 rounded-xl bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-80">
                              <ShoppingCart className="h-3.5 w-3.5" strokeWidth={1.5} /> Agregar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── MAYORISTA ─── */}
            {section === 'mayorista' && (
              <motion.div key="mayorista" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="space-y-4">

                <div className="mb-6">
                  <h1 className="text-xl font-semibold text-stone-900">Plan mayorista</h1>
                  <p className="mt-0.5 text-sm text-stone-400">Condiciones, beneficios y acceso para compras por volumen</p>
                </div>

                {/* Estado del plan */}
                <div className={`rounded-2xl p-6 ${isWholesale ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${isWholesale ? 'bg-white/15 text-white' : 'bg-stone-100 text-stone-500'}`}>
                        <Store className="w-3 h-3" /> {isWholesale ? 'Plan activo' : 'Sin plan activo'}
                      </span>
                      <p className={`mt-3 text-lg font-semibold ${isWholesale ? 'text-white' : 'text-stone-900'}`}>
                        {isWholesale ? 'Tienes acceso mayorista activo' : 'Compra en volumen con precios especiales'}
                      </p>
                      <p className={`mt-1 text-sm leading-6 ${isWholesale ? 'text-white/70' : 'text-stone-400'}`}>
                        {isWholesale
                          ? 'Tu descuento se aplica automáticamente al superar el monto mínimo de compra. No necesitas cupones.'
                          : 'El plan mayorista está diseñado para distribuidoras, salones y emprendedoras que compran frecuentemente en volumen.'}
                      </p>
                    </div>
                    {isWholesale && currentUser.codigoMayorista && (
                      <div className={`rounded-xl border px-4 py-3 ${isWholesale ? 'border-white/20 bg-white/10' : 'border-stone-200 bg-stone-50'}`}>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">Código</p>
                        <p className="mt-1 font-mono text-lg font-bold tracking-wider text-white">{currentUser.codigoMayorista}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cómo funciona */}
                <div className="rounded-2xl border border-stone-200 bg-white p-6">
                  <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-stone-400">Cómo funciona</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { n: '1', t: 'Arma tu carrito', d: 'Agrega los productos que necesitas normalmente.' },
                      { n: '2', t: 'Supera el mínimo', d: 'Al superar el monto configurado, el descuento se activa solo.' },
                      { n: '3', t: 'Precio aplicado', d: 'El precio mayorista aparece en el resumen antes de pagar.' },
                    ].map(({ n, t, d }) => (
                      <div key={n} className="rounded-xl bg-stone-50 p-4">
                        <span className="text-2xl font-bold text-stone-200 leading-none">{n}</span>
                        <p className="mt-2 text-sm font-semibold text-stone-800">{t}</p>
                        <p className="mt-1 text-xs leading-5 text-stone-400">{d}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Beneficios */}
                <div className="rounded-2xl border border-stone-200 bg-white p-6">
                  <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-stone-400">Beneficios incluidos</p>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {[
                      ['Descuento automático por volumen', 'Se activa solo al superar la compra mínima. Sin cupones.'],
                      ['Acceso a toda la colección', 'Aceites, body splash, tono sobre tono y más sin restricciones.'],
                      ['Atención prioritaria', 'Canal exclusivo para pedidos mayoristas con respuesta rápida.'],
                      ['Promociones exclusivas', 'Acceso anticipado a lanzamientos y descuentos por temporada.'],
                      ['Precios de distribuidor', 'Tarifas con margen real para revender.'],
                      ['Sin tope de cantidad', 'Compra las unidades que necesites por referencia.'],
                    ].map(([t, d]) => (
                      <div key={t} className="flex items-start gap-3 rounded-xl border border-stone-100 p-3.5">
                        <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" strokeWidth={2.5} />
                        <div>
                          <p className="text-sm font-medium text-stone-800">{t}</p>
                          <p className="mt-0.5 text-xs leading-5 text-stone-400">{d}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Solicitar acceso (solo si no es mayorista) */}
                {!isWholesale && (
                  <div className="rounded-2xl border border-stone-200 bg-white p-6">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-stone-400">¿Cómo obtener acceso?</p>
                    <p className="mt-3 text-sm leading-6 text-stone-500">
                      El plan se activa manualmente por el equipo de Juhnios Rold. Escríbenos indicando tu nombre, ciudad y volumen estimado de compra mensual. En menos de 24 h recibirás tu código y acceso activado.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <a href="https://wa.me/573001234567" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-85">
                        Solicitar por WhatsApp
                      </a>
                      <a href="mailto:contacto@juhniosrold.com"
                        className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-5 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50">
                        <Mail className="h-4 w-4" strokeWidth={1.6} /> Correo electrónico
                      </a>
                    </div>
                  </div>
                )}

                {/* FAQ */}
                <div className="rounded-2xl border border-stone-200 bg-white p-6">
                  <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-stone-400">Preguntas frecuentes</p>
                  <div className="space-y-3">
                    {[
                      ['¿Cuál es el monto mínimo?', 'Varía según la configuración actual de la tienda. Se muestra automáticamente en el carrito al ser mayorista.'],
                      ['¿Puedo combinar con otras promociones?', 'Algunas promociones adicionales pueden acumularse. El sistema siempre aplica el precio más conveniente.'],
                      ['¿Puedo pedir a nombre de un tercero?', 'Sí. Puedes ingresar cualquier dirección de envío. El descuento aplica sobre tu cuenta independientemente.'],
                      ['¿Con qué frecuencia puedo comprar?', 'No hay restricción de frecuencia. Compra cuando lo necesites, siempre superando el mínimo.'],
                    ].map(([q, a]) => (
                      <div key={q} className="rounded-xl bg-stone-50 p-4">
                        <p className="text-sm font-semibold text-stone-800">{q}</p>
                        <p className="mt-1.5 text-xs leading-5 text-stone-400">{a}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

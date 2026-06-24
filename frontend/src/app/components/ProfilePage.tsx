import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  Clock,
  CreditCard,
  FileText,
  Hash,
  Heart,
  Loader2,
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
import { initiatePayment, resolveMockPayment, getInvoiceByOrder, openInvoicePdf } from '../services/payments.service';
import { TrackingPedidoPage } from './TrackingPedidoPage';
import { navigateBack, navigateTo } from '../services/navigate';

type Section = 'datos' | 'pedidos' | 'guardados' | 'mayorista';

const DOCUMENT_TYPES: Record<string, string> = {
  CC: 'Cédula de Ciudadanía', CE: 'Cédula de Extranjería',
  PASSPORT: 'Pasaporte', NIT: 'NIT', OTHER: 'Otro', PENDING: 'Sin definir',
};

const inp = 'w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-300 focus:border-stone-400 focus:ring-2 focus:ring-stone-100 disabled:bg-stone-50 disabled:text-stone-400 disabled:cursor-not-allowed';

/* ── status helpers ── */
const STATUS_LABEL: Record<string, string> = {
  pendiente: 'Pendiente', pending: 'Pendiente', payment_pending: 'Pend. pago',
  paid: 'Pagado', failed: 'Rechazado',
  procesando: 'Procesando', processing: 'Procesando', confirmed: 'Confirmado', packed: 'Empacado',
  enviado: 'En camino', shipped: 'En camino', in_transit: 'En tránsito',
  entregado: 'Entregado', delivered: 'Entregado',
  cancelado: 'Cancelado', cancelled: 'Cancelado', returned: 'Devuelto', refunded: 'Reembolsado',
};
const STATUS_CLS: Record<string, string> = {
  pendiente: 'bg-amber-50 text-amber-700 border-amber-200', pending: 'bg-amber-50 text-amber-700 border-amber-200', payment_pending: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-600 border-red-200', cancelado: 'bg-red-50 text-red-600 border-red-200', cancelled: 'bg-red-50 text-red-600 border-red-200',
  procesando: 'bg-blue-50 text-blue-700 border-blue-200', processing: 'bg-blue-50 text-blue-700 border-blue-200', confirmed: 'bg-blue-50 text-blue-700 border-blue-200', packed: 'bg-blue-50 text-blue-700 border-blue-200',
  enviado: 'bg-violet-50 text-violet-700 border-violet-200', shipped: 'bg-violet-50 text-violet-700 border-violet-200', in_transit: 'bg-violet-50 text-violet-700 border-violet-200',
  entregado: 'bg-emerald-50 text-emerald-700 border-emerald-200', delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
function StatusIcon({ s }: { s: string }) {
  if (['enviado','shipped','in_transit'].includes(s)) return <Truck className="w-3 h-3" strokeWidth={2} />;
  if (['entregado','delivered','paid'].includes(s)) return <Check className="w-3 h-3" strokeWidth={2.5} />;
  if (['failed','cancelado','cancelled'].includes(s)) return <AlertCircle className="w-3 h-3" strokeWidth={2} />;
  if (['procesando','processing','confirmed','packed'].includes(s)) return <Package className="w-3 h-3" strokeWidth={2} />;
  return <Clock className="w-3 h-3" strokeWidth={2} />;
}
const canPay = (s: string) => ['pendiente','pending','payment_pending','failed'].includes(s);

/* ════════════════════════════════════════════════════════ */
export function ProfilePage({ onLoginClick: _onLogin }: { onLoginClick: () => void }) {
  const { currentUser, updateProfile, orders, loadOrders, backendOnline, savedProducts, toggleSaveProduct } = useUser();
  const { addItem } = useCart();
  const { products } = useAdmin();
  const toast = useToast();

  const initialSection = (): Section => {
    const s = new URLSearchParams(window.location.search).get('s');
    return (['datos','pedidos','guardados','mayorista'] as Section[]).includes(s as Section) ? (s as Section) : 'datos';
  };
  const [section, setSection] = useState<Section>(initialSection);

  /* ── datos ── */
  const [form, setForm] = useState({ firstName: '', lastName: '', telefono: '' });
  const [profileLoc, setProfileLoc] = useState<LocationValue>(EMPTY_LOCATION);
  const [deliveryLoc, setDeliveryLoc] = useState<DeliveryLocationValue>(EMPTY_DELIVERY_LOCATION);
  const [cities, setCities] = useState<City[]>([]);
  const cityNames = useMemo(() => cities.map(c => c.name), [cities]);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveErr, setSaveErr] = useState('');

  /* ── pedidos ── */
  const [payingId, setPayingId] = useState<string | null>(null);
  const [mockPay, setMockPay] = useState<{ orderId: string; paymentId: string } | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);

  /* redirect si no logueado */
  useEffect(() => {
    if (!currentUser) navigateTo('/');
  }, [currentUser]);

  /* inicializar form */
  useEffect(() => {
    if (!currentUser) return;
    setSaveErr(''); setSaveOk(false);
    setForm({ firstName: currentUser.firstName || '', lastName: currentUser.lastName || '', telefono: currentUser.telefono || '' });
    setDeliveryLoc({
      ...EMPTY_DELIVERY_LOCATION,
      address: currentUser.direccion || '', reference: currentUser.referencia || '',
      city: currentUser.ciudad || '', state: currentUser.departamento || '', country: currentUser.pais || '',
      lat: currentUser.latitud ?? null, lng: currentUser.longitud ?? null,
      confirmed: Boolean(currentUser.latitud && currentUser.longitud),
    });
    if (!currentUser.pais && !currentUser.departamento && !currentUser.ciudad) { setProfileLoc(EMPTY_LOCATION); return; }
    let alive = true; setLoadingLoc(true);
    geographyService.resolveLocationByNames({ country: currentUser.pais, state: currentUser.departamento, city: currentUser.ciudad })
      .then(r => { if (alive) setProfileLoc(r); })
      .catch(() => { if (alive) setProfileLoc({ ...EMPTY_LOCATION, countryName: currentUser.pais ?? '', stateName: currentUser.departamento ?? '', cityName: currentUser.ciudad ?? '' }); })
      .finally(() => { if (alive) setLoadingLoc(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!profileLoc.stateId) { setCities([]); return; }
    let c = true;
    geographyService.getCities(profileLoc.stateId).then(r => { if (c) setCities(r); }).catch(() => { if (c) setCities([]); });
    return () => { c = false; };
  }, [profileLoc.stateId]);

  useEffect(() => { if (section === 'pedidos') loadOrders(); }, [section, loadOrders]);

  if (!currentUser) return null;

  const docLabel = currentUser.tipoDocumento ? DOCUMENT_TYPES[currentUser.tipoDocumento] ?? currentUser.tipoDocumento : null;
  const isWholesale = currentUser.modoCompra === 'WHOLESALE' || Boolean(currentUser.codigoMayorista);

  /* guardar */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaveErr('');
    if (!form.firstName.trim()) { setSaveErr('Ingresa tu nombre.'); return; }
    if (!form.lastName.trim()) { setSaveErr('Ingresa tus apellidos.'); return; }
    setSaving(true);
    const r = await updateProfile({
      firstName: form.firstName, lastName: form.lastName, telefono: form.telefono,
      direccion: deliveryLoc.address || undefined, referencia: deliveryLoc.reference || undefined,
      ciudad: profileLoc.cityName || deliveryLoc.city || undefined,
      departamento: profileLoc.stateName || deliveryLoc.state || undefined,
      pais: deliveryLoc.country || profileLoc.countryName || undefined,
      latitud: deliveryLoc.lat, longitud: deliveryLoc.lng,
    });
    setSaving(false);
    if (!r.ok) { setSaveErr(r.message || 'No fue posible guardar.'); return; }
    setSaveOk(true); setTimeout(() => setSaveOk(false), 3000);
  };

  /* pago */
  const handlePay = async (orderId: string) => {
    setPayingId(orderId);
    const tab = window.open('about:blank', '_blank');
    try {
      const p = await initiatePayment(orderId);
      if (p.requires_redirect && p.checkout_url) {
        if (tab && !tab.closed) { tab.location.href = p.checkout_url; navigateTo(`/pago/resultado?pedido_id=${orderId}`); }
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
      outcome === 'approved' ? toast.success(r.invoice_number ? `Aprobado · Factura ${r.invoice_number}` : 'Pago aprobado.') : toast.warning('Pago rechazado.');
      setMockPay(null);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error.'); }
    finally { setPayingId(null); }
  };

  const handleViewInvoice = async (orderId: string) => {
    setLoadingInvoiceId(orderId);
    try {
      const invoice = await getInvoiceByOrder(orderId);
      if (!invoice) { toast.warning('No hay factura disponible para este pedido.'); return; }
      await openInvoicePdf(invoice.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo abrir la factura.');
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  /* carrito desde guardados */
  const handleAddToCart = async (product: any) => {
    try {
      const cp = await getProductById(product.id);
      const v = cp.variants.find((i: any) => i.is_active && i.presentation === product.presentacion) ?? cp.variants.find((i: any) => i.is_active);
      if (!v) { toast.warning('Sin presentación disponible.'); return; }
      const added = await addItem({ variantId: v.id, name: cp.name, category: cp.category_name, price: v.current_price ?? cp.price ?? 0, image: cp.primary_image || product.imagen || 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=600&q=80', size: v.presentation, quantity: 1 });
      if (added) toast.success(`${cp.name} añadido al carrito`);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error al cargar producto.'); }
  };

  const savedWithDetail = savedProducts.map(s => { const p = products.find(x => x.id === s.productoId); return p ? { ...p, savedDate: s.fecha } : null; }).filter(Boolean) as any[];

  const navItems: { id: Section; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'datos',     label: 'Mis datos',       icon: <UserIcon className="w-4 h-4" strokeWidth={1.5} /> },
    { id: 'pedidos',   label: 'Pedidos',          icon: <Package className="w-4 h-4" strokeWidth={1.5} />,  badge: orders.length || undefined },
    { id: 'guardados', label: 'Guardados',        icon: <Heart className="w-4 h-4" strokeWidth={1.5} />,    badge: savedProducts.length || undefined },
    { id: 'mayorista', label: 'Plan mayorista',   icon: <Store className="w-4 h-4" strokeWidth={1.5} /> },
  ];

  /* ── UI ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-stone-50">

      {/* ── top bar ── */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
        <div className="flex h-14 items-center justify-between px-6">
          <button
            onClick={() => navigateBack('/')}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Volver</span>
          </button>
          <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-400">Mi cuenta</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-white text-xs font-bold">
            {currentUser.firstName?.[0]?.toUpperCase() ?? currentUser.nombre?.[0]?.toUpperCase() ?? '?'}
          </div>
        </div>
      </header>

      {/* ── layout principal: sidebar fijo izquierda + contenido ── */}
      <div className="flex min-h-[calc(100vh-56px)]">

        {/* ══ SIDEBAR ══ — ancho fijo, pegado izquierda, fondo blanco, borde derecho */}
        <aside className="hidden lg:flex lg:w-56 lg:flex-shrink-0 lg:flex-col border-r border-stone-200 bg-white px-4 pt-6 pb-8">

          {/* Identity */}
          <div className="mb-6 px-1">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-stone-900 text-white text-sm font-bold">
              {currentUser.firstName?.[0]?.toUpperCase() ?? currentUser.nombre?.[0]?.toUpperCase() ?? '?'}
            </div>
            <p className="text-sm font-semibold text-stone-900 leading-tight truncate">{currentUser.nombre}</p>
            <p className="text-xs text-stone-400 truncate mt-0.5">{currentUser.email}</p>
            {isWholesale && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-stone-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
                <Store className="w-2.5 h-2.5" /> Mayorista
              </span>
            )}
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-0.5">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all w-full ${
                  section === item.id
                    ? 'bg-stone-900 text-white'
                    : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                }`}
              >
                {item.icon}
                <span className="flex-1 whitespace-nowrap">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${section === item.id ? 'bg-white/25 text-white' : 'bg-stone-100 text-stone-500'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Badges */}
          <div className="mt-auto pt-6 space-y-1.5 px-1">
            <p className="flex items-center gap-1.5 text-[10px] text-stone-400">
              <BadgeCheck className="w-3 h-3 text-emerald-500" strokeWidth={2.5} /> Cuenta verificada
            </p>
            {docLabel && currentUser.numeroDocumento && (
              <p className="flex items-center gap-1.5 text-[10px] text-stone-400">
                <Hash className="w-3 h-3" /> {docLabel.split(' ')[0]} · {currentUser.numeroDocumento}
              </p>
            )}
          </div>
        </aside>

        {/* nav mobile: barra horizontal arriba del contenido */}
        <div className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-stone-200 bg-white lg:hidden">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setSection(item.id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[9px] font-semibold transition ${section === item.id ? 'text-stone-900' : 'text-stone-400'}`}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {/* ══ MAIN ══ — ocupa todo el ancho restante */}
        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className="px-6 py-6 pb-20 lg:pb-6">
          <AnimatePresence mode="wait">

            {/* ─── MIS DATOS ─── */}
            {section === 'datos' && (
              <motion.div key="datos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>

                <h1 className="mb-1 text-lg font-semibold text-stone-900">Mis datos</h1>
                <p className="mb-5 text-sm text-stone-400">Nombre, contacto y dirección de entrega</p>

                <AnimatePresence>
                  {saveOk && (
                    <motion.p key="ok" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
                      <Check className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} /> Cambios guardados correctamente
                    </motion.p>
                  )}
                  {saveErr && (
                    <motion.p key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} /> {saveErr}
                    </motion.p>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSave} className="space-y-3">

                  {/* Nombre y apellido */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Nombre *</span>
                      <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className={inp} placeholder="María Fernanda" required />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Apellidos *</span>
                      <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className={inp} placeholder="García López" required />
                    </label>
                  </div>

                  {/* Contacto */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                        <Mail className="w-3 h-3" /> Email
                      </span>
                      <input type="email" value={currentUser.email} disabled className={inp} />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                        <Phone className="w-3 h-3" /> Teléfono
                      </span>
                      <input type="tel" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className={inp} placeholder="3001234567" />
                    </label>
                  </div>

                  {/* Documento — solo si existe, compacto */}
                  {docLabel && currentUser.numeroDocumento && (
                    <div className="flex items-center gap-2 rounded-xl border border-stone-100 bg-stone-50 px-3.5 py-2.5 text-sm text-stone-500">
                      <Hash className="w-3.5 h-3.5 flex-shrink-0 text-stone-400" />
                      <span>{docLabel} · <span className="font-mono font-semibold text-stone-700">{currentUser.numeroDocumento}</span></span>
                    </div>
                  )}

                  {/* Separador */}
                  <div className="flex items-center gap-3 py-1">
                    <div className="h-px flex-1 bg-stone-100" />
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-stone-300">
                      <MapPin className="w-3 h-3" /> Dirección de envío
                    </span>
                    <div className="h-px flex-1 bg-stone-100" />
                  </div>

                  {/* Dirección */}
                  <div className="rounded-2xl border border-stone-200 bg-white p-4">
                    {loadingLoc && (
                      <p className="mb-3 flex items-center gap-1.5 text-[11px] text-stone-400">
                        <Loader2 className="w-3 h-3 animate-spin" /> Cargando ubicación guardada…
                      </p>
                    )}
                    <div className="space-y-3">
                      <LocationPicker value={profileLoc} onChange={setProfileLoc} />
                      <DeliveryLocationSection
                        value={deliveryLoc} onChange={setDeliveryLoc}
                        searchScope={{ state: profileLoc.stateName, country: profileLoc.countryName }}
                        cityOptions={cityNames}
                        onCityResolved={cn => setProfileLoc(p => ({ ...p, cityId: null, cityName: cn }))}
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-85 disabled:opacity-40 sm:w-auto">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" strokeWidth={2} />}
                    {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ─── PEDIDOS ─── */}
            {section === 'pedidos' && (
              <motion.div key="pedidos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>

                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-semibold text-stone-900">Mis pedidos</h1>
                    <p className="text-xs text-stone-400">{orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'} en total</p>
                  </div>
                  <button onClick={loadOrders} className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-500 transition hover:border-stone-300 hover:text-stone-800">
                    <RefreshCw className="w-3 h-3" /> Actualizar
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Package className="mb-3 h-8 w-8 text-stone-200" strokeWidth={1} />
                    <p className="text-sm font-medium text-stone-500">Sin pedidos aún</p>
                    <p className="mt-1 text-xs text-stone-400">Tu historial aparecerá aquí</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.map(order => {
                      const subtotal = order.productos.reduce((s: number, p: { precio: number; cantidad: number }) => s + p.precio * p.cantidad, 0);
                      const costoEnvio = order.total - subtotal;
                      const showEnvioCost = costoEnvio > 0;
                      const isTracking = trackingId === order.id;
                      const isPaid = !canPay(order.estado);

                      return (
                        <div key={order.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">

                          {/* ══ CABECERA ══ */}
                          <div className="flex items-center justify-between px-5 pt-4 pb-3">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="font-mono text-sm font-bold text-stone-900">
                                  #{order.order_number ?? order.id.slice(0, 8).toUpperCase()}
                                </p>
                                <p className="text-[11px] text-stone-400 mt-0.5">
                                  {new Date(order.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                              </div>
                            </div>
                            <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_CLS[order.estado] ?? 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                              <StatusIcon s={order.estado} />
                              {STATUS_LABEL[order.estado] ?? order.estado}
                            </span>
                          </div>

                          {/* ══ CUERPO: dos columnas en md+ ══ */}
                          <div className="grid grid-cols-1 gap-0 md:grid-cols-[1fr_240px] border-t border-stone-100">

                            {/* ── Col izquierda: productos + resumen ── */}
                            <div className="px-5 py-3">
                              {/* Productos */}
                              <div className="space-y-2">
                                {order.productos.map((p: { nombre: string; cantidad: number; precio: number }, i: number) => (
                                  <div key={i} className="flex items-start gap-3">
                                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-stone-100">
                                      <Package className="h-3.5 w-3.5 text-stone-400" strokeWidth={1.5} />
                                    </div>
                                    <div className="flex flex-1 items-start justify-between gap-2 min-w-0">
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-stone-800 leading-tight truncate">{p.nombre}</p>
                                        <p className="text-[11px] text-stone-400 mt-0.5">Cantidad: {p.cantidad}</p>
                                      </div>
                                      <span className="text-sm font-semibold text-stone-900 flex-shrink-0">
                                        ${(p.precio * p.cantidad).toLocaleString('es-CO')}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Resumen de totales */}
                              <div className="mt-3 border-t border-stone-100 pt-3 space-y-1">
                                <div className="flex justify-between text-xs text-stone-400">
                                  <span>Subtotal</span>
                                  <span>${subtotal.toLocaleString('es-CO')}</span>
                                </div>
                                {showEnvioCost && (
                                  <div className="flex justify-between text-xs text-stone-400">
                                    <span>Costo de envío</span>
                                    <span>${costoEnvio.toLocaleString('es-CO')}</span>
                                  </div>
                                )}
                                <div className="flex justify-between border-t border-stone-100 pt-1.5 text-base font-bold text-stone-900">
                                  <span>Total</span>
                                  <span className="text-emerald-700">${order.total.toLocaleString('es-CO')}</span>
                                </div>
                              </div>
                            </div>

                            {/* ── Col derecha: dirección + envío ── */}
                            <div className="border-t border-stone-100 md:border-t-0 md:border-l px-5 py-4 space-y-4 bg-stone-50/40">

                              {/* Dirección de entrega */}
                              {order.direccionEnvio && (
                                <div>
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-stone-400" strokeWidth={1.5} />
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Dirección de entrega</p>
                                  </div>
                                  <p className="text-xs text-stone-600 leading-relaxed">{order.direccionEnvio}</p>
                                </div>
                              )}

                              {/* Info de envío */}
                              {isPaid && (
                                <div>
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <Truck className="w-3.5 h-3.5 text-stone-400" strokeWidth={1.5} />
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Información del envío</p>
                                  </div>
                                  <p className="text-xs text-stone-600">Transportadora: <span className="text-stone-400">Por asignar</span></p>
                                  <p className="text-xs text-stone-500 mt-0.5">Tiempo estimado: 2 a 5 días hábiles</p>
                                  <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 py-2 text-[11px] text-emerald-700 leading-relaxed">
                                    <Check className="w-3 h-3 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
                                    Te notificaremos cuando tu pedido esté en camino.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* ══ ACCIONES ══ */}
                          <div className="border-t border-stone-100 px-5 py-3 flex flex-wrap items-center gap-2">
                            {/* Pago pendiente */}
                            {backendOnline && canPay(order.estado) && (
                              mockPay?.orderId === order.id ? (
                                <>
                                  <button onClick={() => handleMock('approved')} disabled={payingId === order.id}
                                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                                    Aprobar pago
                                  </button>
                                  <button onClick={() => handleMock('declined')} disabled={payingId === order.id}
                                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-40">
                                    Rechazar
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => handlePay(order.id)} disabled={payingId === order.id}
                                  className="flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                                  <CreditCard className="w-3.5 h-3.5" strokeWidth={1.5} />
                                  {payingId === order.id ? 'Iniciando…' : 'Completar pago'}
                                </button>
                              )
                            )}

                            {/* Seguimiento */}
                            {backendOnline && isPaid && (
                              <button
                                onClick={() => setTrackingId(isTracking ? null : order.id)}
                                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                  isTracking
                                    ? 'border-stone-300 bg-stone-100 text-stone-700'
                                    : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                                }`}
                              >
                                <Truck className="w-3.5 h-3.5" strokeWidth={1.5} />
                                {isTracking ? 'Ocultar seguimiento' : 'Ver seguimiento'}
                              </button>
                            )}

                            {/* Factura */}
                            {backendOnline && isPaid && (
                              <button
                                onClick={() => handleViewInvoice(order.id)}
                                disabled={loadingInvoiceId === order.id}
                                className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:border-stone-300 disabled:opacity-40"
                              >
                                {loadingInvoiceId === order.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <FileText className="w-3.5 h-3.5" strokeWidth={1.5} />}
                                Ver factura
                              </button>
                            )}
                          </div>

                          {/* ══ TRACKING EXPANDIDO ══ */}
                          {isTracking && (
                            <div className="border-t-2 border-stone-100 bg-stone-50/60 px-5 py-5">
                              <TrackingPedidoPage
                                pedidoId={order.id}
                                direccionEnvio={order.direccionEnvio}
                                onClose={() => setTrackingId(null)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── GUARDADOS ─── */}
            {section === 'guardados' && (
              <motion.div key="guardados" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
                <h1 className="mb-1 text-lg font-semibold text-stone-900">Guardados</h1>
                <p className="mb-5 text-sm text-stone-400">{savedWithDetail.length} {savedWithDetail.length === 1 ? 'producto' : 'productos'}</p>

                {savedWithDetail.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Heart className="mb-3 h-8 w-8 text-stone-200" strokeWidth={1} />
                    <p className="text-sm font-medium text-stone-500">Sin productos guardados</p>
                    <p className="mt-1 text-xs text-stone-400">Toca el ♡ en cualquier producto para guardarlo aquí</p>
                  </div>
                ) : (
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                    {savedWithDetail.map((p: any) => (
                      <div key={p.id} className="group overflow-hidden rounded-2xl border border-stone-200 bg-white">
                        <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                          <img src={p.imagen || 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=600&q=80'} alt={p.nombre} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          <button onClick={() => toggleSaveProduct(p.id)} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow-sm transition hover:opacity-70">
                            <Trash2 className="h-3.5 w-3.5 text-stone-600" strokeWidth={1.5} />
                          </button>
                        </div>
                        <div className="p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{p.tipo}</p>
                          <p className="mt-0.5 text-sm font-medium text-stone-900 leading-tight">{p.nombre}</p>
                          <p className="text-xs text-stone-400">{p.presentacion}</p>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-stone-900">${p.precio.toLocaleString('es-CO')}</span>
                            <button onClick={() => handleAddToCart(p)} className="flex items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:opacity-80">
                              <ShoppingCart className="h-3 w-3" strokeWidth={2} /> Agregar
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
              <motion.div key="mayorista" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }} className="space-y-3">

                <h1 className="mb-1 text-lg font-semibold text-stone-900">Plan mayorista</h1>
                <p className="mb-5 text-sm text-stone-400">Condiciones y beneficios para compras por volumen</p>

                {/* Estado */}
                <div className={`rounded-2xl p-5 ${isWholesale ? 'bg-stone-900' : 'border border-stone-200 bg-white'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest ${isWholesale ? 'bg-white/15 text-white' : 'bg-stone-100 text-stone-500'}`}>
                        <Store className="w-3 h-3" /> {isWholesale ? 'Activo' : 'Sin plan'}
                      </span>
                      <p className={`mt-2.5 text-base font-semibold leading-snug ${isWholesale ? 'text-white' : 'text-stone-900'}`}>
                        {isWholesale ? 'Tu plan mayorista está activo' : 'Compra en volumen con precios especiales'}
                      </p>
                      <p className={`mt-1 text-sm leading-6 ${isWholesale ? 'text-white/65' : 'text-stone-400'}`}>
                        {isWholesale
                          ? 'El descuento se aplica automáticamente al superar el monto mínimo. Sin cupones.'
                          : 'Diseñado para distribuidoras, salones y emprendedoras que compran en volumen.'}
                      </p>
                    </div>
                    {isWholesale && currentUser.codigoMayorista && (
                      <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/50">Código</p>
                        <p className="mt-1 font-mono text-base font-bold tracking-wider text-white">{currentUser.codigoMayorista}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cómo funciona */}
                <div className="rounded-2xl border border-stone-200 bg-white p-5">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Cómo funciona</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      { n: '1', t: 'Arma tu carrito', d: 'Agrega los productos que necesitas.' },
                      { n: '2', t: 'Supera el mínimo', d: 'El descuento se activa solo al superar el monto.' },
                      { n: '3', t: 'Precio aplicado', d: 'Ves el precio mayorista antes de pagar.' },
                    ].map(({ n, t, d }) => (
                      <div key={n} className="rounded-xl bg-stone-50 p-4">
                        <span className="text-3xl font-bold leading-none text-stone-100">{n}</span>
                        <p className="mt-1.5 text-sm font-semibold text-stone-800">{t}</p>
                        <p className="mt-0.5 text-xs leading-5 text-stone-400">{d}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Beneficios */}
                <div className="rounded-2xl border border-stone-200 bg-white p-5">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Beneficios</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ['Descuento automático por volumen', 'Se activa solo, sin cupones.'],
                      ['Acceso a toda la colección', 'Sin restricciones por referencia.'],
                      ['Atención prioritaria', 'Canal exclusivo para mayoristas.'],
                      ['Promociones exclusivas', 'Acceso anticipado a lanzamientos.'],
                      ['Precios de distribuidor', 'Margen real para revender.'],
                      ['Sin tope de cantidad', 'Compra lo que necesites.'],
                    ].map(([t, d]) => (
                      <div key={t} className="flex items-start gap-2.5 rounded-xl border border-stone-100 p-3">
                        <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" strokeWidth={2.5} />
                        <div>
                          <p className="text-sm font-medium text-stone-800">{t}</p>
                          <p className="text-xs text-stone-400">{d}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Solicitar (solo si no es mayorista) */}
                {!isWholesale && (
                  <div className="rounded-2xl border border-stone-200 bg-white p-5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-400">¿Cómo obtener acceso?</p>
                    <p className="mb-4 text-sm leading-6 text-stone-500">
                      El plan se activa por el equipo de Juhnios Rold. Escríbenos indicando tu nombre, ciudad y volumen mensual estimado. En menos de 24 h tienes tu acceso.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <a href="https://wa.me/573001234567" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-85">
                        Solicitar por WhatsApp
                      </a>
                      <a href="mailto:contacto@juhniosrold.com"
                        className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50">
                        <Mail className="h-4 w-4" strokeWidth={1.6} /> Correo
                      </a>
                    </div>
                  </div>
                )}

                {/* FAQ */}
                <div className="rounded-2xl border border-stone-200 bg-white p-5">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-stone-400">Preguntas frecuentes</p>
                  <div className="space-y-2.5">
                    {[
                      ['¿Cuál es el monto mínimo?', 'Se muestra automáticamente en el carrito al ser mayorista.'],
                      ['¿Se combina con otras promociones?', 'El sistema aplica siempre el precio más conveniente.'],
                      ['¿Puedo pedir a nombre de un tercero?', 'Sí. El descuento aplica sobre tu cuenta sin importar la dirección.'],
                      ['¿Con qué frecuencia puedo comprar?', 'Sin restricción de frecuencia, solo superando el mínimo.'],
                    ].map(([q, a]) => (
                      <div key={q as string} className="rounded-xl bg-stone-50 px-4 py-3.5">
                        <p className="text-sm font-semibold text-stone-800">{q}</p>
                        <p className="mt-1 text-xs leading-5 text-stone-400">{a}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

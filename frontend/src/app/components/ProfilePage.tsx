import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Gift,
  Hash,
  Heart,
  Headphones,
  KeyRound,
  Loader2,
  Lock,
  MapPin,
  Package,
  Percent,
  Phone,
  RefreshCw,
  Save,
  Search,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Store,
  Trash2,
  Truck,
  User as UserIcon,
  Zap,
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
import { getProductById, type Product as CatalogProduct } from '../services/products.service';
import { ProductPage as ProductQuickView } from './ProductCatalog';
import { initiatePayment, resolveMockPayment, getInvoiceByOrder, openInvoicePdf } from '../services/payments.service';
import { TrackingPedidoPage } from './TrackingPedidoPage';
import { navigateBack, navigateTo } from '../services/navigate';
import { GoogleOnboardingModal } from './GoogleOnboardingModal';
import { getTrackingPedido, type Envio } from '../services/enviosApi';
import { InteractiveLocationMap } from './ui/InteractiveLocationMap';

type Section = 'datos' | 'pedidos' | 'guardados' | 'mayorista';

const DOCUMENT_TYPES: Record<string, string> = {
  CC: 'Cédula de Ciudadanía', CE: 'Cédula de Extranjería',
  PASSPORT: 'Pasaporte', NIT: 'NIT', OTHER: 'Otro', PENDING: 'Sin definir',
};

const inp = 'w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-900 outline-none transition placeholder:text-stone-300 focus:border-stone-400 focus:ring-2 focus:ring-stone-100 disabled:bg-stone-50 disabled:text-stone-400 disabled:cursor-not-allowed';

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

const OLIVE = '#2D3A1F';


const selectCls = 'w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-xs text-stone-800 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10 transition appearance-none';
const selectArrow = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23A8A29E' stroke-width='1.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center' };

/* ── Sección Mayorista ── */
function MayoristaSection({
  isWholesale, codigoMayorista, onApply,
}: {
  isWholesale: boolean;
  codigoMayorista?: string;
  onApply: (data: {
    company_id_type: string; company_id_type_other?: string; company_id_number: string;
    company_name: string; business_type: string; is_international_distributor: boolean; company_phone?: string;
  }) => Promise<{ ok: boolean; message?: string }>;
}) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  /* ── estado formulario solicitud ── */
  const [tipoIdEmpresa, setTipoIdEmpresa] = useState<'NIT' | 'CC' | 'OTRO'>('NIT');
  const [otroTipoId,    setOtroTipoId]    = useState('');
  const [numIdEmpresa,  setNumIdEmpresa]  = useState('');
  const [razonSocial,   setRazonSocial]   = useState('');
  const [tipoNegocio,   setTipoNegocio]   = useState('TIENDA');
  const [esDistribIntl, setEsDistribIntl] = useState(false);
  const [telEmpresa,    setTelEmpresa]    = useState('');
  const [applying,      setApplying]      = useState(false);
  const [applyErr,      setApplyErr]      = useState('');
  const [applyOk,       setApplyOk]       = useState(false);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyErr('');
    if (tipoIdEmpresa === 'OTRO' && !otroTipoId.trim()) { setApplyErr('Especifica el tipo de identificación de la empresa.'); return; }
    if (!numIdEmpresa.trim()) { setApplyErr('Ingresa el número de identificación de la empresa.'); return; }
    if (!razonSocial.trim())  { setApplyErr('Ingresa la razón social o nombre de la empresa.'); return; }
    setApplying(true);
    const r = await onApply({
      company_id_type: tipoIdEmpresa,
      company_id_type_other: tipoIdEmpresa === 'OTRO' ? otroTipoId : undefined,
      company_id_number: numIdEmpresa,
      company_name: razonSocial,
      business_type: tipoNegocio,
      is_international_distributor: esDistribIntl,
      company_phone: telEmpresa || undefined,
    });
    setApplying(false);
    if (!r.ok) { setApplyErr(r.message || 'No fue posible enviar la solicitud.'); return; }
    setApplyOk(true);
  };

  const beneficios = [
    { icon: Percent,     title: 'Descuento automático',      desc: 'Descuentos aplicados al instante según el volumen de compra.' },
    { icon: ShoppingBag, title: 'Precios de distribuidor',   desc: 'Accede a precios especiales diseñados para revendedores y distribuidores.' },
    { icon: Sparkles,    title: 'Acceso a toda la colección',desc: 'Sin restricciones por referencia. Elige lo que necesites.' },
    { icon: Gift,        title: 'Promociones exclusivas',    desc: 'Acceso anticipado a lanzamientos y promociones solo para mayoristas.' },
    { icon: Headphones,  title: 'Atención prioritaria',      desc: 'Canal exclusivo y tiempos de respuesta preferenciales para mayoristas.' },
    { icon: Zap,         title: 'Sin tope de cantidad',      desc: 'Compra la cantidad que necesites, sin límites.' },
  ];

  const pasos = [
    { n: '01', icon: ShoppingCart,  title: 'Elige tus productos',       desc: 'Agrega al carrito los productos que necesitas para tu negocio.' },
    { n: '02', icon: Lock,          title: 'Supera el monto mínimo',     desc: 'Tu compra debe alcanzar el monto mínimo mayorista establecido.' },
    { n: '03', icon: Package,       title: 'Registra tu empresa',        desc: 'Completa el formulario con los datos de tu empresa en esta misma sección.' },
    { n: '04', icon: Headphones,    title: 'Accede al plan al instante', desc: 'El descuento mayorista se activa de inmediato al completar el registro.' },
  ];

  const faqs = [
    ['¿Cuál es el monto mínimo?',          'Se muestra automáticamente en el carrito al tener plan mayorista.'],
    ['¿Se combina con otras promociones?',  'El sistema aplica siempre el precio más conveniente para ti.'],
    ['¿Puede comprar a nombre de un tercero?', 'Sí. El descuento aplica sobre tu cuenta sin importar la dirección.'],
    ['¿Con qué frecuencia puedo comprar?',  'Sin restricción de frecuencia, solo superando el monto mínimo.'],
  ];

  return (
    <motion.div key="mayorista" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-stone-900 tracking-tight">Plan Mayorista Juhnios Rold</h1>
        <p className="mt-0.5 text-xs text-stone-400">Compra por volumen, accede a precios especiales y recibe atención prioritaria.</p>
      </div>

      {/* Layout 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] gap-4 items-start">

        {/* ── COL IZQUIERDA ── */}
        <div className="flex flex-col gap-3">

          {/* Tarjeta principal — estado */}
          {isWholesale ? (
            <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
              <div className="px-5 pt-5 pb-4" style={{ background: 'linear-gradient(135deg, #f0f4ed 0%, #ffffff 60%)' }}>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest border" style={{ color: OLIVE, borderColor: `${OLIVE}30`, backgroundColor: `${OLIVE}10` }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: OLIVE }} /> Plan activo
                </span>
                <p className="mt-3 text-base font-semibold text-stone-900">Descuento mayorista habilitado</p>
                <p className="mt-1 text-xs leading-5 text-stone-400">
                  Se aplica automáticamente al superar el monto mínimo. Sin cupones ni pasos adicionales.
                </p>
                {codigoMayorista && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Código</span>
                    <span className="font-mono text-sm font-bold tracking-wider text-stone-900">{codigoMayorista}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-stone-100" style={{ background: 'linear-gradient(135deg, #fafaf9 0%, #ffffff 60%)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">Plan inactivo</span>
                </div>
                <h2 className="text-sm font-semibold text-stone-900">Activar plan mayorista</h2>
                <p className="text-xs text-stone-400 mt-0.5 leading-5">
                  Ingresa los datos de tu empresa para activar el plan al instante.
                </p>
              </div>

              {applyOk ? (
                <div className="px-5 py-6 flex flex-col items-center text-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${OLIVE}15` }}>
                    <Check className="w-5 h-5" style={{ color: OLIVE }} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-900">¡Plan mayorista activado!</p>
                    <p className="text-xs text-stone-400 mt-1 leading-5">
                      Ya tienes acceso a precios especiales y descuentos por volumen. Recarga la página para ver tu nuevo plan.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleApply} className="px-5 py-4 space-y-3">
                  <AnimatePresence>
                    {applyErr && (
                      <motion.p key="err" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2 text-xs text-rose-700 leading-relaxed">
                        {applyErr}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* Tipo ID empresa */}
                  <div className="flex gap-2.5">
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Tipo de identificación *</label>
                      <select value={tipoIdEmpresa} onChange={e => setTipoIdEmpresa(e.target.value as 'NIT' | 'CC' | 'OTRO')}
                        className={selectCls} style={selectArrow}>
                        <option value="NIT">NIT</option>
                        <option value="CC">Cédula</option>
                        <option value="OTRO">Otro</option>
                      </select>
                    </div>
                    {tipoIdEmpresa === 'OTRO' && (
                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Especifica el tipo *</label>
                        <input value={otroTipoId} onChange={e => setOtroTipoId(e.target.value)} placeholder="Ej: RUT, RFC…"
                          className={selectCls} required />
                      </div>
                    )}
                  </div>

                  {/* Número ID + Razón social */}
                  <div className="flex gap-2.5">
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">N° de identificación *</label>
                      <input value={numIdEmpresa} onChange={e => setNumIdEmpresa(e.target.value)} placeholder="900123456-7"
                        className={selectCls} required />
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Razón social *</label>
                      <input value={razonSocial} onChange={e => setRazonSocial(e.target.value)} placeholder="Mi Empresa S.A.S."
                        className={selectCls} required />
                    </div>
                  </div>

                  {/* Tipo de negocio */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Tipo de negocio *</label>
                    <select value={tipoNegocio} onChange={e => { setTipoNegocio(e.target.value); if (e.target.value !== 'DISTRIBUIDOR') setEsDistribIntl(false); }}
                      className={selectCls} style={selectArrow}>
                      <option value="TIENDA">Tienda</option>
                      <option value="DISTRIBUIDOR">Distribuidor</option>
                      <option value="RESTAURANTE">Restaurante</option>
                      <option value="FARMACIA">Farmacia / Droguería</option>
                      <option value="SPA">Spa / Estética</option>
                      <option value="OTRO">Otro</option>
                    </select>
                    {tipoNegocio === 'DISTRIBUIDOR' && (
                      <label className="flex items-center gap-2 mt-1 cursor-pointer select-none">
                        <div className="relative flex-shrink-0" onClick={() => setEsDistribIntl(v => !v)}>
                          <div className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all"
                            style={{ borderColor: esDistribIntl ? OLIVE : '#D6D0C8', backgroundColor: esDistribIntl ? OLIVE : 'transparent' }}>
                            {esDistribIntl && <svg width="8" height="6" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                        </div>
                        <span className="text-xs text-stone-500">¿Es distribuidor internacional?</span>
                      </label>
                    )}
                  </div>

                  {/* Teléfono empresa */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Teléfono empresa</label>
                    <input type="tel" value={telEmpresa} onChange={e => setTelEmpresa(e.target.value)} placeholder="6011234567"
                      className={selectCls} />
                  </div>

                  <button type="submit" disabled={applying}
                    className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: OLIVE }}>
                    {applying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Store className="w-3.5 h-3.5" strokeWidth={2} />}
                    {applying ? 'Activando…' : 'Activar plan mayorista'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Compra mínima */}
          <div className="rounded-2xl border border-stone-200 bg-white px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${OLIVE}12` }}>
                <Lock className="w-3.5 h-3.5" style={{ color: OLIVE }} strokeWidth={1.8} />
              </div>
              <span className="text-xs font-semibold text-stone-700">Compra mínima mayorista</span>
            </div>
            <span className="text-sm font-bold text-stone-900 font-mono">$XXX.XXX COP</span>
          </div>

          {/* Cómo funciona */}
          <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Cómo funciona</p>
            </div>
            <div className="grid grid-cols-2 gap-px bg-stone-100">
              {pasos.map(({ n, icon: Icon, title, desc }) => (
                <div key={n} className="bg-white px-4 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-mono font-bold" style={{ color: OLIVE }}>{n}</span>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${OLIVE}10` }}>
                      <Icon className="w-3 h-3" style={{ color: OLIVE }} strokeWidth={1.8} />
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold text-stone-800 leading-tight mb-0.5">{title}</p>
                  <p className="text-[10px] text-stone-400 leading-4">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── COL DERECHA ── */}
        <div className="flex flex-col gap-3">

          {/* Beneficios */}
          <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Beneficios del plan</p>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: OLIVE }} />
                <div className="w-1 h-1 rounded-full bg-stone-200" />
                <div className="w-1 h-1 rounded-full bg-stone-200" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-px bg-stone-100">
              {beneficios.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-white px-3.5 py-4 flex flex-col gap-2">
                  <div className="relative w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${OLIVE}10` }}>
                    <Icon className="w-4 h-4" style={{ color: OLIVE }} strokeWidth={1.6} />
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#C9A84C' }}>
                      <Check className="w-2 h-2 text-white" strokeWidth={3} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-stone-800 leading-tight">{title}</p>
                    <p className="text-[10px] text-stone-400 mt-0.5 leading-4">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ acordeón */}
          <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Preguntas frecuentes</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-stone-100">
              {faqs.map(([q, a], i) => (
                <div key={i} className="bg-white">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-stone-50 transition-colors"
                  >
                    <div className="w-5 h-5 rounded-full border border-stone-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-[9px] font-bold text-stone-400">?</span>
                    </div>
                    <p className="flex-1 text-xs font-semibold text-stone-800 leading-snug">{q}</p>
                    <ChevronDown
                      className="w-3.5 h-3.5 text-stone-400 flex-shrink-0 mt-0.5 transition-transform duration-200"
                      style={{ transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)' }}
                      strokeWidth={2}
                    />
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="px-4 pb-3.5 text-[11px] text-stone-400 leading-5 ml-8">{a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════ */
export function ProfilePage({ onLoginClick: _onLogin }: { onLoginClick: () => void }) {
  const { currentUser, updateProfile, changePassword, orders, loadOrders, backendOnline, savedProducts, toggleSaveProduct } = useUser();
  const { addItem } = useCart();
  const { products } = useAdmin();
  const toast = useToast();

  const initialSection = (): Section => {
    const s = new URLSearchParams(window.location.search).get('s');
    return (['datos','pedidos','guardados','mayorista'] as Section[]).includes(s as Section) ? (s as Section) : 'datos';
  };
  const [section, setSection] = useState<Section>(initialSection);
  const [showOnboarding, setShowOnboarding] = useState(false);

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

  /* ── contraseña ── */
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdErr, setPwdErr] = useState('');
  const [showPwdFields, setShowPwdFields] = useState(false);

  /* ── pedidos ── */
  const [payingId, setPayingId] = useState<string | null>(null);
  const [mockPay, setMockPay] = useState<{ orderId: string; paymentId: string } | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);
  const [ordersPage, setOrdersPage] = useState(1);
  const ORDERS_PER_PAGE = 5;
  const [shippingData, setShippingData] = useState<Record<string, Envio | null>>({});

  const [loadingShipping, setLoadingShipping] = useState<Record<string, boolean>>({});

  /* ── filtros de pedidos ── */
  const [orderNumFilter, setOrderNumFilter] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [orderDateFrom, setOrderDateFrom] = useState('');
  const [orderDateTo, setOrderDateTo] = useState('');

  /* ── guardados ── */
  const [savedPage, setSavedPage] = useState(1);
  const SAVED_PER_PAGE = 9;

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

  useEffect(() => {
    if (section === 'pedidos') { loadOrders(); setOrdersPage(1); }
    if (section === 'guardados') { setSavedPage(1); }
  }, [section, loadOrders]);

  useEffect(() => { setOrdersPage(1); }, [orderNumFilter, orderStatusFilter, orderDateFrom, orderDateTo]);

  /* cargar datos de envío para pedidos que ya están pagados */
  useEffect(() => {
    if (!backendOnline || section !== 'pedidos') return;
    orders.forEach(order => {
      if (canPay(order.estado)) return;
      if (shippingData[order.id] !== undefined || loadingShipping[order.id]) return;
      setLoadingShipping(prev => ({ ...prev, [order.id]: true }));
      getTrackingPedido(order.id)
        .then(data => setShippingData(prev => ({ ...prev, [order.id]: data.envio })))
        .catch(() => setShippingData(prev => ({ ...prev, [order.id]: null })))
        .finally(() => setLoadingShipping(prev => ({ ...prev, [order.id]: false })));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, section, backendOnline]);

  const filteredOrders = useMemo(() => {
    const numQ = orderNumFilter.toLowerCase().trim();
    const fromDate = orderDateFrom ? new Date(orderDateFrom) : null;
    const toDate = orderDateTo ? new Date(`${orderDateTo}T23:59:59`) : null;
    return orders.filter(o => {
      const orderText = `${o.order_number ?? ''} ${o.id}`.toLowerCase();
      const orderDate = new Date(o.fecha);
      return (!numQ || orderText.includes(numQ)) &&
        (!orderStatusFilter || o.estado === orderStatusFilter) &&
        (!fromDate || orderDate >= fromDate) &&
        (!toDate || orderDate <= toDate);
    });
  }, [orders, orderNumFilter, orderStatusFilter, orderDateFrom, orderDateTo]);

  const clearOrderFilters = () => {
    setOrderNumFilter('');
    setOrderStatusFilter('');
    setOrderDateFrom('');
    setOrderDateTo('');
  };

  const hasOrderFilters = orderNumFilter || orderStatusFilter || orderDateFrom || orderDateTo;

  if (!currentUser) return null;

  const missingData = !currentUser.numeroDocumento || currentUser.tipoDocumento === 'PENDING' || !currentUser.latitud;
  const missingDoc = !currentUser.numeroDocumento || currentUser.tipoDocumento === 'PENDING';
  const missingLocation = !currentUser.latitud;

  /* solicitud mayorista */
  const handleApplyWholesale = async (data: {
    company_id_type: string; company_id_type_other?: string; company_id_number: string;
    company_name: string; business_type: string; is_international_distributor: boolean; company_phone?: string;
  }) => {
    return updateProfile({
      modoCompra: 'WHOLESALE',
      companyIdType: data.company_id_type,
      companyIdTypeOther: data.company_id_type_other,
      companyIdNumber: data.company_id_number,
      companyName: data.company_name,
      businessType: data.business_type,
      isInternationalDistributor: data.is_international_distributor,
      companyPhone: data.company_phone,
    });
  };

  const docLabel = currentUser.tipoDocumento ? DOCUMENT_TYPES[currentUser.tipoDocumento] ?? currentUser.tipoDocumento : null;
  const isWholesale = currentUser.modoCompra === 'WHOLESALE';

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

  /* contraseña */
  const hasPassword = currentUser?.hasUsablePassword ?? true;
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setPwdErr('');
    if (hasPassword && !currentPassword) { setPwdErr('Ingresa tu contraseña actual.'); return; }
    if (newPassword.length < 8) { setPwdErr('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
    if (newPassword !== confirmPassword) { setPwdErr('Las contraseñas no coinciden.'); return; }
    setSavingPwd(true);
    const r = await changePassword(newPassword, hasPassword ? currentPassword : undefined);
    setSavingPwd(false);
    if (!r.ok) { setPwdErr(r.message || 'No fue posible guardar la contraseña.'); return; }
    toast.success(hasPassword ? 'Contraseña actualizada.' : 'Contraseña configurada.');
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
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
      if (invoice.dianStatus !== 'VALIDATED') {
        toast.info('Esta factura aún está pendiente de validación ante la DIAN. El documento puede tardar en confirmarse.');
      }
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

  /* vista rápida desde guardados */
  const [quickViewProduct, setQuickViewProduct] = useState<CatalogProduct | null>(null);
  const [quickViewSizes, setQuickViewSizes] = useState<Record<string, string>>({});
  const handleQuickView = async (productId: string) => {
    try {
      const cp = await getProductById(productId);
      setQuickViewProduct(cp);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No fue posible cargar el producto.');
    }
  };
  const handleQuickViewAddToCart = async (cp: CatalogProduct) => {
    const size = quickViewSizes[cp.id] || cp.sizes[0];
    const v = cp.variants.find(i => i.is_active && i.presentation === size) ?? cp.variants.find(i => i.is_active);
    if (!v) { toast.warning('Sin presentación disponible.'); return; }
    try {
      const added = await addItem({ variantId: v.id, name: cp.name, category: cp.category_name, price: v.current_price ?? cp.price ?? 0, image: cp.primary_image || 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=600&q=80', size: v.presentation, quantity: 1 });
      if (added) toast.success(`${cp.name} añadido al carrito`);
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error al agregar al carrito.'); }
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

      {/* ── Banner datos faltantes ── */}
      {missingData && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
            <p className="text-[12px] text-amber-800 leading-snug">
              {missingDoc && missingLocation && 'Faltan tu documento de identidad y dirección de entrega.'}
              {missingDoc && !missingLocation && 'Falta tu documento de identidad.'}
              {!missingDoc && missingLocation && 'Falta tu dirección de entrega.'}
              {' '}Completa tu perfil para una mejor experiencia.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setShowOnboarding(true)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-opacity"
              style={{ backgroundColor: '#2D3A1F' }}>
              Completar ahora
            </button>
            <button
              onClick={() => { setSection('datos'); }}
              className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-amber-700 border border-amber-300 hover:bg-amber-100 transition-colors">
              Ver mi perfil
            </button>
          </div>
        </div>
      )}

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
            {isWholesale ? (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-stone-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
                <Store className="w-2.5 h-2.5" /> Mayorista
              </span>
            ) : (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-stone-500">
                <Store className="w-2.5 h-2.5" /> Minorista
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
          <div className="px-4 py-4 pb-20 lg:pb-4 lg:px-6">
          <AnimatePresence mode="wait">

            {/* ─── MIS DATOS ─── */}
            {section === 'datos' && (
              <motion.div key="datos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>

                {/* Header */}
                <div className="mb-5">
                  <h1 className="text-xl font-semibold text-stone-900 tracking-tight">Mi perfil</h1>
                  <p className="mt-0.5 text-xs text-stone-400">Gestiona tu información personal y dirección de entrega.</p>
                </div>

                <AnimatePresence>
                  {saveOk && (
                    <motion.div key="ok" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mb-4 flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-emerald-600" strokeWidth={2.5} />
                      </div>
                      Cambios guardados correctamente
                    </motion.div>
                  )}
                  {saveErr && (
                    <motion.div key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mb-4 flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                      <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-3 h-3 text-red-500" strokeWidth={2} />
                      </div>
                      {saveErr}
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSave}>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

                    {/* ── COLUMNA IZQUIERDA: datos personales ── */}
                    <div className="flex flex-col gap-3">

                      {/* Tarjeta identidad */}
                      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
                        <div className="px-5 pt-4 pb-3 border-b border-stone-100 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #f0f4ed 0%, #ffffff 60%)' }}>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Información personal</p>
                            <p className="mt-0.5 text-sm font-semibold text-stone-900">{currentUser.nombre || `${currentUser.firstName} ${currentUser.lastName}`}</p>
                          </div>
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ backgroundColor: OLIVE }}>
                            {currentUser.firstName?.[0]?.toUpperCase() ?? currentUser.nombre?.[0]?.toUpperCase() ?? '?'}
                          </div>
                        </div>

                        {/* Campos */}
                        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Nombre *</span>
                            <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className={inp} placeholder="María Fernanda" required />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Apellidos *</span>
                            <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className={inp} placeholder="García López" required />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Email</span>
                            <input type="email" value={currentUser.email} disabled className={inp} />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Teléfono</span>
                            <input type="tel" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className={inp} placeholder="3001234567" />
                          </label>
                        </div>

                        {/* Documento */}
                        {docLabel && currentUser.numeroDocumento && (
                          <div className="mx-5 mb-4 flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50 px-3.5 py-2.5">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${OLIVE}12` }}>
                              <Hash className="w-3 h-3" style={{ color: OLIVE }} strokeWidth={2} />
                            </div>
                            <div>
                              <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400">{docLabel}</p>
                              <p className="font-mono text-xs font-semibold text-stone-800">{currentUser.numeroDocumento}</p>
                            </div>
                            <div className="ml-auto">
                              <BadgeCheck className="w-4 h-4 text-emerald-500" strokeWidth={2} />
                            </div>
                          </div>
                        )}

                        {/* Botón guardar */}
                        <div className="px-5 pb-4">
                          <button type="submit" disabled={saving}
                            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                            style={{ backgroundColor: OLIVE }}>
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={2} />}
                            {saving ? 'Guardando…' : 'Guardar cambios'}
                          </button>
                        </div>
                      </div>

                      {/* Tarjeta seguridad / contraseña */}
                      <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
                        <div className="px-5 py-3 border-b border-stone-100 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${OLIVE}12` }}>
                            <KeyRound className="w-3.5 h-3.5" style={{ color: OLIVE }} strokeWidth={2} />
                          </div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                            {hasPassword ? 'Cambiar contraseña' : 'Configurar contraseña'}
                          </p>
                        </div>

                        <div className="px-5 py-4 space-y-3">
                          <AnimatePresence>
                            {pwdErr && (
                              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                {pwdErr}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {!hasPassword && (
                            <p className="text-[11px] text-stone-400 leading-relaxed">
                              Tu cuenta no tiene una contraseña configurada todavía (iniciaste sesión con Google). Crea una para poder ingresar también con tu email.
                            </p>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {hasPassword && (
                              <label className="flex flex-col gap-1.5 sm:col-span-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Contraseña actual *</span>
                                <div className="relative">
                                  <input
                                    type={showPwdFields ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    className={inp}
                                    placeholder="••••••••"
                                  />
                                </div>
                              </label>
                            )}
                            <label className="flex flex-col gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Nueva contraseña *</span>
                              <input
                                type={showPwdFields ? 'text' : 'password'}
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className={inp}
                                placeholder="Mínimo 8 caracteres"
                              />
                            </label>
                            <label className="flex flex-col gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Confirmar contraseña *</span>
                              <input
                                type={showPwdFields ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className={inp}
                                placeholder="Repite la contraseña"
                              />
                            </label>
                          </div>

                          <button
                            type="button"
                            onClick={() => setShowPwdFields(v => !v)}
                            className="flex items-center gap-1.5 text-[11px] font-medium text-stone-400 hover:text-stone-600 transition-colors"
                          >
                            {showPwdFields ? <EyeOff className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Eye className="w-3.5 h-3.5" strokeWidth={1.5} />}
                            {showPwdFields ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                          </button>

                          <button
                            type="button"
                            disabled={savingPwd}
                            onClick={handleChangePassword}
                            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                            style={{ backgroundColor: OLIVE }}
                          >
                            {savingPwd ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" strokeWidth={2} />}
                            {savingPwd ? 'Guardando…' : hasPassword ? 'Actualizar contraseña' : 'Configurar contraseña'}
                          </button>
                        </div>
                      </div>

                      {/* Tarjeta empresa — solo mayoristas */}
                      {isWholesale && (
                        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
                          <div className="px-5 py-3 border-b border-stone-100 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${OLIVE}12` }}>
                              <Store className="w-3 h-3" style={{ color: OLIVE }} strokeWidth={1.8} />
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Datos de empresa</p>
                          </div>
                          <div className="px-5 py-4 space-y-3">
                            {currentUser.companyName && (
                              <p className="text-sm font-semibold text-stone-900">{currentUser.companyName}</p>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              {currentUser.companyIdNumber && (
                                <div className="flex items-center gap-2 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5">
                                  <Hash className="w-3 h-3 flex-shrink-0 text-stone-400" strokeWidth={2} />
                                  <div className="min-w-0">
                                    <p className="text-[9px] text-stone-400 uppercase tracking-wide">{currentUser.companyIdType === 'OTRO' ? (currentUser.companyIdTypeOther || 'Otro') : (currentUser.companyIdType || 'ID')}</p>
                                    <p className="font-mono text-xs font-semibold text-stone-800 truncate">{currentUser.companyIdNumber}</p>
                                  </div>
                                </div>
                              )}
                              {currentUser.businessType && (
                                <div className="flex items-center gap-2 rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5">
                                  <Store className="w-3 h-3 flex-shrink-0 text-stone-400" strokeWidth={1.8} />
                                  <p className="text-xs text-stone-700 truncate">{{ TIENDA:'Tienda', DISTRIBUIDOR:'Distribuidor', RESTAURANTE:'Restaurante', FARMACIA:'Farmacia', SPA:'Spa / Estética', OTRO:'Otro' }[currentUser.businessType] ?? currentUser.businessType}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                    </div>

                    {/* ── COLUMNA DERECHA: dirección de envío ── */}
                    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
                      <div className="px-5 pt-4 pb-3 border-b border-stone-100 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #f0f4ed 0%, #ffffff 60%)' }}>
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${OLIVE}12` }}>
                          <MapPin className="w-3.5 h-3.5" style={{ color: OLIVE }} strokeWidth={1.8} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Dirección de envío</p>
                          <p className="text-xs text-stone-500 mt-0.5">Ubicación donde recibirás tus pedidos</p>
                        </div>
                      </div>
                      <div className="px-5 py-4">
                        {loadingLoc && (
                          <div className="mb-3 flex items-center gap-2 text-[11px] text-stone-400">
                            <Loader2 className="w-3 h-3 animate-spin" /> Cargando ubicación guardada…
                          </div>
                        )}
                        <div className="space-y-3">
                          <LocationPicker value={profileLoc} onChange={setProfileLoc} />
                          <DeliveryLocationSection
                            value={deliveryLoc} onChange={setDeliveryLoc}
                            searchScope={{ state: profileLoc.stateName, country: profileLoc.countryName }}
                            cityOptions={cityNames}
                            onCityResolved={cn => setProfileLoc(p => ({ ...p, cityId: null, cityName: cn }))}
                            onLocationResolved={setProfileLoc}
                          />
                        </div>
                      </div>
                    </div>

                  </div>{/* grid cols-2 */}
                  </form>
              </motion.div>
            )}

            {/* ─── PEDIDOS ─── */}
            {section === 'pedidos' && (
              <motion.div key="pedidos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>

                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-semibold text-stone-900">Mis pedidos</h1>
                    <p className="text-xs text-stone-400">
                      {filteredOrders.length !== orders.length
                        ? `${filteredOrders.length} de ${orders.length} pedidos`
                        : `${orders.length} ${orders.length === 1 ? 'pedido' : 'pedidos'} en total`}
                    </p>
                  </div>
                  <button onClick={() => { loadOrders(); setShippingData({}); setOrdersPage(1); }} className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-500 transition hover:border-stone-300 hover:text-stone-800">
                    <RefreshCw className="w-3 h-3" /> Actualizar
                  </button>
                </div>

                {/* ── Panel de filtros ── */}
                <div className="mb-5 rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Número de pedido */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Número de pedido</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300 pointer-events-none" />
                        <input
                          value={orderNumFilter}
                          onChange={e => setOrderNumFilter(e.target.value)}
                          placeholder="ID o número..."
                          className="w-full pl-8 pr-3 py-2 text-xs border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 placeholder:text-stone-300"
                        />
                      </div>
                    </div>

                    {/* Estado */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Estado</label>
                      <select
                        value={orderStatusFilter}
                        onChange={e => setOrderStatusFilter(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 text-stone-700"
                      >
                        <option value="">Todos los estados</option>
                        <option value="pendiente">Pendiente</option>
                        <option value="pending">Pago pendiente</option>
                        <option value="paid">Pagado</option>
                        <option value="packed">Empacado</option>
                        <option value="shipped">Enviado</option>
                        <option value="in_transit">En tránsito</option>
                        <option value="delivered">Entregado</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                    </div>

                    {/* Fecha desde */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Fecha desde</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300 pointer-events-none" />
                        <input
                          type="date"
                          value={orderDateFrom}
                          onChange={e => setOrderDateFrom(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 text-xs border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400"
                        />
                      </div>
                    </div>

                    {/* Fecha hasta */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Fecha hasta</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300 pointer-events-none" />
                        <input
                          type="date"
                          value={orderDateTo}
                          min={orderDateFrom || undefined}
                          onChange={e => setOrderDateTo(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 text-xs border border-stone-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400"
                        />
                      </div>
                    </div>
                  </div>

                  {hasOrderFilters && (
                    <div className="flex justify-end mt-3 pt-3 border-t border-stone-100">
                      <button
                        onClick={clearOrderFilters}
                        className="text-xs font-semibold text-stone-400 hover:text-stone-800 transition-colors"
                      >
                        Limpiar filtros
                      </button>
                    </div>
                  )}
                </div>

                {orders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Package className="mb-3 h-8 w-8 text-stone-200" strokeWidth={1} />
                    <p className="text-sm font-medium text-stone-500">Sin pedidos aún</p>
                    <p className="mt-1 text-xs text-stone-400">Tu historial aparecerá aquí</p>
                  </div>
                ) : (() => {
                  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
                  const pagedOrders = filteredOrders.slice((ordersPage - 1) * ORDERS_PER_PAGE, ordersPage * ORDERS_PER_PAGE);
                  if (pagedOrders.length === 0) return (
                    <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-stone-200 bg-white">
                      <Package className="mb-3 h-8 w-8 text-stone-200" strokeWidth={1} />
                      <p className="text-sm font-medium text-stone-500">Sin pedidos con esos filtros</p>
                      <button onClick={clearOrderFilters} className="mt-2 text-xs font-semibold text-stone-400 hover:text-stone-800 transition-colors">Limpiar filtros</button>
                    </div>
                  );
                  return (
                  <div className="space-y-3">
                    {pagedOrders.map(order => {
                      const subtotal = order.productos.reduce((s: number, p: { precio: number; cantidad: number }) => s + p.precio * p.cantidad, 0);
                      const costoEnvio = order.total - subtotal;
                      const showEnvioCost = costoEnvio > 0;
                      const isTracking = trackingId === order.id;
                      const isPaid = !canPay(order.estado);
                      const envio = shippingData[order.id] ?? null;
                      const loadingEnvio = loadingShipping[order.id] ?? false;

                      return (
                        <div key={order.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">

                          {/* ══ CABECERA ══ */}
                          <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 pt-4 pb-3">
                            <div>
                              <p className="font-mono text-sm font-bold text-stone-900">
                                #{order.order_number ?? order.id.slice(0, 8).toUpperCase()}
                              </p>
                              <p className="text-[11px] text-stone-400 mt-0.5">
                                {new Date(order.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
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

                              {/* Dirección de entrega + mapa */}
                              {order.direccionEnvio && (
                                <div>
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-stone-400" strokeWidth={1.5} />
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Dirección de entrega</p>
                                  </div>
                                  <p className="text-xs text-stone-600 leading-relaxed mb-2">{order.direccionEnvio}</p>
                                  {order.latitudEnvio != null && order.longitudEnvio != null ? (
                                    <InteractiveLocationMap
                                      lat={order.latitudEnvio}
                                      lng={order.longitudEnvio}
                                      onMarkerMove={() => {}}
                                      readOnly
                                      className="h-40 overflow-hidden rounded-xl border border-stone-200"
                                    />
                                  ) : null}
                                </div>
                              )}

                              {/* Info de envío */}
                              {isPaid && (
                                <div>
                                  <div className="flex items-center gap-1.5 mb-1.5">
                                    <Truck className="w-3.5 h-3.5 text-stone-400" strokeWidth={1.5} />
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Información del envío</p>
                                  </div>
                                  {loadingEnvio ? (
                                    <div className="flex items-center gap-1.5 text-xs text-stone-400">
                                      <Loader2 className="w-3 h-3 animate-spin" /> Cargando…
                                    </div>
                                  ) : envio ? (
                                    <div className="space-y-1.5">
                                      <p className="text-xs text-stone-600">
                                        Transportadora: <span className="font-medium text-stone-800">{envio.transportadora?.nombre ?? 'Por asignar'}</span>
                                      </p>
                                      {envio.numero_guia && (
                                        <p className="text-xs text-stone-600">
                                          Guía: <span className="font-mono font-medium text-stone-800">{envio.numero_guia}</span>
                                        </p>
                                      )}
                                      {envio.fecha_entrega_estimada && (
                                        <p className="text-xs text-stone-600">
                                          Entrega estimada: <span className="font-medium text-stone-800">
                                            {new Date(envio.fecha_entrega_estimada).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                                          </span>
                                        </p>
                                      )}
                                      {envio.fecha_entrega_real && (
                                        <p className="text-xs text-stone-600">
                                          Entregado el: <span className="font-medium text-emerald-700">
                                            {new Date(envio.fecha_entrega_real).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                                          </span>
                                        </p>
                                      )}
                                      {envio.tracking_url && (
                                        <a href={envio.tracking_url} target="_blank" rel="noopener noreferrer"
                                          className="mt-1 flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-800 transition-colors">
                                          <ExternalLink className="w-3 h-3" strokeWidth={2} />
                                          Rastrear envío
                                        </a>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="space-y-1.5">
                                      <p className="text-xs text-stone-600">Transportadora: <span className="text-stone-400">Por asignar</span></p>
                                      <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 py-2 text-[11px] text-emerald-700 leading-relaxed">
                                        <Check className="w-3 h-3 mt-0.5 flex-shrink-0" strokeWidth={2.5} />
                                        Te notificaremos cuando tu pedido esté en camino.
                                      </p>
                                    </div>
                                  )}
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

                    {/* ── Paginación ── */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-2">
                        <p className="text-xs text-stone-400">
                          Página {ordersPage} de {totalPages}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setOrdersPage(p => Math.max(1, p - 1))}
                            disabled={ordersPage === 1}
                            className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-600 transition hover:border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
                            Anterior
                          </button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                              key={page}
                              onClick={() => setOrdersPage(page)}
                              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                                page === ordersPage
                                  ? 'bg-stone-900 text-white'
                                  : 'border border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                          <button
                            onClick={() => setOrdersPage(p => Math.min(totalPages, p + 1))}
                            disabled={ordersPage === totalPages}
                            className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-600 transition hover:border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Siguiente
                            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })()}
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
                ) : (() => {
                  const savedTotalPages = Math.ceil(savedWithDetail.length / SAVED_PER_PAGE);
                  const pagedSaved = savedWithDetail.slice((savedPage - 1) * SAVED_PER_PAGE, savedPage * SAVED_PER_PAGE);
                  return (
                    <div className="space-y-3">
                      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                        {pagedSaved.map((p: any) => (
                          <div
                            key={p.id}
                            onClick={() => handleQuickView(p.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleQuickView(p.id); } }}
                            className="group overflow-hidden rounded-2xl border border-stone-200 bg-white cursor-pointer transition-colors hover:border-stone-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300"
                          >
                            <div className="relative aspect-[4/3] overflow-hidden bg-stone-100">
                              <img src={p.imagen || 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=600&q=80'} alt={p.nombre} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />

                              {/* Overlay ojo + eliminar: siempre visible en mobile/touch, hover en desktop */}
                              <div className="absolute inset-0 md:bg-black/22 md:hover:backdrop-blur-[1px] flex items-start justify-end gap-2 p-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={e => { e.stopPropagation(); handleQuickView(p.id); }}
                                  className="rounded-full bg-white/90 p-1.5 shadow-sm transition hover:bg-white"
                                  aria-label="Vista rápida"
                                >
                                  <Eye className="h-3.5 w-3.5 text-stone-600" strokeWidth={1.5} />
                                </button>
                                <button
                                  onClick={e => { e.stopPropagation(); toggleSaveProduct(p.id); }}
                                  className="rounded-full bg-white/90 p-1.5 shadow-sm transition hover:bg-white"
                                  title="Quitar de guardados"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-stone-600" strokeWidth={1.5} />
                                </button>
                              </div>
                            </div>
                            <div className="p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{p.tipo}</p>
                              <p className="mt-0.5 text-sm font-medium text-stone-900 leading-tight">{p.nombre}</p>
                              <p className="text-xs text-stone-400">{p.presentacion}</p>
                              <div className="mt-3 flex items-center justify-between gap-2">
                                <span className="text-sm font-bold text-stone-900">${p.precio.toLocaleString('es-CO')}</span>
                                <button onClick={e => { e.stopPropagation(); handleAddToCart(p); }} className="flex items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:opacity-80">
                                  <ShoppingCart className="h-3 w-3" strokeWidth={2} /> Agregar
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {savedTotalPages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                          <p className="text-xs text-stone-400">
                            Página {savedPage} de {savedTotalPages}
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setSavedPage(p => Math.max(1, p - 1))}
                              disabled={savedPage === 1}
                              className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-600 transition hover:border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
                              Anterior
                            </button>
                            {Array.from({ length: savedTotalPages }, (_, i) => i + 1).map(page => (
                              <button
                                key={page}
                                onClick={() => setSavedPage(page)}
                                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                                  page === savedPage
                                    ? 'bg-stone-900 text-white'
                                    : 'border border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                                }`}
                              >
                                {page}
                              </button>
                            ))}
                            <button
                              onClick={() => setSavedPage(p => Math.min(savedTotalPages, p + 1))}
                              disabled={savedPage === savedTotalPages}
                              className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-600 transition hover:border-stone-300 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Siguiente
                              <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </motion.div>
            )}

            {/* ─── MAYORISTA ─── */}
            {section === 'mayorista' && (
              <MayoristaSection isWholesale={isWholesale} codigoMayorista={currentUser.codigoMayorista} onApply={handleApplyWholesale} />
            )}

          </AnimatePresence>
          </div>
        </main>
      </div>

      <GoogleOnboardingModal
        isOpen={showOnboarding}
        initialFirstName={currentUser.firstName}
        initialLastName={currentUser.lastName}
        initialStep={missingDoc ? 'identity' : missingLocation ? 'location' : 'wholesale'}
        onClose={() => setShowOnboarding(false)}
      />

      <AnimatePresence>
        {quickViewProduct && (
          <ProductQuickView
            product={quickViewProduct}
            allProducts={[quickViewProduct]}
            selectedSizes={quickViewSizes}
            onSelectSize={(id, size) => setQuickViewSizes(prev => ({ ...prev, [id]: size }))}
            onAddToCart={handleQuickViewAddToCart}
            onToggleSave={(id) => toggleSaveProduct(id)}
            isSaved={savedProducts.some(s => s.productoId === quickViewProduct.id)}
            isProductSaved={(id) => savedProducts.some(s => s.productoId === id)}
            onClose={() => setQuickViewProduct(null)}
            onNavigateTo={p => setQuickViewProduct(p)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, MapPin, Phone, X, ArrowRight, Check } from 'lucide-react';
import { openWhatsApp } from '../utils/whatsapp';

const OLIVE = '#2D3A1F';

type LegalModal = 'terms' | 'privacy' | 'cookies' | 'shipping' | 'returns' | 'warranty' | null;

/* ── SVG logos de medios de pago reales ── */
const PaymentIcons = () => (
  <div className="flex items-center gap-3 flex-wrap">
    {/* Visa */}
    <svg viewBox="0 0 50 16" className="h-5 w-auto" aria-label="Visa">
      <rect width="50" height="16" rx="2" fill="#1A1F71"/>
      <text x="7" y="12" fontSize="10" fill="white" fontFamily="Arial" fontWeight="bold" letterSpacing="0.5">VISA</text>
    </svg>
    {/* Mastercard */}
    <svg viewBox="0 0 36 24" className="h-5 w-auto" aria-label="Mastercard">
      <rect width="36" height="24" rx="3" fill="#252525"/>
      <circle cx="14" cy="12" r="8" fill="#EB001B"/>
      <circle cx="22" cy="12" r="8" fill="#F79E1B"/>
      <path d="M18 6.5a8 8 0 010 11A8 8 0 0118 6.5z" fill="#FF5F00"/>
    </svg>
    {/* PSE */}
    <svg viewBox="0 0 44 24" className="h-5 w-auto" aria-label="PSE">
      <rect width="44" height="24" rx="3" fill="#007BC4"/>
      <text x="7" y="16" fontSize="9" fill="white" fontFamily="Arial" fontWeight="bold">PSE</text>
    </svg>
    {/* Nequi */}
    <svg viewBox="0 0 52 24" className="h-5 w-auto" aria-label="Nequi">
      <rect width="52" height="24" rx="3" fill="#6B0FA8"/>
      <text x="8" y="16" fontSize="9" fill="white" fontFamily="Arial" fontWeight="bold">nequi</text>
    </svg>
    {/* Daviplata */}
    <svg viewBox="0 0 64 24" className="h-5 w-auto" aria-label="Daviplata">
      <rect width="64" height="24" rx="3" fill="#ED1C24"/>
      <text x="5" y="16" fontSize="8.5" fill="white" fontFamily="Arial" fontWeight="bold">daviplata</text>
    </svg>
    {/* Efecty */}
    <svg viewBox="0 0 54 24" className="h-5 w-auto" aria-label="Efecty">
      <rect width="54" height="24" rx="3" fill="#F5A800"/>
      <text x="7" y="16" fontSize="8.5" fill="#1A1A1A" fontFamily="Arial" fontWeight="bold">efecty</text>
    </svg>
  </div>
);

/* ── SVG redes sociales estilo fino ── */
const InstagramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <circle cx="12" cy="12" r="4"/>
    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor"/>
  </svg>
);

const TikTokIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>
  </svg>
);

const FacebookIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
  </svg>
);

export function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [activeModal, setActiveModal] = useState<LegalModal>(null);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) return;
    openWhatsApp(`Hola, quiero suscribirme a las novedades de Juhnios Rold. Mi correo es: ${email}`);
    setSubscribed(true);
    setEmail('');
    setTimeout(() => setSubscribed(false), 3500);
  };

  const modalTitles: Record<NonNullable<LegalModal>, string> = {
    terms: 'Términos y condiciones',
    privacy: 'Política de privacidad',
    cookies: 'Política de cookies',
    shipping: 'Política de envíos',
    returns: 'Devoluciones',
    warranty: 'Garantía',
  };

  return (
    <footer style={{ backgroundColor: OLIVE }} className="text-white/70">

      {/* ── BLOQUE PRINCIPAL ── */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-14 pt-20 pb-14">

        {/* Frase editorial */}
        <div className="border-b border-white/10 pb-14 mb-14">
          <p
            className="text-[42px] md:text-[58px] lg:text-[72px] font-light text-white leading-[0.92] tracking-tight max-w-4xl"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Colombia entera<br />
            <em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.5)' }}>nos conoce.</em>
          </p>
        </div>

        {/* Grid 4 columnas */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-16">

          {/* Marca */}
          <div>
            <p className="text-[8.5px] tracking-[0.38em] uppercase text-white/35 mb-4">Marca</p>
            <div className="text-[13px] tracking-[0.2em] uppercase font-semibold text-white mb-1">
              JUHNIOS ROLD
            </div>
            <div className="text-[9px] tracking-[0.22em] uppercase text-[#C4A97D] mb-5">
              CUIDADO CAPILAR NATURAL
            </div>
            <p className="text-[12px] text-white/45 leading-relaxed mb-6 max-w-[220px]">
              Productos capilares premium para mujeres colombianas que no piden permiso para brillar.
            </p>
            <div className="space-y-2.5">
              {[
                { Icon: Mail,  text: 'hola@juhniosrold.com', href: 'mailto:hola@juhniosrold.com' },
                { Icon: Phone, text: '+57 300 123 4567',     href: 'tel:+573001234567' },
                { Icon: MapPin,text: 'Bogotá, Colombia',     href: undefined },
              ].map(({ Icon, text, href }) => (
                <div key={text} className="flex items-center gap-2">
                  <Icon className="w-3 h-3 text-white/30 flex-shrink-0" strokeWidth={1.5} />
                  {href
                    ? <a href={href} className="text-[11px] text-white/45 hover:text-white/80 transition-colors">{text}</a>
                    : <span className="text-[11px] text-white/45">{text}</span>
                  }
                </div>
              ))}
            </div>
          </div>

          {/* Productos */}
          <div>
            <p className="text-[8.5px] tracking-[0.38em] uppercase text-white/35 mb-4">Productos</p>
            <ul className="space-y-2.5">
              {[
                { href: '#productos',  label: 'Capilar' },
                { href: '#aceites',    label: 'Aceites naturales' },
                { href: '#mayorista',  label: 'Materias primas' },
                { href: '#pro',        label: 'Modo PRO' },
                { href: '#catalogo',   label: 'Ver todo el catálogo' },
              ].map(({ href, label }) => (
                <li key={label}>
                  <a href={href} className="text-[12px] text-white/45 hover:text-white/90 transition-colors">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Ayuda */}
          <div>
            <p className="text-[8.5px] tracking-[0.38em] uppercase text-white/35 mb-4">Ayuda</p>
            <ul className="space-y-2.5">
              {([
                ['shipping', 'Política de envíos'],
                ['returns',  'Devoluciones'],
                ['warranty', 'Garantía'],
                ['terms',    'Términos y condiciones'],
                ['privacy',  'Privacidad'],
              ] as [LegalModal, string][]).map(([key, label]) => (
                <li key={key}>
                  <button
                    onClick={() => setActiveModal(key)}
                    className="text-[12px] text-white/45 hover:text-white/90 transition-colors text-left"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <p className="text-[8.5px] tracking-[0.38em] uppercase text-white/35 mb-4">Newsletter</p>
            <p className="text-[12px] text-white/45 leading-relaxed mb-5">
              Novedades, rituales y descuentos exclusivos directo a tu correo.
            </p>
            <form onSubmit={handleSubscribe} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email" placeholder="tu@email.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  disabled={subscribed}
                  className="flex-1 px-3.5 py-2.5 bg-white/8 border border-white/12 rounded-xl text-[12px] text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors disabled:opacity-40"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                />
                <button
                  type="submit" disabled={subscribed}
                  className="px-3.5 py-2.5 rounded-xl text-[#2D3A1F] text-[10px] font-semibold transition-opacity hover:opacity-85 disabled:opacity-50 flex-shrink-0"
                  style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}
                >
                  {subscribed ? <Check className="w-4 h-4" strokeWidth={2} /> : <ArrowRight className="w-4 h-4" strokeWidth={2} />}
                </button>
              </div>
              {subscribed && (
                <p className="text-[10.5px] text-emerald-400">¡Gracias por suscribirte!</p>
              )}
            </form>

            {/* Redes sociales */}
            <div className="mt-8">
              <p className="text-[8.5px] tracking-[0.38em] uppercase text-white/35 mb-4">Síguenos</p>
              <div className="flex items-center gap-2">
                {[
                  { Icon: InstagramIcon, label: 'Instagram', href: 'https://instagram.com' },
                  { Icon: TikTokIcon,    label: 'TikTok',    href: 'https://tiktok.com' },
                  { Icon: FacebookIcon,  label: 'Facebook',  href: 'https://facebook.com' },
                  { Icon: WhatsAppIcon,  label: 'WhatsApp',  href: 'https://wa.me/573001234567' },
                ].map(({ Icon, label, href }) => (
                  <motion.a
                    key={label} href={href} target="_blank" rel="noopener noreferrer"
                    aria-label={label}
                    whileHover={{ scale: 1.1, y: -2 }} whileTap={{ scale: 0.95 }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white transition-colors"
                    style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
                  >
                    <Icon />
                  </motion.a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM BAR ── */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <p className="text-[10.5px] text-white/25">
            © 2026 Juhnios Rold · Bogotá, Colombia · Todos los derechos reservados.
          </p>

          {/* Métodos de pago */}
          <div className="flex flex-col gap-2">
            <p className="text-[8.5px] tracking-[0.28em] uppercase text-white/25">Métodos de pago aceptados</p>
            <PaymentIcons />
          </div>
        </div>
      </div>

      {/* ── MODALES LEGALES ── */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 12 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="px-7 py-5 border-b border-stone-100 flex items-center justify-between">
                <h2 className="text-[16px] font-medium text-stone-900">{modalTitles[activeModal!]}</h2>
                <button onClick={() => setActiveModal(null)} className="p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors">
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
              <div className="p-7 overflow-y-auto flex-1 text-[12.5px] text-stone-500 leading-relaxed space-y-4">
                {activeModal === 'shipping' && <>
                  <p><strong className="text-stone-700">Bogotá y Medellín:</strong> 2–3 días hábiles. <strong className="text-stone-700">Cali, Barranquilla, Cartagena:</strong> 3–4 días. <strong className="text-stone-700">Resto del país:</strong> 4–7 días hábiles.</p>
                  <p><strong className="text-stone-700">Envío gratis</strong> en compras superiores a $80.000 COP. Para compras menores el costo es de $10.000 COP.</p>
                  <p>Los pedidos se procesan de lunes a viernes de 8 AM a 5 PM. Pedidos después de las 2 PM se procesan al siguiente día hábil.</p>
                  <p>Recibirás un correo con número de seguimiento una vez despachado tu pedido.</p>
                </>}
                {activeModal === 'returns' && <>
                  <p>Aceptamos devoluciones dentro de los <strong className="text-stone-700">30 días</strong> posteriores a la compra.</p>
                  <p>El producto debe estar sin abrir o usado menos del 30%, en su empaque original y con comprobante de compra.</p>
                  <p>Para iniciar una devolución escríbenos a <strong className="text-stone-700">hola@juhniosrold.com</strong> con tu número de pedido. Reembolso al método de pago original en 5–7 días hábiles.</p>
                </>}
                {activeModal === 'warranty' && <>
                  <p>Todos nuestros productos tienen <strong className="text-stone-700">garantía de satisfacción de 30 días</strong>. Si no estás satisfecha, te devolvemos tu dinero.</p>
                  <p>Nuestros productos son formulados con 98% ingredientes naturales certificados, libres de sulfatos, parabenos y crueldad animal.</p>
                  <p>Para hacer válida tu garantía contáctanos en los primeros 30 días con tu número de pedido y descripción del problema.</p>
                </>}
                {activeModal === 'terms' && <>
                  <p>Al usar juhniosrold.com aceptas estos términos. Los productos son para uso personal y no para reventa. Nos reservamos el derecho de modificar precios y disponibilidad sin previo aviso.</p>
                  <p>Los pagos se procesan de forma segura. Envíos gratuitos en compras mayores a $80.000 COP. Devoluciones dentro de 30 días.</p>
                  <p>Todo el contenido del sitio es propiedad de Juhnios Rold y está protegido por derechos de autor colombianos.</p>
                </>}
                {activeModal === 'privacy' && <>
                  <p>Recopilamos tu nombre, email, teléfono y dirección de envío únicamente para procesar pedidos y comunicarte promociones relevantes.</p>
                  <p>No vendemos ni transferimos tu información a terceros, salvo proveedores de pago necesarios para operar.</p>
                  <p>Puedes solicitar acceso, corrección o eliminación de tus datos escribiendo a <strong className="text-stone-700">hola@juhniosrold.com</strong>.</p>
                </>}
                {activeModal === 'cookies' && <>
                  <p>Usamos cookies esenciales para el carrito y sesión, cookies de rendimiento (Google Analytics) para mejorar la experiencia, y cookies de marketing para mostrar anuncios relevantes.</p>
                  <p>Puedes desactivar las cookies no esenciales desde la configuración de tu navegador. Algunas funciones del sitio pueden verse afectadas.</p>
                </>}
              </div>
              <div className="px-7 py-5 border-t border-stone-100">
                <button
                  onClick={() => setActiveModal(null)}
                  className="px-6 py-2.5 text-white text-[10px] tracking-[0.22em] uppercase font-medium rounded-xl hover:opacity-85 transition-opacity"
                  style={{ backgroundColor: OLIVE }}
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </footer>
  );
}

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Check, Loader2, X, Plus, Minus } from "lucide-react";
import proVideo from "../../imports/51905-467131986.mp4";

const OLIVE = '#2D3A1F';

const faqs = [
  {
    q: '¿Quiénes pueden acceder al Programa PRO?',
    a: 'Estilistas, salones de belleza, academias de cosmetología y cualquier profesional del sector capilar con actividad comercial verificable.',
  },
  {
    q: '¿Cuánto descuento recibo?',
    a: 'Los profesionales PRO acceden a descuentos de hasta el 40% en toda la línea, con precios escalonados según el volumen mensual de pedidos.',
  },
  {
    q: '¿Hay pedido mínimo?',
    a: 'El pedido mínimo inicial es de $150.000 COP. Una vez activada tu cuenta no hay restricciones por pedido.',
  },
  {
    q: '¿Qué incluye el soporte dedicado?',
    a: 'Asesor personal asignado, capacitaciones técnicas periódicas, acceso prioritario a novedades y canal directo de WhatsApp para pedidos urgentes.',
  },
  {
    q: '¿En cuánto tiempo activan mi cuenta?',
    a: 'En menos de 24 horas hábiles tras verificar tu información un asesor te contacta para activar los beneficios.',
  },
];

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between gap-4 py-5 text-left group"
      >
        <span className="text-[13.5px] text-stone-800 font-medium leading-snug group-hover:text-stone-900 transition-colors">
          {q}
        </span>
        <span className="flex-shrink-0 mt-0.5 text-stone-300 group-hover:text-stone-500 transition-colors">
          {open
            ? <Minus className="w-3.5 h-3.5" strokeWidth={1.5} />
            : <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          }
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-[12.5px] text-stone-400 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ModoPro() {
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', salon: '', phone: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <section id="pro" className="py-12 px-4 md:px-8 lg:px-14" style={{ backgroundColor: '#F7F5F1' }}>
      <div className="max-w-[1400px] mx-auto space-y-5">

        {/* ── BANNER con video ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65 }}
          className="relative overflow-hidden rounded-[28px]"
          style={{ minHeight: 360 }}
        >
          {/* Video */}
          <video
            autoPlay loop muted playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src={proVideo} type="video/mp4" />
          </video>

          {/* Overlay */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(105deg, rgba(8,11,6,0.72) 0%, rgba(8,11,6,0.38) 60%, transparent 100%)' }}
          />

          {/* Contenido */}
          <div className="relative z-10 h-full flex items-center px-10 md:px-14 lg:px-20 py-14">
            <div className="max-w-lg">
              <p className="text-[8.5px] tracking-[0.46em] uppercase text-white/40 mb-5">
                Programa profesional
              </p>
              <h2
                className="font-light text-white leading-[0.9] tracking-tight mb-5"
                style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(40px, 5vw, 64px)' }}
              >
                Modo <em style={{ fontStyle: 'italic' }}>PRO</em>
              </h2>
              <p className="text-[13px] text-white/50 leading-relaxed mb-8 max-w-[320px]">
                Descuentos, stock prioritario y soporte dedicado para salones y estilistas profesionales.
              </p>
              <motion.button
                whileHover={{ opacity: 0.88 }} whileTap={{ scale: 0.97 }}
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-3 px-7 py-3.5 text-white text-[10px] tracking-[0.3em] uppercase font-medium border border-white/25 rounded-full hover:border-white/60 transition-all group"
              >
                Solicitar acceso
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* ── PANEL INFERIOR: stats + preguntas ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="grid md:grid-cols-[280px_1fr] gap-0 bg-white rounded-[28px] overflow-hidden"
        >
          {/* Stats lateral */}
          <div className="flex flex-col justify-between px-10 py-10 border-b md:border-b-0 md:border-r border-stone-100">
            <div>
              <p className="text-[8.5px] tracking-[0.38em] uppercase text-stone-400 mb-8">
                Beneficios PRO
              </p>
              <div className="space-y-7">
                {[
                  { val: '40%', label: 'Descuento máximo' },
                  { val: '500+', label: 'Profesionales activos' },
                  { val: '24 h', label: 'Activación de cuenta' },
                ].map(({ val, label }) => (
                  <div key={label}>
                    <span
                      className="block text-[34px] font-light text-stone-900 leading-none mb-1"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      {val}
                    </span>
                    <span className="text-[10.5px] text-stone-400 tracking-[0.14em] uppercase">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <motion.button
              whileHover={{ opacity: 0.88 }} whileTap={{ scale: 0.97 }}
              onClick={() => setShowForm(true)}
              className="mt-10 flex items-center justify-between gap-2 px-6 py-3.5 text-white text-[10px] tracking-[0.26em] uppercase font-semibold rounded-xl"
              style={{ backgroundColor: OLIVE }}
            >
              Unirme al PRO
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </motion.button>
          </div>

          {/* Preguntas frecuentes */}
          <div className="px-10 py-10">
            <p className="text-[8.5px] tracking-[0.38em] uppercase text-stone-400 mb-2">
              Preguntas frecuentes
            </p>
            <p className="text-[12px] text-stone-400 mb-6">Todo lo que necesitas saber antes de unirte.</p>
            <div>
              {faqs.map(({ q, a }) => <Faq key={q} q={q} a={a} />)}
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── MODAL DE REGISTRO ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(10,12,8,0.72)', backdropFilter: 'blur(10px)' }}
            onClick={() => { if (!loading) setShowForm(false); }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl"
            >
              {!submitted ? (
                <div className="px-8 py-8">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <p className="text-[8.5px] tracking-[0.36em] uppercase text-stone-400 mb-1">Juhnios Rold PRO</p>
                      <h3
                        className="text-[22px] font-light text-stone-900 leading-tight"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                      >
                        Únete al programa
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowForm(false)}
                      className="p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
                    >
                      <X className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3.5">
                    {[
                      { label: 'Nombre completo', key: 'name', type: 'text', ph: 'María González' },
                      { label: 'Teléfono', key: 'phone', type: 'tel', ph: '+57 300 123 4567' },
                      { label: 'Email profesional', key: 'email', type: 'email', ph: 'maria@misalon.com' },
                      { label: 'Salón o negocio', key: 'salon', type: 'text', ph: 'Salón Belleza & Estilo' },
                    ].map(({ label, key, type, ph }) => (
                      <div key={key}>
                        <label className="text-[9px] tracking-[0.22em] uppercase text-stone-400 mb-1.5 block">{label}</label>
                        <input
                          type={type} required placeholder={ph}
                          value={form[key as keyof typeof form]}
                          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                          className="w-full px-4 py-3 border border-stone-200 rounded-xl text-[13px] text-stone-800 placeholder:text-stone-300 focus:outline-none focus:border-stone-400 transition-colors"
                        />
                      </div>
                    ))}

                    <div className="pt-2">
                      <motion.button
                        type="submit" disabled={loading}
                        whileHover={{ opacity: loading ? 1 : 0.88 }} whileTap={{ scale: 0.97 }}
                        className="w-full py-4 text-white text-[10px] tracking-[0.28em] uppercase font-semibold rounded-xl flex items-center justify-center gap-3 disabled:opacity-60"
                        style={{ backgroundColor: OLIVE }}
                      >
                        {loading
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                          : <>Solicitar acceso PRO <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} /></>
                        }
                      </motion.button>
                    </div>
                    <p className="text-[10px] text-stone-300 text-center leading-relaxed pt-1">
                      Un asesor te contacta en menos de 24 horas para activar tu cuenta.
                    </p>
                  </form>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="px-10 py-14 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.12, type: 'spring', stiffness: 320, damping: 22 }}
                    className="w-14 h-14 flex items-center justify-center mx-auto mb-7 rounded-full border-2"
                    style={{ borderColor: OLIVE, color: OLIVE }}
                  >
                    <Check className="w-6 h-6" strokeWidth={1.5} />
                  </motion.div>
                  <h3
                    className="text-[24px] font-light text-stone-900 mb-3"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    Solicitud recibida
                  </h3>
                  <p className="text-[12.5px] text-stone-400 leading-relaxed mb-8 max-w-xs mx-auto">
                    Te contactamos al <span className="text-stone-700 font-medium">{form.phone}</span> en menos de 24 horas para activar tu cuenta PRO.
                  </p>
                  <button
                    onClick={() => { setShowForm(false); setSubmitted(false); setForm({ name: '', email: '', salon: '', phone: '' }); }}
                    className="px-8 py-3 text-white text-[10px] tracking-[0.24em] uppercase font-medium rounded-xl hover:opacity-85 transition-opacity"
                    style={{ backgroundColor: OLIVE }}
                  >
                    Entendido
                  </button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

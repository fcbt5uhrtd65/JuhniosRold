import { useState, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { ArrowRight, X, Check } from 'lucide-react';
import { openWhatsApp } from '../utils/whatsapp';

const OLIVE = '#2D3A1F';

const categories = [
  { name: 'Aceites esenciales',  code: '01' },
  { name: 'Extractos botánicos', code: '02' },
  { name: 'Mantecas naturales',  code: '03' },
  { name: 'Activos cosméticos',  code: '04' },
  { name: 'Conservantes',        code: '05' },
  { name: 'Emulsionantes',       code: '06' },
  { name: 'Fragancias',          code: '07' },
  { name: 'Colorantes',          code: '08' },
];

const stats = [
  { value: '200+', label: 'Ingredientes'   },
  { value: '50%',  label: 'Dto. por volumen' },
  { value: '5 kg', label: 'Pedido mínimo'  },
  { value: '15',   label: 'Años de exp.'   },
];

export function WholesaleBuyers() {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData]   = useState({
    company: '', contact: '', email: '', phone: '', category: '', volume: '',
  });
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = [
      'Hola, quiero solicitar el catálogo mayorista de materias primas.',
      `Empresa: ${formData.company}`,
      `Contacto: ${formData.contact}`,
      `Email: ${formData.email}`,
      `Teléfono: ${formData.phone}`,
      `Categoría de interés: ${formData.category}`,
      `Volumen mensual estimado: ${formData.volume}`,
    ].join('\n');
    openWhatsApp(message);
    setShowModal(false);
    setFormData({ company: '', contact: '', email: '', phone: '', category: '', volume: '' });
  };

  return (
    <section id="mayorista" className="py-12 px-4 md:px-8 lg:px-14" style={{ backgroundColor: '#F7F5F1' }}>
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7 }}
        className="relative max-w-[1400px] mx-auto rounded-[32px] overflow-hidden"
        style={{ minHeight: 420 }}
      >
        {/* ── Imagen de fondo ── */}
        <img
          src="https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=1800&q=88"
          alt="Materias primas naturales"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />

        {/* ── Overlay doble: oscuro general + gradiente lateral ── */}
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(10,13,8,0.62)' }} />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(105deg, rgba(10,13,8,0.55) 0%, transparent 60%)' }}
        />

        {/* ── Contenido ── */}
        <div className="relative h-full px-6 sm:px-10 md:px-14 lg:px-20 py-10 sm:py-14 flex flex-col justify-between gap-8 lg:gap-10 lg:flex-row lg:items-center">

          {/* BLOQUE IZQUIERDO */}
          <div className="flex flex-col max-w-sm">
            <p className="text-[9px] tracking-[0.46em] uppercase text-white/40 mb-5">
              Para fabricantes · B2B
            </p>
            <h2
              className="text-[34px] sm:text-[44px] md:text-[52px] font-light text-white leading-[0.95] tracking-tight mb-5"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Materias<br />
              <em style={{ fontStyle: 'italic', color: '#A8C090' }}>primas</em>
            </h2>
            <div className="w-8 h-px mb-5" style={{ backgroundColor: '#A8C090' }} />
            <p className="text-[13px] text-white/55 leading-relaxed mb-8">
              Ingredientes botánicos de la más alta calidad para marcas que no se conforman con menos.
            </p>

            {/* Bullets */}
            <ul className="space-y-2.5">
              {['Stock permanente garantizado', 'Muestras gratuitas disponibles', 'Asesoría técnica incluida'].map(item => (
                <li key={item} className="flex items-center gap-2.5">
                  <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#A8C090' }} strokeWidth={2.5} />
                  <span className="text-[12px] text-white/60">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* BLOQUE DERECHO */}
          <div className="flex flex-col gap-7 lg:items-end">

            {/* Stats grid 2×2 */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10">
              {stats.map(({ value, label }) => (
                <div
                  key={label}
                  className="flex flex-col px-7 py-5"
                  style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
                >
                  <span
                    className="text-[34px] font-light text-white leading-none"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    {value}
                  </span>
                  <span className="text-[9px] tracking-[0.22em] uppercase text-white/40 mt-2">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Categorías en 2 columnas compactas */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 w-full">
              {categories.map(cat => (
                <div key={cat.code} className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-light w-5 flex-shrink-0"
                    style={{ color: '#A8C090', fontFamily: "'Playfair Display', serif" }}
                  >
                    {cat.code}
                  </span>
                  <span className="text-[11px] text-white/50">{cat.name}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <motion.button
              whileHover={{ opacity: 0.88 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowModal(true)}
              className="flex items-center justify-between gap-4 px-7 py-4 rounded-2xl text-white text-[11px] tracking-[0.24em] uppercase font-semibold w-full"
              style={{ backgroundColor: OLIVE }}
            >
              Solicitar catálogo mayorista
              <ArrowRight className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ── MODAL ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(10,12,8,0.75)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 14 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 14 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-7 py-5 border-b border-stone-100">
                <div>
                  <h3 className="text-base font-medium text-stone-900">Solicitar catálogo</h3>
                  <p className="text-[10px] text-stone-400 mt-0.5">Te contactamos en menos de 24 h</p>
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-stone-100 transition-colors">
                  <X className="w-4 h-4 text-stone-400" strokeWidth={1.5} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="px-7 py-6 space-y-3">
                {[
                  { placeholder: 'Empresa',             key: 'company', type: 'text'  },
                  { placeholder: 'Persona de contacto', key: 'contact', type: 'text'  },
                  { placeholder: 'Email',               key: 'email',   type: 'email' },
                  { placeholder: 'Teléfono',            key: 'phone',   type: 'tel'   },
                ].map(({ placeholder, key, type }) => (
                  <input
                    key={key} type={type} required placeholder={placeholder}
                    value={formData[key as keyof typeof formData]}
                    onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                    className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none focus:border-stone-400 transition-colors"
                  />
                ))}
                <select required value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-stone-400 bg-white"
                >
                  <option value="">Categoría de interés</option>
                  {categories.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                </select>
                <select required value={formData.volume}
                  onChange={e => setFormData({ ...formData, volume: e.target.value })}
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm text-stone-700 focus:outline-none focus:border-stone-400 bg-white"
                >
                  <option value="">Volumen mensual estimado</option>
                  <option value="5-20kg">5–20 kg</option>
                  <option value="20-50kg">20–50 kg</option>
                  <option value="50-100kg">50–100 kg</option>
                  <option value="100kg+">Más de 100 kg</option>
                </select>
                <motion.button type="submit" whileHover={{ opacity: 0.88 }} whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-between px-6 py-3.5 text-white text-[11px] tracking-[0.24em] uppercase font-semibold rounded-xl mt-1"
                  style={{ backgroundColor: OLIVE }}
                >
                  Enviar solicitud
                  <ArrowRight className="w-4 h-4" strokeWidth={2} />
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

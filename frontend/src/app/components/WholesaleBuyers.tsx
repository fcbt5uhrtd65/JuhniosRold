import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { ArrowRight, Check } from 'lucide-react';

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
  const ref    = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

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
            <motion.a
              href="/materias-primas"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ opacity: 0.88 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center justify-between gap-4 px-7 py-4 rounded-2xl text-white text-[11px] tracking-[0.24em] uppercase font-semibold w-full"
              style={{ backgroundColor: OLIVE }}
            >
              Solicitar catálogo mayorista
              <ArrowRight className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
            </motion.a>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

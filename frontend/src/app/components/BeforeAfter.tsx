import { useRef, useState } from 'react';
import { motion, useInView } from 'motion/react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

const OLIVE = '#2D3A1F';

interface Card {
  id: number;
  before: string;
  after: string;
  benefit: string;
}

// Hoja SVG botánica minimalista para el cierre
const LeafSmall = () => (
  <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
    <path d="M7 11C7 11 1 7.5 1 3.5C1 1.5 2.8 0.5 4.5 0.5C5.5 0.5 6.3 1 7 1.7C7.7 1 8.5 0.5 9.5 0.5C11.2 0.5 13 1.5 13 3.5C13 7.5 7 11 7 11Z"
      stroke="#8B7355" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
    <line x1="7" y1="11" x2="7" y2="2.5" stroke="#8B7355" strokeWidth="0.6" strokeDasharray="1 1.5" strokeLinecap="round"/>
  </svg>
);

// Slider interactivo — drag horizontal para comparar
function ComparisonCard({ card, index, inView }: { card: Card; index: number; inView: boolean }) {
  const [pos, setPos]         = useState(50);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const update = (clientX: number) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos(Math.max(3, Math.min(97, ((clientX - rect.left) / rect.width) * 100)));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.09, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl overflow-hidden bg-stone-100 shadow-sm border border-stone-100"
    >
      {/* Imagen comparativa */}
      <div
        ref={ref}
        className="relative aspect-[3/4] select-none"
        style={{ cursor: 'ew-resize', touchAction: 'none' }}
        onMouseDown={() => setDragging(true)}
        onMouseMove={e => { if (dragging) update(e.clientX); }}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onTouchStart={() => setDragging(true)}
        onTouchMove={e => { e.preventDefault(); if (dragging) update(e.touches[0].clientX); }}
        onTouchEnd={() => setDragging(false)}
      >
        {/* Imagen DESPUÉS (base) */}
        <img
          src={card.after}
          alt="Después"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />

        {/* Imagen ANTES (clip) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          <img
            src={card.before}
            alt="Antes"
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        </div>

        {/* Línea divisoria */}
        <div
          className="absolute top-0 bottom-0 w-px bg-white/90 z-20 pointer-events-none"
          style={{ left: `${pos}%` }}
        >
          {/* Handle circular */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
            <motion.div
              animate={{ scale: dragging ? 1.15 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-9 h-9 bg-white rounded-full shadow-md flex items-center justify-center"
            >
              <ChevronLeft className="w-3 h-3 text-stone-600" strokeWidth={2} />
              <ChevronRight className="w-3 h-3 text-stone-600" strokeWidth={2} />
            </motion.div>
          </div>
        </div>

        {/* Etiquetas superiores */}
        <div className="absolute top-3 left-3 z-20 pointer-events-none">
          <span className="px-2.5 py-1 bg-white/90 text-[9px] tracking-[0.2em] uppercase text-stone-600 rounded-full font-medium">
            Antes
          </span>
        </div>
        <div className="absolute top-3 right-3 z-20 pointer-events-none">
          <span
            className="px-2.5 py-1 text-[9px] tracking-[0.2em] uppercase text-white rounded-full font-medium"
            style={{ backgroundColor: OLIVE }}
          >
            Después
          </span>
        </div>
      </div>

      {/* Etiqueta de beneficio inferior */}
      <div className="px-4 py-3 bg-white flex items-center gap-2">
        <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: OLIVE }} />
        <span className="text-[11px] font-medium text-stone-700 tracking-wide">{card.benefit}</span>
      </div>
    </motion.div>
  );
}

export function BeforeAfter() {
  const sectionRef = useRef<HTMLElement>(null);
  const inView     = useInView(sectionRef, { once: true, margin: '-80px' });

  const cards: Card[] = [
    {
      id: 1,
      // Cabello opaco / cabello brillante y sedoso liso
      before: '/images/before-after/before-long-damaged.png',
      after:  '/images/before-after/after-long-smooth.png',
      benefit: '+ Brillo y suavidad',
    },
    {
      id: 2,
      // Cabello con pérdida / cabello abundante y saludable
      before: '/images/before-after/before-medium-smooth.png',
      after:  '/images/before-after/after-medium-smooth.png',
      benefit: '+ Crecimiento saludable',
    },
    {
      id: 3,
      // Cabello esponjado con frizz / liso controlado y brillante
      before: 'https://images.unsplash.com/photo-1618609378039-b572f369f2a8?w=600&q=85',
      after:  'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=85',
      benefit: '+ Control del frizz',
    },
    {
      id: 4,
      // Cabello sin vida / nutrido, con textura y movimiento
      before: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=85',
      after:  'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&q=85',
      benefit: '+ Fuerza y nutrición',
    },
    {
      id: 5,
      // Rizos indefinidos / rizos definidos con humedad y forma
      before: 'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=600&q=85',
      after:  'https://images.unsplash.com/photo-1590065707046-4fde65275b2e?w=600&q=85',
      benefit: '+ Rizos definidos',
    },
    {
      id: 6,
      // Cabello fino / volumen suave y natural
      before: 'https://images.unsplash.com/photo-1522337094846-8a818192de1f?w=600&q=85',
      after:  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&q=85',
      benefit: '+ Volumen natural',
    },
    {
      id: 7,
      // Cabello quebradizo y opaco / hidratado y sellado
      before: 'https://images.unsplash.com/photo-1523263685509-57c1d050d19b?w=600&q=85',
      after:  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=600&q=85',
      benefit: '+ Hidratación intensa',
    },
    {
      id: 8,
      // Cabello con daño y opacidad / color vibrante y recuperado
      before: 'https://images.unsplash.com/photo-1576097449798-7c7f90e1248a?w=600&q=85',
      after:  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=85',
      benefit: '+ Reparación capilar',
    },
  ];

  return (
    <section ref={sectionRef} id="resultados" className="py-20 bg-[#F7F5F1] overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-14">

        {/* ── ENCABEZADO ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65 }}
          className="grid md:grid-cols-2 gap-8 items-start mb-12"
        >
          {/* Izquierda */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-6 h-px bg-stone-400" />
              <span className="text-[10px] tracking-[0.35em] uppercase text-stone-500 font-medium">
                Resultados reales
              </span>
            </div>
            <h2
              className="text-4xl md:text-5xl lg:text-6xl font-light text-stone-900 leading-none"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Antes{' '}
              <span className="font-medium" style={{ color: OLIVE }}>&</span>{' '}
              Después
            </h2>
          </div>

          {/* Derecha */}
          <div className="md:pt-8 flex flex-col gap-5 items-start md:items-end">
            <p className="text-sm text-stone-500 leading-relaxed max-w-xs text-left md:text-right">
              Cada imagen es una historia real de transformación con lo natural.
              Clientes reales, sin filtros, sin retoques.
            </p>
            <motion.a
              href="#catalogo"
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-stone-300 text-stone-700 text-[11px] tracking-[0.18em] uppercase font-medium rounded-full hover:border-stone-500 hover:text-stone-900 transition-all"
            >
              Ver más resultados
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </motion.a>
          </div>
        </motion.div>

        {/* ── GALERÍA — 2 filas × 4 columnas ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {/* Fila 1 */}
          {cards.slice(0, 4).map((card, i) => (
            <ComparisonCard key={card.id} card={card} index={i} inView={inView} />
          ))}
          {/* Fila 2 */}
          {cards.slice(4).map((card, i) => (
            <ComparisonCard key={card.id} card={card} index={i + 4} inView={inView} />
          ))}
        </div>

        {/* ── CIERRE con línea y hoja ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.9 }}
          className="flex items-center justify-center gap-4"
        >
          <div className="w-16 h-px bg-stone-300" />
          
          <div className="w-16 h-px bg-stone-300" />
        </motion.div>
      </div>
    </section>
  );
}

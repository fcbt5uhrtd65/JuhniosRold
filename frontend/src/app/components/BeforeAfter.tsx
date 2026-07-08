import { useRef, useState } from 'react';
import { motion, useInView } from 'motion/react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

const OLIVE = '#2D3A1F';

interface Card {
  id: number;
  before: string;
  after: string;
  benefit: string;
  title: string;
}

const cards: Card[] = [
  {
    id: 1,
    before: '/images/before-after/before-1.png',
    after: '/images/before-after/after-1.png',
    benefit: '+ Rizos definidos y controlados',
    title: 'Transformacion rizada frontal',
  },
  {
    id: 2,
    before: '/images/before-after/before-2.png',
    after: '/images/before-after/after-2.png',
    benefit: '+ Suavidad y movimiento',
    title: 'Transformacion lisa lateral',
  },
  {
    id: 3,
    before: '/images/before-after/before-3.png',
    after: '/images/before-after/after-3.png',
    benefit: '+ Brillo y nutricion',
    title: 'Transformacion larga frontal',
  },
  {
    id: 4,
    before: '/images/before-after/before-4.png',
    after: '/images/before-after/after-4.png',
    benefit: '+ Definicion con menos frizz',
    title: 'Transformacion rizada lateral',
  },
  {
    id: 5,
    before: '/images/before-after/before-5.png',
    after: '/images/before-after/after-5.png',
    benefit: '+ Largo sellado y brillante',
    title: 'Transformacion lisa posterior',
  },
];

function ComparisonCard({ card, index, inView }: { card: Card; index: number; inView: boolean }) {
  const [pos, setPos] = useState(50);
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
      transition={{ delay: index * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden rounded-lg bg-stone-100 shadow-sm border border-stone-200"
    >
      <div
        ref={ref}
        className="relative aspect-[4/5] select-none bg-stone-200"
        style={{ cursor: 'ew-resize', touchAction: 'none' }}
        onMouseDown={(e) => { setDragging(true); update(e.clientX); }}
        onMouseMove={(e) => { if (dragging) update(e.clientX); }}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onTouchStart={(e) => { setDragging(true); update(e.touches[0].clientX); }}
        onTouchMove={(e) => { e.preventDefault(); if (dragging) update(e.touches[0].clientX); }}
        onTouchEnd={() => setDragging(false)}
      >
        <img
          src={card.after}
          alt={`${card.title} despues`}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />

        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        >
          <img
            src={card.before}
            alt={`${card.title} antes`}
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        </div>

        <div
          className="absolute top-0 bottom-0 z-20 w-px bg-white/90 pointer-events-none"
          style={{ left: `${pos}%` }}
        >
          <div className="absolute top-1/2 left-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
            <motion.div
              animate={{ scale: dragging ? 1.15 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md"
            >
              <ChevronLeft className="h-3 w-3 text-stone-600" strokeWidth={2} />
              <ChevronRight className="h-3 w-3 text-stone-600" strokeWidth={2} />
            </motion.div>
          </div>
        </div>

        <div className="absolute top-3 left-3 z-20 pointer-events-none">
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.2em] text-stone-700 shadow-sm">
            Antes
          </span>
        </div>
        <div className="absolute top-3 right-3 z-20 pointer-events-none">
          <span
            className="rounded-full px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.2em] text-white shadow-sm"
            style={{ backgroundColor: OLIVE }}
          >
            Despues
          </span>
        </div>
      </div>

      <div className="flex min-h-[52px] items-center gap-2 bg-white px-4 py-3">
        <div className="h-1 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: OLIVE }} />
        <span className="text-[11px] font-medium tracking-wide text-stone-700">{card.benefit}</span>
      </div>
    </motion.div>
  );
}

export function BeforeAfter() {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-80px' });

  return (
    <section ref={sectionRef} id="resultados" className="overflow-hidden bg-[#F7F5F1] py-20">
      <div className="mx-auto max-w-[1400px] px-6 md:px-10 lg:px-14">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65 }}
          className="mb-12 grid items-start gap-8 md:grid-cols-2"
        >
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px w-6 bg-stone-400" />
              <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-stone-500">
                Resultados reales
              </span>
            </div>
            <h2
              className="text-4xl font-light leading-none text-stone-900 md:text-5xl lg:text-6xl"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Antes <span className="font-medium" style={{ color: OLIVE }}>&</span> Despues
            </h2>
          </div>

          <div className="flex flex-col items-start gap-5 md:items-end md:pt-8">
            <p className="max-w-xs text-left text-sm leading-relaxed text-stone-500 md:text-right">
              Arrastra cada imagen para comparar los resultados reales de cada proceso.
            </p>
            <motion.a
              href="#catalogo"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-stone-700 transition-all hover:border-stone-500 hover:text-stone-900"
            >
              Ver catalogo
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </motion.a>
          </div>
        </motion.div>

        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map((card, i) => (
            <ComparisonCard key={card.id} card={card} index={i} inView={inView} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6 }}
          className="flex items-center justify-center gap-4"
        >
          <div className="h-px w-16 bg-stone-300" />
          <div className="h-px w-16 bg-stone-300" />
        </motion.div>
      </div>
    </section>
  );
}

import { useState, useRef } from 'react';
import { motion, useInView } from 'motion/react';

const OLIVE = '#2D3A1F';
const CREAM = '#F5F3EE';

// Íconos SVG lineales minimalistas
const IconLeaf = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M11 20C11 20 2 14 2 7.5C2 4 4.8 2 7.5 2C9 2 10.2 2.7 11 3.7C11.8 2.7 13 2 14.5 2C17.2 2 20 4 20 7.5C20 14 11 20 11 20Z"
      stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    <line x1="11" y1="20" x2="11" y2="4.5" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 2" strokeLinecap="round" />
  </svg>
);
const IconDrop = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <path d="M11 3L17 11C17 15 14.3 18.5 11 18.5C7.7 18.5 5 15 5 11L11 3Z"
      stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconStar = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.2" />
    <path d="M11 7V15M7 11H15" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const TABS = ['Fórmulas', 'Ingredientes', 'Laboratorio', 'Rituales'];

export function Laboratorio() {
  const [tab, setTab] = useState('Laboratorio');
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-60px' });

  const metrics = [
    {
      pct: '98%',
      label: 'Natural',
      desc: 'Ingredientes de origen botánico, seleccionados por su eficacia comprobada.',
      icon: <IconLeaf />,
    },
    {
      pct: '0%',
      label: 'Sin rellenos',
      desc: 'Sin sulfatos, parabenos ni siliconas. Solo lo que tu cabello necesita.',
      icon: <IconDrop />,
    },
    {
      pct: '100%',
      label: 'Cruelty Free',
      desc: 'Desarrollado con respeto: sin pruebas en animales, en ninguna etapa.',
      icon: <IconStar />,
    },
  ];

  return (
    <section ref={sectionRef} className="py-20 overflow-hidden" style={{ backgroundColor: CREAM }}>
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-14">

        {/* ── TABS ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-0 border-b border-stone-200 mb-14"
        >
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="relative px-6 py-3.5 text-[11px] tracking-[0.2em] uppercase font-medium transition-colors"
              style={{ color: t === tab ? OLIVE : '#9ca3af' }}
            >
              {t}
              {t === tab && (
                <motion.div
                  layoutId="lab-tab-line"
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                  style={{ backgroundColor: OLIVE }}
                />
              )}
            </button>
          ))}
        </motion.div>

        {/* ── HERO: eyebrow + título + imagen + apoyo ── */}
        <div className="grid lg:grid-cols-[1fr_1.15fr_0.65fr] gap-8 items-start mb-14">

          {/* Izquierda: texto */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7 }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-6 h-px bg-stone-400" />
              <span className="text-[9px] tracking-[0.38em] uppercase text-stone-400 font-medium">
                Ciencia + Naturaleza
              </span>
            </div>
            <h2
              className="text-5xl md:text-6xl lg:text-7xl font-light text-stone-900 leading-[1.05]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Formulado<br />
              <em
                className="not-italic font-semibold"
                style={{ fontStyle: 'italic', color: OLIVE }}
              >
                para quien
              </em>
              <br />
              exige más.
            </h2>
            <div className="w-8 h-0.5 mt-5 rounded-full" style={{ backgroundColor: OLIVE }} />
          </motion.div>

          {/* Centro: imagen editorial */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="relative aspect-[4/3] rounded-2xl overflow-hidden"
          >
            <img
              src="https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=900&q=85"
              alt="Laboratorio natural Juhnios Rold"
              className="w-full h-full object-cover"
              draggable={false}
            />
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ background: 'linear-gradient(to bottom, transparent 60%, rgba(245,243,238,0.4))' }}
            />
          </motion.div>

          {/* Derecha: texto apoyo */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="flex flex-col gap-6 pt-2 lg:pt-8"
          >
            {[
              { icon: <IconLeaf />, text: 'Cada ingrediente elegido con criterio científico.' },
              { icon: <IconStar />, text: 'Cada fórmula probada para resultados reales.' },
            ].map(({ icon, text }, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${OLIVE}12`, color: OLIVE }}
                >
                  {icon}
                </div>
                <p className="text-sm text-stone-500 leading-relaxed pt-1.5">{text}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── MÉTRICAS — card oscura ── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: '#1A1A18' }}
        >
          <div className="grid md:grid-cols-3">
            {metrics.map(({ pct, label, desc, icon }, i) => (
              <div
                key={label}
                className={`flex flex-col items-center text-center px-8 py-10 ${
                  i < 2 ? 'md:border-r border-white/10' : ''
                }`}
              >
                {/* Ícono */}
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center mb-6"
                  style={{ backgroundColor: `${OLIVE}40`, color: '#A8B89A' }}
                >
                  {icon}
                </div>

                {/* Porcentaje */}
                <div
                  className="text-5xl md:text-6xl font-light text-white leading-none mb-3"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {pct}
                </div>

                {/* Label */}
                <div
                  className="text-[9px] tracking-[0.3em] uppercase font-medium mb-4"
                  style={{ color: '#A8B89A' }}
                >
                  {label}
                </div>

                {/* Descripción */}
                <p className="text-xs text-white/40 leading-relaxed max-w-[200px]">{desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

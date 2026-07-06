import { useState, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { ArrowRight } from 'lucide-react';

const OLIVE = '#2D3A1F';
const CREAM = '#F7F5F1';

interface Oil {
  index: string;
  name: string;
  subtitle: string;
  detail: string;         // descripción larga solo para el item activo
  purity: string;
  origin: string;
  compound: string;
  image: string;          // imagen grande del lado izquierdo
  thumb: string;          // miniatura circular en la lista
}

const oils: Oil[] = [
  {
    index: '01',
    name: 'Aceite de Romero',
    subtitle: 'Estimula y fortalece',
    detail: 'Activa la circulación del cuero cabelludo y estimula el crecimiento natural del cabello desde la raíz.',
    purity: '100% puro',
    origin: 'España',
    compound: 'Rosmarinus officinalis',
    image: '/images/oils/aceite-romero.png',
    thumb: '/images/oils/aceite-romero.png',
  },
  {
    index: '02',
    name: 'Aceite de Argán',
    subtitle: 'Reparación y elasticidad',
    detail: 'Restaura el brillo natural. Alto contenido de vitamina E y ácidos grasos esenciales para una reparación profunda.',
    purity: '100% puro',
    origin: 'Marruecos',
    compound: 'Argania spinosa',
    // Nueces de argán, aceite dorado, fondo neutro — muy limpio
    image: '/images/oils/aceite-argan.png',
    thumb: '/images/oils/aceite-argan.png',
  },
  {
    index: '03',
    name: 'Aceite de Quina',
    subtitle: 'Vitalidad y resistencia',
    detail: 'Ayuda a fortalecer la fibra capilar y acompaña rituales de cuidado para un cabello con apariencia más fuerte y saludable.',
    purity: '100% puro',
    origin: 'Andes',
    compound: 'Cinchona officinalis',
    image: '/images/oils/aceite-quina.png',
    thumb: '/images/oils/aceite-quina.png',
  },
  {
    index: '04',
    name: 'Aceite de Cebolla',
    subtitle: 'Fuerza y crecimiento',
    detail: 'Estimula el cuero cabelludo y aporta nutrición para apoyar una rutina capilar enfocada en fortaleza, brillo y crecimiento.',
    purity: '100% puro',
    origin: 'Colombia',
    compound: 'Allium cepa',
    image: '/images/oils/aceite-cebolla.png',
    thumb: '/images/oils/aceite-cebolla.png',
  },
];

export function OilsSection() {
  const [active, setActive] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-80px' });

  const oil = oils[active];

  return (
    <section ref={sectionRef} className="py-12 md:py-20 overflow-hidden" style={{ backgroundColor: CREAM }}>
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-14">

        {/* ── ENCABEZADO ── */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65 }}
          className="grid md:grid-cols-2 gap-6 items-start mb-12"
        >
          {/* Izquierda: eyebrow + título */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[9px] tracking-[0.42em] uppercase text-stone-400 font-medium">
                Esencias naturales
              </span>
              <div className="w-8 h-px bg-stone-300" />
            </div>
            <h2
              className="text-5xl md:text-6xl font-light text-stone-900 leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Aceites{' '}
              <em
                className="not-italic font-semibold"
                style={{ fontStyle: 'italic', color: OLIVE }}
              >
                Puros
              </em>
            </h2>
          </div>

          {/* Derecha: descripción */}
          <div className="md:pt-6">
            <p className="text-sm text-stone-500 leading-relaxed max-w-sm">
              Ingredientes de máxima pureza, seleccionados de los mejores orígenes
              del mundo para el cuidado profesional de tu cabello.
            </p>
          </div>
        </motion.div>

        {/* ── CUERPO: 2 columnas ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-8 lg:gap-10 items-start">

          {/* COLUMNA IZQUIERDA — imagen grande */}
          <motion.div
            initial={{ opacity: 0, x: -32 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-stone-200">
              <AnimatePresence mode="wait">
                <motion.img
                  key={active}
                  src={oil.image}
                  alt={oil.name}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.55 }}
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
              </AnimatePresence>

              {/* Gradiente suave abajo para la tarjeta */}
              <div
                className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 100%)' }}
              />

              {/* Tarjeta flotante "ORIGEN" */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`badge-${active}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.25 }}
                  className="absolute bottom-5 left-5 rounded-xl border border-white/20 backdrop-blur-md px-4 py-3"
                  style={{ backgroundColor: 'rgba(247,245,241,0.90)' }}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[8px] tracking-[0.32em] uppercase text-stone-400 font-medium">
                      Origen
                    </span>
                    {/* pequeño ícono hoja */}
                    <svg width="10" height="9" viewBox="0 0 10 9" fill="none">
                      <path d="M5 8.5C5 8.5 0.5 5.8 0.5 3C0.5 1.4 1.9 0.5 3.2 0.5C3.9 0.5 4.5 0.8 5 1.3C5.5 0.8 6.1 0.5 6.8 0.5C8.1 0.5 9.5 1.4 9.5 3C9.5 5.8 5 8.5 5 8.5Z"
                        stroke="#8B7355" strokeWidth="0.7" fill="none" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="text-sm font-medium text-stone-800">{oil.origin}</div>
                  <div className="text-[9px] text-stone-400 italic mt-0.5">{oil.compound}</div>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* COLUMNA DERECHA — lista + detalle */}
          <motion.div
            initial={{ opacity: 0, x: 32 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.85, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col"
          >
            {/* Lista de aceites */}
            <div className="flex flex-col">
              {oils.map((o, i) => {
                const isActive = i === active;
                return (
                  <motion.button
                    key={o.index}
                    onClick={() => setActive(i)}
                    initial={{ opacity: 0, x: 16 }}
                    animate={inView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.2 + i * 0.07 }}
                    className={`w-full text-left transition-all duration-300 ${
                      isActive
                        ? 'rounded-xl mb-1'
                        : 'border-b border-stone-200 last:border-b-0'
                    }`}
                    style={isActive ? { backgroundColor: 'white', border: `1px solid ${OLIVE}22` } : {}}
                  >
                    {/* Fila siempre visible */}
                    <div className={`flex items-center gap-4 ${isActive ? 'px-5 pt-5 pb-4' : 'py-4'}`}>
                      {/* Número */}
                      <span className="text-[10px] font-mono text-stone-300 flex-shrink-0 w-5 text-right">
                        {o.index}
                      </span>

                      {/* Miniatura circular */}
                      <div
                        className={`rounded-full overflow-hidden flex-shrink-0 transition-all duration-300 ${
                          isActive ? 'w-14 h-14' : 'w-10 h-10'
                        }`}
                      >
                        <img src={o.thumb} alt={o.name} className="w-full h-full object-cover" draggable={false} />
                      </div>

                      {/* Nombre + beneficio */}
                      <div className="flex-1 min-w-0">
                        <div
                          className={`font-light text-stone-900 leading-snug transition-all duration-300 ${
                            isActive ? 'text-xl' : 'text-base'
                          }`}
                          style={{ fontFamily: "'Playfair Display', serif" }}
                        >
                          {o.name}
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5">{o.subtitle}</div>
                      </div>

                      {/* Flecha / botón circular */}
                      {isActive ? (
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: OLIVE }}
                        >
                          <ArrowRight className="w-4 h-4 text-white" strokeWidth={2} />
                        </div>
                      ) : (
                        <ArrowRight
                          className="w-3.5 h-3.5 text-stone-300 flex-shrink-0"
                          strokeWidth={1.5}
                        />
                      )}
                    </div>

                    {/* Detalle expandido — solo para el activo */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-5">
                            <p className="text-[11px] text-stone-500 leading-relaxed">
                              {o.detail}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>

            {/* Texto descriptivo del aceite activo */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`desc-${active}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
                className="mt-7 mb-5"
              >
                <p className="text-sm text-stone-500 leading-relaxed">
                  Repara y fortalece desde la raíz. Rico en vitaminas A, D, E y K para
                  una hidratación duradera y un cabello visiblemente más saludable.
                </p>
              </motion.div>
            </AnimatePresence>

            {/* Cards PUREZA + CERTIFICADO */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { label: 'Pureza',      value: oil.purity },
                { label: 'Certificado', value: 'Orgánico' },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="rounded-xl border border-stone-200 px-5 py-4 bg-white"
                >
                  <div className="text-[8px] tracking-[0.3em] uppercase text-stone-400 mb-1.5 font-medium">
                    {label}
                  </div>
                  <div className="text-base font-medium text-stone-800">{value}</div>
                </div>
              ))}
            </div>

            {/* CTA ancho */}
            <motion.a
              href="#catalogo"
              whileHover={{ opacity: 0.88, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-between px-7 py-4 text-white text-[11px] tracking-[0.25em] uppercase font-semibold rounded-xl transition-opacity"
              style={{ backgroundColor: OLIVE }}
            >
              Ver detalles del producto
              <ArrowRight className="w-4 h-4" strokeWidth={2} />
            </motion.a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

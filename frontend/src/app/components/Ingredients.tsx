import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Sun, Moon, ArrowRight } from 'lucide-react';

/* ─────────────────────────────────────────
   DATA
───────────────────────────────────────── */
const ingredientSlides = [
  { name: 'Keratina',  tagline: 'Reestructura desde el interior',  image: 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=1920&q=80' },
  { name: 'Romero',    tagline: 'Despierta lo que estaba dormido',  image: 'https://images.unsplash.com/photo-1596401885239-34d567b41b5e?w=1920&q=80' },
  { name: 'Cebolla',   tagline: 'Fortaleza natural y visible',      image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=1920&q=80' },
  { name: 'Aguacate',  tagline: 'Nutrición profunda que se siente', image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=1920&q=80' },
  { name: 'Almendras', tagline: 'Hidratación que permanece',        image: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=1920&q=80' },
  { name: 'Lino',      tagline: 'Control sin esfuerzo',             image: 'https://images.unsplash.com/photo-1628773822503-930a7eaecf80?w=1920&q=80' },
];

type RitualType = 'morning' | 'night';
const rituals = {
  morning: {
    title: 'Ritual de Mañana', subtitle: 'Energiza y protege', icon: Sun,
    formula: 'JR-AM-01',
    steps: [
      { number: '01', label: 'LIMPIEZA', title: 'Limpiar',    product: 'Aceite de Cebolla',    description: 'Estimula el cuero cabelludo mientras elimina impurezas acumuladas durante la noche.', time: '2 min', compound: 'Allium cepa extract' },
      { number: '02', label: 'NUTRICIÓN', title: 'Nutrir',    product: 'Aceite de Aguacate',   description: 'Hidrata profundamente con vitaminas A, D y E. Protege contra agresores externos del día.', time: '3 min', compound: 'Persea gratissima oil' },
      { number: '03', label: 'SELLADO',  title: 'Sellar',     product: 'Silicona de Lino',     description: 'Sella la cutícula y controla el frizz durante todo el día sin residuos pesados.',  time: '1 min', compound: 'Linum usitatissimum seed' },
    ],
  },
  night: {
    title: 'Ritual de Noche', subtitle: 'Repara y regenera', icon: Moon,
    formula: 'JR-PM-02',
    steps: [
      { number: '01', label: 'ACTIVACIÓN', title: 'Tratar',      product: 'Aceite de Romero',     description: 'Activa la circulación del cuero cabelludo para estimular el crecimiento mientras duermes.', time: '2 min', compound: 'Rosmarinus officinalis' },
      { number: '02', label: 'RECONSTRUCCIÓN', title: 'Reconstruir', product: 'Tratamiento Keratina', description: 'Proteína pura que penetra la fibra capilar y repara daños del día a profundidad.',         time: '5 min', compound: 'Hydrolyzed keratin' },
      { number: '03', label: 'PROTECCIÓN', title: 'Proteger',    product: 'Aceite de Almendras',  description: 'Sella la nutrición nocturna y aporta brillo duradero visible desde la mañana.',           time: '1 min', compound: 'Prunus amygdalus dulcis' },
    ],
  },
};

const labStats = [
  { value: '98%',  label: 'Natural',       caption: 'Ingredientes de origen botánico, seleccionados por su eficacia comprobada.' },
  { value: '0%',   label: 'Sin rellenos',  caption: 'Sin sulfatos, parabenos ni siliconas. Solo lo que tu cabello necesita.' },
  { value: '100%', label: 'Cruelty free',  caption: 'Desarrollado con respeto: sin pruebas en animales, en ninguna etapa.' },
];

/* ─────────────────────────────────────────
   TABS
───────────────────────────────────────── */
type Tab = 'ingredientes' | 'laboratorio' | 'rituales';
const TABS: { id: Tab; label: string }[] = [
  { id: 'ingredientes', label: 'Ingredientes' },
  { id: 'laboratorio',  label: 'Laboratorio'  },
  { id: 'rituales',     label: 'Rituales'     },
];

/* ─────────────────────────────────────────
   PANEL — INGREDIENTES
───────────────────────────────────────── */
function PanelIngredientes() {
  const [idx, setIdx] = useState(0);
  const next = () => setIdx(p => (p + 1) % ingredientSlides.length);
  const prev = () => setIdx(p => (p - 1 + ingredientSlides.length) % ingredientSlides.length);

  useEffect(() => { const t = setInterval(next, 8000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const slide = ingredientSlides[idx];

  return (
    <div className="relative flex-1 overflow-hidden bg-black">
      {/* Progress bar */}
      <div className="absolute top-0 inset-x-0 h-px bg-white/10 overflow-hidden z-20">
        <motion.div key={idx} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
          transition={{ duration: 8, ease: 'linear' }} className="h-full bg-white/40 origin-left" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={idx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} className="absolute inset-0">
          <motion.div initial={{ scale: 1.1 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }} className="absolute inset-0">
            <div className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${slide.image})`, filter: 'brightness(0.32) contrast(1.1) saturate(1.1)' }} />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />

          <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
            <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -60 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}>
              <div className="mb-6">
                <span className="text-[10px] tracking-[0.4em] uppercase text-white/50">
                  {String(idx + 1).padStart(2, '0')} / {String(ingredientSlides.length).padStart(2, '0')}
                </span>
              </div>
              <h2 className="text-7xl md:text-8xl lg:text-9xl mb-8 font-serif text-white leading-none tracking-tight">{slide.name}</h2>
              <p className="text-2xl md:text-3xl text-white/90 font-light max-w-3xl leading-relaxed">{slide.tagline}</p>
              <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
                transition={{ duration: 1.2, delay: 0.6, ease: 'easeOut' }}
                className="h-px w-32 bg-white/30 mx-auto mt-12" />
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      <button onClick={prev} aria-label="Anterior"
        className="absolute left-6 top-1/2 -translate-y-1/2 p-3 text-white/60 hover:text-white transition-colors z-10">
        <ChevronLeft className="w-8 h-8" strokeWidth={1} />
      </button>
      <button onClick={next} aria-label="Siguiente"
        className="absolute right-6 top-1/2 -translate-y-1/2 p-3 text-white/60 hover:text-white transition-colors z-10">
        <ChevronRight className="w-8 h-8" strokeWidth={1} />
      </button>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {ingredientSlides.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)} aria-label={`Ingrediente ${i + 1}`}>
            <div className={`h-px transition-all duration-500 ${i === idx ? 'w-12 bg-white' : 'w-8 bg-white/30 hover:bg-white/50'}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   PANEL — LABORATORIO (premium minimal)
───────────────────────────────────────── */
function PanelLaboratorio() {
  return (
    <div className="flex-1 flex flex-col bg-secondary overflow-hidden">
      <div className="flex-1 flex flex-col max-w-[1400px] mx-auto w-full px-5 sm:px-8 md:px-12 py-12 md:py-20">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-3 mb-8 md:mb-10">
            <div className="h-px w-6 bg-foreground/30" />
            <span className="text-[9px] tracking-[0.45em] uppercase text-muted-foreground">CIENCIA + NATURALEZA</span>
          </div>

          <div className="flex items-end justify-between gap-8 flex-wrap mb-10 md:mb-16">
            <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-none tracking-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}>
              Formulado<br />
              <span className="text-muted-foreground">para quien</span><br />
              exige más.
            </h2>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              Cada ingrediente elegido con criterio científico.<br />
              Cada fórmula probada para resultados reales.
            </p>
          </div>
        </motion.div>

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-3 gap-px bg-border"
        >
          {labStats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="group bg-foreground text-background px-3 sm:px-6 md:px-10 py-6 md:py-12 text-center"
            >
              <div className="text-2xl sm:text-4xl md:text-6xl mb-2 md:mb-3 tracking-tight">{s.value}</div>
              <div className="text-[9px] sm:text-[10px] tracking-[0.2em] sm:tracking-[0.3em] uppercase opacity-60 mb-2">{s.label}</div>
              <p className="text-[11px] opacity-40 leading-relaxed hidden md:block">{s.caption}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Formula strip */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="mt-8 pt-6 border-t border-border flex items-center gap-8 overflow-x-auto scrollbar-hide"
        >
          {['Keratina Hidrolizada · 15%', 'Aceite de Argán · 12%', 'Proteína de Seda · 10%', 'Complejo B5 · 8%'].map((item) => (
            <span key={item} className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground whitespace-nowrap">{item}</span>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   PANEL — RITUALES (lab-aesthetic)
───────────────────────────────────────── */
function PanelRituales() {
  const [active, setActive] = useState<RitualType>('morning');
  const ritual = rituals[active];
  const Icon = ritual.icon;
  const totalTime = ritual.steps.reduce((s, st) => s + parseInt(st.time), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-background relative">
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'radial-gradient(circle, #0a0a0a 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative max-w-[1400px] mx-auto px-5 sm:px-8 md:px-12 py-12 md:py-20">

        {/* Header row */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10 md:mb-14"
        >
          {/* Label + formula ref */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="h-px w-6 bg-foreground/30" />
              <span className="text-[9px] tracking-[0.4em] uppercase text-muted-foreground">PROTOCOLO DIARIO</span>
            </div>
            <span className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground/40 font-mono hidden md:block">
              REF: {ritual.formula}
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
            <h2 className="text-3xl sm:text-4xl md:text-6xl leading-none text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Rituales de<br />Belleza
            </h2>

            {/* Toggle — lab style */}
            <div className="flex items-center gap-0 border border-border bg-secondary/50 self-start md:self-auto">
              {(['morning', 'night'] as RitualType[]).map((type) => {
                const TIcon = rituals[type].icon;
                const isActive = active === type;
                return (
                  <button
                    key={type} onClick={() => setActive(type)}
                    className={`relative flex items-center gap-2 px-4 sm:px-6 py-3 text-[9px] tracking-[0.25em] uppercase transition-all duration-300 ${
                      isActive ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <TIcon className="w-3 h-3" strokeWidth={1.5} />
                    {type === 'morning' ? 'Mañana' : 'Noche'}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Protocol header */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
          >
            {/* Protocol meta strip */}
            <div className="flex items-center justify-between py-4 border-y border-border mb-0">
              <div className="flex items-center gap-4 md:gap-6">
                <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
                <div>
                  <div className="text-xs text-foreground">{ritual.title}</div>
                  <div className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground">{ritual.subtitle}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[9px] tracking-[0.25em] uppercase text-muted-foreground font-mono">
                <span className="hidden sm:inline">T·TOTAL</span>
                <span className="text-foreground/60">{totalTime} min</span>
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-0">
              {ritual.steps.map((step, i) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="group py-5 md:py-7 border-b border-border hover:bg-secondary/40 transition-colors px-2 -mx-2"
                >
                  {/* Mobile layout */}
                  <div className="flex items-start gap-3 md:hidden">
                    <div className="flex flex-col gap-0.5 pt-0.5 shrink-0 w-8">
                      <span className="text-[7px] tracking-[0.3em] uppercase text-muted-foreground/50 font-mono">STEP</span>
                      <span className="text-[11px] text-foreground font-mono">{step.number}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] tracking-[0.25em] uppercase text-foreground/60 mb-1">{step.label}</div>
                      <div className="text-sm text-foreground mb-0.5">{step.product}</div>
                      <div className="text-[9px] text-muted-foreground/50 font-mono italic mb-2">{step.compound}</div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                    <div className="text-[9px] text-muted-foreground font-mono shrink-0">{parseInt(step.time)}m</div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden md:grid grid-cols-12 gap-8">
                    <div className="col-span-1 flex flex-col gap-1 pt-0.5">
                      <span className="text-[8px] tracking-[0.3em] uppercase text-muted-foreground/50 font-mono">STEP</span>
                      <span className="text-xs text-foreground font-mono">{step.number}</span>
                    </div>
                    <div className="col-span-2 pt-0.5">
                      <div className="text-[8px] tracking-[0.35em] uppercase text-muted-foreground/50 mb-1">FASE</div>
                      <div className="text-[10px] tracking-[0.2em] uppercase text-foreground/70">{step.label}</div>
                    </div>
                    <div className="col-span-3 pt-0.5">
                      <div className="text-sm text-foreground mb-1">{step.product}</div>
                      <div className="text-[9px] text-muted-foreground/50 font-mono italic">{step.compound}</div>
                    </div>
                    <div className="col-span-5 pt-0.5">
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                    <div className="col-span-1 pt-0.5 flex flex-col items-end gap-1">
                      <span className="text-[8px] tracking-[0.3em] uppercase text-muted-foreground/40 font-mono">MIN</span>
                      <span className="text-xs text-muted-foreground font-mono">{parseInt(step.time)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              className="mt-8 md:mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3 text-[9px] tracking-[0.3em] uppercase text-muted-foreground/50 font-mono">
                <span>JR / {ritual.formula}</span>
                <div className="h-px w-8 bg-border" />
                <span>{totalTime} min · {ritual.steps.length} pasos</span>
              </div>
              <motion.a
                href="#catalogo" whileHover={{ x: 5 }}
                className="flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase text-foreground hover:opacity-60 transition-opacity"
              >
                Comprar el ritual
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </motion.a>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────── */
export function Ingredients() {
  const [activeTab, setActiveTab] = useState<Tab>('ingredientes');
  const isDark = activeTab === 'ingredientes';

  return (
    <section className="relative flex flex-col" style={{ minHeight: '100svh' }}>
      {/* Tab Bar */}
      <div
        className={`relative z-30 transition-colors duration-600 ${
          isDark ? 'bg-black/70 backdrop-blur-sm' : 'bg-background border-b border-border'
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 flex items-center gap-0">
          <span className={`text-[8px] tracking-[0.4em] uppercase mr-10 hidden sm:block transition-colors duration-500 ${isDark ? 'text-white/30' : 'text-muted-foreground/60'}`}>
            FÓRMULAS
          </span>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`relative px-5 py-4 text-[9px] tracking-[0.3em] uppercase transition-all duration-300 ${
                  isDark
                    ? isActive ? 'text-white' : 'text-white/35 hover:text-white/60'
                    : isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="tab-underline"
                    className={`absolute bottom-0 left-0 right-0 h-px ${isDark ? 'bg-white/70' : 'bg-foreground'}`}
                    transition={{ type: 'spring', stiffness: 500, damping: 45 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel */}
      <div className="flex-1 flex flex-col" style={{ minHeight: 'calc(100svh - 49px)' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'ingredientes' && (
            <motion.div key="ingredientes" className="flex-1 flex flex-col"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}>
              <PanelIngredientes />
            </motion.div>
          )}
          {activeTab === 'laboratorio' && (
            <motion.div key="laboratorio" className="flex-1 flex flex-col"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}>
              <PanelLaboratorio />
            </motion.div>
          )}
          {activeTab === 'rituales' && (
            <motion.div key="rituales" className="flex-1 flex flex-col"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}>
              <PanelRituales />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
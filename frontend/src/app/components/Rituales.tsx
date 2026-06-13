import { useState, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { Sun, Moon, Clock, ArrowRight } from 'lucide-react';

const OLIVE = '#2D3A1F';
const CREAM = '#F7F5F1';

type RitualType = 'morning' | 'night';

const TABS = ['Fórmulas', 'Ingredientes', 'Laboratorio', 'Rituales'];

// Miniaturas circulares por producto
const PRODUCT_THUMBS: Record<string, string> = {
  'Aceite de Cebolla':
    'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=160&q=80',
  'Aceite de Aguacate':
    'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=160&q=80',
  'Silicona de Lino':
    'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=160&q=80',
  'Aceite de Romero':
    'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=160&q=80',
  'Tratamiento Keratina':
    'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=160&q=80',
  'Aceite de Almendras':
    'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=160&q=80',
};

interface Step {
  number: string;
  phase: string;
  product: string;
  scientific: string;
  description: string;
  min: number;
}

const rituals: Record<RitualType, {
  title: string;
  subtitle: string;
  ref: string;
  totalMin: number;
  steps: Step[];
}> = {
  morning: {
    title: 'Ritual de Mañana',
    subtitle: 'Energiza y protege',
    ref: 'JR-AM-01',
    totalMin: 6,
    steps: [
      {
        number: '01',
        phase: 'Limpieza',
        product: 'Aceite de Cebolla',
        scientific: 'Allium cepa extract',
        description:
          'Estimula el cuero cabelludo mientras elimina impurezas acumuladas durante la noche.',
        min: 2,
      },
      {
        number: '02',
        phase: 'Nutrición',
        product: 'Aceite de Aguacate',
        scientific: 'Persea gratissima oil',
        description:
          'Hidrata profundamente con vitaminas A, D y E. Protege contra agresores externos del día.',
        min: 3,
      },
      {
        number: '03',
        phase: 'Sellado',
        product: 'Silicona de Lino',
        scientific: 'Linum usitatissimum seed',
        description:
          'Sella la cutícula y controla el frizz durante todo el día sin residuos pesados.',
        min: 1,
      },
    ],
  },
  night: {
    title: 'Ritual de Noche',
    subtitle: 'Repara y regenera',
    ref: 'JR-PM-01',
    totalMin: 8,
    steps: [
      {
        number: '01',
        phase: 'Tratamiento',
        product: 'Aceite de Romero',
        scientific: 'Rosmarinus officinalis oil',
        description:
          'Activa la circulación del cuero cabelludo y estimula el crecimiento mientras duermes.',
        min: 2,
      },
      {
        number: '02',
        phase: 'Reconstrucción',
        product: 'Tratamiento Keratina',
        scientific: 'Hydrolyzed keratin complex',
        description:
          'Proteína pura que penetra la fibra capilar y repara daños del día en profundidad.',
        min: 5,
      },
      {
        number: '03',
        phase: 'Protección',
        product: 'Aceite de Almendras',
        scientific: 'Prunus amygdalus oil',
        description:
          'Sella la nutrición nocturna y aporta brillo duradero visible desde la mañana.',
        min: 1,
      },
    ],
  },
};

export function Rituales() {
  const [activeTab, setActiveTab] = useState('Rituales');
  const [ritualType, setRitualType] = useState<RitualType>('morning');
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-60px' });

  const ritual = rituals[ritualType];

  return (
    <section ref={sectionRef} id="rituales" className="py-20 overflow-hidden" style={{ backgroundColor: CREAM }}>
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-14">

        {/* ── TABS ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="flex items-center border-b border-stone-200 mb-10"
        >
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className="relative px-6 py-3.5 text-[11px] tracking-[0.2em] uppercase font-medium transition-colors"
              style={{ color: t === activeTab ? OLIVE : '#9ca3af' }}
            >
              {t}
              {t === activeTab && (
                <motion.div
                  layoutId="rituales-tab-line"
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                  style={{ backgroundColor: OLIVE }}
                />
              )}
            </button>
          ))}
        </motion.div>

        {/* ── HERO CARD horizontal ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="rounded-2xl overflow-hidden mb-5 grid lg:grid-cols-[1fr_1fr]"
          style={{ backgroundColor: '#EDEAE4', minHeight: 280 }}
        >
          {/* Izquierda: texto */}
          <div className="flex flex-col justify-center px-9 py-10 md:px-12 md:py-12">
            <p className="text-[9px] tracking-[0.38em] uppercase text-stone-400 font-medium mb-4">
              Protocolo diario &nbsp;·
            </p>
            <h2
              className="text-4xl md:text-5xl lg:text-6xl font-light text-stone-900 leading-[1.1] mb-5"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Rituales de<br />Belleza
            </h2>
            <div className="w-8 h-0.5 mb-5 rounded-full" style={{ backgroundColor: OLIVE }} />
            <p className="text-sm text-stone-500 leading-relaxed max-w-xs">
              Rutinas simples, ingredientes naturales y resultados reales
              para un cabello más saludable cada día.
            </p>
          </div>

          {/* Derecha: imagen + selector */}
          <div className="relative min-h-[240px]">
            <img
              src="https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=900&q=85"
              alt="Ritual de belleza natural"
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
            {/* Degradado para fundir con izquierda */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(to right, #EDEAE4 0%, #EDEAE440 20%, transparent 40%)' }}
            />

            {/* Selector Mañana / Noche */}
            <div className="absolute bottom-6 right-6 flex rounded-full overflow-hidden shadow-md"
              style={{ backgroundColor: 'white' }}
            >
              {([
                { key: 'morning', label: 'Mañana', Icon: Sun },
                { key: 'night',   label: 'Noche',  Icon: Moon },
              ] as { key: RitualType; label: string; Icon: typeof Sun }[]).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setRitualType(key)}
                  className="flex items-center gap-2 px-5 py-2.5 text-[11px] tracking-[0.14em] uppercase font-semibold transition-all duration-200"
                  style={
                    ritualType === key
                      ? { backgroundColor: OLIVE, color: 'white', borderRadius: '9999px' }
                      : { color: '#9ca3af' }
                  }
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── CARD DE PASOS ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="bg-white rounded-2xl overflow-hidden border border-stone-100"
        >
          {/* Cabecera de la card */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-stone-100">
            <div className="flex items-center gap-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={ritualType}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${OLIVE}12`, color: OLIVE }}
                >
                  {ritualType === 'morning'
                    ? <Sun className="w-4 h-4" strokeWidth={1.5} />
                    : <Moon className="w-4 h-4" strokeWidth={1.5} />
                  }
                </motion.div>
              </AnimatePresence>
              <div>
                <div className="text-sm font-medium text-stone-800">{ritual.title}</div>
                <div className="text-[10px] text-stone-400">{ritual.subtitle}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-stone-400">
              <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span className="text-[10px] tracking-[0.15em] uppercase font-medium">
                {ritual.totalMin} min
              </span>
            </div>
          </div>

          {/* Filas de pasos */}
          <AnimatePresence mode="wait">
            <motion.div
              key={ritualType}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {ritual.steps.map((step, i) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className={`grid grid-cols-[56px_100px_56px_1fr_1fr_56px_32px] items-center gap-4 px-8 py-6 ${
                    i < ritual.steps.length - 1 ? 'border-b border-stone-100' : ''
                  } hover:bg-stone-50/60 transition-colors`}
                >
                  {/* Número */}
                  <div>
                    <div className="text-[8px] tracking-[0.25em] uppercase text-stone-400">Step</div>
                    <div
                      className="text-2xl font-light text-stone-800 leading-tight"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      {step.number}
                    </div>
                  </div>

                  {/* Fase */}
                  <div>
                    <div className="text-[8px] tracking-[0.2em] uppercase text-stone-400 mb-0.5">Fase</div>
                    <div className="text-[11px] font-semibold text-stone-700 tracking-wide uppercase">
                      {step.phase}
                    </div>
                  </div>

                  {/* Miniatura circular */}
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-stone-100 flex-shrink-0">
                    <img
                      src={PRODUCT_THUMBS[step.product] ?? ''}
                      alt={step.product}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  </div>

                  {/* Producto */}
                  <div>
                    <div
                      className="text-base font-light text-stone-900 leading-snug"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      {step.product}
                    </div>
                    <div className="text-[9px] text-stone-400 italic mt-0.5">{step.scientific}</div>
                  </div>

                  {/* Descripción */}
                  <p className="text-[11px] text-stone-500 leading-relaxed">{step.description}</p>

                  {/* Minutos */}
                  <div className="text-right">
                    <div className="text-[8px] tracking-[0.2em] uppercase text-stone-400">Min</div>
                    <div
                      className="text-xl font-light text-stone-700"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      {step.min}
                    </div>
                  </div>

                  {/* Flecha */}
                  <button
                    className="w-7 h-7 rounded-full border border-stone-200 flex items-center justify-center text-stone-400 hover:border-stone-500 hover:text-stone-700 transition-all"
                    aria-label={`Ver detalle ${step.product}`}
                  >
                    <ArrowRight className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Pie de la card */}
          <div className="flex items-center justify-between px-8 py-4 border-t border-stone-100 bg-stone-50/50">
            <div className="flex items-center gap-4 text-[9px] text-stone-400 tracking-wide">
              <span>REF: {ritual.ref}</span>
              <span className="text-stone-200">|</span>
              <span>{ritual.totalMin} min · {ritual.steps.length} pasos</span>
            </div>
            <motion.a
              href="#catalogo"
              whileHover={{ x: 4 }}
              className="flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase font-semibold transition-colors"
              style={{ color: OLIVE }}
            >
              Comprar el ritual
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </motion.a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sun, Moon, ArrowRight } from 'lucide-react';

type RitualType = 'morning' | 'night';

const rituals = {
  morning: {
    title: 'Ritual de Mañana',
    subtitle: 'Energiza y protege',
    icon: Sun,
    steps: [
      {
        number: '01',
        title: 'Limpiar',
        product: 'Aceite de Cebolla',
        description: 'Estimula el cuero cabelludo mientras elimina impurezas acumuladas durante la noche.',
        time: '2 min',
      },
      {
        number: '02',
        title: 'Nutrir',
        product: 'Aceite de Aguacate',
        description: 'Hidrata profundamente con vitaminas A, D y E. Protege contra agresores externos del día.',
        time: '3 min',
      },
      {
        number: '03',
        title: 'Sellar',
        product: 'Silicona de Lino',
        description: 'Sella la cutícula y controla el frizz durante todo el día sin residuos pesados.',
        time: '1 min',
      },
    ],
  },
  night: {
    title: 'Ritual de Noche',
    subtitle: 'Repara y regenera',
    icon: Moon,
    steps: [
      {
        number: '01',
        title: 'Tratar',
        product: 'Aceite de Romero',
        description: 'Activa la circulación del cuero cabelludo para estimular el crecimiento mientras duermes.',
        time: '2 min',
      },
      {
        number: '02',
        title: 'Reconstruir',
        product: 'Tratamiento Keratina',
        description: 'Proteína pura que penetra la fibra capilar y repara daños del día a profundidad.',
        time: '5 min',
      },
      {
        number: '03',
        title: 'Proteger',
        product: 'Aceite de Almendras',
        description: 'Sella la nutrición nocturna y aporta brillo duradero visible desde la mañana.',
        time: '1 min',
      },
    ],
  },
};

export function Rituales() {
  const [active, setActive] = useState<RitualType>('morning');
  const ritual = rituals[active];
  const Icon = ritual.icon;

  return (
    <section id="rituales" className="py-24 bg-background border-y border-border">
      <div className="max-w-[1400px] mx-auto px-8 md:px-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6"
        >
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
              RUTINAS DIARIAS
            </div>
            <h2 className="text-4xl md:text-5xl leading-none">
              Rituales de<br />Belleza
            </h2>
          </div>

          {/* Toggle */}
          <div className="flex gap-0 border border-border">
            {(['morning', 'night'] as RitualType[]).map((type) => {
              const ToggleIcon = rituals[type].icon;
              return (
                <button
                  key={type}
                  onClick={() => setActive(type)}
                  className={`flex items-center gap-2 px-5 py-3 text-xs tracking-[0.15em] uppercase transition-all ${
                    active === type
                      ? 'bg-foreground text-background'
                      : 'hover:bg-secondary'
                  }`}
                >
                  <ToggleIcon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {type === 'morning' ? 'Mañana' : 'Noche'}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Steps */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
          >
            {/* Ritual label */}
            <div className="flex items-center gap-3 mb-10 pb-6 border-b border-border">
              <Icon className="w-5 h-5" strokeWidth={1} />
              <div>
                <div className="text-sm">{ritual.title}</div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">{ritual.subtitle}</div>
              </div>
            </div>

            {/* Steps list */}
            <div className="space-y-0">
              {ritual.steps.map((step, index) => (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className="grid md:grid-cols-12 gap-6 py-8 border-b border-border group"
                >
                  {/* Number */}
                  <div className="md:col-span-1 text-[10px] tracking-[0.3em] uppercase text-muted-foreground self-start pt-1">
                    {step.number}
                  </div>

                  {/* Title */}
                  <div className="md:col-span-2 self-start">
                    <div className="text-sm">{step.title}</div>
                  </div>

                  {/* Product */}
                  <div className="md:col-span-3 self-start">
                    <div className="text-xs text-muted-foreground">{step.product}</div>
                  </div>

                  {/* Description */}
                  <div className="md:col-span-5 self-start">
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                  </div>

                  {/* Time */}
                  <div className="md:col-span-1 self-start text-right">
                    <div className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground">{step.time}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-10 flex items-center justify-between"
            >
              <p className="text-xs text-muted-foreground">
                Tiempo total: ~{ritual.steps.reduce((sum, s) => sum + parseInt(s.time), 0)} minutos
              </p>
              <motion.a
                href="#catalogo"
                whileHover={{ x: 5 }}
                className="flex items-center gap-2 text-xs tracking-wider uppercase"
              >
                Comprar el ritual completo
                <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </motion.a>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

import { motion } from 'motion/react';
import { Beaker, Leaf, Droplet, Sparkles } from 'lucide-react';

const ingredients = [
  {
    name: 'Keratina Hidrolizada',
    icon: Sparkles,
    benefit: 'Reconstruye la fibra capilar desde adentro',
    percentage: '15%',
    number: '01',
  },
  {
    name: 'Aceite de Argán',
    icon: Droplet,
    benefit: 'Hidratación profunda y brillo natural',
    percentage: '12%',
    number: '02',
  },
  {
    name: 'Proteína de Seda',
    icon: Leaf,
    benefit: 'Suavidad extrema y protección térmica',
    percentage: '10%',
    number: '03',
  },
  {
    name: 'Complejo B5',
    icon: Beaker,
    benefit: 'Fortalece y previene la caída',
    percentage: '8%',
    number: '04',
  },
];

export function Laboratorio() {
  return (
    <section className="py-24 bg-secondary border-y border-border">
      <div className="max-w-[1400px] mx-auto px-8 md:px-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
            CIENCIA + NATURALEZA
          </div>
          <div className="flex items-end justify-between gap-6 flex-wrap">
            <h2 className="text-4xl md:text-5xl leading-none">
              Laboratorio<br />Juhnios
            </h2>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              Ingredientes científicamente probados que penetran la fibra capilar para resultados visibles en semanas.
            </p>
          </div>
        </motion.div>

        {/* Ingredients grid */}
        <div className="grid md:grid-cols-2 gap-px bg-border mb-px">
          {ingredients.map((ing, index) => {
            const Icon = ing.icon;
            return (
              <motion.div
                key={ing.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group bg-secondary hover:bg-background transition-colors p-8 md:p-10"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
                    {ing.number}
                  </div>
                  <Icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1} />
                </div>

                <div className="text-5xl md:text-6xl mb-4 group-hover:opacity-80 transition-opacity">
                  {ing.percentage}
                </div>

                <h3 className="text-base mb-3">{ing.name}</h3>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {ing.benefit}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-3 gap-px bg-border"
        >
          {[
            { value: '98%', label: 'Ingredientes naturales' },
            { value: '0%', label: 'Sulfatos y parabenos' },
            { value: '100%', label: 'Cruelty free' },
          ].map(({ value, label }) => (
            <div key={label} className="bg-foreground text-background py-8 text-center">
              <div className="text-3xl md:text-4xl mb-2">{value}</div>
              <div className="text-[10px] tracking-[0.2em] uppercase opacity-60">{label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

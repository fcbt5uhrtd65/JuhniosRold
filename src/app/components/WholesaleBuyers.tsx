import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { ArrowRight, X, Check } from 'lucide-react';

const categories = [
  { name: 'Aceites esenciales', code: '01', detail: '80+ variedades' },
  { name: 'Extractos botánicos', code: '02', detail: 'Certificados orgánicos' },
  { name: 'Mantecas naturales', code: '03', detail: 'Origen directo' },
  { name: 'Activos cosméticos', code: '04', detail: 'Alta concentración' },
  { name: 'Conservantes', code: '05', detail: 'Sin parabenos' },
  { name: 'Emulsionantes', code: '06', detail: 'Biodegradables' },
  { name: 'Fragancias', code: '07', detail: '100% naturales' },
  { name: 'Colorantes', code: '08', detail: 'Food-grade' },
];

const stats = [
  { value: 200, label: 'Ingredientes', unit: '+' },
  { value: 50, label: 'Descuento', unit: '%' },
  { value: 5, label: 'Mínimo', unit: ' kg' },
  { value: 15, label: 'Experiencia', unit: ' años' },
];

// Animated counting number
function CountUp({ target, unit, inView }: { target: number; unit: string; inView: boolean }) {
  const [count, setCount] = useState(0);
  const hasRun = useRef(false);

  useEffect(() => {
    if (!inView || hasRun.current) return;
    hasRun.current = true;

    const duration = 1800;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out expo
      const eased = 1 - Math.pow(2, -10 * progress);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };

    setTimeout(() => requestAnimationFrame(animate), 200);
  }, [inView, target]);

  return (
    <div className="flex items-baseline justify-end gap-0.5">
      <span className="text-3xl font-light tabular-nums">{count}</span>
      <span className="text-sm opacity-50 font-light">{unit}</span>
    </div>
  );
}

export function WholesaleBuyers() {
  const [showModal, setShowModal] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    company: '', contact: '', email: '', phone: '', category: '', volume: '',
  });
  const statsRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(statsRef, { once: true, margin: '-100px' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Solicitud enviada');
    setShowModal(false);
    setFormData({ company: '', contact: '', email: '', phone: '', category: '', volume: '' });
  };

  return (
    <section className="py-20 bg-foreground text-background overflow-hidden relative">
      {/* Subtle grid lines decoration */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }}
      />

      <div className="relative max-w-[1400px] mx-auto px-5 sm:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="flex items-end justify-between gap-8 flex-wrap">
            <div>
              <div className="text-[10px] tracking-[0.45em] uppercase text-background/40 mb-4">
                Para fabricantes
              </div>
              <h2
                className="text-5xl md:text-6xl lg:text-7xl font-light tracking-tight leading-none"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Materias<br />
                <span className="text-background/40">primas</span>
              </h2>
            </div>

            {/* Stats Grid with CountUp */}
            <div ref={statsRef} className="hidden lg:grid grid-cols-4 gap-8">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-right"
                >
                  <CountUp target={stat.value} unit={stat.unit} inView={isInView} />
                  <div className="text-[8px] tracking-[0.25em] uppercase text-background/40 mt-1">
                    {stat.label}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-px bg-background/10">

          {/* Categories — 2 cols */}
          <div className="lg:col-span-2 bg-foreground p-8 md:p-12">
            <div className="text-[9px] tracking-[0.4em] uppercase text-background/30 mb-6">
              Categorías disponibles
            </div>
            <div className="grid sm:grid-cols-2 gap-0">
              {categories.map((cat, index) => (
                <motion.div
                  key={cat.code}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.06 }}
                  onHoverStart={() => setHoveredCategory(index)}
                  onHoverEnd={() => setHoveredCategory(null)}
                  className="relative overflow-hidden cursor-default"
                >
                  {/* Hover fill */}
                  <motion.div
                    className="absolute inset-0 bg-background/5"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: hoveredCategory === index ? 1 : 0 }}
                    style={{ originX: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                  />

                  <div className="relative py-5 px-3 border-b border-background/10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="text-3xl font-light opacity-15 tabular-nums w-10 flex-shrink-0">
                        {cat.code}
                      </div>
                      <div>
                        <div className="text-base md:text-lg">{cat.name}</div>
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{
                            opacity: hoveredCategory === index ? 1 : 0,
                            height: hoveredCategory === index ? 'auto' : 0,
                          }}
                          className="text-[9px] tracking-[0.2em] uppercase text-background/40 overflow-hidden"
                        >
                          {cat.detail}
                        </motion.div>
                      </div>
                    </div>

                    <motion.div
                      animate={{
                        x: hoveredCategory === index ? 0 : -10,
                        opacity: hoveredCategory === index ? 1 : 0,
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* CTA Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-background text-foreground p-8 md:p-12 flex flex-col justify-between"
          >
            <div>
              <h3
                className="text-2xl md:text-3xl mb-4 leading-tight"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Solicita nuestro catálogo completo
              </h3>
              <p className="text-xs text-muted-foreground mb-8 leading-relaxed">
                Descuentos progresivos según volumen.<br />
                Entrega en 24–48 horas.
              </p>

              {/* Benefits */}
              <div className="space-y-4 mb-8">
                {[
                  'Certificaciones internacionales',
                  'Stock permanente garantizado',
                  'Asesoría técnica incluida',
                  'Muestras gratuitas disponibles',
                ].map((benefit, i) => (
                  <motion.div
                    key={benefit}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-start gap-3 text-xs group"
                  >
                    <div className="w-4 h-4 border border-foreground/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-foreground group-hover:border-foreground transition-colors">
                      <Check className="w-2.5 h-2.5 group-hover:text-background transition-colors" strokeWidth={2.5} />
                    </div>
                    <span className="leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors">
                      {benefit}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.button
              onClick={() => setShowModal(true)}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-between px-6 py-4 bg-foreground text-background group relative overflow-hidden"
            >
              <motion.div
                className="absolute inset-0 bg-foreground/80 origin-left"
                initial={{ scaleX: 0 }}
                whileHover={{ scaleX: 1 }}
                transition={{ duration: 0.3 }}
              />
              <span className="relative z-10 text-xs tracking-wider uppercase">Contactar ahora</span>
              <ArrowRight className="relative z-10 w-4 h-4 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
            </motion.button>
          </motion.div>
        </div>

        {/* Mobile Stats */}
        <div className="grid grid-cols-4 gap-4 mt-8 lg:hidden">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <div className="flex items-baseline justify-center gap-0.5">
                <div className="text-2xl font-light">{stat.value}</div>
                <div className="text-xs opacity-50">{stat.unit}</div>
              </div>
              <div className="text-[8px] tracking-[0.2em] uppercase text-background/40 mt-1">
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background text-foreground max-w-md w-full overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div>
                  <h3 className="text-xl mb-1">Solicitar catálogo</h3>
                  <p className="text-[10px] text-muted-foreground tracking-wider uppercase">
                    Te contactaremos en menos de 24h
                  </p>
                </div>
                <motion.button
                  whileHover={{ rotate: 90 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-secondary transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </motion.button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-3">
                <input
                  type="text" required
                  placeholder="Nombre de la empresa"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary border-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 text-sm placeholder:text-muted-foreground/50"
                />
                <input
                  type="text" required
                  placeholder="Persona de contacto"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary border-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 text-sm placeholder:text-muted-foreground/50"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="email" required placeholder="Email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-secondary border-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 text-sm placeholder:text-muted-foreground/50"
                  />
                  <input
                    type="tel" required placeholder="Teléfono"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-secondary border-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 text-sm placeholder:text-muted-foreground/50"
                  />
                </div>
                <select
                  required value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary border-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 text-sm text-foreground"
                >
                  <option value="">Categoría de interés</option>
                  {categories.map((cat) => (
                    <option key={cat.code} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
                <select
                  required value={formData.volume}
                  onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                  className="w-full px-4 py-3 bg-secondary border-0 focus:outline-none focus:ring-1 focus:ring-foreground/20 text-sm text-foreground"
                >
                  <option value="">Volumen mensual estimado</option>
                  <option value="5-20kg">5–20 kg</option>
                  <option value="20-50kg">20–50 kg</option>
                  <option value="50-100kg">50–100 kg</option>
                  <option value="100kg+">Más de 100 kg</option>
                </select>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full px-6 py-4 bg-foreground text-background hover:bg-foreground/90 transition-colors text-xs tracking-[0.25em] uppercase mt-4"
                >
                  Enviar solicitud
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

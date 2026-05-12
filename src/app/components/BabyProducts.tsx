import { useState, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'motion/react';
import { Shield, Heart, Leaf, Droplet, ArrowRight } from 'lucide-react';

const products = [
  {
    id: 1,
    name: 'Shampoo Suave',
    category: 'Cuidado Capilar',
    tagline: 'Sin lágrimas, pH balanceado',
    image: 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=800&q=80',
    features: ['pH neutro', 'Hipoalergénico', 'Sin sulfatos'],
    color: 'from-blue-50 to-sky-50',
  },
  {
    id: 2,
    name: 'Aceite Natural',
    category: 'Hidratación',
    tagline: 'Piel suave y protegida',
    image: 'https://images.unsplash.com/photo-1584362917165-526a968579e8?w=800&q=80',
    features: ['100% natural', 'Sin perfume', 'Dermatológico'],
    color: 'from-amber-50 to-yellow-50',
  },
  {
    id: 3,
    name: 'Crema Protectora',
    category: 'Protección',
    tagline: 'Cuidado 24 horas',
    image: 'https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?w=800&q=80',
    features: ['Sin parabenos', 'Hidratación 24h', 'Piel sensible'],
    color: 'from-rose-50 to-pink-50',
  },
  {
    id: 4,
    name: 'Gel de Baño',
    category: 'Limpieza',
    tagline: 'Extra suave y delicado',
    image: 'https://images.unsplash.com/photo-1522441815192-d9f04eb0615c?w=800&q=80',
    features: ['Extra suave', 'Sin irritantes', 'Aroma suave'],
    color: 'from-green-50 to-emerald-50',
  },
];

const values = [
  { icon: Heart, label: 'Con amor', description: 'Formulado con el mayor cuidado' },
  { icon: Shield, label: 'Seguro', description: 'Dermatológicamente probado' },
  { icon: Leaf, label: 'Natural', description: '98% ingredientes naturales' },
  { icon: Droplet, label: 'Suave', description: 'Para la piel más delicada' },
];

// Floating bubble component
function FloatingBubble({ size, x, y, delay, duration }: {
  size: number; x: number; y: number; delay: number; duration: number;
}) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size,
        height: size,
        left: `${x}%`,
        top: `${y}%`,
        background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8), rgba(255,255,255,0.1))',
        border: '1px solid rgba(255,255,255,0.5)',
      }}
      animate={{
        y: [0, -20, 0],
        x: [0, 8, -5, 0],
        scale: [1, 1.05, 0.97, 1],
        opacity: [0.4, 0.7, 0.5, 0.4],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

const bubbles = [
  { size: 80, x: 8, y: 15, delay: 0, duration: 6 },
  { size: 40, x: 92, y: 25, delay: 1, duration: 5 },
  { size: 60, x: 15, y: 65, delay: 2, duration: 7 },
  { size: 30, x: 85, y: 70, delay: 0.5, duration: 4.5 },
  { size: 50, x: 50, y: 8, delay: 1.5, duration: 6.5 },
  { size: 25, x: 72, y: 55, delay: 3, duration: 5.5 },
  { size: 45, x: 25, y: 85, delay: 0.8, duration: 8 },
  { size: 35, x: 62, y: 88, delay: 2.5, duration: 5 },
];

export function BabyProducts() {
  const [activeProduct, setActiveProduct] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' });

  return (
    <section
      ref={sectionRef}
      className="py-24 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #fdf6f0 0%, #fef0f5 40%, #f0f4fe 100%)',
      }}
    >
      {/* Floating bubbles */}
      {bubbles.map((b, i) => (
        <FloatingBubble key={i} {...b} />
      ))}

      <div className="relative z-10 max-w-[1400px] mx-auto px-5 sm:px-8 md:px-12">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-20 text-center"
        >
          <div className="text-[9px] tracking-[0.45em] uppercase text-muted-foreground mb-4">
            Cuidado especial
          </div>
          <h2 className="text-4xl md:text-5xl mb-4 leading-tight">Línea Bebé</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Formulaciones ultrasuaves diseñadas para la piel más delicada del mundo
          </p>
        </motion.div>

        {/* Values pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-3 mb-20"
        >
          {values.map((value, i) => {
            const Icon = value.icon;
            return (
              <motion.div
                key={value.label}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={isInView ? { opacity: 1, scale: 1, y: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4, scale: 1.04 }}
                className="flex items-center gap-3 bg-white/70 backdrop-blur-sm border border-white/80 px-5 py-3 rounded-full shadow-sm"
              >
                <div className="w-7 h-7 bg-foreground/5 rounded-full flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-foreground/70" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-xs text-foreground">{value.label}</div>
                  <div className="text-[9px] text-muted-foreground tracking-wide hidden sm:block">
                    {value.description}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Products interactive grid */}
        <div className="grid lg:grid-cols-2 gap-6 mb-20">
          {/* Left: Product selector tabs */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col gap-2"
          >
            {products.map((product, index) => (
              <motion.button
                key={product.id}
                onClick={() => setActiveProduct(index)}
                whileHover={{ x: 6 }}
                className={`group relative text-left p-5 border transition-all duration-400 overflow-hidden ${
                  activeProduct === index
                    ? 'border-foreground/20 bg-white/80'
                    : 'border-white/50 bg-white/30 hover:bg-white/50'
                }`}
              >
                {/* Active indicator bar */}
                <motion.div
                  className="absolute left-0 top-0 bottom-0 w-0.5 bg-foreground"
                  initial={false}
                  animate={{ scaleY: activeProduct === index ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                />

                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground mb-1">
                      {product.category}
                    </div>
                    <div className={`transition-all duration-300 ${activeProduct === index ? 'text-xl' : 'text-base opacity-60'}`}>
                      {product.name}
                    </div>
                    <AnimatePresence>
                      {activeProduct === index && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <p className="text-xs text-muted-foreground mt-2">{product.tagline}</p>
                          <div className="flex gap-2 mt-3 flex-wrap">
                            {product.features.map(f => (
                              <span key={f} className="text-[9px] px-2 py-1 bg-foreground/5 rounded-full tracking-wide">
                                {f}
                              </span>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <motion.div
                    animate={{ x: activeProduct === index ? 0 : -8, opacity: activeProduct === index ? 1 : 0 }}
                    className="flex-shrink-0"
                  >
                    <ArrowRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                  </motion.div>
                </div>
              </motion.button>
            ))}

            {/* CTA */}
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="mt-4 w-full py-4 bg-foreground text-background text-xs tracking-[0.25em] uppercase flex items-center justify-center gap-3 group"
            >
              Ver línea completa
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
            </motion.button>
          </motion.div>

          {/* Right: Active product image */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeProduct}
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={`relative h-80 lg:h-full min-h-[380px] overflow-hidden bg-gradient-to-br ${products[activeProduct].color}`}
              >
                <img
                  src={products[activeProduct].image}
                  alt={products[activeProduct].name}
                  className="w-full h-full object-cover mix-blend-multiply opacity-80"
                />
                {/* Soft vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-transparent" />

                {/* Product badge */}
                <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-sm px-4 py-2">
                  <div className="text-[8px] tracking-[0.3em] uppercase text-muted-foreground">
                    {products[activeProduct].category}
                  </div>
                  <div className="text-sm">{products[activeProduct].name}</div>
                </div>

                {/* Floating certification badge */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-sm border border-white px-4 py-3 text-center"
                >
                  <div className="text-[8px] tracking-[0.25em] uppercase text-muted-foreground mb-0.5">
                    Certificado
                  </div>
                  <div className="text-xs">Dermatológico</div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Bottom disclaimer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8 }}
          className="text-center border-t border-foreground/10 pt-10"
        >
          <p className="text-[10px] text-muted-foreground max-w-2xl mx-auto leading-relaxed tracking-wide">
            Todos nuestros productos para bebé están dermatológicamente probados y cumplen con las más altas normas de seguridad internacional. Sin parabenos · Sin sulfatos · Sin fragancias artificiales
          </p>
        </motion.div>
      </div>
    </section>
  );
}

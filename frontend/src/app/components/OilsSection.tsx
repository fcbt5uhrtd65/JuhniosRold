import { useState, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { ArrowRight } from 'lucide-react';

const oils = [
  {
    name: 'Aceite de Oliva',
    subtitle: 'Nutrición profunda',
    description: 'Repara y fortalece desde la raíz. Rico en vitaminas A, D, E y K para una hidratación duradera.',
    purity: '100% puro',
    origin: 'Mediterráneo',
    compound: 'Olea europaea',
    index: '01',
    image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=1200&q=80',
  },
  {
    name: 'Aceite de Argán',
    subtitle: 'Hidratación extrema',
    description: 'Restaura el brillo natural. Alto contenido de ácidos grasos esenciales y vitamina E.',
    purity: '100% puro',
    origin: 'Marruecos',
    compound: 'Argania spinosa',
    index: '02',
    image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=1200&q=80',
  },
  {
    name: 'Aceite de Uva',
    subtitle: 'Antioxidante natural',
    description: 'Protege y fortalece. Ligero y de rápida absorción con poderosos antioxidantes.',
    purity: '100% puro',
    origin: 'Francia',
    compound: 'Vitis vinifera',
    index: '03',
    image: 'https://images.unsplash.com/photo-1566065363841-0e0d82b4a5c5?w=1200&q=80',
  },
  {
    name: 'Aceite de Romero',
    subtitle: 'Estimulante capilar',
    description: 'Activa la circulación del cuero cabelludo y estimula el crecimiento natural del cabello.',
    purity: '100% puro',
    origin: 'España',
    compound: 'Rosmarinus officinalis',
    index: '04',
    image: 'https://images.unsplash.com/photo-1596240896925-a8e728c0d3c7?w=1200&q=80',
  },
];

// Floating golden particles in background
function OilParticles() {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    x: 10 + Math.random() * 80,
    y: 10 + Math.random() * 80,
    size: 2 + Math.random() * 4,
    delay: Math.random() * 4,
    duration: 4 + Math.random() * 4,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: 'radial-gradient(circle, rgba(180,140,60,0.5), rgba(180,140,60,0.1))',
          }}
          animate={{
            y: [-10, -30, -10],
            opacity: [0, 0.6, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

export function OilsSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageMousePos, setImageMousePos] = useState({ x: 0.5, y: 0.5 });
  const imageRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' });

  const activeOil = oils[activeIndex];

  const handleImageMouseMove = (e: React.MouseEvent) => {
    const rect = imageRef.current?.getBoundingClientRect();
    if (!rect) return;
    setImageMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  return (
    <section ref={sectionRef} className="py-24 bg-background relative overflow-hidden">
      <OilParticles />

      <div className="relative z-10 max-w-[1400px] mx-auto px-5 sm:px-8 md:px-12">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="mb-20"
        >
          <div className="flex items-end justify-between gap-8 flex-wrap">
            <div>
              <div className="text-[9px] tracking-[0.45em] uppercase text-muted-foreground mb-4">
                Esencias naturales
              </div>
              <h2 className="text-4xl md:text-5xl leading-none">
                Aceites<br />
                <span className="text-muted-foreground/50">Puros</span>
              </h2>
            </div>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              Ingredientes de máxima pureza, seleccionados de los mejores orígenes del mundo para el cuidado profesional.
            </p>
          </div>
        </motion.div>

        {/* Main layout */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Left: Image with tilt effect */}
          <motion.div
            ref={imageRef}
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            onMouseMove={handleImageMouseMove}
            onMouseLeave={() => setImageMousePos({ x: 0.5, y: 0.5 })}
            className="relative aspect-[3/4] bg-secondary overflow-hidden cursor-none"
            style={{ perspective: '1000px' }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, scale: 1.06 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  rotateY: (imageMousePos.x - 0.5) * 6,
                  rotateX: -(imageMousePos.y - 0.5) * 4,
                }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                  opacity: { duration: 0.6 },
                  scale: { duration: 0.6 },
                  rotateY: { type: 'spring', stiffness: 200, damping: 30 },
                  rotateX: { type: 'spring', stiffness: 200, damping: 30 },
                }}
                className="absolute inset-0"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <img
                  src={activeOil.image}
                  alt={activeOil.name}
                  className="w-full h-full object-cover"
                />
                {/* Shine effect */}
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  animate={{
                    background: `radial-gradient(circle at ${imageMousePos.x * 100}% ${imageMousePos.y * 100}%, rgba(255,255,255,0.12) 0%, transparent 60%)`,
                  }}
                  transition={{ type: 'spring', damping: 40 }}
                />
              </motion.div>
            </AnimatePresence>

            {/* Index number overlay */}
            <div className="absolute top-6 left-6 z-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIndex}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="text-6xl font-light text-white/15 leading-none select-none"
                >
                  {activeOil.index}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Origin badge */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`origin-${activeIndex}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.3 }}
                className="absolute bottom-6 left-6 z-10 bg-background/95 backdrop-blur-sm border border-border/50 px-4 py-3"
              >
                <div className="text-[8px] tracking-[0.35em] uppercase text-muted-foreground mb-1">Origen</div>
                <div className="text-sm">{activeOil.origin}</div>
                <div className="text-[9px] text-muted-foreground/50 font-mono italic mt-0.5">
                  {activeOil.compound}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Progress bar for image */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 z-10">
              <motion.div
                className="h-full bg-white/50"
                animate={{ width: `${((activeIndex + 1) / oils.length) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>

          {/* Right: Oil selector */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-0"
          >
            {/* Oil list */}
            <div className="border-t border-border">
              {oils.map((oil, index) => (
                <motion.button
                  key={oil.name}
                  onClick={() => setActiveIndex(index)}
                  initial={{ opacity: 0, x: 20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.3 + index * 0.08 }}
                  className={`w-full text-left border-b border-border transition-all duration-400 group ${
                    activeIndex === index ? '' : 'opacity-35 hover:opacity-60'
                  }`}
                >
                  <div className="py-6 flex items-baseline justify-between gap-4">
                    <div className="flex items-baseline gap-4">
                      <span className="text-[10px] font-mono text-muted-foreground/40 flex-shrink-0">
                        {oil.index}
                      </span>
                      <div>
                        <div className={`transition-all duration-400 ${activeIndex === index ? 'text-2xl' : 'text-lg'}`}>
                          {oil.name}
                        </div>
                        <motion.div
                          className="text-xs text-muted-foreground overflow-hidden"
                          animate={{
                            height: activeIndex === index ? 'auto' : 0,
                            opacity: activeIndex === index ? 1 : 0,
                            marginTop: activeIndex === index ? 4 : 0,
                          }}
                          transition={{ duration: 0.35 }}
                        >
                          {oil.subtitle}
                        </motion.div>
                      </div>
                    </div>

                    <motion.div
                      animate={{
                        x: activeIndex === index ? 0 : -8,
                        opacity: activeIndex === index ? 1 : 0,
                        rotate: activeIndex === index ? 0 : -45,
                      }}
                      transition={{ duration: 0.25 }}
                    >
                      <ArrowRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                    </motion.div>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Active oil detail */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="pt-8 space-y-6"
              >
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {activeOil.description}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-border p-4 group hover:bg-secondary transition-colors">
                    <div className="text-[8px] tracking-[0.35em] uppercase text-muted-foreground mb-2">Pureza</div>
                    <div className="text-base">{activeOil.purity}</div>
                  </div>
                  <div className="border border-border p-4 group hover:bg-secondary transition-colors">
                    <div className="text-[8px] tracking-[0.35em] uppercase text-muted-foreground mb-2">Certificado</div>
                    <div className="text-base">Orgánico</div>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-between text-xs tracking-[0.2em] uppercase border border-border px-6 py-4 hover:bg-foreground hover:text-background transition-all duration-300 group"
                >
                  <span>Ver detalles del producto</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                </motion.button>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

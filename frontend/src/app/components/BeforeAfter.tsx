import { useState, useRef, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Transformation {
  id: number;
  before: string;
  after: string;
  label: string;
  days: string;
}

function ComparisonSlider({ transformation, autoReveal }: { transformation: Transformation; autoReveal?: boolean }) {
  const [sliderPosition, setSliderPosition] = useState(autoReveal ? 0 : 50);
  const [isDraggingState, setIsDraggingState] = useState(false);
  const [hasAutoRevealed, setHasAutoRevealed] = useState(false);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-80px' });

  // Auto-reveal: animate from 0 → 50% when entering viewport
  useEffect(() => {
    if (isInView && autoReveal && !hasAutoRevealed) {
      setHasAutoRevealed(true);
      let start: number | null = null;
      const duration = 1400;
      const targetPos = 50;

      const animate = (timestamp: number) => {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setSliderPosition(eased * targetPos);
        if (progress < 1) requestAnimationFrame(animate);
      };
      setTimeout(() => requestAnimationFrame(animate), 300);
    }
  }, [isInView, autoReveal, hasAutoRevealed]);

  const updateSlider = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(2, Math.min(98, percentage)));
  };

  const handleMouseDown = () => { isDragging.current = true; setIsDraggingState(true); };
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging.current) updateSlider(e.clientX);
  };
  const handleMouseUp = () => { isDragging.current = false; setIsDraggingState(false); };
  const handleTouchStart = () => { isDragging.current = true; setIsDraggingState(true); };
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isDragging.current) updateSlider(e.touches[0].clientX);
  };
  const handleTouchEnd = () => { isDragging.current = false; setIsDraggingState(false); };

  return (
    <div
      ref={containerRef}
      className="aspect-[3/4] bg-secondary overflow-hidden relative select-none group"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: 'ew-resize', touchAction: 'none' }}
    >
      {/* After image */}
      <div className="absolute inset-0">
        <img
          src={transformation.after}
          alt="Después"
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>

      {/* Before image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <img
          src={transformation.before}
          alt="Antes"
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-px z-10 pointer-events-none"
        style={{
          left: `${sliderPosition}%`,
          background: 'rgba(255,255,255,0.9)',
          boxShadow: '0 0 12px rgba(255,255,255,0.6), 0 0 30px rgba(255,255,255,0.2)',
        }}
      >
        {/* Handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            animate={{
              scale: isDraggingState ? 1.15 : 1,
              boxShadow: isDraggingState
                ? '0 0 0 4px rgba(255,255,255,0.3), 0 0 20px rgba(255,255,255,0.4)'
                : '0 0 0 2px rgba(255,255,255,0.2)',
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center"
          >
            <div className="flex items-center gap-0.5">
              <ChevronLeft className="w-3 h-3 text-black" strokeWidth={2.5} />
              <ChevronRight className="w-3 h-3 text-black" strokeWidth={2.5} />
            </div>
          </motion.div>

          {/* Pulse rings */}
          {!isDraggingState && !hasAutoRevealed && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full border border-white/40"
                animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.div
                className="absolute inset-0 rounded-full border border-white/20"
                animate={{ scale: [1, 2.4], opacity: [0.4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
              />
            </>
          )}
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-4 left-4 px-3 py-1 bg-white text-[9px] tracking-[0.25em] uppercase text-black pointer-events-none z-10">
        Antes
      </div>
      <div className="absolute top-4 right-4 px-3 py-1 bg-black text-white text-[9px] tracking-[0.25em] uppercase pointer-events-none z-10">
        Después
      </div>

      {/* Percentage while dragging */}
      <AnimatePresence>
        {isDraggingState && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 bg-black/80 backdrop-blur-sm px-3 py-1.5 text-white pointer-events-none"
          >
            <span className="text-[11px] font-mono">
              {Math.round(sliderPosition)}% ← Antes
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom day label */}
      <motion.div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-white tracking-[0.2em] uppercase bg-black/70 backdrop-blur-sm px-3 py-1.5 pointer-events-none z-10"
        initial={{ opacity: 0, y: 8 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 1.2 }}
      >
        {transformation.days} · {transformation.label}
      </motion.div>
    </div>
  );
}

export function BeforeAfter() {
  const transformations: Transformation[] = [
    {
      id: 1,
      before: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=600&q=80',
      after: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80',
      label: 'Resultado visible',
      days: '30 días',
    },
    {
      id: 2,
      before: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&q=80',
      after: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&q=80',
      label: 'Hidratación profunda',
      days: '45 días',
    },
    {
      id: 3,
      before: 'https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?w=600&q=80',
      after: 'https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?w=600&q=80',
      label: 'Sin frizz',
      days: '60 días',
    },
    {
      id: 4,
      before: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80',
      after: 'https://images.unsplash.com/photo-1504703395950-b89145a5425b?w=600&q=80',
      label: 'Crecimiento activo',
      days: '21 días',
    },
    {
      id: 5,
      before: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&q=80',
      after: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&q=80',
      label: 'Brillo intenso',
      days: '35 días',
    },
    {
      id: 6,
      before: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80',
      after: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=600&q=80',
      label: 'Reparación total',
      days: '50 días',
    },
  ];

  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section ref={sectionRef} className="py-20 bg-background overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 md:px-12">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="mb-12 grid md:grid-cols-2 gap-8 items-end"
        >
          <div>
            <div className="text-[10px] tracking-[0.4em] uppercase text-muted-foreground mb-3">
              Resultados Reales
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl leading-none">
              Antes &<br />Después
            </h2>
          </div>
          <div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
              Desliza cada imagen para descubrir la transformación real de nuestras clientas.
              Sin filtros. Sin retoques.
            </p>
          </div>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border">
          {transformations.map((transformation, index) => (
            <motion.div
              key={transformation.id}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                delay: index * 0.08,
                duration: 0.6,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <ComparisonSlider transformation={transformation} autoReveal={true} />
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.8 }}
          className="text-center mt-10 flex flex-col sm:flex-row items-center justify-center gap-6"
        >
          <div className="flex items-center gap-2">
            <div className="w-4 h-[1px] bg-foreground/30" />
            <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
              Sin filtros — Resultados verificados
            </p>
            <div className="w-4 h-[1px] bg-foreground/30" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
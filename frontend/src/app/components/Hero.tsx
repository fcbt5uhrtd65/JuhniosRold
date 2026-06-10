import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  image: string;
}

// Grain texture overlay via SVG data URI
const GrainOverlay = () => (
  <div
    className="absolute inset-0 pointer-events-none z-10 opacity-[0.18] mix-blend-overlay"
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      backgroundSize: '200px 200px',
    }}
  />
);

// Split text into words for staggered animation
function AnimatedTitle({ title, subtitle }: { title: string; subtitle: string }) {
  const words = (title + ' ' + subtitle).split(' ');
  return (
    <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.05] mb-8 text-white overflow-hidden">
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden mr-[0.25em]">
          <motion.span
            className="inline-block"
            initial={{ y: '110%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{
              duration: 0.7,
              delay: 0.3 + i * 0.08,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

export function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const sectionRef = useRef<HTMLElement>(null);

  const slides: Slide[] = [
    {
      id: 1,
      title: 'TU CABELLO,',
      subtitle: 'TU PODER',
      description: 'Productos capilares diseñados para mujeres que no piden permiso para brillar.',
      image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1200&q=80',
    },
    {
      id: 2,
      title: 'QUIÉNES',
      subtitle: 'SOMOS',
      description: 'Una marca colombiana comprometida con la belleza natural y sostenible desde 2020.',
      image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&q=80',
    },
    {
      id: 3,
      title: 'RESULTADOS',
      subtitle: 'REALES',
      description: 'Más de 10,000 clientas satisfechas en toda Colombia confían en nuestros productos.',
      image: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=1200&q=80',
    },
  ];

  const paginate = (newDirection: number) => {
    setDirection(newDirection);
    setCurrentSlide((prev) => {
      if (newDirection === 1) return prev === slides.length - 1 ? 0 : prev + 1;
      return prev === 0 ? slides.length - 1 : prev - 1;
    });
  };

  useEffect(() => {
    const timer = setInterval(() => paginate(1), 7000);
    return () => clearInterval(timer);
  }, [currentSlide]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = sectionRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    });
  };

  // Clip-path diagonal wipe transition
  const slideVariants = {
    enter: (dir: number) => ({
      clipPath: dir > 0
        ? 'inset(0 100% 0 0)'
        : 'inset(0 0 0 100%)',
      opacity: 1,
    }),
    center: {
      clipPath: 'inset(0 0% 0 0)',
      opacity: 1,
      transition: {
        clipPath: { duration: 0.85, ease: [0.76, 0, 0.24, 1] },
      },
    },
    exit: (dir: number) => ({
      clipPath: dir > 0
        ? 'inset(0 0 0 100%)'
        : 'inset(0 100% 0 0)',
      opacity: 1,
      transition: {
        clipPath: { duration: 0.85, ease: [0.76, 0, 0.24, 1] },
      },
    }),
  };

  return (
    <section
      ref={sectionRef}
      className="min-h-screen relative overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Cursor spotlight */}
      <motion.div
        className="absolute pointer-events-none z-20 rounded-full"
        style={{
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
        }}
        animate={{
          x: mousePos.x * (sectionRef.current?.offsetWidth || 1200) - 200,
          y: mousePos.y * (sectionRef.current?.offsetHeight || 800) - 200,
          opacity: isHovered ? 1 : 0,
        }}
        transition={{ type: 'spring', damping: 30, stiffness: 200 }}
      />

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 z-30 h-[2px] bg-white/10">
        <motion.div
          key={currentSlide}
          className="h-full bg-white/60 origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 7, ease: 'linear' }}
        />
      </div>

      {/* Slide number indicator */}
      <div className="absolute top-8 right-8 z-30 flex items-center gap-3">
        <span className="text-white/40 text-[10px] tracking-[0.3em] font-mono">
          {String(currentSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
        </span>
      </div>

      {/* Slides */}
      <AnimatePresence initial={false} custom={direction} mode="sync">
        <motion.div
          key={currentSlide}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="absolute inset-0"
        >
          {/* Kenburns background */}
          <motion.div
            className="absolute inset-0"
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 7.5, ease: 'easeOut' }}
          >
            <img
              src={slides[currentSlide].image}
              alt={slides[currentSlide].title}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </motion.div>

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />

          {/* Grain */}
          <GrainOverlay />

          {/* Subtle parallax-feel via mouse */}
          <motion.div
            className="absolute inset-[-5%]"
            animate={{
              x: isHovered ? (mousePos.x - 0.5) * -20 : 0,
              y: isHovered ? (mousePos.y - 0.5) * -15 : 0,
            }}
            transition={{ type: 'spring', damping: 40, stiffness: 150 }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-20 h-screen flex items-center justify-center text-center px-8 md:px-12">
        <div className="max-w-3xl">
          <AnimatePresence mode="wait">
            <div key={currentSlide}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-[10px] tracking-[0.5em] uppercase text-white/60 mb-8"
              >
                COLOMBIA — 2026
              </motion.div>

              <AnimatedTitle
                title={slides[currentSlide].title}
                subtitle={slides[currentSlide].subtitle}
              />

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className="text-sm md:text-base text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed"
              >
                {slides[currentSlide].description}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="flex flex-col sm:flex-row gap-4 justify-center"
              >
                <motion.a
                  href="#catalogo"
                  whileHover={{ scale: 1.05, y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative overflow-hidden px-10 py-4 bg-white text-black text-xs tracking-[0.25em] uppercase group"
                >
                  <span className="relative z-10">Ver colección</span>
                  <motion.div
                    className="absolute inset-0 bg-black origin-left"
                    initial={{ scaleX: 0 }}
                    whileHover={{ scaleX: 1 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  />
                  <motion.span
                    className="absolute inset-0 flex items-center justify-center text-white text-xs tracking-[0.25em] uppercase z-20"
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                  >
                    Ver colección
                  </motion.span>
                </motion.a>
                <motion.a
                  href="#productos"
                  whileHover={{ scale: 1.05, y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-10 py-4 border border-white/60 text-white text-xs tracking-[0.25em] uppercase hover:bg-white/10 transition-colors backdrop-blur-sm"
                >
                  Cómo funciona
                </motion.a>
              </motion.div>
            </div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30 flex items-center gap-6">
        <motion.button
          onClick={() => paginate(-1)}
          aria-label="Slide anterior"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="w-10 h-10 border border-white/40 flex items-center justify-center hover:bg-white/10 transition-colors text-white backdrop-blur-sm"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
        </motion.button>

        <div className="flex gap-2" role="tablist">
          {slides.map((slide, index) => (
            <button
              key={index}
              onClick={() => {
                setDirection(index > currentSlide ? 1 : -1);
                setCurrentSlide(index);
              }}
              role="tab"
              aria-selected={index === currentSlide}
              aria-label={`Ir a slide ${index + 1}`}
              className={`h-[2px] transition-all duration-500 ${
                index === currentSlide ? 'w-10 bg-white' : 'w-5 bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>

        <motion.button
          onClick={() => paginate(1)}
          aria-label="Siguiente slide"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="w-10 h-10 border border-white/40 flex items-center justify-center hover:bg-white/10 transition-colors text-white backdrop-blur-sm"
        >
          <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
        </motion.button>
      </div>

      {/* Bottom left brand text */}
      <div className="absolute bottom-10 left-8 z-30 hidden md:block">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-[9px] tracking-[0.4em] uppercase text-white/30"
        >
          JUHNIOS ROLD — CUIDADO CAPILAR
        </motion.div>
      </div>
    </section>
  );
}

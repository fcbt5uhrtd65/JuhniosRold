import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, ChevronRight, ArrowRight,
  Leaf, FlaskConical, Heart, MapPin,
} from 'lucide-react';
import { NavigationBar } from './NavigationBar';

const OLIVE = '#2D3A1F';

interface HeroProps {
  onLoginClick?: () => void;
}

const CircleSeal = () => (
  <div className="w-24 h-24 md:w-28 md:h-28">
    <svg viewBox="0 0 512 512" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>{`
          .cs-line { fill: none; stroke: #6f725f; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
          .cs-text { fill: #6f725f; font-family: Arial, Helvetica, sans-serif; font-size: 31px; font-weight: 600; letter-spacing: 5px; }
          .cs-text-sm { fill: #6f725f; font-family: Arial, Helvetica, sans-serif; font-size: 29px; font-weight: 600; letter-spacing: 5px; }
        `}</style>
        <path id="cs-top-arc" d="M 105 256 A 151 151 0 0 1 407 256" fill="none" />
        <path id="cs-bot-arc" d="M 407 256 A 151 151 0 0 1 105 256" fill="none" />
      </defs>

      {/* Fondo blanco */}
      <circle cx="256" cy="256" r="205" fill="white" />

      {/* Círculos exteriores */}
      <circle cx="256" cy="256" r="205" className="cs-line" />
      <circle cx="256" cy="256" r="193" className="cs-line" />

      {/* Círculo interior */}
      <circle cx="256" cy="256" r="122" className="cs-line" />

      {/* Texto superior */}
      <text className="cs-text">
        <textPath href="#cs-top-arc" startOffset="50%" textAnchor="middle">
          NATURAL · EFECTIVO
        </textPath>
      </text>

      {/* Texto inferior */}
      <text className="cs-text-sm">
        <textPath href="#cs-bot-arc" startOffset="50%" textAnchor="middle">
          CONSCIENTE
        </textPath>
      </text>

      {/* Hoja central */}
      <g transform="translate(256 256)">
        <path d="M 0 -62 C 42 -25 47 28 0 66 C -47 28 -42 -25 0 -62 Z" className="cs-line" />
        <path d="M 0 -16 L 0 78" className="cs-line" />
        <path d="M 0 20 L -25 0" className="cs-line" />
        <path d="M 0 38 L 24 18" className="cs-line" />
      </g>
    </svg>
  </div>
);

const beneficios = [
  { icon: Leaf,         label: 'Ingredientes', sub: '100% naturales' },
  { icon: FlaskConical, label: 'Sin químicos',  sub: 'agresivos' },
  { icon: Heart,        label: 'Cruelty',       sub: 'free' },
  { icon: MapPin,       label: 'Hecho con amor',sub: 'en Colombia' },
];

export function Hero({ onLoginClick }: HeroProps = {}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection]       = useState(1);
  const [isHovered, setIsHovered]       = useState(false);
  const [mousePos, setMousePos]         = useState({ x: 0.5, y: 0.5 });
  const sectionRef = useRef<HTMLElement>(null);

  const slides = [
    {
      id: 1,
      eyebrow: 'CUIDADO CAPILAR NATURAL',
      titleLine1: 'Tu cabello,',
      titleLine2: 'tu ',
      titleItalic: 'poder.',
      description: 'Productos con aceites naturales puros que nutren, reparan y dan brillo desde la primera aplicación.',
      ctaPrimary: 'Comprar ahora',
      ctaSecondary: 'Hacer diagnóstico',
      // Mujer con cabello saludable, brillante, natural — estética limpia
      image: 'https://images.unsplash.com/photo-1617897903246-719242758050?w=1600&q=90',
    },
    {
      id: 2,
      eyebrow: 'INGREDIENTES 100% NATURALES',
      titleLine1: 'Naturaleza',
      titleLine2: 'que ',
      titleItalic: 'transforma.',
      description: 'Aceites de oliva, argán, romero y uva seleccionados de los mejores orígenes del mundo.',
      ctaPrimary: 'Ver colección',
      ctaSecondary: 'Hacer diagnóstico',
      // Aceites, flores y plantas — estética botánica limpia
      image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=1600&q=90',
    },
    {
      id: 3,
      eyebrow: 'TRANSFORMACIONES REALES',
      titleLine1: 'Resultados',
      titleLine2: 'que ',
      titleItalic: 'hablan.',
      description: 'Más de 10.000 mujeres en Colombia han transformado su cabello con lo natural.',
      ctaPrimary: 'Ver resultados',
      ctaSecondary: 'Hacer diagnóstico',
      // Mujer con cabello liso brillante, cuidado natural, elegante
      image: 'https://images.unsplash.com/photo-1526045612212-70caf35c14df?w=1600&q=90',
    },
  ];

  const paginate = (newDir: number) => {
    setDirection(newDir);
    setCurrentSlide(prev => {
      if (newDir === 1) return prev === slides.length - 1 ? 0 : prev + 1;
      return prev === 0 ? slides.length - 1 : prev - 1;
    });
  };

  useEffect(() => {
    const t = setInterval(() => paginate(1), 7000);
    return () => clearInterval(t);
  }, [currentSlide]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = sectionRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
  };

  const slideVariants = {
    enter: (dir: number) => ({ clipPath: dir > 0 ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)' }),
    center: { clipPath: 'inset(0% 0% 0% 0%)', transition: { clipPath: { duration: 0.9, ease: [0.76, 0, 0.24, 1] } } },
    exit: (dir: number) => ({ clipPath: dir > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)', transition: { clipPath: { duration: 0.9, ease: [0.76, 0, 0.24, 1] } } }),
  };

  const slide = slides[currentSlide];

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden rounded-[20px] mx-3 md:mx-5 lg:mx-7"
      style={{ height: 'min(100vh, 680px)', minHeight: 480, marginTop: 14 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 z-30 h-[2px] bg-white/10">
        <motion.div
          key={currentSlide}
          className="h-full origin-left"
          style={{ backgroundColor: 'rgba(255,255,255,0.45)' }}
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
          transition={{ duration: 7, ease: 'linear' }}
        />
      </div>

      {/* ── SLIDES ── */}
      <AnimatePresence initial={false} custom={direction} mode="sync">
        <motion.div
          key={currentSlide} custom={direction}
          variants={slideVariants} initial="enter" animate="center" exit="exit"
          className="absolute inset-0"
        >
          <motion.div className="absolute inset-0" initial={{ scale: 1.06 }} animate={{ scale: 1 }} transition={{ duration: 8, ease: 'easeOut' }}>
            <img src={slide.image} alt={slide.titleLine1} className="w-full h-full object-cover object-top" loading="eager" decoding="async" />
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-r from-[#E8E0D0]/80 via-[#D5C9B5]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          <motion.div
            className="absolute inset-[-3%]"
            animate={{ x: isHovered ? (mousePos.x - 0.5) * -14 : 0, y: isHovered ? (mousePos.y - 0.5) * -10 : 0 }}
            transition={{ type: 'spring', damping: 50, stiffness: 160 }}
          />
        </motion.div>
      </AnimatePresence>

      <NavigationBar variant="transparent" onLoginClick={onLoginClick} />

      {/* ── CONTENIDO ── */}
      <div className="relative z-20 h-full flex flex-col justify-center px-6 sm:px-8 md:px-14 lg:px-20 pb-16 pt-20 sm:pt-24">
        <div className="max-w-xl">
          <AnimatePresence mode="wait">
            <div key={currentSlide}>
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
                className="flex items-center gap-3 mb-3 sm:mb-5"
              >
                <div className="w-6 sm:w-8 h-px" style={{ backgroundColor: '#8B7355' }} />
                <span className="text-[9px] sm:text-[10px] tracking-[0.3em] sm:tracking-[0.35em] uppercase font-medium text-stone-700">{slide.eyebrow}</span>
              </motion.div>

              <div className="overflow-hidden mb-1">
                <motion.div
                  initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.22, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-[68px] font-semibold text-stone-900 leading-[1.0] tracking-tight"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {slide.titleLine1}
                </motion.div>
              </div>
              <div className="overflow-hidden mb-4 sm:mb-6">
                <motion.div
                  initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.34, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-[68px] leading-[1.0] tracking-tight"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  <span className="font-light text-stone-800">{slide.titleLine2}</span>
                  <span className="font-medium italic text-stone-900">{slide.titleItalic}</span>
                </motion.div>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.55 }}
                className="text-xs sm:text-sm md:text-base text-stone-700/90 mb-5 sm:mb-8 max-w-sm leading-relaxed"
              >
                {slide.description}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62, duration: 0.5 }}
                className="flex flex-wrap gap-2.5 sm:gap-3"
              >
                <motion.a href="#resultados" whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 text-white text-[10px] sm:text-[11px] tracking-[0.15em] sm:tracking-[0.18em] uppercase font-medium rounded-full shadow-md shadow-stone-900/15 hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: OLIVE }}
                >
                  {slide.ctaPrimary}
                  <ArrowRight className="w-3 sm:w-3.5 h-3 sm:h-3.5" strokeWidth={2} />
                </motion.a>
                <motion.a href="#diagnostico" whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2 px-5 sm:px-7 py-3 sm:py-3.5 bg-white/70 backdrop-blur-sm text-stone-800 text-[10px] sm:text-[11px] tracking-[0.15em] sm:tracking-[0.18em] uppercase font-medium rounded-full border border-stone-300/60 hover:bg-white/90 transition-colors"
                >
                  {slide.ctaSecondary}
                </motion.a>
              </motion.div>
            </div>
          </AnimatePresence>
        </div>
      </div>

      {/* Barra de beneficios */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.6 }}
        className="absolute bottom-14 left-8 md:left-14 lg:left-20 z-30 hidden md:block"
      >
        <div className="flex items-center gap-px bg-white/80 backdrop-blur-md border border-stone-200/60 rounded-2xl overflow-hidden shadow-sm">
          {beneficios.map(({ icon: Icon, label, sub }, i) => (
            <div key={label} className={`flex items-center gap-2.5 px-4 py-3 ${i < beneficios.length - 1 ? 'border-r border-stone-200/60' : ''}`}>
              <div className="w-7 h-7 rounded-full bg-stone-100/80 flex items-center justify-center flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-stone-600" strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-[10px] font-medium text-stone-800 leading-none">{label}</div>
                <div className="text-[9px] text-stone-500 mt-0.5 leading-none">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Sello circular */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, rotate: -10 }} animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: 1.1, duration: 0.7, type: 'spring', stiffness: 120 }}
        className="absolute bottom-12 right-8 md:right-10 z-30"
      >
        <CircleSeal />
      </motion.div>

      {/* Controles slider */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4">
        <motion.button onClick={() => paginate(-1)} whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
          className="w-8 h-8 rounded-full bg-white/60 backdrop-blur-sm border border-white/50 flex items-center justify-center text-stone-700 hover:bg-white/80 transition-colors shadow-sm"
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2} />
        </motion.button>
        <div className="flex items-center gap-2">
          {slides.map((_, i) => (
            <button key={i}
              onClick={() => { setDirection(i > currentSlide ? 1 : -1); setCurrentSlide(i); }}
              className={`rounded-full transition-all duration-500 ${i === currentSlide ? 'w-7 h-1.5 bg-stone-700' : 'w-1.5 h-1.5 bg-stone-400/50 hover:bg-stone-500/70'}`}
            />
          ))}
        </div>
        <motion.button onClick={() => paginate(1)} whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
          className="w-8 h-8 rounded-full bg-white/60 backdrop-blur-sm border border-white/50 flex items-center justify-center text-stone-700 hover:bg-white/80 transition-colors shadow-sm"
        >
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
        </motion.button>
      </div>
    </section>
  );
}

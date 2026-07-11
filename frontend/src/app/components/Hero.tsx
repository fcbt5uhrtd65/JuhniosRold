import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Leaf } from 'lucide-react';
import { NavigationBar } from './NavigationBar';
import header1 from '../../assets/header1.png';
import header2 from '../../assets/header2.png';

interface HeroProps {
  onLoginClick?: () => void;
}

const SLIDES = [
  { id: 1, image: header1, alt: 'Compra la línea completa Cebolla y llévate gratis un aceite de coco o aguacate' },
  { id: 2, image: header2, alt: 'Envíos gratis en compras superiores a $130.000' },
];

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

export function Hero({ onLoginClick }: HeroProps = {}) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev === SLIDES.length - 1 ? 0 : prev + 1));
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      className="relative overflow-hidden rounded-[20px] mx-3 md:mx-5 lg:mx-7"
      style={{ height: 'min(100vh, 680px)', minHeight: 480, marginTop: 14 }}
    >
      {/* Fondo: rota entre las imágenes del banner */}
      <AnimatePresence initial={false} mode="sync">
        <motion.img
          key={SLIDES[currentSlide].id}
          src={SLIDES[currentSlide].image}
          alt={SLIDES[currentSlide].alt}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          decoding="async"
        />
      </AnimatePresence>

      <NavigationBar variant="transparent" onLoginClick={onLoginClick} />

      {/* Barra de beneficio único */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}
        className="absolute bottom-14 left-8 md:left-14 lg:left-20 z-30 hidden md:block"
      >
        <div className="flex items-center gap-2.5 px-4 py-3 bg-white/80 backdrop-blur-md border border-stone-200/60 rounded-2xl shadow-sm">
          <div className="w-7 h-7 rounded-full bg-stone-100/80 flex items-center justify-center flex-shrink-0">
            <Leaf className="w-3.5 h-3.5 text-stone-600" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-[10px] font-medium text-stone-800 leading-none">Ingredientes</div>
            <div className="text-[9px] text-stone-500 mt-0.5 leading-none">100% naturales</div>
          </div>
        </div>
      </motion.div>

      {/* Sello circular */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, rotate: -10 }} animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: 0.6, duration: 0.7, type: 'spring', stiffness: 120 }}
        className="absolute bottom-12 right-8 md:right-10 z-30"
      >
        <CircleSeal />
      </motion.div>

      {/* Puntos de navegación */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.id}
            onClick={() => setCurrentSlide(i)}
            aria-label={`Ver imagen ${i + 1}`}
            className={`rounded-full transition-all duration-500 ${i === currentSlide ? 'w-7 h-1.5 bg-stone-700' : 'w-1.5 h-1.5 bg-stone-400/50 hover:bg-stone-500/70'}`}
          />
        ))}
      </div>
    </section>
  );
}

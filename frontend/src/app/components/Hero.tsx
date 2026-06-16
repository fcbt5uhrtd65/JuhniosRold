import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, ChevronRight, ArrowRight,
  Leaf, FlaskConical, Heart, MapPin,
  Search, X, User, Bell, ChevronDown,
} from 'lucide-react';
import { ShoppingCart } from './ShoppingCart';
import { UserDropdown } from './UserDropdown';
import { useSearch } from '../contexts/SearchContext';
import { useUser } from '../contexts/UserContext';

const OLIVE = '#2D3A1F';

interface HeroProps {
  onLoginClick?: () => void;
}

/* ── Iconos ── */
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

const LeafLogo = () => (
  <svg width="20" height="16" viewBox="0 0 28 22" fill="none">
    <path d="M14 20C14 20 4 14 4 7C4 3.5 7 1 10.5 1C12 1 13.2 1.6 14 2.5C14.8 1.6 16 1 17.5 1C21 1 24 3.5 24 7C24 14 14 20 14 20Z" stroke="rgba(255,255,255,0.8)" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 20V6" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="1.5 2"/>
    <path d="M14 10C12 8.5 9 8 7 9" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" strokeLinecap="round"/>
    <path d="M14 14C16 12.5 19 12 21 13" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" strokeLinecap="round"/>
  </svg>
);

const CircleSeal = () => (
  <div className="relative w-24 h-24 md:w-28 md:h-28">
    <svg viewBox="0 0 120 120" className="w-full h-full" style={{ transform: 'rotate(-15deg)' }}>
      <defs>
        <path id="circle-top2" d="M 60,60 m -42,0 a 42,42 0 1,1 84,0 a 42,42 0 1,1 -84,0" />
        <path id="circle-bottom2" d="M 60,60 m -38,0 a 38,38 0 1,0 76,0 a 38,38 0 1,0 -76,0" />
      </defs>
      <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
      <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
      <text fontSize="9" fill="rgba(255,255,255,0.9)" letterSpacing="3.5" fontFamily="'Space Grotesk', sans-serif" fontWeight="500">
        <textPath href="#circle-top2" startOffset="8%">NATURAL · EFECTIVO ·</textPath>
      </text>
      <text fontSize="9" fill="rgba(255,255,255,0.9)" letterSpacing="3.5" fontFamily="'Space Grotesk', sans-serif" fontWeight="500">
        <textPath href="#circle-bottom2" startOffset="18%">CONSCIENTE ·</textPath>
      </text>
      <g transform="translate(60,60)">
        <path d="M0 -12 C-6-8 -8-2 -6 4 C-4 8 0 12 0 12 C0 12 4 8 6 4 C8-2 6-8 0-12Z"
          fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1" strokeLinecap="round"/>
        <line x1="0" y1="12" x2="0" y2="-8" stroke="rgba(255,255,255,0.6)" strokeWidth="0.7" strokeDasharray="1.5 2"/>
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

const mainNavLinks = [
  { href: '#',            label: 'Inicio',          hasDropdown: false },
  { href: '#productos',   label: 'Productos',       hasDropdown: true  },
  { href: '#diagnostico', label: 'Diagnóstico',     hasDropdown: false },
  { href: '#resultados',  label: 'Antes y Después', hasDropdown: false },
  { href: '#pro',         label: 'Modo PRO',        hasDropdown: false },
];

export function Hero({ onLoginClick }: HeroProps = {}) {
  const { searchQuery, setSearchQuery, isSearchOpen, setIsSearchOpen } = useSearch();
  const { currentUser, orders } = useUser();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection]       = useState(1);
  const [isHovered, setIsHovered]       = useState(false);
  const [mousePos, setMousePos]         = useState({ x: 0.5, y: 0.5 });
  const [scrolled, setScrolled]         = useState(false);
  const [hidden, setHidden]             = useState(false);
  const [activeLink, setActiveLink]     = useState('#');
  const lastScrollY = useRef(0);
  const sectionRef = useRef<HTMLElement>(null);

  interface Notification { id: string; type: 'order' | 'promo'; message: string; read: boolean; }
  const notifications: Notification[] = currentUser ? [
    ...orders.filter(o => o.estado === 'enviado').map(o => ({
      id: o.id, type: 'order' as const, message: `Tu pedido #${o.id} está en camino`, read: false,
    })),
    { id: 'promo-1', type: 'promo' as const, message: '¡Nuevo descuento exclusivo!', read: false },
  ] : [];

  const slides = [
    {
      id: 1,
      eyebrow: 'TRANSFORMACIONES REALES',
      titleLine1: 'Resultados',
      titleLine2: 'que ',
      titleItalic: 'hablan.',
      description: 'Más de 10.000 mujeres en toda Colombia han transformado su cabello con lo natural.',
      ctaPrimary: 'Ver resultados',
      ctaSecondary: 'Hacer diagnóstico',
      image: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=1600&q=90',
    },
    {
      id: 2,
      eyebrow: 'CUIDADO CAPILAR NATURAL',
      titleLine1: 'Tu cabello,',
      titleLine2: 'tu ',
      titleItalic: 'poder.',
      description: 'Productos naturales diseñados para mujeres que no piden permiso para brillar.',
      ctaPrimary: 'Comprar ahora',
      ctaSecondary: 'Hacer diagnóstico',
      image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1600&q=90',
    },
    {
      id: 3,
      eyebrow: 'MARCA COLOMBIANA',
      titleLine1: 'Naturaleza',
      titleLine2: 'que ',
      titleItalic: 'transforma.',
      description: 'Ingredientes puros, ciencia y amor en cada frasco. Certificados y cruelty-free.',
      ctaPrimary: 'Ver colección',
      ctaSecondary: 'Hacer diagnóstico',
      image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1600&q=90',
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

  useEffect(() => {
    const fn = () => {
      const current = window.scrollY;
      setScrolled(current > 40);
      if (current < 80) setHidden(false);
      else if (current > lastScrollY.current + 4) setHidden(true);
      else if (current < lastScrollY.current - 4) setHidden(false);
      lastScrollY.current = current;
    };
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const handleNavClick = (href: string, e: React.MouseEvent) => {
    if (href === '#') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    setActiveLink(href);
  };

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
      style={{ height: '100vh', minHeight: 600, marginTop: 14 }}
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

      {/* ── NAVBAR TRANSPARENTE DENTRO DEL HERO ── */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: hidden ? -90 : 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="absolute left-0 right-0 z-40 transition-all duration-300"
        style={{ top: '16px' }}
      >
        <div className={`mx-4 md:mx-6 lg:mx-8 px-5 md:px-7 rounded-[16px] transition-all duration-400 ${
          scrolled
            ? 'bg-white/15 backdrop-blur-md border border-white/20 shadow-[0_4px_24px_rgba(0,0,0,0.12)]'
            : 'bg-white/8 backdrop-blur-sm border border-white/12'
        }`}>
          <div className="flex items-center justify-between h-[62px] gap-4">

            {/* Logo */}
            <a href="#" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex-shrink-0 flex items-center gap-2.5 cursor-pointer group">
              <div className="opacity-80 group-hover:opacity-100 transition-opacity">
                <LeafLogo />
              </div>
              <div>
                <div className="text-[12.5px] tracking-[0.2em] uppercase font-semibold text-white leading-none">
                  JUHNIOS ROLD
                </div>
                <div className="text-[7px] tracking-[0.24em] uppercase mt-0.5 font-light" style={{ color: 'rgba(196,169,125,0.9)' }}>
                  CUIDADO CAPILAR NATURAL
                </div>
              </div>
            </a>

            {/* Links centrales */}
            <nav className="hidden lg:flex items-center gap-0">
              {mainNavLinks.map(link => {
                const isActive = activeLink === link.href;
                return (
                  <a
                    key={link.href}
                    href={link.href === '#' ? undefined : link.href}
                    onClick={e => handleNavClick(link.href, e)}
                    className={`relative flex items-center gap-1 px-4 h-[62px] text-[11.5px] tracking-[0.07em] transition-colors duration-200 ${
                      isActive ? 'text-white font-medium' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {link.label}
                    {link.hasDropdown && <ChevronDown className="w-3 h-3 opacity-50" strokeWidth={1.5} />}
                    {isActive && (
                      <motion.div
                        layoutId="activeNavHero"
                        className="absolute bottom-0 left-3 right-3 h-[2px] rounded-t-full bg-white/60"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                  </a>
                );
              })}
            </nav>

            {/* Derecha */}
            <div className="flex items-center gap-1.5">

              {/* Buscador */}
              <div className="hidden md:flex items-center">
                <AnimatePresence mode="wait">
                  {isSearchOpen ? (
                    <motion.div key="open"
                      initial={{ width: 0, opacity: 0 }} animate={{ width: 190, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }} className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/15 border border-white/20 rounded-full backdrop-blur-sm">
                        <Search className="w-3.5 h-3.5 text-white/60 flex-shrink-0" strokeWidth={1.5} />
                        <input autoFocus type="search" placeholder="Buscar…"
                          value={searchQuery}
                          onChange={e => { setSearchQuery(e.target.value); if (e.target.value) document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' }); }}
                          className="bg-transparent text-[12px] focus:outline-none placeholder:text-white/40 text-white w-full"
                        />
                        <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}>
                          <X className="w-3 h-3 text-white/50 hover:text-white transition-colors" strokeWidth={1.5} />
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.button key="closed"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => setIsSearchOpen(true)}
                      className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <Search className="w-4 h-4" strokeWidth={1.5} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Notificaciones */}
              {currentUser && notifications.length > 0 && (
                <button className="relative p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all hidden md:block">
                  <Bell className="w-4 h-4" strokeWidth={1.5} />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-400 rounded-full" />
                </button>
              )}

              {/* Cuenta */}
              <div className="hidden md:block">
                {currentUser ? (
                  <UserDropdown />
                ) : (
                  <button onClick={onLoginClick}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <User className="w-4 h-4" strokeWidth={1.5} />
                    <span className="text-[11px] tracking-wide hidden xl:inline">Mi cuenta</span>
                  </button>
                )}
              </div>

              {/* Carrito */}
              <div className="rounded-full border border-white/20 bg-white/10 backdrop-blur-sm">
                <ShoppingCart onLoginRequired={onLoginClick} />
              </div>

              {/* CTA */}
              <motion.a
                href="#catalogo"
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                className="hidden md:inline-flex items-center gap-2 px-5 py-2 text-white text-[10.5px] tracking-[0.16em] uppercase font-semibold rounded-full transition-opacity hover:opacity-88"
                style={{ backgroundColor: OLIVE }}
              >
                Comprar ahora
              </motion.a>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── CONTENIDO ── */}
      <div className="relative z-20 h-full flex flex-col justify-center px-8 md:px-14 lg:px-20 pb-20 pt-24">
        <div className="max-w-xl">
          <AnimatePresence mode="wait">
            <div key={currentSlide}>
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
                className="flex items-center gap-3 mb-5"
              >
                <div className="w-8 h-px" style={{ backgroundColor: '#8B7355' }} />
                <span className="text-[10px] tracking-[0.35em] uppercase font-medium text-stone-700">{slide.eyebrow}</span>
              </motion.div>

              <div className="overflow-hidden mb-1">
                <motion.div
                  initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.22, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="text-5xl md:text-6xl lg:text-[68px] font-semibold text-stone-900 leading-[1.0] tracking-tight"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {slide.titleLine1}
                </motion.div>
              </div>
              <div className="overflow-hidden mb-6">
                <motion.div
                  initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.34, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="text-5xl md:text-6xl lg:text-[68px] leading-[1.0] tracking-tight"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  <span className="font-light text-stone-800">{slide.titleLine2}</span>
                  <span className="font-medium italic text-stone-900">{slide.titleItalic}</span>
                </motion.div>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.55 }}
                className="text-sm md:text-base text-stone-700/90 mb-8 max-w-sm leading-relaxed"
              >
                {slide.description}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62, duration: 0.5 }}
                className="flex flex-wrap gap-3"
              >
                <motion.a href="#resultados" whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 text-white text-[11px] tracking-[0.18em] uppercase font-medium rounded-full shadow-md shadow-stone-900/15 hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: OLIVE }}
                >
                  {slide.ctaPrimary}
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
                </motion.a>
                <motion.a href="#diagnostico" whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-white/70 backdrop-blur-sm text-stone-800 text-[11px] tracking-[0.18em] uppercase font-medium rounded-full border border-stone-300/60 hover:bg-white/90 transition-colors"
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

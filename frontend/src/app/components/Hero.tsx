import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, ChevronRight, ArrowRight,
  Leaf, FlaskConical, Heart, MapPin,
  Search, X, User, Bell, ChevronDown,
  Package, Tag, Info, AlertCircle, CheckCheck,
  Instagram,
} from 'lucide-react';
import { ShoppingCart } from './ShoppingCart';
import { UserDropdown } from './UserDropdown';
import { useSearch } from '../contexts/SearchContext';
import { useUser } from '../contexts/UserContext';
import { useNotifications } from '../contexts/NotificationsContext';
import type { NotificationType } from '../services/notifications.service';

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
    <path d="M14 20C14 20 4 14 4 7C4 3.5 7 1 10.5 1C12 1 13.2 1.6 14 2.5C14.8 1.6 16 1 17.5 1C21 1 24 3.5 24 7C24 14 14 20 14 20Z" stroke="#8B7355" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 20V6" stroke="#8B7355" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="1.5 2"/>
    <path d="M14 10C12 8.5 9 8 7 9" stroke="#8B7355" strokeWidth="0.8" strokeLinecap="round"/>
    <path d="M14 14C16 12.5 19 12 21 13" stroke="#8B7355" strokeWidth="0.8" strokeLinecap="round"/>
  </svg>
);

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

const mainNavLinks = [
  { href: '#',            label: 'Inicio',          hasDropdown: false },
  { href: '#productos',   label: 'Productos',       hasDropdown: true  },
  { href: '/catalogo',    label: 'Catálogo',        hasDropdown: false },
  { href: '#diagnostico', label: 'Diagnóstico',     hasDropdown: false },
  { href: '#resultados',  label: 'Antes y Después', hasDropdown: false },
  { href: '#pro',         label: 'Modo PRO',        hasDropdown: false },
];

function notifIcon(type: NotificationType) {
  if (type.startsWith('order')) return <Package className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />;
  if (type === 'promo') return <Tag className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />;
  if (type === 'order_cancelled') return <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />;
  return <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />;
}

function notifColor(type: NotificationType) {
  if (type === 'order_confirmed' || type === 'order_delivered') return 'text-emerald-500';
  if (type === 'order_shipped') return 'text-blue-500';
  if (type === 'order_cancelled') return 'text-red-400';
  if (type === 'promo') return 'text-amber-500';
  if (type === 'wholesale_activated') return 'text-violet-500';
  return 'text-stone-400';
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return 'Ahora';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  return `Hace ${Math.floor(diff / 86400)} d`;
}

export function Hero({ onLoginClick }: HeroProps = {}) {
  const { searchQuery, setSearchQuery, isSearchOpen, setIsSearchOpen } = useSearch();
  const { currentUser } = useUser();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection]       = useState(1);
  const [isHovered, setIsHovered]       = useState(false);
  const [mousePos, setMousePos]         = useState({ x: 0.5, y: 0.5 });
  const [scrolled, setScrolled]         = useState(false);
  const [hidden, setHidden]             = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeLink, setActiveLink]     = useState('#');
  const [menuOpen, setMenuOpen]         = useState(false);
  const lastScrollY = useRef(0);
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

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleNavClick = (href: string, e: React.MouseEvent) => {
    if (href.startsWith('/') && href !== '/') {
      e.preventDefault();
      window.history.pushState({}, '', href);
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.dispatchEvent(new Event('app:navigate'));
      return;
    }
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

      {/* ── NAVBAR TRANSPARENTE DENTRO DEL HERO ── */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: hidden ? -90 : 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="absolute left-0 right-0 z-40 transition-all duration-300"
        style={{ top: '16px' }}
      >
        <div className={`mx-4 md:mx-6 lg:mx-8 px-5 md:px-7 rounded-[16px] transition-all duration-400 bg-white/90 backdrop-blur-md border border-white/40 ${
          scrolled
            ? 'shadow-[0_4px_24px_rgba(0,0,0,0.12)]'
            : 'shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
        }`}>
          <div className="flex items-center justify-between h-[62px] gap-4">

            {/* Logo */}
            <a href="#" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="flex-shrink-0 flex items-center gap-2.5 cursor-pointer group">
              <div className="opacity-80 group-hover:opacity-100 transition-opacity">
                <LeafLogo />
              </div>
              <div>
                <div className="text-[12.5px] tracking-[0.2em] uppercase font-semibold text-stone-900 leading-none">
                  JUHNIOS ROLD
                </div>
                <div className="text-[7px] tracking-[0.24em] uppercase mt-0.5 font-light text-[#8B7355]">
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
                      isActive ? 'text-stone-900 font-medium' : 'text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    {link.label}
                    {link.hasDropdown && <ChevronDown className="w-3 h-3 opacity-50" strokeWidth={1.5} />}
                    {isActive && (
                      <motion.div
                        layoutId="activeNavHero"
                        className="absolute bottom-0 left-3 right-3 h-[2px] rounded-t-full"
                        style={{ backgroundColor: OLIVE }}
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
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-full">
                        <Search className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" strokeWidth={1.5} />
                        <input autoFocus type="search" placeholder="Buscar…"
                          value={searchQuery}
                          onChange={e => { setSearchQuery(e.target.value); if (e.target.value) document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' }); }}
                          className="bg-transparent text-[12px] focus:outline-none placeholder:text-stone-400 text-stone-700 w-full"
                        />
                        <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}>
                          <X className="w-3 h-3 text-stone-400 hover:text-stone-600 transition-colors" strokeWidth={1.5} />
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.button key="closed"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => setIsSearchOpen(true)}
                      className="p-2 rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-all"
                    >
                      <Search className="w-4 h-4" strokeWidth={1.5} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Notificaciones */}
              {currentUser && (
                <div className="relative hidden md:block">
                  <button
                    onClick={() => setShowNotifications(v => !v)}
                    className="relative p-2 rounded-full text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-all"
                  >
                    <Bell className="w-4 h-4" strokeWidth={1.5} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[9px] font-semibold border-2 border-white shadow-sm">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>
                  <AnimatePresence>
                    {showNotifications && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.16 }}
                        className="absolute right-0 mt-2 w-80 bg-white border border-stone-100 shadow-xl rounded-2xl z-50 overflow-hidden"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
                          <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-stone-500">
                            Notificaciones {unreadCount > 0 && `· ${unreadCount} nueva${unreadCount > 1 ? 's' : ''}`}
                          </span>
                          {unreadCount > 0 && (
                            <button
                              onClick={markAllRead}
                              className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-stone-700 transition-colors"
                            >
                              <CheckCheck className="w-3 h-3" strokeWidth={2} /> Marcar todas
                            </button>
                          )}
                        </div>
                        {/* Lista */}
                        <div className="max-h-72 overflow-y-auto divide-y divide-stone-50">
                          {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 gap-2">
                              <Bell className="w-6 h-6 text-stone-200" strokeWidth={1} />
                              <p className="text-xs text-stone-400">Sin notificaciones</p>
                            </div>
                          ) : notifications.map(n => (
                            <button
                              key={n.id}
                              onClick={() => {
                                markRead(n.id);
                                if (n.action_url) {
                                  window.history.pushState({}, '', n.action_url);
                                  window.dispatchEvent(new Event('app:navigate'));
                                  setShowNotifications(false);
                                }
                              }}
                              className={`w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors flex gap-3 ${!n.read ? 'bg-stone-50/60' : ''}`}
                            >
                              <span className={notifColor(n.type)}>{notifIcon(n.type)}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs leading-snug truncate ${n.read ? 'text-stone-500' : 'font-semibold text-stone-800'}`}>
                                  {n.title}
                                </p>
                                <p className="text-[11px] text-stone-400 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                                <p className="text-[10px] text-stone-300 mt-1">{timeAgo(n.created_at)}</p>
                              </div>
                              {!n.read && <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Cuenta */}
              <div className="hidden md:block">
                {currentUser ? (
                  <UserDropdown />
                ) : (
                  <button onClick={onLoginClick}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all"
                  >
                    <User className="w-4 h-4" strokeWidth={1.5} />
                    <span className="text-[11px] tracking-wide hidden xl:inline">Mi cuenta</span>
                  </button>
                )}
              </div>

              {/* Carrito */}
              <div className="rounded-full border border-stone-200">
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

              {/* Hamburguesa mobile */}
              <button
                onClick={() => setMenuOpen(true)}
                className="lg:hidden flex flex-col gap-[5px] p-2 rounded-full hover:bg-stone-100 transition-colors"
                aria-label="Abrir menú"
              >
                <span className="block w-4 h-px bg-stone-700" />
                <span className="block w-3 h-px bg-stone-400" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── MENÚ LATERAL MOBILE ── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 bg-black/25 backdrop-blur-sm z-[150]"
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-0 right-0 bottom-0 z-[160] w-full max-w-xs bg-white shadow-2xl flex flex-col rounded-l-3xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-7 py-5 border-b border-stone-100">
                <div>
                  <div className="text-[13px] tracking-[0.22em] uppercase font-semibold text-stone-900">JUHNIOS ROLD</div>
                  <div className="text-[8px] tracking-[0.25em] uppercase text-[#8B7355] mt-0.5">CUIDADO CAPILAR NATURAL</div>
                </div>
                <button onClick={() => setMenuOpen(false)} className="p-2 rounded-full hover:bg-stone-100 transition-colors">
                  <X className="w-4 h-4 text-stone-400" strokeWidth={1.5} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-4 py-3">
                <div className="space-y-0.5">
                  {[
                    { href: '#',          label: 'Inicio',     sub: 'Volver al inicio' },
                    { href: '/catalogo',  label: 'Catálogo',   sub: 'Flipbook comercial' },
                    { href: '#productos', label: 'Productos',  sub: 'Colección completa' },
                    { href: '#aceites',   label: 'Aceites',    sub: 'Naturales & premium' },
                    { href: '#mayorista', label: 'Mayorista',  sub: 'Materias primas' },
                    { href: '#pro',       label: 'Modo PRO',   sub: 'Programa profesional' },
                    { href: '#comunidad', label: 'Comunidad',  sub: 'Comunidad & rituales' },
                    { href: '#diagnostico', label: 'Diagnóstico', sub: 'Test capilar' },
                  ].map((link, i) => (
                    <motion.div key={link.href}
                      initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 + i * 0.045 }}
                    >
                      <a
                        href={link.href === '#' ? undefined : link.href}
                        onClick={e => { handleNavClick(link.href, e); setMenuOpen(false); }}
                        className={`group flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-200 ${activeLink === link.href ? 'bg-stone-100' : 'hover:bg-stone-50'}`}
                      >
                        <div>
                          <div className="text-[14px] font-light text-stone-800">{link.label}</div>
                          <div className="text-[9px] tracking-[0.18em] uppercase text-stone-400 mt-0.5">{link.sub}</div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
                      </a>
                    </motion.div>
                  ))}
                </div>
              </nav>
              <div className="px-6 py-5 border-t border-stone-100 space-y-3">
                {!currentUser && (
                  <button
                    onClick={() => { setMenuOpen(false); onLoginClick?.(); }}
                    className="w-full py-3 text-white text-[11px] tracking-[0.18em] uppercase font-medium rounded-xl hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: OLIVE }}
                  >
                    Iniciar sesión
                  </button>
                )}
                <a href="#catalogo" onClick={() => setMenuOpen(false)}
                  className="w-full py-3 border border-stone-200 text-stone-700 text-[11px] tracking-[0.18em] uppercase font-medium rounded-xl hover:bg-stone-50 transition-colors flex items-center justify-center"
                >
                  Comprar ahora
                </a>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[9px] tracking-[0.25em] uppercase text-stone-400">Síguenos</span>
                  <div className="flex items-center gap-3">
                    <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-stone-700 transition-colors">
                      <Instagram className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </a>
                  </div>
                </div>
                <div className="text-[9px] text-stone-300">© 2026 Juhnios Rold · Colombia</div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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

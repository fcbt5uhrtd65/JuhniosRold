import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, User, Gift, Heart, Sparkles, Bell, ChevronRight, ArrowRight } from 'lucide-react';
import { ShoppingCart } from './ShoppingCart';
import { UserDropdown } from './UserDropdown';
import { useSearch } from '../contexts/SearchContext';
import { useUser } from '../contexts/UserContext';

interface NavbarProps {
  onLoginClick?: () => void;
}

interface Notification {
  id: string;
  type: 'order' | 'promo' | 'info';
  message: string;
  read: boolean;
}

interface SeasonalCampaign {
  month: number;
  event: string;
  ribbon: string;
  icon: any;
  discount: string;
  product: string;
  bgColor: string;
  textColor: string;
}

const navLinks = [
  { href: '#',          label: 'Inicio',      sub: 'Volver al inicio' },
  { href: '#productos', label: 'Productos',    sub: 'Colección completa' },
  { href: '#aceites',   label: 'Aceites',      sub: 'Naturales & premium' },
  { href: '#bebe',      label: 'Bebé',         sub: 'Cuidado especial' },
  { href: '#mayorista', label: 'Mayorista',    sub: 'Materias primas' },
  { href: '#pro',       label: 'Pro',          sub: 'Programa profesional' },
  { href: '#comunidad', label: 'Experiencia',  sub: 'Comunidad & rituales' },
  { href: '#contacto',  label: 'Contacto',     sub: 'Escríbenos' },
];

export function Navbar({ onLoginClick }: NavbarProps = {}) {
  const { searchQuery, setSearchQuery, isSearchOpen, setIsSearchOpen } = useSearch();
  const { currentUser, orders } = useUser();
  const [scrolled, setScrolled]           = useState(false);
  const [menuOpen, setMenuOpen]           = useState(false);
  const [showModal, setShowModal]         = useState(false);
  const [showBanner, setShowBanner]       = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const [bannerHeight, setBannerHeight]   = useState(64);

  useEffect(() => {
    const seen = sessionStorage.getItem('hasSeenSeasonalModal');
    if (!seen) {
      const t = setTimeout(() => setShowModal(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  const notifications: Notification[] = currentUser ? [
    ...orders
      .filter(o => o.estado === 'enviado')
      .map(o => ({ id: o.id, type: 'order' as const, message: `Tu pedido #${o.id} está en camino`, read: false })),
    { id: 'promo-1', type: 'promo' as const, message: '¡Nuevo descuento exclusivo disponible!', read: false },
  ] : [];

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleCloseModal = () => {
    setShowModal(false);
    setShowBanner(true);
    sessionStorage.setItem('hasSeenSeasonalModal', 'true');
  };

  const campaigns: SeasonalCampaign[] = [
    { month: 5,  event: 'Día de las Madres', ribbon: 'Para ella',  icon: Heart,    discount: '40% de descuento', product: 'Colección completa',    bgColor: 'from-rose-50 to-pink-50',   textColor: 'text-rose-900'  },
    { month: 3,  event: 'Día de la Mujer',   ribbon: '8 de marzo', icon: Sparkles, discount: '35% de descuento', product: 'Aceites premium',        bgColor: 'from-purple-50 to-pink-50', textColor: 'text-purple-900'},
    { month: 6,  event: 'Día del Padre',     ribbon: 'Para él',    icon: Gift,     discount: '30% de descuento', product: 'Productos seleccionados', bgColor: 'from-blue-50 to-slate-50',  textColor: 'text-slate-900' },
    { month: 12, event: 'Fin de Año',        ribbon: 'Especial',   icon: Gift,     discount: '25% de descuento', product: 'Kits de regalo',         bgColor: 'from-amber-50 to-yellow-50',textColor: 'text-amber-900' },
    { month: 2,  event: 'Amor y Amistad',    ribbon: 'Febrero',    icon: Heart,    discount: '30% de descuento', product: 'Dúos y kits',            bgColor: 'from-red-50 to-pink-50',    textColor: 'text-red-900'   },
  ];

  const currentMonth   = new Date().getMonth() + 1;
  const activeCampaign = campaigns.find(c => c.month === currentMonth);
  const bannerShown    = !!(activeCampaign && showBanner);

  useEffect(() => {
    if (!bannerShown || !bannerRef.current) return;
    const update = () => setBannerHeight(bannerRef.current?.offsetHeight ?? 64);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [bannerShown]);

  return (
    <>
      {/* ── Seasonal Modal ── */}
      {activeCampaign && showModal && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-rose-50 max-w-4xl w-full overflow-hidden"
          >
            <button onClick={handleCloseModal} className="absolute top-4 right-4 p-2 hover:opacity-50 transition-opacity z-10 text-gray-600">
              <X className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <div className="grid md:grid-cols-2">
              <div className="relative h-[220px] sm:h-[320px] md:h-auto">
                <img src="https://images.unsplash.com/photo-1752652011858-302f08a6dc9f?w=800&q=80" alt="Mamá e hija" className="w-full h-full object-cover" />
              </div>
              <div className="p-6 sm:p-8 md:p-12 flex flex-col justify-center">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="flex items-center gap-2 text-rose-400 mb-6">
                  <Heart className="w-4 h-4" strokeWidth={1.5} />
                  <span className="text-[10px] tracking-[0.3em] uppercase">Para ella</span>
                </motion.div>
                <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-3xl md:text-4xl leading-tight mb-6 text-gray-900">
                  Para quien siempre estuvo
                </motion.h2>
                <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="text-sm text-gray-600 mb-8 leading-relaxed">
                  Este mes celebramos el cuidado que transformó
                </motion.p>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mb-8">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[10px] tracking-[0.2em] uppercase text-gray-500">Hasta</span>
                    <span className="text-5xl font-light text-rose-600">40%</span>
                  </div>
                  <p className="text-xs text-gray-500 tracking-wide">en productos seleccionados este mayo</p>
                </motion.div>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex items-center gap-2 text-xs text-gray-500 mb-8">
                  <Gift className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span>Disponible durante mayo</span>
                </motion.div>
                <motion.button
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                  whileHover={{ scale: 1.02 }} onClick={handleCloseModal}
                  className="flex items-center justify-center gap-2 w-full py-4 bg-rose-700 text-white text-xs tracking-[0.25em] uppercase hover:bg-rose-800 transition-colors"
                >
                  Descubrir colección <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ── Seasonal Banner ── */}
      {bannerShown && (
        <motion.div
          ref={bannerRef}
          initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className={`fixed top-0 left-0 right-0 z-50 bg-gradient-to-r ${activeCampaign!.bgColor} border-b border-border/50`}
        >
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 md:px-12 py-3 md:py-5">
            <div className="flex items-center justify-between gap-2 md:gap-4">
              <div className="flex items-center gap-2 md:gap-4 shrink-0">
                <motion.div
                  initial={{ rotate: -5, scale: 0.9 }} animate={{ rotate: 0, scale: 1 }} transition={{ delay: 0.3, type: 'spring' }}
                  className={`relative px-3 py-1.5 bg-background/90 backdrop-blur-sm border border-border ${activeCampaign!.textColor}`}
                >
                  <div className="flex items-center gap-1.5">
                    {activeCampaign!.icon && <activeCampaign.icon className="w-3 h-3" strokeWidth={1.5} />}
                    <span className="text-[9px] tracking-[0.2em] uppercase font-medium">{activeCampaign!.ribbon}</span>
                  </div>
                </motion.div>
                <span className={`hidden lg:block text-xs ${activeCampaign!.textColor}/60 tracking-wide`}>{activeCampaign!.event}</span>
              </div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex-1 text-center min-w-0">
                <div className={`${activeCampaign!.textColor} flex flex-wrap items-baseline justify-center gap-x-1.5 gap-y-0`}>
                  <span className="text-base md:text-2xl font-serif tracking-tight">{activeCampaign!.discount}</span>
                  <span className="text-[10px] md:text-sm opacity-60">en</span>
                  <span className="text-xs md:text-base font-light hidden sm:inline">{activeCampaign!.product}</span>
                </div>
              </motion.div>
              <div className="flex items-center gap-2 shrink-0">
                <motion.a href="#catalogo" whileHover={{ scale: 1.05 }} className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background text-[10px] tracking-[0.25em] uppercase hover:opacity-90 transition-opacity">
                  Ver productos
                </motion.a>
                <button onClick={() => setShowBanner(false)} className={`p-2 hover:opacity-50 transition-opacity ${activeCampaign!.textColor}/60`} aria-label="Cerrar">
                  <X className="w-4 h-4" strokeWidth={1} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Main Navbar ── */}
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed left-0 right-0 z-40 transition-all duration-500 ${
          scrolled ? 'bg-background/95 backdrop-blur-md border-b border-border' : 'bg-transparent'
        }`}
        style={{ top: bannerShown ? `${bannerHeight}px` : '0' }}
      >
        <div className="max-w-[1400px] mx-auto px-8 md:px-12">
          <div className="flex items-center justify-between py-5">

            {/* Logo */}
            <motion.a
              href="#"
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="relative group cursor-pointer"
            >
              <div className="text-xs tracking-[0.35em] uppercase">JUHNIOS ROLD</div>
              <motion.div
                className="absolute -bottom-1 left-0 h-px bg-foreground"
                initial={{ width: '2rem' }}
                whileHover={{ width: '100%' }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              />
            </motion.a>

            {/* Right actions */}
            <div className="flex items-center gap-5">

              {/* Search */}
              <motion.button
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className="hover:opacity-50 transition-opacity"
                title="Buscar"
              >
                <Search className="w-4 h-4" strokeWidth={1} />
              </motion.button>

              {/* Notifications */}
              {currentUser && (
                <div className="relative hidden md:block">
                  <motion.button
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="hover:opacity-50 transition-opacity relative"
                  >
                    <Bell className="w-4 h-4" strokeWidth={1} />
                    {notifications.filter(n => !n.read).length > 0 && (
                      <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-foreground rounded-full" />
                    )}
                  </motion.button>
                  <AnimatePresence>
                    {showNotifications && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="absolute right-0 mt-4 w-80 bg-background border border-border shadow-xl z-50"
                      >
                        <div className="p-4 border-b border-border">
                          <div className="text-[10px] tracking-[0.25em] uppercase">Notificaciones</div>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-6 text-center text-xs text-muted-foreground">Sin notificaciones</div>
                          ) : notifications.map(n => (
                            <div key={n.id} className="p-4 border-b border-border hover:bg-secondary transition-colors">
                              <div className="flex gap-3">
                                <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${n.type === 'order' ? 'bg-blue-500' : n.type === 'promo' ? 'bg-green-500' : 'bg-gray-400'}`} />
                                <div className="text-xs flex-1">{n.message}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* User */}
              {currentUser ? (
                <UserDropdown />
              ) : (
                <motion.button
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={onLoginClick}
                  className="hover:opacity-50 transition-opacity"
                  title="Iniciar sesión"
                >
                  <User className="w-4 h-4" strokeWidth={1} />
                </motion.button>
              )}

              {/* Cart */}
              <ShoppingCart onLoginRequired={onLoginClick} />

              {/* Menu trigger — two clean lines */}
              <button
                onClick={() => setMenuOpen(true)}
                className="flex flex-col gap-[5px] group ml-1 p-1"
                aria-label="Abrir menú"
              >
                <span className="block w-5 h-px bg-current transition-opacity group-hover:opacity-40" />
                <span className="block w-3 h-px bg-current transition-opacity group-hover:opacity-40" />
              </button>
            </div>
          </div>

          {/* Search bar */}
          <AnimatePresence>
            {isSearchOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="border-t border-border overflow-hidden"
              >
                <div className="py-5">
                  <input
                    type="search" placeholder="Buscar productos..." autoFocus
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (e.target.value) document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full bg-transparent border-b border-border pb-2 text-xs focus:outline-none focus:border-foreground transition-colors placeholder:text-muted-foreground"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.nav>

      {/* ── Slide-in Menu Panel (right side) ── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 bg-foreground/10 backdrop-blur-sm z-40"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm bg-background border-l border-border flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-border">
                <span className="tracking-[0.4em] uppercase text-muted-foreground text-[17px]">MENÚ</span>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="hover:opacity-50 transition-opacity"
                  aria-label="Cerrar menú"
                >
                  <X className="w-4 h-4" strokeWidth={1} />
                </button>
              </div>

              {/* Nav links */}
              <nav className="flex-1 flex flex-col justify-start px-[24px] py-[0px] pt-2 m-[0px]">
                <div className="space-y-0">
                  {navLinks.map((link, i) => (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                      className="border-b border-border last:border-0"
                    >
                      <a
                        href={link.href === '#' ? undefined : link.href}
                        onClick={(e) => {
                          if (link.href === '#') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
                          setMenuOpen(false);
                        }}
                        className="group flex items-center justify-between py-4 hover:pl-2 transition-all duration-300"
                      >
                        <div>
                          <div className="tracking-wide text-foreground group-hover:opacity-60 transition-opacity text-[17px]">
                            {link.label}
                          </div>
                          <div className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground mt-0.5">
                            {link.sub}
                          </div>
                        </div>
                        <ArrowRight
                          className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300"
                          strokeWidth={1.5}
                        />
                      </a>
                    </motion.div>
                  ))}
                </div>
              </nav>

              {/* Footer */}
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                className="px-8 py-6 border-t border-border space-y-4"
              >
                {/* Login if not logged in */}
                {!currentUser && (
                  <button
                    onClick={() => { setMenuOpen(false); onLoginClick?.(); }}
                    className="flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <User className="w-3.5 h-3.5" strokeWidth={1} />
                    Iniciar sesión
                  </button>
                )}
                <div className="flex items-center gap-5">
                  <span className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground">Síguenos</span>
                  {['IG', 'TK', 'FB'].map(s => (
                    <span key={s} className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition-colors cursor-pointer">{s}</span>
                  ))}
                </div>
                <div className="text-[9px] text-muted-foreground">
                  © 2026 Juhnios Rold · Bogotá, Colombia
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, X, User, Bell, Package, Tag, Info, AlertCircle,
  ChevronRight, ArrowRight, ChevronDown, Instagram, CheckCheck,
  Heart, Settings, LogOut,
} from 'lucide-react';
import { ShoppingCart } from './ShoppingCart';
import { UserDropdown } from './UserDropdown';
import { useSearch } from '../contexts/SearchContext';
import { useUser } from '../contexts/UserContext';
import { useNotifications } from '../contexts/NotificationsContext';
import type { NotificationType } from '../services/notifications.service';
import { navigateTo } from '../services/navigate';

interface NavbarProps {
  onLoginClick?: () => void;
}

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

const LeafIcon = () => (
  <svg width="22" height="18" viewBox="0 0 28 22" fill="none">
    <path d="M14 20C14 20 4 14 4 7C4 3.5 7 1 10.5 1C12 1 13.2 1.6 14 2.5C14.8 1.6 16 1 17.5 1C21 1 24 3.5 24 7C24 14 14 20 14 20Z" stroke="#8B7355" strokeWidth="1" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M14 20V6" stroke="#8B7355" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="1.5 2"/>
    <path d="M14 10C12 8.5 9 8 7 9" stroke="#8B7355" strokeWidth="0.8" strokeLinecap="round"/>
    <path d="M14 14C16 12.5 19 12 21 13" stroke="#8B7355" strokeWidth="0.8" strokeLinecap="round"/>
  </svg>
);

const mainNavLinks = [
  { href: '#',            label: 'Inicio',         hasDropdown: false },
  { href: '#productos',   label: 'Productos',      hasDropdown: true  },
  { href: '/catalogo',    label: 'Catálogo',       hasDropdown: false },
  { href: '#diagnostico', label: 'Diagnóstico',    hasDropdown: false },
  { href: '#resultados',  label: 'Antes y Después',hasDropdown: false },
  { href: '#pro',         label: 'Modo PRO',       hasDropdown: false },
];

const allNavLinks = [
  { href: '#',          label: 'Inicio',     sub: 'Volver al inicio' },
  { href: '/catalogo',  label: 'Catálogo',   sub: 'Flipbook comercial' },
  { href: '#productos', label: 'Productos',  sub: 'Colección completa' },
  { href: '#aceites',   label: 'Aceites',    sub: 'Naturales & premium' },
  { href: '#bebe',      label: 'Bebé',       sub: 'Cuidado especial' },
  { href: '#mayorista', label: 'Mayorista',  sub: 'Materias primas' },
  { href: '#pro',       label: 'Modo PRO',   sub: 'Programa profesional' },
  { href: '#comunidad', label: 'Comunidad',  sub: 'Comunidad & rituales' },
  { href: '#contacto',  label: 'Contacto',   sub: 'Escríbenos' },
];

const OLIVE = '#2D3A1F';

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

export function Navbar({ onLoginClick }: NavbarProps = {}) {
  const { searchQuery, setSearchQuery, isSearchOpen, setIsSearchOpen } = useSearch();
  const { currentUser, logout, orders, savedProducts } = useUser();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [scrolled, setScrolled]                   = useState(false);
  const [hidden, setHidden]                        = useState(false);
  const [menuOpen, setMenuOpen]                   = useState(false);
  const [showModal, setShowModal]                 = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeLink, setActiveLink]               = useState('#');
  const lastScrollY = useRef(0);

  useEffect(() => {
    const seen = sessionStorage.getItem('hasSeenSeasonalModal');
    if (!seen) {
      const t = setTimeout(() => setShowModal(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const fn = () => {
      const current = window.scrollY;
      setScrolled(current > 40);
      if (current < 80) {
        setHidden(false);
      } else if (current > lastScrollY.current + 4) {
        setHidden(true);
      } else if (current < lastScrollY.current - 4) {
        setHidden(false);
      }
      lastScrollY.current = current;
    };
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const handleCloseModal = () => {
    setShowModal(false);
    sessionStorage.setItem('hasSeenSeasonalModal', 'true');
  };

  const handleNavClick = (href: string, e: React.MouseEvent) => {
    if (href.startsWith('/')) {
      e.preventDefault();
      setMenuOpen(false);
      window.history.pushState({}, '', href);
      window.dispatchEvent(new PopStateEvent('popstate'));
      window.dispatchEvent(new Event('app:navigate'));
      return;
    }
    const offHome = window.location.pathname !== '/';
    if (href.startsWith('#') && offHome) {
      e.preventDefault();
      setMenuOpen(false);
      navigateTo(href === '#' ? '/' : `/${href}`);
      return;
    }
    if (href === '#') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    setActiveLink(href);
    setMenuOpen(false);
  };

  return (
    <>
      {/* ── MODAL BIENVENIDA ── */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-[#F7F3EE] max-w-3xl w-full overflow-hidden rounded-3xl shadow-2xl"
            >
              <button onClick={handleCloseModal} className="absolute top-4 right-4 p-2 hover:opacity-50 transition-opacity z-10 text-stone-500">
                <X className="w-5 h-5" strokeWidth={1.5} />
              </button>
              <div className="grid md:grid-cols-2">
                <div className="relative h-[220px] sm:h-[300px] md:h-auto">
                  <img src="https://images.unsplash.com/photo-1752652011858-302f08a6dc9f?w=800&q=80" alt="Juhnios Rold" className="w-full h-full object-cover" />
                </div>
                <div className="p-8 md:p-12 flex flex-col justify-center">
                  <div className="flex items-center gap-2 text-[#8B7355] mb-5">
                    <Heart className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span className="text-[10px] tracking-[0.3em] uppercase">Juhnios Rold</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-light leading-snug mb-4 text-stone-800" style={{ fontFamily: "'Playfair Display', serif" }}>
                    Belleza natural que transforma
                  </h2>
                  <p className="text-sm text-stone-500 mb-6 leading-relaxed">
                    Descubre nuestra colección de cuidado capilar con ingredientes 100% naturales.
                  </p>
                  <div className="flex items-baseline gap-2 mb-7">
                    <span className="text-[10px] tracking-[0.2em] uppercase text-stone-400">Envío gratis desde</span>
                    <span className="text-3xl font-light text-stone-800">$80.000</span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }} onClick={handleCloseModal}
                    className="flex items-center justify-center gap-2 w-full py-3.5 text-white text-[11px] tracking-[0.2em] uppercase font-medium rounded-xl"
                    style={{ backgroundColor: OLIVE }}
                  >
                    Explorar colección <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NAVBAR — pill flotante con bordes redondeados ── */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: hidden ? -90 : 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed left-3 right-3 md:left-5 md:right-5 lg:left-7 lg:right-7 z-40"
        style={{ top: '14px' }}
      >
        <div className={`bg-white rounded-[20px] transition-shadow duration-300 ${
          scrolled ? 'shadow-[0_4px_24px_rgba(0,0,0,0.10)]' : 'shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
        }`}>
          <div className="px-5 md:px-7 lg:px-9">
            <div className="flex items-center justify-between h-[68px] gap-4">

              {/* LOGO */}
              <a
                href="#"
                onClick={e => {
                  e.preventDefault();
                  if (window.location.pathname !== '/') { navigateTo('/'); return; }
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex-shrink-0 flex items-center gap-2.5 cursor-pointer group"
              >
                <div className="opacity-80 group-hover:opacity-100 transition-opacity">
                  <LeafIcon />
                </div>
                <div>
                  <div className="text-[13.5px] tracking-[0.2em] uppercase font-semibold text-stone-900 leading-none">
                    JUHNIOS ROLD
                  </div>
                  <div className="text-[7.5px] tracking-[0.28em] uppercase text-[#8B7355] mt-0.5 font-light">
                    CUIDADO CAPILAR NATURAL
                  </div>
                </div>
              </a>

              {/* MENÚ CENTRAL */}
              <nav className="hidden lg:flex items-center gap-0">
                {mainNavLinks.map(link => {
                  const isActive = activeLink === link.href;
                  return (
                    <a
                      key={link.href}
                      href={link.href === '#' ? undefined : link.href}
                      onClick={e => handleNavClick(link.href, e)}
                      className={`relative flex items-center gap-1 px-4 h-[68px] text-[12px] tracking-[0.07em] transition-colors duration-200 ${
                        isActive ? 'text-stone-900 font-medium' : 'text-stone-500 hover:text-stone-900'
                      }`}
                    >
                      {link.label}
                      {link.hasDropdown && <ChevronDown className="w-3 h-3 opacity-50" strokeWidth={1.5} />}
                      {isActive && (
                        <motion.div
                          layoutId="activeNav"
                          className="absolute bottom-0 left-3 right-3 h-[2px] rounded-t-full"
                          style={{ backgroundColor: OLIVE }}
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                      )}
                    </a>
                  );
                })}
              </nav>

              {/* DERECHA */}
              <div className="flex items-center gap-2">

                {/* Buscador */}
                <div className="hidden md:flex items-center">
                  <AnimatePresence mode="wait">
                    {isSearchOpen ? (
                      <motion.div
                        key="search-open"
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 200, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-2 px-3 py-2 bg-stone-50 border border-stone-200 rounded-full">
                          <Search className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" strokeWidth={1.5} />
                          <input
                            autoFocus type="search" placeholder="Buscar productos…"
                            value={searchQuery}
                            onChange={e => {
                              setSearchQuery(e.target.value);
                              if (e.target.value) document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="bg-transparent text-[12px] focus:outline-none placeholder:text-stone-400 text-stone-700 w-full"
                          />
                          <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }}>
                            <X className="w-3 h-3 text-stone-400 hover:text-stone-600 transition-colors" strokeWidth={1.5} />
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="search-closed"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={() => setIsSearchOpen(true)}
                        className="p-2 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-all"
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
                      onClick={() => setShowNotifications(!showNotifications)}
                      className="relative p-2 rounded-full hover:bg-stone-100 text-stone-500 hover:text-stone-700 transition-all"
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
                              <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
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
                                {!n.read && (
                                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                                )}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Mi cuenta */}
                <div className="hidden md:block">
                  {currentUser ? (
                    <UserDropdown />
                  ) : (
                    <button
                      onClick={onLoginClick}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full hover:bg-stone-100 text-stone-600 hover:text-stone-900 transition-all"
                    >
                      <User className="w-4 h-4" strokeWidth={1.5} />
                      <span className="text-[11px] tracking-wide hidden xl:inline">Mi cuenta</span>
                    </button>
                  )}
                </div>

                {/* Carrito */}
                <div className="border border-stone-200 rounded-full">
                  <ShoppingCart onLoginRequired={onLoginClick} />
                </div>

                {/* CTA Comprar ahora */}
                <motion.a
                  href="#catalogo"
                  onClick={e => handleNavClick('#catalogo', e)}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 text-white text-[11px] tracking-[0.15em] uppercase font-medium rounded-full hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: OLIVE }}
                >
                  Comprar ahora
                  <ArrowRight className="w-3 h-3" strokeWidth={2} />
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

              <div className="px-5 py-4 border-b border-stone-100">
                <div className="flex items-center gap-2.5 px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-full">
                  <Search className="w-3.5 h-3.5 text-stone-400" strokeWidth={1.5} />
                  <input type="search" placeholder="Buscar productos…"
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="bg-transparent text-[12px] focus:outline-none placeholder:text-stone-400 text-stone-700 w-full"
                  />
                </div>
              </div>

              <nav className="flex-1 overflow-y-auto px-4 py-3">
                <div className="space-y-0.5">
                  {allNavLinks.map((link, i) => (
                    <motion.div key={link.href}
                      initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 + i * 0.045 }}
                    >
                      <a
                        href={link.href === '#' ? undefined : link.href}
                        onClick={e => handleNavClick(link.href, e)}
                        className={`group flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-200 ${
                          activeLink === link.href ? 'bg-stone-100' : 'hover:bg-stone-50'
                        }`}
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
                {currentUser ? (
                  <>
                    {/* Perfil del usuario */}
                    <div className="flex items-center gap-3 px-1 pb-2 border-b border-stone-100">
                      <div className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-stone-500" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-stone-800 truncate">{currentUser.nombre}</div>
                        <div className="text-[10px] text-stone-400 truncate">{currentUser.email}</div>
                      </div>
                    </div>

                    {/* Accesos rápidos */}
                    <div className="space-y-0.5">
                      <button
                        onClick={() => { setMenuOpen(false); navigateTo('/perfil?s=pedidos'); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors text-left"
                      >
                        <Package className="w-4 h-4 text-stone-400" strokeWidth={1.5} />
                        <div className="flex-1">
                          <div className="text-[13px] text-stone-700">Mis Pedidos</div>
                          {orders.length > 0 && (
                            <div className="text-[10px] text-stone-400">{orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}</div>
                          )}
                        </div>
                        {orders.filter(o => o.estado === 'pendiente').length > 0 && (
                          <span className="min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-stone-800 text-white text-[9px] font-semibold">
                            {orders.filter(o => o.estado === 'pendiente').length}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => { setMenuOpen(false); navigateTo('/perfil?s=guardados'); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors text-left"
                      >
                        <Heart className="w-4 h-4 text-stone-400" strokeWidth={1.5} />
                        <div className="flex-1">
                          <div className="text-[13px] text-stone-700">Guardados</div>
                          {savedProducts.length > 0 && (
                            <div className="text-[10px] text-stone-400">{savedProducts.length} {savedProducts.length === 1 ? 'producto' : 'productos'}</div>
                          )}
                        </div>
                      </button>

                      {/* Notificaciones en mobile */}
                      <button
                        onClick={() => { setMenuOpen(false); setShowNotifications(true); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors text-left"
                      >
                        <Bell className="w-4 h-4 text-stone-400" strokeWidth={1.5} />
                        <div className="flex-1">
                          <div className="text-[13px] text-stone-700">Notificaciones</div>
                        </div>
                        {unreadCount > 0 && (
                          <span className="min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-semibold">
                            {unreadCount > 9 ? '9+' : unreadCount}
                          </span>
                        )}
                      </button>

                      <button
                        onClick={() => { setMenuOpen(false); navigateTo('/perfil'); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors text-left"
                      >
                        <Settings className="w-4 h-4 text-stone-400" strokeWidth={1.5} />
                        <div className="text-[13px] text-stone-700">Mi Perfil</div>
                      </button>

                      <button
                        onClick={() => { setMenuOpen(false); logout(); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 transition-colors text-left"
                      >
                        <LogOut className="w-4 h-4 text-red-400" strokeWidth={1.5} />
                        <div className="text-[13px] text-red-500">Cerrar Sesión</div>
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => { setMenuOpen(false); onLoginClick?.(); }}
                    className="w-full py-3 text-white text-[11px] tracking-[0.18em] uppercase font-medium rounded-xl hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: OLIVE }}
                  >
                    Iniciar sesión
                  </button>
                )}

                {!currentUser && (
                  <a href="#catalogo" onClick={e => handleNavClick('#catalogo', e)}
                    className="w-full py-3 border border-stone-200 text-stone-700 text-[11px] tracking-[0.18em] uppercase font-medium rounded-xl hover:bg-stone-50 transition-colors flex items-center justify-center"
                  >
                    Comprar ahora
                  </a>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[9px] tracking-[0.25em] uppercase text-stone-400">Síguenos</span>
                  <div className="flex items-center gap-3">
                    <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-stone-700 transition-colors">
                      <Instagram className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </a>
                    <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" className="text-stone-400 hover:text-stone-700 transition-colors">
                      <TikTokIcon className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
                <div className="text-[9px] text-stone-300">© 2026 Juhnios Rold · Bogotá, Colombia</div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Package, Heart, LogOut, ChevronDown, Settings } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { MyOrders } from './MyOrders';
import { SavedProducts } from './SavedProducts';
import { UserProfile } from './UserProfile';

export function UserDropdown() {
  const { currentUser, logout, savedProducts, orders } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!currentUser) return null;

  // Extract first name
  const firstName = currentUser.nombre.split(' ')[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 hover:opacity-70 transition-opacity"
      >
        <div className="hidden md:flex items-center gap-2">
          <span className="text-[10px] tracking-[0.15em] uppercase">{firstName}</span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-3 h-3" strokeWidth={1} />
          </motion.div>
        </div>
        <div className="md:hidden">
          <User className="w-4 h-4" strokeWidth={1} />
        </div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-4 w-64 bg-background border border-border shadow-2xl z-50"
          >
            {/* User Info Header */}
            <div className="p-5 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary border border-border flex items-center justify-center">
                  <User className="w-4 h-4" strokeWidth={1} />
                </div>
                <div>
                  <div className="text-sm font-medium">{currentUser.nombre}</div>
                  <div className="text-[10px] text-muted-foreground">{currentUser.email}</div>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="p-2">
              <motion.button
                whileHover={{ x: 4 }}
                onClick={() => {
                  setIsOpen(false);
                  setShowOrders(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors text-left"
              >
                <Package className="w-4 h-4" strokeWidth={1} />
                <div className="flex-1">
                  <div className="text-xs">Mis Pedidos</div>
                  {orders.length > 0 && (
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
                    </div>
                  )}
                </div>
                {orders.filter(o => o.estado === 'pendiente').length > 0 && (
                  <div className="w-5 h-5 bg-foreground text-background text-[9px] flex items-center justify-center">
                    {orders.filter(o => o.estado === 'pendiente').length}
                  </div>
                )}
              </motion.button>

              <motion.button
                whileHover={{ x: 4 }}
                onClick={() => {
                  setIsOpen(false);
                  setShowSaved(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors text-left"
              >
                <Heart className="w-4 h-4" strokeWidth={1} />
                <div className="flex-1">
                  <div className="text-xs">Guardados</div>
                  {savedProducts.length > 0 && (
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      {savedProducts.length} {savedProducts.length === 1 ? 'producto' : 'productos'}
                    </div>
                  )}
                </div>
              </motion.button>

              <motion.button
                whileHover={{ x: 4 }}
                onClick={() => {
                  setIsOpen(false);
                  setShowProfile(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors text-left"
              >
                <Settings className="w-4 h-4" strokeWidth={1} />
                <div className="text-xs">Mi Perfil</div>
              </motion.button>

              <div className="h-px bg-border my-2" />

              <motion.button
                whileHover={{ x: 4 }}
                onClick={() => {
                  logout();
                  setIsOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary transition-colors text-left text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" strokeWidth={1} />
                <div className="text-xs">Cerrar Sesión</div>
              </motion.button>
            </div>

            {/* Decorative Footer */}
            <div className="h-1 bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <MyOrders isOpen={showOrders} onClose={() => setShowOrders(false)} />
      <SavedProducts isOpen={showSaved} onClose={() => setShowSaved(false)} />
      <UserProfile isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
}

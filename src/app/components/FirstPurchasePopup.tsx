import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export function FirstPurchasePopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      const hasSeenPopup = localStorage.getItem('hasSeenFirstPurchasePopup');
      if (!hasSeenPopup) {
        setIsOpen(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('hasSeenFirstPurchasePopup', 'true');
    setIsOpen(false);
    // Aquí iría la lógica para guardar el email
  };

  const handleClose = () => {
    localStorage.setItem('hasSeenFirstPurchasePopup', 'true');
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-foreground/90 z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-background p-8 max-w-md w-full relative"
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 hover:opacity-50 transition-opacity"
            >
              <X className="w-4 h-4" strokeWidth={1} />
            </button>

            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-4">
              BIENVENIDA
            </div>

            <h3 className="text-3xl mb-4">
              15% OFF<br />
              Primera compra
            </h3>

            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              Únete a nuestra comunidad y recibe un descuento exclusivo en tu primera compra.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full px-3 py-3 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground transition-colors"
              />
              <button
                type="submit"
                className="w-full py-3 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90 transition-opacity"
              >
                Obtener descuento
              </button>
            </form>

            <div className="mt-4 text-[10px] text-center text-muted-foreground">
              * Válido solo para nuevos clientes
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

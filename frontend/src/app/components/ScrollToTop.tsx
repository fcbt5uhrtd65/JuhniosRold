import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp } from 'lucide-react';

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const getScrollY = () => Math.max(
      window.scrollY,
      document.documentElement.scrollTop,
      document.body.scrollTop,
    );
    const onScroll = () => setVisible(getScrollY() > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.3 }}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleClick}
          className="fixed bottom-24 right-6 z-[60] w-10 h-10 bg-background border border-border flex items-center justify-center hover:border-foreground hover:bg-foreground hover:text-background transition-all shadow-sm"
          aria-label="Volver arriba"
        >
          <ArrowUp className="w-4 h-4" strokeWidth={1.5} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

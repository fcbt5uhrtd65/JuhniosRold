import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY = 'jr_cookie_consent';

type CookieConsent = 'accepted' | 'rejected';

export function CookieConsentBar() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem(STORAGE_KEY) === null);
  }, []);

  const saveConsent = (value: CookieConsent) => {
    localStorage.setItem(STORAGE_KEY, value);
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -18, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="fixed left-0 right-0 top-0 z-[140] border-b border-emerald-200/70 bg-[#DDF7EE] text-[#2D3A1F] shadow-[0_8px_24px_rgba(45,58,31,0.08)]"
          role="dialog"
          aria-label="Aviso de cookies"
        >
          <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="min-w-0 flex-1 pr-8 lg:pr-0">
              <p className="text-[13px] font-semibold leading-tight sm:text-sm">Este sitio usa cookies</p>
              <p className="mt-0.5 text-[12px] leading-snug text-stone-700 sm:text-[13px]">
                Al continuar navegando en Juhnios Rold, aceptas el uso de cookies propias y de terceros para mejorar tu experiencia, personalizar contenido y analizar la interacción de los usuarios.
              </p>
              {expanded && (
                <p className="mt-2 text-[12px] leading-snug text-stone-600 sm:text-[13px]">
                  Usamos cookies esenciales para funciones como sesión y carrito. Las cookies no esenciales nos ayudan a medir el rendimiento y mejorar el sitio.
                </p>
              )}
              <button
                type="button"
                onClick={() => setExpanded(value => !value)}
                className="mt-1 text-[12px] font-semibold text-[#007C83] underline-offset-2 transition-colors hover:text-[#005F64] hover:underline active:text-[#004F53] touch-manipulation"
              >
                {expanded ? 'Ver menos' : 'Más información'}
              </button>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-shrink-0">
              <button
                type="button"
                onClick={() => saveConsent('rejected')}
                className="h-10 rounded-full border border-[#007C83]/35 px-5 text-[13px] font-semibold text-[#007C83] transition-all hover:border-[#007C83] hover:bg-white/45 active:scale-[0.98] touch-manipulation"
              >
                Rechazar
              </button>
              <button
                type="button"
                onClick={() => saveConsent('accepted')}
                className="h-10 rounded-full bg-[#007C83] px-6 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-[#006A70] active:scale-[0.98] touch-manipulation"
              >
                Aceptar todo
              </button>
            </div>

            <button
              type="button"
              onClick={() => saveConsent('rejected')}
              className="absolute right-2.5 top-2.5 rounded-full p-2 text-[#2D3A1F]/75 transition-all hover:bg-white/45 hover:text-[#2D3A1F] active:scale-95 touch-manipulation"
              aria-label="Cerrar aviso de cookies"
            >
              <X className="h-4 w-4" strokeWidth={1.7} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

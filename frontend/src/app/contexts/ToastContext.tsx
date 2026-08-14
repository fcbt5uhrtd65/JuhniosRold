import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const recentToastsRef = useRef<Map<string, number>>(new Map());

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const dedupeKey = `${type}:${message}`;
    const now = Date.now();
    const lastShown = recentToastsRef.current.get(dedupeKey);
    if (lastShown && now - lastShown < 1500) {
      return;
    }
    recentToastsRef.current.set(dedupeKey, now);

    const id = Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, message, type };

    setToasts(prev => [...prev, newToast]);

    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 4000);
  }, []);

  const success = useCallback((message: string) => showToast(message, 'success'), [showToast]);
  const error = useCallback((message: string) => showToast(message, 'error'), [showToast]);
  const info = useCallback((message: string) => showToast(message, 'info'), [showToast]);
  const warning = useCallback((message: string) => showToast(message, 'warning'), [showToast]);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5" strokeWidth={1.5} />;
      case 'error':
        return <XCircle className="w-5 h-5" strokeWidth={1.5} />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" strokeWidth={1.5} />;
      case 'info':
        return <Info className="w-5 h-5" strokeWidth={1.5} />;
    }
  };

  const getIconColor = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'text-emerald-600 bg-emerald-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'warning':
        return 'text-amber-600 bg-amber-50';
      case 'info':
        return 'text-sky-600 bg-sky-50';
    }
  };

  const value = useMemo(
    () => ({ showToast, success, error, info, warning }),
    [showToast, success, error, info, warning],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-6 right-6 z-[300] space-y-3 pointer-events-none max-w-[calc(100vw-2rem)]">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-stone-800 shadow-[0_18px_50px_rgba(28,25,23,0.16)] min-w-[280px] max-w-md pointer-events-auto"
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${getIconColor(toast.type)}`}>
                {getIcon(toast.type)}
              </span>
              <div className="flex-1 text-sm">{toast.message}</div>
              <button
                onClick={() => removeToast(toast.id)}
                className="opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Cerrar notificación"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

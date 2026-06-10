// ============================================================
// ApiStatus — Backend connection indicator
// Shows a subtle pill when backend is online/offline
// ============================================================

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wifi, WifiOff } from 'lucide-react';
import { isBackendAvailable } from '../services/api';

export function ApiStatus() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    isBackendAvailable().then(status => {
      setOnline(status);
      setVisible(true);
      // Auto-hide after 4s if online
      if (status) {
        setTimeout(() => setVisible(false), 4000);
      }
    });
  }, []);

  return (
    <AnimatePresence>
      {visible && online !== null && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          className={`fixed bottom-6 left-6 z-50 flex items-center gap-2 px-3 py-2 text-[10px] tracking-widest uppercase border ${
            online
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          {online ? (
            <>
              <Wifi className="w-3 h-3" strokeWidth={1.5} />
              <span>API conectada</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" strokeWidth={1.5} />
              <span>Modo demo — sin backend</span>
              <button
                onClick={() => setVisible(false)}
                className="ml-2 opacity-50 hover:opacity-100"
              >
                ✕
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

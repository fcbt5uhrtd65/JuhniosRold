import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gift, Share2, Award, Copy, Check, MessageCircle } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

export function ReferralProgram() {
  const { currentUser } = useUser();
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Generate a deterministic code from user info or random
  useEffect(() => {
    if (currentUser) {
      const base = currentUser.nombre?.split(' ')[0].toUpperCase() || 'JR';
      setReferralCode(`${base}${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
    } else {
      setReferralCode(`JR${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
    }
  }, [currentUser]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = referralCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    const msg = `¡Usa mi código ${referralCode} en Juhnios Rold y obtén 15% de descuento en tu primera compra! 🌿`;
    if (navigator.share) {
      navigator.share({ title: 'Juhnios Rold — Código de referido', text: msg, url: 'https://juhniosrold.com' });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  return (
    <section className="py-20 bg-foreground text-background">
      <div className="max-w-[1400px] mx-auto px-8 md:px-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="text-[10px] tracking-[0.3em] uppercase opacity-60 mb-4">
            PROGRAMA DE REFERIDOS
          </div>
          <h2 className="text-4xl md:text-5xl leading-none mb-6">
            Comparte y gana
          </h2>
          <p className="text-xs opacity-70 max-w-2xl mx-auto leading-relaxed">
            Refiere a tus amigas y ambas ganan descuentos. Mientras más compartes, más ahorras.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-px bg-background/10 mb-16">
          {[
            { icon: Share2, step: '01', title: 'Comparte tu código', desc: 'Cada cliente tiene un código único para compartir con amigas' },
            { icon: Gift, step: '02', title: 'Tu amiga ahorra', desc: 'Ella obtiene 15% de descuento en su primera compra' },
            { icon: Award, step: '03', title: 'Tú también ganas', desc: 'Recibes 20% de descuento en tu próxima compra' },
          ].map(({ icon: Icon, step, title, desc }) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-8 bg-foreground"
            >
              <div className="text-[10px] tracking-[0.3em] uppercase opacity-40 mb-4">{step}</div>
              <div className="w-12 h-12 mb-6 border border-background/20 flex items-center justify-center">
                <Icon className="w-5 h-5" strokeWidth={1} />
              </div>
              <div className="text-base mb-3">{title}</div>
              <p className="text-xs opacity-60 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Code Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-md mx-auto"
        >
          <div className="text-center mb-6">
            <div className="text-[10px] tracking-[0.2em] uppercase opacity-60 mb-2">
              Tu código de referido
            </div>
            <div className="text-[9px] opacity-40 tracking-wide">
              Válido para nuevos clientes · 30 días de vigencia
            </div>
          </div>

          {/* Code display */}
          <div className="flex items-center gap-0 mb-4">
            <div className="flex-1 py-4 px-6 bg-background/10 border border-background/20 text-center">
              <span className="text-xl tracking-[0.4em] font-mono">{referralCode}</span>
            </div>
            <button
              onClick={handleCopy}
              className="py-4 px-5 border border-background/20 border-l-0 hover:bg-background/10 transition-colors flex items-center justify-center"
              title="Copiar código"
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Check className="w-4 h-4" strokeWidth={1.5} />
                  </motion.div>
                ) : (
                  <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Copy className="w-4 h-4" strokeWidth={1.5} />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={handleCopy}
              whileHover={{ opacity: 0.85 }}
              whileTap={{ scale: 0.98 }}
              className="py-3 bg-background text-foreground text-xs tracking-wider uppercase flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Copy className="w-3.5 h-3.5" strokeWidth={1.5} />}
              {copied ? 'Copiado' : 'Copiar'}
            </motion.button>
            <motion.button
              onClick={handleShare}
              whileHover={{ opacity: 0.85 }}
              whileTap={{ scale: 0.98 }}
              className="py-3 bg-transparent border border-background/40 text-background text-xs tracking-wider uppercase flex items-center justify-center gap-2 hover:border-background transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.5} />
              Compartir
            </motion.button>
          </div>

          <p className="text-center text-[10px] opacity-40 mt-4">
            * Disponible para cuentas registradas
          </p>
        </motion.div>
      </div>
    </section>
  );
}

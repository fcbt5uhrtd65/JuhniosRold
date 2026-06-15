import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { Copy, Check, Link, Share2, User } from 'lucide-react';
import { useUser } from '../contexts/UserContext';

const OLIVE = '#2D3A1F';

const GiftSvg = () => (
  <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
    <rect x="2" y="9" width="18" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
    <line x1="11" y1="9" x2="11" y2="20" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M11 9 C11 9 8 9 7 7 C6 5 7 3 9 4 C10.5 4.5 11 6 11 9Z" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
    <path d="M11 9 C11 9 14 9 15 7 C16 5 15 3 13 4 C11.5 4.5 11 6 11 9Z" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
    <line x1="2" y1="13" x2="20" y2="13" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);

export function ReferralProgram() {
  const { currentUser } = useUser();
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: '-60px' });

  useEffect(() => {
    const base = currentUser?.nombre?.split(' ')[0].toUpperCase() || 'JR';
    setReferralCode(`${base}${Math.random().toString(36).substring(2, 6).toUpperCase()}`);
  }, [currentUser]);

  const handleCopy = async (type: 'code' | 'link') => {
    const text = type === 'code'
      ? referralCode
      : `https://juhniosrold.com/?ref=${referralCode}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleShare = () => {
    const msg = `¡Usa mi código ${referralCode} en Juhnios Rold y obtén 15% de descuento en tu primera compra! 🌿 juhniosrold.com/?ref=${referralCode}`;
    if (navigator.share) {
      navigator.share({ title: 'Juhnios Rold — Código de referido', text: msg });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  const steps = [
    {
      num: '01',
      Icon: Share2,
      title: 'Comparte tu código',
      desc: 'Cada clienta tiene un código único y personal para compartir con sus amigas.',
      img: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=200&q=80',
    },
    {
      num: '02',
      Icon: GiftSvg,
      title: 'Tu amiga ahorra',
      desc: 'Ella recibe 15% de descuento en su primera compra con tu código.',
      img: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=200&q=80',
    },
    {
      num: '03',
      Icon: User,
      title: 'Tú también ganas',
      desc: 'Recibes 20% de descuento en tu próxima compra automáticamente.',
      img: 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=200&q=80',
    },
  ];

  return (
    <section ref={sectionRef} className="relative py-24 bg-white overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-14">

        {/* ── HEADER ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.65 }}
          className="mb-16"
        >
          <p className="text-[9px] tracking-[0.42em] uppercase text-stone-400 mb-5">
            Programa de referidos
          </p>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <h2
              className="text-[52px] md:text-[68px] lg:text-[80px] font-light text-stone-900 leading-[0.92] tracking-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Comparte y{' '}
              <em style={{ fontStyle: 'italic', color: OLIVE }}>gana</em>
            </h2>
            <p className="text-[13px] text-stone-400 leading-relaxed max-w-[280px] lg:mb-1">
              Refiere a tus amigas y ambas reciben descuentos exclusivos. El cuidado capilar premium, compartido.
            </p>
          </div>
        </motion.div>

        {/* ── STATS INLINE ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-wrap items-center gap-0 mb-16 border-y border-stone-100 py-6"
        >
          {[
            { value: '15%', label: 'Descuento para tu amiga' },
            { value: '20%', label: 'Descuento para ti' },
            { value: '5', label: 'Referidos por código' },
          ].map(({ value, label }, i) => (
            <div key={label} className={`flex-1 min-w-[140px] px-6 ${i < 2 ? 'border-r border-stone-100' : ''}`}>
              <span
                className="block text-[32px] font-light text-stone-900 leading-none mb-1"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {value}
              </span>
              <span className="text-[10.5px] text-stone-400 uppercase tracking-[0.18em]">{label}</span>
            </div>
          ))}
        </motion.div>

        {/* ── DOS COLUMNAS ── */}
        <div className="grid lg:grid-cols-2 gap-8 items-start">

          {/* Pasos */}
          <div className="space-y-3">
            {steps.map(({ num, Icon, title, desc, img }, i) => (
              <motion.div
                key={num}
                initial={{ opacity: 0, x: -16 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.18 + i * 0.1 }}
                className="flex items-center gap-5 p-5 rounded-2xl border border-stone-100 hover:border-stone-200 hover:bg-stone-50/50 transition-all duration-200 group"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 border border-stone-100 group-hover:border-stone-200 transition-colors">
                  <img src={img} alt={title} className="w-full h-full object-cover" draggable={false} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[8.5px] tracking-[0.32em] uppercase text-stone-300 mb-1">{num}</div>
                  <h3 className="text-[13.5px] font-medium text-stone-900 mb-1 leading-snug">{title}</h3>
                  <p className="text-[11.5px] text-stone-400 leading-relaxed">{desc}</p>
                </div>

                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 opacity-40 group-hover:opacity-70 transition-opacity"
                  style={{ color: OLIVE }}
                >
                  {typeof Icon === 'function' && (Icon as React.FC).length === 0
                    ? <Icon />
                    : <Icon className="w-4 h-4" strokeWidth={1.5} />
                  }
                </div>
              </motion.div>
            ))}
          </div>

          {/* Card de código */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.22 }}
            className="rounded-3xl border border-stone-100 overflow-hidden"
          >
            {/* Header de la card */}
            <div className="px-8 pt-7 pb-6 border-b border-stone-100">
              <p className="text-[8.5px] tracking-[0.36em] uppercase text-stone-400 font-medium mb-1">
                Tu código personal
              </p>
              <p className="text-[11.5px] text-stone-400">
                Válido para nuevos clientes · Vigencia 30 días
              </p>
            </div>

            <div className="px-8 py-7">

              {/* Código */}
              <div className="flex items-center justify-between px-5 py-4 rounded-2xl mb-4 border border-stone-100 bg-stone-50">
                <span
                  className="text-[26px] tracking-[0.35em] font-light text-stone-800"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {referralCode}
                </span>
                <button
                  onClick={() => handleCopy('code')}
                  className="flex items-center gap-1.5 text-[11px] text-stone-400 hover:text-stone-700 transition-colors"
                >
                  <AnimatePresence mode="wait">
                    {copied === 'code' ? (
                      <motion.span key="check"
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-1 text-emerald-600 font-medium"
                      >
                        <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Copiado
                      </motion.span>
                    ) : (
                      <motion.span key="copy"
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" strokeWidth={1.5} /> Copiar
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>

              {/* Compartir WhatsApp */}
              <motion.button
                onClick={handleShare}
                whileHover={{ opacity: 0.88 }} whileTap={{ scale: 0.97 }}
                className="w-full flex items-center justify-center gap-2.5 py-4 text-white text-[11px] tracking-[0.24em] uppercase font-semibold rounded-xl mb-3"
                style={{ backgroundColor: OLIVE }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.554 4.118 1.523 5.847L.057 23.853a.5.5 0 0 0 .609.61l6.11-1.597A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.933 0-3.742-.538-5.28-1.471l-.378-.225-3.924 1.025 1.043-3.814-.247-.393A9.955 9.955 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
                Compartir mi código
              </motion.button>

              {/* Copiar enlace */}
              <motion.button
                onClick={() => handleCopy('link')}
                whileHover={{ opacity: 0.88 }} whileTap={{ scale: 0.97 }}
                className="w-full flex items-center justify-center gap-2 py-3.5 text-stone-600 text-[11px] tracking-[0.2em] uppercase font-medium rounded-xl border border-stone-200 hover:border-stone-400 transition-colors"
              >
                <AnimatePresence mode="wait">
                  {copied === 'link' ? (
                    <motion.span key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2 text-emerald-600">
                      <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> ¡Enlace copiado!
                    </motion.span>
                  ) : (
                    <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex items-center gap-2">
                      <Link className="w-3.5 h-3.5" strokeWidth={1.5} /> Copiar enlace
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              <p className="text-center text-[10px] text-stone-300 mt-5 leading-snug">
                * Disponible para cuentas registradas · Acumulable hasta 5 referidos activos
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

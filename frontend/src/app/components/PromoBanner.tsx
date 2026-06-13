import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Copy, Check, Leaf } from 'lucide-react';

const OLIVE = '#2D3A1F';
const CODE = 'NATURAL15';

export function PromoBanner() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(CODE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <section className="py-4 px-6 md:px-10 lg:px-14">
      <div className="max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl border border-stone-200"
          style={{ backgroundColor: '#F5F0E8' }}
        >
          {/* Textura de puntos muy sutil */}
          <div
            className="absolute inset-0 opacity-[0.035] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #78716c 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />

          <div className="relative grid md:grid-cols-[1fr_1fr] min-h-[260px]">

            {/* ── IZQUIERDA: texto y CTAs ── */}
            <div className="flex flex-col justify-center px-8 py-10 md:px-12 md:py-12 lg:px-16">

              {/* Pill "OFERTA ESPECIAL" */}
              <div className="flex items-center gap-2 mb-5">
                <span
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[9px] tracking-[0.22em] uppercase font-semibold"
                  style={{ backgroundColor: `${OLIVE}12`, borderColor: `${OLIVE}30`, color: OLIVE }}
                >
                  <Leaf className="w-2.5 h-2.5" strokeWidth={2} />
                  Oferta especial
                </span>
              </div>

              {/* Título */}
              <div
                className="text-5xl md:text-6xl font-bold text-stone-900 leading-none mb-1"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                15% <span className="font-light">OFF</span>
              </div>
              <div className="text-xl md:text-2xl text-stone-600 font-light mb-4">
                en aceites naturales
              </div>

              <p className="text-sm text-stone-500 leading-relaxed mb-6 max-w-sm">
                Cuida tu cabello con lo mejor de la naturaleza.
                Aplica el código al finalizar tu compra.
              </p>

              {/* Código promo */}
              <div className="flex items-center gap-3 mb-7">
                <div className="flex items-center gap-3 px-4 py-2.5 bg-white/80 border border-stone-200 rounded-xl">
                  <span className="text-[9px] tracking-[0.2em] uppercase text-stone-400 font-medium">Código</span>
                  <span className="text-base font-bold tracking-widest text-stone-900">{CODE}</span>
                  <button
                    onClick={handleCopy}
                    className="ml-1 p-1 rounded-lg hover:bg-stone-100 transition-colors text-stone-400 hover:text-stone-700"
                    aria-label="Copiar código"
                  >
                    <motion.div
                      key={copied ? 'check' : 'copy'}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.15 }}
                    >
                      {copied
                        ? <Check className="w-4 h-4 text-emerald-500" strokeWidth={2} />
                        : <Copy className="w-4 h-4" strokeWidth={1.5} />
                      }
                    </motion.div>
                  </button>
                </div>
              </div>

              {/* Botones */}
              <div className="flex flex-col sm:flex-row gap-3">
                <motion.a
                  href="#aceites"
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 text-white text-[11px] tracking-[0.18em] uppercase font-semibold rounded-full transition-opacity hover:opacity-90"
                  style={{ backgroundColor: OLIVE }}
                >
                  Comprar ahora
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                </motion.a>
                <motion.a
                  href="#catalogo"
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/70 text-stone-700 text-[11px] tracking-[0.18em] uppercase font-medium rounded-full border border-stone-200 hover:bg-white transition-colors"
                >
                  Ver rutina completa
                </motion.a>
              </div>
            </div>

            {/* ── DERECHA: imagen + sello ── */}
            <div className="relative hidden md:block">
              {/* Foto del producto */}
              <img
                src="https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=900&q=85"
                alt="Aceite natural Juhnios Rold"
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Degradado izquierda para fundir con el texto */}
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(to right, #F5F0E8 0%, #F5F0E880 18%, transparent 42%)' }}
              />

              {/* Sello circular "15% OFF" */}
              <motion.div
                initial={{ scale: 0.7, opacity: 0, rotate: -15 }}
                whileInView={{ scale: 1, opacity: 1, rotate: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 14 }}
                className="absolute top-8 right-8 w-[88px] h-[88px] rounded-full flex flex-col items-center justify-center shadow-lg border-4 border-white"
                style={{ backgroundColor: OLIVE }}
              >
                <span className="text-2xl font-bold text-white leading-none">15%</span>
                <span className="text-[9px] tracking-[0.3em] uppercase text-white/80 mt-0.5">OFF</span>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

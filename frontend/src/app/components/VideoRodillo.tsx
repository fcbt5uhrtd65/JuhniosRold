import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Volume2, VolumeX, ChevronLeft, ChevronRight } from 'lucide-react';

const OLIVE = '#2D3A1F';

interface ReelVideo {
  id: number;
  poster: string;
  username: string;
  caption: string;
}

const REELS: ReelVideo[] = [
  { id: 1, poster: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=500&q=80', username: 'maria.beauty', caption: 'Ritual de romero cada noche' },
  { id: 2, poster: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=500&q=80', username: 'andrea_col', caption: 'Antes y después en 4 semanas' },
  { id: 3, poster: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&q=80', username: 'caro.style', caption: 'Cómo aplico la keratina' },
  { id: 4, poster: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=500&q=80', username: 'laura.glam', caption: 'Mi rutina completa paso a paso' },
  { id: 5, poster: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=500&q=80', username: 'juliana.looks', caption: 'El secreto del aceite de aguacate' },
];

/**
 * Distancia circular más corta entre dos índices en un arreglo de longitud n.
 * Permite que el carrusel "envuelva" (wrap) sin saltos largos.
 */
function circularOffset(index: number, active: number, length: number): number {
  const raw = index - active;
  if (raw > length / 2) return raw - length;
  if (raw < -length / 2) return raw + length;
  return raw;
}

export function VideoRodillo() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(true);
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback((index: number) => {
    setActive(((index % REELS.length) + REELS.length) % REELS.length);
    setPlaying(true);
  }, []);

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40) return;
    goTo(active + (delta < 0 ? 1 : -1));
  };

  return (
    <section className="py-16 sm:py-20 overflow-hidden" style={{ backgroundColor: '#FAFAF8' }}>
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-14">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-10 sm:mb-14">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-5 h-px bg-stone-400" />
            <span className="text-[9px] tracking-[0.38em] uppercase text-stone-500 font-medium">
              Resultados reales
            </span>
            <div className="w-5 h-px bg-stone-400" />
          </div>
          <h2
            className="text-3xl sm:text-4xl xl:text-5xl font-light text-stone-900 leading-snug"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Rituales que <em className="not-italic font-semibold" style={{ color: OLIVE }}>transforman</em>
          </h2>
        </div>

        {/* Rodillo de reels */}
        <div
          className="relative flex items-center justify-center select-none"
          style={{ height: 'min(72vw, 460px)', touchAction: 'pan-y' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Flecha izquierda */}
          <button
            onClick={() => goTo(active - 1)}
            aria-label="Reel anterior"
            className="hidden sm:flex absolute left-0 z-20 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center hover:scale-105 transition-transform"
            style={{ color: OLIVE }}
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={2} />
          </button>

          <div className="relative w-full h-full flex items-center justify-center" style={{ perspective: 1000 }}>
            {REELS.map((reel, index) => {
              const offset = circularOffset(index, active, REELS.length);
              const isActive = offset === 0;
              const visible = Math.abs(offset) <= 2;
              if (!visible) return null;

              // Tamaño base (móvil, tarjeta central) escalado por breakpoint vía clamp en px inline.
              const baseWidth = isActive ? 'min(52vw, 220px)' : 'min(34vw, 150px)';
              const baseHeight = isActive ? 'min(92vw, 390px)' : 'min(60vw, 266px)';

              return (
                <motion.div
                  key={reel.id}
                  className="absolute rounded-2xl overflow-hidden shadow-xl bg-stone-200"
                  style={{ zIndex: 10 - Math.abs(offset) }}
                  animate={{
                    x: `${offset * 78}%`,
                    scale: isActive ? 1 : 0.86,
                    opacity: isActive ? 1 : 0.55,
                    filter: isActive ? 'blur(0px)' : 'blur(1px)',
                  }}
                  initial={false}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  onClick={() => !isActive && goTo(index)}
                >
                  <div
                    className="relative"
                    style={{ width: baseWidth, height: baseHeight, cursor: isActive ? 'default' : 'pointer' }}
                  >
                    <img
                      src={reel.poster}
                      alt={reel.caption}
                      className="absolute inset-0 w-full h-full object-cover"
                      draggable={false}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/10" />

                    {isActive && (
                      <>
                        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                          <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm text-[9px] tracking-widest uppercase text-white font-medium">
                            @{reel.username}
                          </span>
                          <button
                            onClick={(event) => { event.stopPropagation(); setMuted((current) => !current); }}
                            aria-label={muted ? 'Activar sonido' : 'Silenciar'}
                            className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
                          >
                            {muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                          </button>
                        </div>

                        <button
                          onClick={(event) => { event.stopPropagation(); setPlaying((current) => !current); }}
                          aria-label={playing ? 'Pausar' : 'Reproducir'}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <AnimatePresence>
                            {!playing && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.7 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.7 }}
                                transition={{ duration: 0.15 }}
                                className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center"
                              >
                                <Play className="w-4 h-4 ml-0.5" style={{ color: OLIVE }} fill={OLIVE} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </button>

                        <div className="absolute bottom-3 left-3 right-3">
                          <p className="text-[11px] text-white/95 leading-snug line-clamp-2">{reel.caption}</p>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Flecha derecha */}
          <button
            onClick={() => goTo(active + 1)}
            aria-label="Siguiente reel"
            className="hidden sm:flex absolute right-0 z-20 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center hover:scale-105 transition-transform"
            style={{ color: OLIVE }}
          >
            <ChevronRight className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Indicadores */}
        <div className="flex items-center justify-center gap-2 mt-8">
          {REELS.map((reel, index) => (
            <button
              key={reel.id}
              onClick={() => goTo(index)}
              aria-label={`Ir al reel de @${reel.username}`}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: index === active ? 20 : 6,
                backgroundColor: index === active ? OLIVE : '#D8D3C8',
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

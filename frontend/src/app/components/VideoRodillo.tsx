import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Volume2, VolumeX, ChevronLeft, ChevronRight } from 'lucide-react';

const OLIVE = '#2D3A1F';

interface ReelVideo {
  id: number;
  src: string;
  poster: string;
  username: string;
  caption: string;
}

const REELS: ReelVideo[] = [
  {
    id: 1,
    src: '/videos/reels/menthus-tamanos.mp4',
    poster: '',
    username: 'juhniosrold',
    caption: 'Un tamaño para cada momento con loción térmica Menthus',
  },
  {
    id: 2,
    src: '/videos/reels/menthus-calor-extremo.mp4',
    poster: '',
    username: 'juhniosrold',
    caption: 'Cuidamos tu cabello del calor extremo',
  },
  {
    id: 3,
    src: '/videos/reels/duo-piel-glowing.mp4',
    poster: '',
    username: 'juhniosrold',
    caption: 'El dúo perfecto para una piel glowing e hidratada',
  },
  {
    id: 4,
    src: '/videos/reels/testimonio-menthus.mp4',
    poster: '',
    username: 'juhniosrold',
    caption: 'Testimonio real de la fórmula Menthus',
  },
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
  const [muted, setMuted] = useState(false);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback((index: number) => {
    setActive(((index % REELS.length) + REELS.length) % REELS.length);
    setPlaying(true);
  }, []);

  const togglePlaying = useCallback(() => {
    const video = activeVideoRef.current;

    if (playing) {
      video?.pause();
      setPlaying(false);
      return;
    }

    video?.play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, [playing]);

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

  useEffect(() => {
    const video = activeVideoRef.current;
    if (!video) return;

    video.muted = muted;

    if (!playing) {
      video.pause();
      return;
    }

    video.play().catch(() => {
      setPlaying(false);
    });
  }, [active, muted, playing]);

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
                    <video
                      ref={isActive ? activeVideoRef : undefined}
                      key={`${reel.id}-${isActive ? 'active' : 'preview'}`}
                      src={reel.src}
                      poster={reel.poster || undefined}
                      className="absolute inset-0 w-full h-full object-cover"
                      autoPlay={isActive && playing}
                      loop
                      playsInline
                      muted={!isActive || muted}
                      controls={false}
                      preload={isActive ? 'auto' : 'metadata'}
                      aria-label={reel.caption}
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
                          onClick={(event) => { event.stopPropagation(); togglePlaying(); }}
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

import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Heart, Instagram, ExternalLink } from 'lucide-react';

interface Post {
  id: number;
  image: string;
  username: string;
  caption: string;
  likes: number;
}

// Infinite marquee row component
function MarqueeRow({ posts, direction = 1, speed = 35 }: { posts: Post[]; direction?: 1 | -1; speed?: number }) {
  const [likedPosts, setLikedPosts] = useState<Set<number>>(new Set());
  const [particles, setParticles] = useState<{ id: number; postId: number; x: number; y: number }[]>([]);
  const nextParticleId = useRef(0);

  const toggleLike = (id: number, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setLikedPosts(prev => {
      const next = new Set(prev);
      if (!next.has(id)) {
        // Spawn heart particles
        const newParticles = Array.from({ length: 6 }, (_, i) => ({
          id: nextParticleId.current++,
          postId: id,
          x: rect.left + rect.width / 2 + (Math.random() - 0.5) * 40,
          y: rect.top + rect.height / 2 + (Math.random() - 0.5) * 20,
        }));
        setParticles(prev2 => [...prev2, ...newParticles]);
        setTimeout(() => {
          setParticles(prev2 => prev2.filter(p => !newParticles.find(n => n.id === p.id)));
        }, 900);
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  // Duplicate posts for seamless loop
  const duplicated = [...posts, ...posts, ...posts];

  return (
    <div className="relative overflow-hidden">
      {/* Heart particles (fixed to viewport) */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="fixed pointer-events-none z-[999] text-rose-400"
          initial={{ x: p.x - 8, y: p.y - 8, scale: 0, opacity: 1 }}
          animate={{
            y: p.y - 60 - Math.random() * 40,
            scale: [0, 1.2, 0.8],
            opacity: [1, 1, 0],
          }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ position: 'fixed', top: 0, left: 0 }}
        >
          <Heart className="w-4 h-4 fill-current" />
        </motion.div>
      ))}

      <motion.div
        className="flex gap-3 w-max"
        animate={{ x: direction > 0 ? ['0%', '-33.33%'] : ['-33.33%', '0%'] }}
        transition={{
          duration: speed,
          ease: 'linear',
          repeat: Infinity,
        }}
      >
        {duplicated.map((post, index) => (
          <div
            key={`${post.id}-${index}`}
            className="relative w-64 h-64 flex-shrink-0 group overflow-hidden bg-secondary"
          >
            <img
              src={post.image}
              alt={post.caption}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-400" />

            {/* Content on hover */}
            <div className="absolute inset-0 flex flex-col justify-between p-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Instagram className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-[10px] text-white/90 tracking-wide">@{post.username}</span>
                </div>
                <ExternalLink className="w-3 h-3 text-white/60" />
              </div>

              <div>
                <p className="text-[11px] text-white/90 leading-relaxed mb-3">{post.caption}</p>
                <div className="flex items-center justify-between">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleLike(post.id + index * 100, e); }}
                    className="flex items-center gap-1.5 group/like"
                  >
                    <motion.div
                      whileTap={{ scale: 1.4 }}
                      transition={{ type: 'spring', stiffness: 600, damping: 15 }}
                    >
                      <Heart
                        className={`w-4 h-4 transition-colors ${
                          likedPosts.has(post.id + index * 100)
                            ? 'fill-rose-400 text-rose-400'
                            : 'text-white'
                        }`}
                        strokeWidth={1.5}
                      />
                    </motion.div>
                    <span className="text-[10px] text-white">
                      {likedPosts.has(post.id + index * 100) ? post.likes + 1 : post.likes}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export function Comunidad() {
  const rowOnePosts: Post[] = [
    { id: 1, image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80', username: 'maria.beauty', caption: 'Transformación completa en 30 días', likes: 842 },
    { id: 2, image: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&q=80', username: 'andrea_col', caption: 'Mi ritual diario con Juhnios', likes: 631 },
    { id: 3, image: 'https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?w=600&q=80', username: 'caro.style', caption: 'Nunca brilló tanto mi cabello', likes: 1204 },
    { id: 4, image: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&q=80', username: 'laura.glam', caption: 'Resultados profesionales en casa', likes: 978 },
    { id: 5, image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80', username: 'juliana.looks', caption: 'Aceite de romero — mi secreto', likes: 1567 },
  ];

  const rowTwoPosts: Post[] = [
    { id: 6, image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&q=80', username: 'sofia.co', caption: 'Mi cabello nunca había estado tan sano', likes: 723 },
    { id: 7, image: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=600&q=80', username: 'valeria.hair', caption: 'Juhnios cambió mi vida capilar', likes: 1890 },
    { id: 8, image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=600&q=80', username: 'daniela.nat', caption: 'Keratina 100% natural — increíble', likes: 445 },
    { id: 9, image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=600&q=80', username: 'isabella.gl', caption: 'Mi bebé y yo, ambas con Juhnios', likes: 2341 },
    { id: 10, image: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&q=80', username: 'camila.bty', caption: '30 días y el crecimiento es real', likes: 1102 },
  ];

  return (
    <section className="py-24 bg-background overflow-hidden">
      {/* Header */}
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 md:px-12 mb-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6"
        >
          <div>
            <div className="text-[9px] tracking-[0.45em] uppercase text-muted-foreground mb-4">
              @JUHNIOSROLD
            </div>
            <h2 className="text-4xl md:text-5xl leading-none">
              Nuestra<br />Comunidad
            </h2>
          </div>
          <div className="max-w-xs">
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Más de 10,000 mujeres comparten sus transformaciones. Pasa el cursor para explorar.
            </p>
            <motion.a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ x: 4 }}
              className="inline-flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-foreground border-b border-foreground/20 pb-0.5 hover:border-foreground transition-colors"
            >
              <Instagram className="w-3 h-3" />
              Ver en Instagram
            </motion.a>
          </div>
        </motion.div>
      </div>

      {/* Marquee rows */}
      <div className="space-y-3">
        <MarqueeRow posts={rowOnePosts} direction={1} speed={40} />
        <MarqueeRow posts={rowTwoPosts} direction={-1} speed={35} />
      </div>

      {/* Bottom stats */}
      <div className="max-w-[1400px] mx-auto px-5 sm:px-8 md:px-12 mt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-3 gap-px bg-border border border-border"
        >
          {[
            { value: '10K+', label: 'Clientas felices' },
            { value: '4.9', label: 'Rating promedio' },
            { value: '98%', label: 'Recomendarían' },
          ].map((stat, i) => (
            <div key={stat.label} className="bg-background px-6 py-8 text-center">
              <div className="text-2xl md:text-3xl mb-2">{stat.value}</div>
              <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
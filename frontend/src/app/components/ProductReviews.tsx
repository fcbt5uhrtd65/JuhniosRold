import { motion } from 'motion/react';
import { Check, Quote, Star } from 'lucide-react';

interface Review {
  id: number;
  name: string;
  city: string;
  rating: number;
  comment: string;
  verified: boolean;
  date: string;
  timeline: string;
  productsUsed: string[];
  result: string;
}

const OLIVE = '#2D3A1F';

const reviews: Review[] = [
  {
    id: 1,
    name: 'María González',
    city: 'Bogotá',
    rating: 5,
    comment: 'Mi cabello quedó más suave desde la primera semana. Me gustó que no lo deja pesado y el brillo se nota bastante.',
    verified: true,
    date: 'Hace 2 días',
    timeline: '30 días de uso',
    productsUsed: ['Aceite de Romero', 'Tratamiento Keratina'],
    result: 'Más brillo y menos frizz',
  },
  {
    id: 2,
    name: 'Andrea Ramírez',
    city: 'Medellín',
    rating: 5,
    comment: 'Lo compré para mi rutina de caída y me ha funcionado muy bien. La textura se siente limpia y rinde mucho.',
    verified: true,
    date: 'Hace 5 días',
    timeline: '45 días de uso',
    productsUsed: ['Aceite de Cebolla', 'Silicona de Lino'],
    result: 'Rutina más constante',
  },
  {
    id: 3,
    name: 'Carolina Pérez',
    city: 'Cali',
    rating: 5,
    comment: 'El aroma es agradable, el empaque llegó perfecto y se siente como producto de salón. Volvería a comprar.',
    verified: true,
    date: 'Hace 1 semana',
    timeline: '21 días de uso',
    productsUsed: ['Aceite de Romero'],
    result: 'Suavidad visible',
  },
];

function RatingStars({ rating, size = 'h-4 w-4' }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} de 5 estrellas`}>
      {[...Array(5)].map((_, index) => (
        <Star
          key={index}
          className={`${size} ${index < rating ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200'}`}
          strokeWidth={0}
        />
      ))}
    </div>
  );
}

export function ProductReviews() {
  const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;

  return (
    <section id="resenas" className="bg-[#F7F5F1] px-4 py-16 md:px-8 lg:px-14">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-9 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <div className="h-px w-8 bg-stone-300" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.32em] text-stone-500">
                Reseñas verificadas
              </span>
            </div>
            <h2
              className="max-w-2xl text-4xl font-light leading-[0.96] text-stone-950 md:text-5xl"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Lo que dicen quienes ya hicieron su ritual
            </h2>
          </div>

          <div className="rounded-2xl bg-white px-5 py-4 shadow-[0_18px_55px_rgba(28,25,23,0.08)]">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-3xl font-semibold leading-none text-stone-950">{averageRating.toFixed(1)}</p>
                <RatingStars rating={Math.round(averageRating)} />
              </div>
              <div className="h-10 w-px bg-stone-100" />
              <div>
                <p className="text-[12px] font-semibold text-stone-800">{reviews.length} experiencias destacadas</p>
                <p className="text-[11px] text-stone-400">Compras y rutinas verificadas</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {reviews.map((review, index) => (
            <motion.article
              key={review.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: index * 0.08, duration: 0.45 }}
              className="flex min-h-[310px] flex-col rounded-2xl bg-white p-6 shadow-[0_16px_45px_rgba(28,25,23,0.07)] transition-transform duration-300 hover:-translate-y-0.5"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold text-white"
                    style={{ backgroundColor: OLIVE }}
                  >
                    {review.name.split(' ').map(part => part[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-stone-900">{review.name}</p>
                    <p className="text-[11px] text-stone-400">{review.city} · {review.date}</p>
                  </div>
                </div>
                <Quote className="h-5 w-5 text-stone-200" strokeWidth={1.5} />
              </div>

              <div className="mb-4 flex items-center justify-between gap-3">
                <RatingStars rating={review.rating} size="h-3.5 w-3.5" />
                {review.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                    <Check className="h-3 w-3" strokeWidth={2} />
                    Verificada
                  </span>
                )}
              </div>

              <p className="mb-5 text-[13px] leading-relaxed text-stone-600">{review.comment}</p>

              <div className="mt-auto space-y-3 border-t border-stone-100 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">Resultado</span>
                  <span className="text-right text-[12px] font-semibold text-stone-800">{review.result}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {review.productsUsed.map(product => (
                    <span key={product} className="rounded-full bg-stone-100 px-2.5 py-1 text-[10.5px] font-medium text-stone-600">
                      {product}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-stone-400">{review.timeline}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

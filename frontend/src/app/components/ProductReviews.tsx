import { motion } from 'motion/react';
import { Star, Check } from 'lucide-react';

interface Review {
  id: number;
  name: string;
  city: string;
  rating: number;
  comment: string;
  verified: boolean;
  image?: string;
  date: string;
  timeline?: string;
  productsUsed?: string[];
}

export function ProductReviews() {
  const reviews: Review[] = [
    {
      id: 1,
      name: "María González",
      city: "Bogotá",
      rating: 5,
      comment: "Increíble producto. Mi cabello se siente súper suave y con brillo. Lo recomiendo 100%",
      verified: true,
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&q=80",
      date: "Hace 2 días",
      timeline: "30 días",
      productsUsed: ["Aceite de Romero", "Tratamiento Keratina"]
    },
    {
      id: 2,
      name: "Andrea Ramírez",
      city: "Medellín",
      rating: 5,
      comment: "Desde que uso este aceite, la caída de mi cabello se redujo notablemente. Excelente calidad.",
      verified: true,
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&q=80",
      date: "Hace 5 días",
      timeline: "45 días",
      productsUsed: ["Aceite de Cebolla", "Silicona de Lino"]
    },
    {
      id: 3,
      name: "Carolina Pérez",
      city: "Cali",
      rating: 4,
      comment: "Muy buen producto. El olor es agradable y los resultados se ven en poco tiempo.",
      verified: true,
      date: "Hace 1 semana",
      timeline: "21 días",
      productsUsed: ["Aceite de Romero"]
    }
  ];

  const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <div className="py-16 border-t border-border">
      <div className="mb-12">
        <div className="flex items-center gap-8 mb-8">
          <div>
            <div className="text-4xl mb-2">{averageRating.toFixed(1)}</div>
            <div className="flex gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${
                    i < Math.round(averageRating) ? 'fill-foreground' : ''
                  }`}
                  strokeWidth={1}
                />
              ))}
            </div>
            <div className="text-xs text-muted-foreground">
              {reviews.length} reseñas verificadas
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {reviews.map((review, index) => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-secondary p-6 border border-border hover:border-foreground/20 transition-colors"
          >
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-sm font-medium">{review.name}</div>
                {review.verified && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Check className="w-3 h-3" />
                    Verificado
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground mb-4">
                {review.city}
              </div>
            </div>

            <div className="flex gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${
                    i < review.rating ? 'fill-foreground' : ''
                  }`}
                  strokeWidth={1}
                />
              ))}
            </div>

            <p className="text-sm leading-relaxed mb-6">
              {review.comment}
            </p>

            {review.timeline && (
              <div className="mb-4 pb-4 border-b border-border">
                <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
                  TIMELINE
                </div>
                <div className="text-sm">{review.timeline}</div>
              </div>
            )}

            {review.productsUsed && review.productsUsed.length > 0 && (
              <div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                  PRODUCTOS USADOS
                </div>
                <div className="space-y-1.5">
                  {review.productsUsed.map((product, idx) => (
                    <div key={idx} className="text-xs flex items-center gap-2">
                      <div className="w-1 h-1 bg-foreground"></div>
                      {product}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <button className="mt-8 text-xs tracking-wider uppercase border-b border-foreground pb-1 hover:opacity-50 transition-opacity">
        Ver todas las reseñas →
      </button>
    </div>
  );
}

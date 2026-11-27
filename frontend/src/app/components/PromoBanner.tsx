import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { getProducts } from '../services/products.service';
import type { PromotionSummary } from '../services/promotions.service';

const OLIVE = '#2D3A1F';

type BannerPromotion = PromotionSummary & {
  scope: 'PRODUCT' | 'VARIANT' | 'CATEGORY';
  priority: number;
};

function isLivePromotion(promotion: BannerPromotion, now: number): boolean {
  const endsAt = promotion.ends_at ? new Date(promotion.ends_at).getTime() : Infinity;
  return endsAt > now;
}

function getPromotionEndTime(promotion: BannerPromotion | null): number | null {
  if (!promotion?.ends_at) return null;
  const endTime = new Date(promotion.ends_at).getTime();
  return Number.isFinite(endTime) ? endTime : null;
}

function formatScope(promotion: BannerPromotion): string {
  if (promotion.scope === 'CATEGORY') return 'en productos seleccionados';
  if (promotion.scope === 'PRODUCT') return 'en producto seleccionado';
  return 'en una presentación especial';
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function PromoBanner() {
  const [promotions, setPromotions] = useState<BannerPromotion[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let mounted = true;
    getProducts({ limit: 100, active: true })
      .then(({ data }) => {
        if (!mounted) return;
        const found = new Map<string, BannerPromotion>();

        data.forEach(product => {
          if (product.active_promotion) {
            found.set(product.active_promotion.id, {
              ...product.active_promotion,
              scope: 'PRODUCT',
              priority: 0,
            });
          }

          product.variants.forEach(variant => {
            if (variant.active_promotion) {
              found.set(variant.active_promotion.id, {
                ...variant.active_promotion,
                scope: 'VARIANT',
                priority: 0,
              });
            }
          });
        });

        setPromotions(Array.from(found.values()));
      })
      .catch(() => {
        if (mounted) setPromotions([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activePromotion = useMemo(() => {
    return promotions
      .filter(promotion => isLivePromotion(promotion, now))
      .sort((a, b) => {
        const aEnd = getPromotionEndTime(a) ?? Infinity;
        const bEnd = getPromotionEndTime(b) ?? Infinity;
        return aEnd - bEnd || b.priority - a.priority;
      })[0] ?? null;
  }, [now, promotions]);

  const endTime = getPromotionEndTime(activePromotion);
  const remainingMs = endTime !== null ? endTime - now : null;

  if (!activePromotion || remainingMs === null || remainingMs <= 0) {
    return null;
  }

  const discountAmount = activePromotion.discount_type === 'PERCENTAGE'
    ? `${activePromotion.discount_value}%`
    : `$${activePromotion.discount_value.toLocaleString('es-CO')}`;
  const scopeText = formatScope(activePromotion);

  return (
    <section className="py-4 px-6 md:px-10 lg:px-14">
      <div className="max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl bg-[#1A1C16] text-white shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
        >
          <div className="relative flex flex-col gap-6 px-6 py-7 md:flex-row md:items-center md:justify-between md:px-10 lg:px-12">
            <div className="min-w-0">
              <p className="mb-2 text-[13px] md:text-[15px] font-bold uppercase tracking-[0.04em] text-[#C9A96A]">
                Black Friday
              </p>
              <p className="text-[34px] md:text-[48px] font-bold leading-none tracking-tight">
                <span className="text-[#C9A96A]">{discountAmount}</span>{' '}
                <span className="text-white">de descuento</span>
              </p>
              <p className="mt-3 text-[14px] md:text-[17px] text-white/70">
                {scopeText.charAt(0).toUpperCase() + scopeText.slice(1)}
              </p>
            </div>

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center md:gap-10">
              <div>
                <p className="text-[13px] md:text-[15px] font-semibold uppercase tracking-[0.02em] text-white/90">
                  Termina en
                </p>
                <p className="text-[24px] md:text-[30px] font-bold leading-tight tabular-nums text-white">
                  {formatRemaining(remainingMs)}
                </p>
              </div>

              <motion.a
                href="#catalogo"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center justify-center gap-3 rounded-2xl px-7 py-4 text-[15px] md:text-[17px] font-bold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: OLIVE }}
              >
                Comprar ahora
                <ArrowRight className="w-5 h-5" strokeWidth={2.25} />
              </motion.a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

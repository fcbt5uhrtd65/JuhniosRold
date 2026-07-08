import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Clock, Leaf, Tag } from 'lucide-react';
import { getProducts } from '../services/products.service';
import type { DiscountType, PromotionSummary } from '../services/promotions.service';

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

function formatDiscount(promotion: { discount_type: DiscountType; discount_value: number }): string {
  if (promotion.discount_type === 'PERCENTAGE') return `${promotion.discount_value}% OFF`;
  return `$${promotion.discount_value.toLocaleString('es-CO')} OFF`;
}

function formatScope(promotion: BannerPromotion): string {
  if (promotion.scope === 'CATEGORY') return 'en productos seleccionados';
  if (promotion.scope === 'PRODUCT') return 'en producto seleccionado';
  return 'en una presentacion especial';
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

  return (
    <section className="py-4 px-6 md:px-10 lg:px-14">
      <div className="max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl border border-[#2D3A1F] bg-[#111510] bg-cover bg-center text-white"
          style={{ backgroundImage: "url('/images/promo-banner-bg.png')" }}
        >
          <div className="absolute inset-0 bg-black/45 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/25 to-black/45 pointer-events-none" />

          <div className="relative grid gap-6 px-6 py-7 md:grid-cols-[1fr_auto] md:items-center md:px-10 lg:px-14">
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C6A76B] bg-[#C6A76B] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-[#111510]">
                  <Leaf className="w-2.5 h-2.5" strokeWidth={2} />
                  Campana especial
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/80">
                  <Tag className="w-2.5 h-2.5" strokeWidth={2} />
                  {activePromotion.name}
                </span>
              </div>

              <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
                <p className="text-4xl font-bold leading-none md:text-6xl" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {formatDiscount(activePromotion)}
                </p>
                <p className="pb-1 text-sm font-medium text-white/70 md:text-base">
                  {formatScope(activePromotion)}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center md:flex-col md:items-end">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 shadow-lg">
                <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#C6A76B]">
                  <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                  Termina en
                </div>
                <p className="text-xl font-bold leading-tight text-white md:text-2xl">
                  {formatRemaining(remainingMs)}
                </p>
              </div>

              <motion.a
                href="#catalogo"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: OLIVE }}
              >
                Comprar ahora
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </motion.a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

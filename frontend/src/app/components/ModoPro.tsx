import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Minus, Plus } from "lucide-react";
import proVideo from "../../imports/51905-467131986.mp4";
import { useToast } from "../contexts/ToastContext";
import { useUser } from "../contexts/UserContext";
import { navigateTo } from "../services/navigate";
import { getWholesaleSettings } from "../utils/wholesale";

const OLIVE = '#2D3A1F';

const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);

function buildFaqs(minimumLabel: string, discountPercentage: number) {
  return [
    {
      q: '¿Qué es el plan mayorista?',
      a: 'Es el modo de compra para clientes que compran por volumen, revenden, trabajan con salones o necesitan abastecer su negocio con mejores condiciones.',
    },
    {
      q: '¿Cómo activo el modo PRO?',
      a: 'Primero regístrate o inicia sesión. Luego entra a tu perfil y cambia tu cuenta al plan mayorista con los datos de tu negocio.',
    },
    {
      q: '¿Cuál es la compra mínima?',
      a: `El descuento mayorista se activa desde compras de ${minimumLabel}. El carrito te avisa cuánto falta si todavía no llegas al monto.`,
    },
    {
      q: '¿Qué beneficio recibo?',
      a: `Accedes a descuento mayorista de ${discountPercentage}% en compras por volumen, pensado para prosperar, revender y mantener inventario para tu negocio.`,
    },
    {
      q: '¿Qué pasa si ya soy mayorista?',
      a: 'Tu cuenta ya queda marcada como mayorista y el descuento se aplica automáticamente cuando tu carrito supera el mínimo configurado.',
    },
  ];
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start justify-between gap-4 py-5 text-left group active:scale-[0.99] transition"
      >
        <span className="text-[13.5px] text-stone-800 font-medium leading-snug group-hover:text-stone-900 transition-colors">
          {q}
        </span>
        <span className="flex-shrink-0 mt-0.5 text-stone-300 group-hover:text-stone-500 transition-colors">
          {open
            ? <Minus className="w-3.5 h-3.5" strokeWidth={1.5} />
            : <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          }
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-[12.5px] text-stone-400 leading-relaxed">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ModoProProps {
  onLoginRequired?: () => void;
}

export function ModoPro({ onLoginRequired }: ModoProProps) {
  const { currentUser } = useUser();
  const toast = useToast();
  const wholesaleSettings = getWholesaleSettings();
  const minimumLabel = formatMoney(wholesaleSettings.minimumPurchase);
  const faqs = buildFaqs(minimumLabel, wholesaleSettings.discountPercentage);
  const isWholesale = currentUser?.modoCompra === 'WHOLESALE';

  const handleWholesaleAccess = () => {
    if (!currentUser) {
      toast.info('Regístrate o inicia sesión para cambiar tu cuenta al plan mayorista.');
      onLoginRequired?.();
      return;
    }

    if (isWholesale) {
      toast.success('Tu cuenta ya tiene activo el plan mayorista.');
      return;
    }

    toast.info('Completa los datos de tu negocio para activar el plan mayorista.');
    navigateTo('/perfil?s=mayorista');
  };

  const ctaLabel = !currentUser
    ? 'Registrarme o iniciar sesión'
    : isWholesale
      ? 'Plan mayorista activo'
      : 'Cambiar a mayorista';

  return (
    <section id="pro" className="py-12 px-4 md:px-8 lg:px-14" style={{ backgroundColor: '#F7F5F1' }}>
      <div className="max-w-[1400px] mx-auto space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65 }}
          className="relative overflow-hidden rounded-[28px]"
          style={{ minHeight: 360 }}
        >
          <video
            autoPlay loop muted playsInline
            className="absolute inset-0 w-full h-full object-cover"
          >
            <source src={proVideo} type="video/mp4" />
          </video>

          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(105deg, rgba(8,11,6,0.74) 0%, rgba(8,11,6,0.42) 60%, transparent 100%)' }}
          />

          <div className="relative z-10 h-full flex items-center px-7 sm:px-10 md:px-14 lg:px-20 py-14">
            <div className="max-w-lg">
              <p className="text-[8.5px] tracking-[0.46em] uppercase text-white/45 mb-5">
                Plan mayorista
              </p>
              <h2
                className="font-light text-white leading-[0.92] tracking-tight mb-5"
                style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(38px, 5vw, 64px)' }}
              >
                Modo <em style={{ fontStyle: 'italic' }}>PRO</em>
              </h2>
              <p className="text-[13px] text-white/60 leading-relaxed mb-8 max-w-[360px]">
                Compra por volumen, activa precios mayoristas y abastece tu negocio para revender, producir o crecer con más margen.
              </p>
              <motion.button
                whileHover={{ opacity: 0.88 }} whileTap={{ scale: 0.97 }}
                onClick={handleWholesaleAccess}
                className="inline-flex items-center gap-3 px-7 py-3.5 text-white text-[10px] tracking-[0.22em] uppercase font-medium border border-white/25 rounded-full hover:border-white/60 transition-all group"
              >
                {ctaLabel}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
              </motion.button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="grid md:grid-cols-[280px_1fr] gap-0 bg-white rounded-[28px] overflow-hidden"
        >
          <div className="flex flex-col justify-between px-10 py-10 border-b md:border-b-0 md:border-r border-stone-100">
            <div>
              <p className="text-[8.5px] tracking-[0.38em] uppercase text-stone-400 mb-8">
                Beneficios mayoristas
              </p>
              <div className="space-y-7">
                {[
                  { val: `${wholesaleSettings.discountPercentage}%`, label: 'Descuento por volumen' },
                  { val: minimumLabel, label: 'Compra mínima' },
                  { val: 'PRO', label: 'Para revender o producir' },
                ].map(({ val, label }) => (
                  <div key={label}>
                    <span
                      className="block text-[34px] font-light text-stone-900 leading-none mb-1 break-words"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      {val}
                    </span>
                    <span className="text-[10.5px] text-stone-400 tracking-[0.14em] uppercase">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <motion.button
              whileHover={{ opacity: 0.88 }} whileTap={{ scale: 0.97 }}
              onClick={handleWholesaleAccess}
              className="mt-10 flex items-center justify-between gap-2 px-6 py-3.5 text-white text-[10px] tracking-[0.22em] uppercase font-semibold rounded-xl active:scale-[0.98] transition"
              style={{ backgroundColor: OLIVE }}
            >
              {ctaLabel}
              <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />
            </motion.button>
          </div>

          <div className="px-10 py-10">
            <p className="text-[8.5px] tracking-[0.38em] uppercase text-stone-400 mb-2">
              Preguntas frecuentes
            </p>
            <p className="text-[12px] text-stone-400 mb-6">Todo lo que necesitas saber antes de activar el plan.</p>
            <div>
              {faqs.map(({ q, a }) => <Faq key={q} q={q} a={a} />)}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

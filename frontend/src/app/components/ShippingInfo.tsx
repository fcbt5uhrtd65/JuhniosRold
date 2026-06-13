import { motion } from 'motion/react';
import { ShieldCheck, Truck, Star, Headphones } from 'lucide-react';

const trustItems = [
  {
    icon: ShieldCheck,
    title: 'Pagos seguros',
    sub: 'Compra protegida',
  },
  {
    icon: Truck,
    title: 'Envíos a todo Colombia',
    sub: 'Rápidos y seguros',
  },
  {
    icon: Star,
    title: 'Garantía de satisfacción',
    sub: 'Resultados que importan',
  },
  {
    icon: Headphones,
    title: 'Atención personalizada',
    sub: 'Estamos para ti',
  },
];

export function ShippingInfo() {
  return (
    <section className="bg-white border-b border-stone-100">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-14">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-stone-100">
          {trustItems.map(({ icon: Icon, title, sub }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.5 }}
              className="flex items-center gap-3.5 px-6 py-5 md:px-8 md:py-6"
            >
              <div className="w-9 h-9 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-stone-500" strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-stone-800 leading-snug">{title}</div>
                <div className="text-[10px] text-stone-400 mt-0.5 leading-none">{sub}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

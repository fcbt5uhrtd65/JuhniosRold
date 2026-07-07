import { motion } from 'motion/react';
import { RefreshCw, MapPin, Truck } from 'lucide-react';

const trustItems = [
  {
    icon: RefreshCw,
    title: 'Devoluciones en',
    sub: 'JuhniosRold.com completamente gratuitas',
  },
  {
    icon: MapPin,
    title: 'Asesoría en',
    sub: 'diferentes canales',
  },
  {
    icon: Truck,
    title: 'Envío gratis',
    sub: 'por compras mayores a $130.000 en ciudades principales',
  },
];

export function ShippingInfo() {
  return (
    <section className="bg-white border-b border-stone-100">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8">
          {trustItems.map(({ icon: Icon, title, sub }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07, duration: 0.5 }}
              className="flex flex-col items-center text-center gap-2.5 px-4 py-6 md:py-8"
            >
              <Icon className="w-7 h-7 text-stone-700" strokeWidth={1.3} />
              <div className="text-[11px] text-stone-500 leading-snug max-w-[180px]">
                <span className="font-medium text-stone-700">{title}</span> {sub}
              </div>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 3 * 0.07, duration: 0.5 }}
            className="flex flex-col items-center text-center gap-2.5 px-4 py-6 md:py-8"
          >
            <span
              className="text-2xl font-extrabold tracking-tight text-stone-900"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Wompi
            </span>
            <div className="text-[11px] text-stone-500 leading-snug max-w-[180px]">
              <span className="font-medium text-stone-700">Paga seguro</span> con Wompi. Tarjetas, PSE y más medios de pago.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

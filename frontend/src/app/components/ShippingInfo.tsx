import { motion } from 'motion/react';
import { MapPin } from 'lucide-react';
import returnsIcon from '../../assets/icon-devoluciones.jpg';
import freeShippingImg from '../../assets/envios-gratis.jpg';
import wompiLogo from '../../assets/logo-wompi.png';

export function ShippingInfo() {
  return (
    <section className="bg-white border-b border-stone-100">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0, duration: 0.5 }}
            className="flex flex-col items-center text-center gap-3 px-4 py-9 md:py-11"
          >
            <img src={returnsIcon} alt="Devoluciones gratuitas" className="w-14 h-14 md:w-16 md:h-16 object-contain" />
            <div className="text-[13px] md:text-sm text-stone-500 leading-snug max-w-[220px]">
              <span className="font-semibold text-stone-800">Devoluciones en</span> JuhniosRold.com completamente gratuitas
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.07, duration: 0.5 }}
            className="flex flex-col items-center text-center gap-3 px-4 py-9 md:py-11"
          >
            <MapPin className="w-14 h-14 md:w-16 md:h-16 text-stone-700 p-3" strokeWidth={1.2} />
            <div className="text-[13px] md:text-sm text-stone-500 leading-snug max-w-[220px]">
              <span className="font-semibold text-stone-800">Asesoría en</span> diferentes canales
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.14, duration: 0.5 }}
            className="flex flex-col items-center text-center gap-3 px-4 py-9 md:py-11"
          >
            <img src={freeShippingImg} alt="Envíos gratis Juhnios Rold" className="h-16 md:h-20 w-auto object-contain" />
            <div className="text-[13px] md:text-sm text-stone-500 leading-snug max-w-[220px]">
              Envío gratis por compras mayores a $130.000 en ciudades principales
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.21, duration: 0.5 }}
            className="flex flex-col items-center text-center gap-3 px-4 py-9 md:py-11"
          >
            <img src={wompiLogo} alt="Wompi" className="h-9 md:h-11 w-auto object-contain" />
            <div className="text-[13px] md:text-sm text-stone-500 leading-snug max-w-[220px]">
              <span className="font-semibold text-stone-800">Paga seguro</span> con Wompi. Tarjetas, PSE y más medios de pago
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

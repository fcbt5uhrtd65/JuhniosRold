import { motion } from 'motion/react';
import { Package, CreditCard, MapPin, Clock } from 'lucide-react';

export function ShippingInfo() {
  const shippingCities = [
    'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena',
    'Bucaramanga', 'Pereira', 'Manizales', 'Santa Marta'
  ];

  const paymentMethods = [
    { name: 'Nequi', logo: '💳' },
    { name: 'Daviplata', logo: '💳' },
    { name: 'PSE', logo: '🏦' },
    { name: 'Efectivo', logo: '💵' },
    { name: 'Tarjetas', logo: '💳' }
  ];

  return (
    <section className="py-12 bg-secondary border-y border-border">
      <div className="max-w-[1400px] mx-auto px-8 md:px-12">
        <div className="grid md:grid-cols-4 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <Package className="w-6 h-6 mx-auto mb-3" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase mb-1.5">
              Envío gratis
            </div>
            <div className="text-[10px] text-muted-foreground">
              Compras desde $80.000
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <Clock className="w-6 h-6 mx-auto mb-3" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase mb-1.5">
              Entrega rápida
            </div>
            <div className="text-[10px] text-muted-foreground">
              2-5 días hábiles
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <CreditCard className="w-6 h-6 mx-auto mb-3" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase mb-1.5">
              Pago seguro
            </div>
            <div className="text-[10px] text-muted-foreground">
              Todos los métodos
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <MapPin className="w-6 h-6 mx-auto mb-3" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase mb-1.5">
              Cobertura nacional
            </div>
            <div className="text-[10px] text-muted-foreground">
              +20 ciudades
            </div>
          </motion.div>
        </div>

        
      </div>
    </section>
  );
}

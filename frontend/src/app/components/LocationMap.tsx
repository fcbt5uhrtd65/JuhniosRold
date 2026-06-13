import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { MapPin, Package, Clock, Shield, ArrowRight } from 'lucide-react';
import mapImage from '../../imports/ChatGPT_Image_1_may_2026,_06_50_44_p.m..png';

interface City {
  name: string;
  department: string;
  x: string;
  y: string;
  clients: number;
  deliveryDays: string;
}

const cities: City[] = [
  { name: 'Bogotá',       department: 'Cundinamarca',   x: '46%', y: '54%', clients: 3820, deliveryDays: '2-3 días' },
  { name: 'Medellín',     department: 'Antioquia',      x: '37%', y: '40%', clients: 2140, deliveryDays: '2-3 días' },
  { name: 'Cali',         department: 'Valle del Cauca',x: '33%', y: '66%', clients: 1560, deliveryDays: '3-4 días' },
  { name: 'Barranquilla', department: 'Atlántico',      x: '43%', y: '16%', clients: 980,  deliveryDays: '3-4 días' },
  { name: 'Cartagena',    department: 'Bolívar',        x: '36%', y: '20%', clients: 720,  deliveryDays: '3-4 días' },
  { name: 'Bucaramanga',  department: 'Santander',      x: '48%', y: '35%', clients: 640,  deliveryDays: '3-4 días' },
  { name: 'Pereira',      department: 'Risaralda',      x: '37%', y: '54%', clients: 530,  deliveryDays: '4-5 días' },
  { name: 'Manizales',    department: 'Caldas',         x: '38%', y: '50%', clients: 410,  deliveryDays: '4-5 días' },
];

const totalCities  = 28;
const totalClients = cities.reduce((sum, c) => sum + c.clients, 0);

function useCounter(target: number, trigger: boolean, duration = 1600) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let start = 0;
    const step = target / (duration / 16);
    const t = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(t); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(t);
  }, [trigger, target, duration]);
  return val;
}

export function LocationMap() {
  const [hoveredCity, setHoveredCity] = useState<City | null>(null);
  const [activeCity,  setActiveCity]  = useState<City | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const inView     = useInView(sectionRef, { once: true, margin: '-100px' });

  const countCities  = useCounter(totalCities, inView);
  const countClients = useCounter(Math.floor(totalClients / 1000), inView, 1800);

  const displayCity = hoveredCity ?? activeCity;

  const trustItems = [
    { icon: Package, title: 'Envío seguro',       desc: 'Empaque protegido y rastreable en toda Colombia' },
    { icon: Clock,   title: 'Entrega estimada',   desc: '2 a 5 días hábiles según tu ciudad' },
    { icon: Shield,  title: 'Compra protegida',   desc: 'Garantía de 30 días en todos los productos' },
  ];

  return (
    <section ref={sectionRef} className="py-20 bg-white overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-14">

        {/* Header */}
        <div className="grid md:grid-cols-2 items-end gap-10 mb-14">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-5 h-px bg-stone-300" />
              <span className="text-[9px] tracking-[0.4em] uppercase text-muted-foreground">Cobertura nacional</span>
            </div>
            <h2
              className="text-4xl md:text-5xl lg:text-6xl font-light leading-none tracking-tight text-foreground"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Colombia<br />
              <span className="text-muted-foreground/40">entera</span><br />
              nos conoce.
            </h2>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="grid grid-cols-3 gap-6 md:justify-items-end"
          >
            {[
              { value: `+${countCities}`,   label: 'Ciudades',  sub: 'a nivel nacional' },
              { value: `+${countClients}K`, label: 'Clientas',  sub: 'satisfechas' },
              { value: '2–5d',              label: 'Envío',      sub: 'tiempo estimado' },
            ].map(({ value, label, sub }) => (
              <div key={label} className="md:text-right">
                <div className="text-3xl md:text-4xl font-light text-foreground mb-0.5">{value}</div>
                <div className="text-[10px] tracking-[0.2em] uppercase text-foreground/60">{label}</div>
                <div className="text-[9px] text-muted-foreground mt-0.5 hidden md:block">{sub}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Map + City list */}
        <div className="grid md:grid-cols-3 gap-8 items-start mb-14">

          {/* Map */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="md:col-span-2"
          >
            <div className="relative w-full rounded-3xl overflow-hidden bg-stone-50 border border-stone-100"
              style={{ aspectRatio: '3/4', maxHeight: '580px' }}
            >
              <img
                src={mapImage}
                alt="Mapa de Colombia — Juhnios Rold"
                className="w-full h-full object-contain p-4"
              />

              {/* City pins */}
              {cities.map((city, idx) => (
                <motion.button
                  key={city.name}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={inView ? { scale: 1, opacity: 1 } : {}}
                  transition={{ delay: 0.2 + idx * 0.08, type: 'spring', stiffness: 350, damping: 22 }}
                  whileHover={{ scale: 1.6 }}
                  onMouseEnter={() => setHoveredCity(city)}
                  onMouseLeave={() => setHoveredCity(null)}
                  onClick={() => setActiveCity(city === activeCity ? null : city)}
                  className="absolute -translate-x-1/2 -translate-y-full focus:outline-none"
                  style={{ left: city.x, top: city.y }}
                  aria-label={city.name}
                >
                  <div className="relative">
                    <MapPin
                      className={`transition-all duration-200 drop-shadow-sm ${
                        displayCity?.name === city.name
                          ? 'w-5 h-5 text-foreground'
                          : 'w-4 h-4 text-stone-400 hover:text-stone-700'
                      }`}
                      fill={displayCity?.name === city.name ? 'currentColor' : 'none'}
                      strokeWidth={1.5}
                    />
                    {city.clients > 1000 && (
                      <span className="absolute top-0 left-0 w-4 h-4 rounded-full bg-stone-400/20 animate-ping" />
                    )}
                  </div>
                </motion.button>
              ))}

              {/* Tooltip */}
              <AnimatePresence>
                {displayCity && (
                  <motion.div
                    key={displayCity.name}
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.18 }}
                    className="absolute z-10 bg-white border border-stone-200 shadow-xl rounded-2xl pointer-events-none min-w-[160px] overflow-hidden"
                    style={{ left: displayCity.x, top: `calc(${displayCity.y} - 100px)`, transform: 'translateX(-50%)' }}
                  >
                    <div className="px-4 pt-3 pb-2 bg-stone-50 border-b border-stone-100">
                      <div className="text-[11px] font-medium tracking-wide text-foreground">{displayCity.name}</div>
                      <div className="text-[9px] text-muted-foreground">{displayCity.department}</div>
                    </div>
                    <div className="grid grid-cols-2">
                      <div className="px-3 py-2 border-r border-stone-100">
                        <div className="text-[8px] uppercase text-muted-foreground mb-0.5">Clientas</div>
                        <div className="text-xs font-medium text-foreground">+{displayCity.clients.toLocaleString()}</div>
                      </div>
                      <div className="px-3 py-2">
                        <div className="text-[8px] uppercase text-muted-foreground mb-0.5">Envío</div>
                        <div className="text-xs font-medium text-foreground">{displayCity.deliveryDays}</div>
                      </div>
                    </div>
                    {/* Arrow */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0"
                      style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid white' }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* City list */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-4 h-px bg-stone-300" />
              <div className="text-[9px] tracking-[0.35em] uppercase text-muted-foreground">Ciudades principales</div>
            </div>

            <div className="space-y-1">
              {cities.map((city, idx) => {
                const isActive = displayCity?.name === city.name;
                return (
                  <motion.button
                    key={city.name}
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.05 }}
                    onMouseEnter={() => setHoveredCity(city)}
                    onMouseLeave={() => setHoveredCity(null)}
                    onClick={() => setActiveCity(city === activeCity ? null : city)}
                    className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all duration-200 ${
                      isActive ? 'bg-stone-100 border border-stone-200' : 'hover:bg-stone-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full transition-all ${isActive ? 'bg-foreground' : 'bg-stone-300'}`} />
                      <div>
                        <div className="text-xs font-medium text-foreground">{city.name}</div>
                        <div className="text-[9px] text-muted-foreground">{city.deliveryDays}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-[9px] text-muted-foreground">+{city.clients.toLocaleString()}</div>
                      {isActive && <ArrowRight className="w-3 h-3 text-stone-400" strokeWidth={1.5} />}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Free shipping card */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="mt-5 p-5 bg-emerald-50 border border-emerald-100 rounded-2xl"
            >
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-emerald-600" strokeWidth={1.5} />
                <span className="text-[10px] tracking-[0.2em] uppercase text-emerald-700 font-medium">Envío gratis</span>
              </div>
              <p className="text-xs text-emerald-800/80 leading-relaxed">
                En compras mayores a <strong>$80.000 COP</strong> a cualquier ciudad de Colombia.
              </p>
            </motion.div>
          </motion.div>
        </div>

        {/* Trust cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          {trustItems.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-4 p-5 bg-stone-50 rounded-2xl border border-stone-100"
            >
              <div className="w-10 h-10 rounded-xl bg-white border border-stone-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Icon className="w-4 h-4 text-stone-600" strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground mb-1">{title}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

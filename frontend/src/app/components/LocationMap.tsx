import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { MapPin, ArrowRight } from 'lucide-react';
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
  { name: 'Bogotá',      department: 'Cundinamarca', x: '46%', y: '54%', clients: 3820, deliveryDays: '2-3 días' },
  { name: 'Medellín',    department: 'Antioquia',    x: '37%', y: '40%', clients: 2140, deliveryDays: '2-3 días' },
  { name: 'Cali',        department: 'Valle del Cauca', x: '33%', y: '66%', clients: 1560, deliveryDays: '3-4 días' },
  { name: 'Barranquilla',department: 'Atlántico',    x: '43%', y: '16%', clients: 980,  deliveryDays: '3-4 días' },
  { name: 'Cartagena',   department: 'Bolívar',      x: '36%', y: '20%', clients: 720,  deliveryDays: '3-4 días' },
  { name: 'Bucaramanga', department: 'Santander',    x: '48%', y: '35%', clients: 640,  deliveryDays: '3-4 días' },
  { name: 'Pereira',     department: 'Risaralda',    x: '37%', y: '54%', clients: 530,  deliveryDays: '4-5 días' },
  { name: 'Manizales',   department: 'Caldas',       x: '38%', y: '50%', clients: 410,  deliveryDays: '4-5 días' },
];

const totalCities  = 28;
const totalClients = cities.reduce((sum, c) => sum + c.clients, 0);

/* Animated counter hook */
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
  const [activeCity, setActiveCity]   = useState<City | null>(null);
  const sectionRef  = useRef<HTMLElement>(null);
  const inView      = useInView(sectionRef, { once: true, margin: '-100px' });

  const countCities   = useCounter(totalCities, inView);
  const countClients  = useCounter(Math.floor(totalClients / 1000), inView, 1800);

  const displayCity = hoveredCity ?? activeCity;

  return (
    <section ref={sectionRef} className="bg-white overflow-hidden">
      {/* ── Header ── */}
      <div className="max-w-[1400px] mx-auto px-8 md:px-12 pt-20 pb-14">
        <div className="grid md:grid-cols-2 items-end gap-10">
          {/* Left */}
          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px w-6 bg-foreground/30" />
              <span className="text-[9px] tracking-[0.4em] uppercase text-muted-foreground">COBERTURA NACIONAL</span>
            </div>
            <h2 className="text-5xl md:text-6xl lg:text-7xl leading-none tracking-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}>
              Colombia<br />
              <span className="text-muted-foreground/50">entera</span><br />
              nos conoce.
            </h2>
          </motion.div>

          {/* Right — stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-3 gap-8 md:justify-items-end"
          >
            {[
              { value: `+${countCities}`,   label: 'Ciudades',  sublabel: 'a nivel nacional' },
              { value: `+${countClients}K`, label: 'Clientas',  sublabel: 'satisfechas' },
              { value: '2–5d',              label: 'Envío',      sublabel: 'tiempo estimado' },
            ].map(({ value, label, sublabel }) => (
              <div key={label} className="md:text-right">
                <div className="text-3xl md:text-4xl text-foreground mb-1">{value}</div>
                <div className="text-[10px] tracking-[0.25em] uppercase text-foreground/70">{label}</div>
                <div className="text-[9px] text-muted-foreground mt-0.5 hidden md:block">{sublabel}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Map + List ── */}
      <div className="max-w-[1400px] mx-auto px-8 md:px-12 pb-20">
        <div className="grid md:grid-cols-3 gap-8 items-start">

          {/* Map */}
          <motion.div
            initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="md:col-span-2"
          >
            {/* Raw image — no frame */}
            <div className="relative w-full" style={{ aspectRatio: '3/4', maxHeight: '580px' }}>
              <img
                src={mapImage}
                alt="Mapa de Colombia — Juhnios Rold"
                className="w-full h-full object-contain"
              />

              {/* City pins */}
              {cities.map((city, idx) => (
                <motion.button
                  key={city.name}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={inView ? { scale: 1, opacity: 1 } : {}}
                  transition={{ delay: 0.2 + idx * 0.08, type: 'spring', stiffness: 350, damping: 22 }}
                  whileHover={{ scale: 1.5 }}
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
                          : 'w-4 h-4 text-foreground/50 hover:text-foreground/80'
                      }`}
                      fill={displayCity?.name === city.name ? 'currentColor' : 'none'}
                      strokeWidth={1.5}
                    />
                    {city.clients > 1000 && (
                      <span className="absolute top-0 left-0 w-4 h-4 rounded-full bg-foreground/15 animate-ping" />
                    )}
                  </div>
                </motion.button>
              ))}

              {/* Tooltip */}
              <AnimatePresence>
                {displayCity && (
                  <motion.div
                    key={displayCity.name}
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.18 }}
                    className="absolute z-10 bg-foreground text-background pointer-events-none shadow-xl min-w-[170px]"
                    style={{ left: displayCity.x, top: `calc(${displayCity.y} - 96px)`, transform: 'translateX(-50%)' }}
                  >
                    <div className="px-4 pt-3 pb-2">
                      <div className="text-[11px] tracking-[0.15em] uppercase mb-0.5">{displayCity.name}</div>
                      <div className="text-[9px] opacity-50 tracking-wide">{displayCity.department}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-0 border-t border-background/15">
                      <div className="px-4 py-2 border-r border-background/15">
                        <div className="text-[8px] uppercase opacity-40 mb-0.5">Clientas</div>
                        <div className="text-xs">+{displayCity.clients.toLocaleString()}</div>
                      </div>
                      <div className="px-4 py-2">
                        <div className="text-[8px] uppercase opacity-40 mb-0.5">Envío</div>
                        <div className="text-xs">{displayCity.deliveryDays}</div>
                      </div>
                    </div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0"
                      style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid var(--foreground)' }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* City list */}
          <motion.div
            initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px w-5 bg-foreground/20" />
              <div className="text-[9px] tracking-[0.35em] uppercase text-muted-foreground">Ciudades principales</div>
            </div>

            <div className="space-y-0">
              {cities.map((city, idx) => {
                const isActive = displayCity?.name === city.name;
                return (
                  <motion.button
                    key={city.name}
                    initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }} transition={{ delay: idx * 0.05 }}
                    onMouseEnter={() => setHoveredCity(city)}
                    onMouseLeave={() => setHoveredCity(null)}
                    onClick={() => setActiveCity(city === activeCity ? null : city)}
                    className={`w-full text-left py-3.5 border-b border-border flex items-center justify-between transition-all duration-200 ${
                      isActive ? 'pl-3 bg-secondary' : 'hover:pl-2 hover:bg-secondary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ width: isActive ? '6px' : '0px' }}
                        className="h-px bg-foreground shrink-0 transition-all"
                      />
                      <div>
                        <div className="text-xs text-foreground">{city.name}</div>
                        <div className="text-[9px] text-muted-foreground">{city.deliveryDays}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-[9px] text-muted-foreground font-mono">+{city.clients.toLocaleString()}</div>
                      <motion.div animate={{ opacity: isActive ? 1 : 0 }}>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" strokeWidth={1.5} />
                      </motion.div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {/* Free shipping note */}
            <motion.div
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
              viewport={{ once: true }} transition={{ delay: 0.5 }}
              className="mt-8 border border-border bg-secondary/40 p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px w-4 bg-foreground/30" />
                <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground">Envío gratis</div>
              </div>
              <div className="text-xs text-foreground/80 leading-relaxed">
                En compras mayores a $80.000 COP a todo Colombia
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
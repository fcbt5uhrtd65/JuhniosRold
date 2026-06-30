import { useState, useRef } from 'react';
import { motion, AnimatePresence, useInView } from 'motion/react';
import { Package, Clock, Shield, Truck } from 'lucide-react';

const OLIVE = '#2D3A1F';

interface City {
  name: string;
  department: string;
  x: number;
  y: number;
  clients: number;
  deliveryDays: string;
  size: 'xl' | 'lg' | 'md' | 'sm';
}

const cities: City[] = [
  { name: 'Bogotá',       department: 'Cundinamarca',    x: 46, y: 54, clients: 3820, deliveryDays: '2–3 días', size: 'xl' },
  { name: 'Medellín',     department: 'Antioquia',       x: 37, y: 40, clients: 2140, deliveryDays: '2–3 días', size: 'xl' },
  { name: 'Cali',         department: 'Valle del Cauca', x: 33, y: 66, clients: 1560, deliveryDays: '3–4 días', size: 'lg' },
  { name: 'Barranquilla', department: 'Atlántico',       x: 43, y: 16, clients:  980, deliveryDays: '3–4 días', size: 'lg' },
  { name: 'Cartagena',    department: 'Bolívar',         x: 36, y: 20, clients:  720, deliveryDays: '3–4 días', size: 'md' },
  { name: 'Bucaramanga',  department: 'Santander',       x: 49, y: 35, clients:  640, deliveryDays: '3–4 días', size: 'md' },
  { name: 'Pereira',      department: 'Risaralda',       x: 37, y: 54, clients:  530, deliveryDays: '4–5 días', size: 'sm' },
  { name: 'Manizales',    department: 'Caldas',          x: 38, y: 50, clients:  410, deliveryDays: '4–5 días', size: 'sm' },
];

const totalCities  = 28;
const totalClients = cities.reduce((s, c) => s + c.clients, 0);

const dotSize = { xl: 10, lg: 7, md: 6, sm: 5 };

function useCounter(target: number, trigger: boolean, duration = 1400) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  if (trigger && !started.current) {
    started.current = true;
    let v = 0;
    const step = target / (duration / 16);
    const t = setInterval(() => {
      v += step;
      if (v >= target) { setVal(target); clearInterval(t); }
      else setVal(Math.floor(v));
    }, 16);
  }
  return val;
}

export function LocationMap() {
  const [active, setActive] = useState<City | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const inView     = useInView(sectionRef, { once: true, margin: '-80px' });

  const countCities  = useCounter(totalCities,                     inView);
  const countClients = useCounter(Math.floor(totalClients / 1000), inView, 1800);

  return (
    <section ref={sectionRef} className="py-16 md:py-24 bg-[#F7F5F1] overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 lg:px-14">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-12 md:mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-5 h-px bg-stone-400" />
              <span className="text-[9px] tracking-[0.4em] uppercase text-stone-400 font-medium">Cobertura nacional</span>
            </div>
            <h2
              className="text-[36px] sm:text-5xl lg:text-[56px] font-light leading-[1.0] tracking-tight text-stone-900"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Llegamos a toda<br />
              <em className="not-italic font-medium" style={{ color: OLIVE }}>Colombia.</em>
            </h2>
          </motion.div>

          {/* Stats en línea */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, delay: 0.12 }}
            className="flex gap-8 md:gap-10 md:pb-2"
          >
            {[
              { value: `+${countCities}`,   label: 'ciudades' },
              { value: `+${countClients}K`, label: 'clientas' },
              { value: '2–5d',              label: 'entrega' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-2xl sm:text-3xl font-light text-stone-900" style={{ fontFamily: "'Playfair Display', serif" }}>{value}</div>
                <div className="text-[9px] tracking-[0.25em] uppercase text-stone-400 mt-0.5">{label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── Bloque principal: mapa + lista ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-10 items-start mb-10">

          {/* MAPA */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.75 }}
          >
            <div
              className="relative w-full rounded-2xl overflow-hidden"
              style={{ aspectRatio: '16/9', background: '#EDEAE4' }}
            >
              {/* SVG Colombia — forma limpia y centrada */}
              <svg
                viewBox="0 0 200 220"
                className="absolute inset-0 w-full h-full"
                style={{ padding: '6% 18%' }}
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M 68 10 L 82 6 L 98 9 L 112 7 L 122 15 L 128 26 L 126 40 L 132 48 L 138 58
                     L 136 72 L 128 78 L 133 88 L 130 102 L 126 112 L 122 128 L 116 143 L 108 158
                     L 103 175 L 98 192 L 90 208 L 83 218 L 76 210 L 70 198 L 64 184 L 59 168
                     L 54 152 L 49 136 L 44 120 L 38 104 L 34 88 L 29 72 L 26 56 L 28 42
                     L 34 30 L 44 18 L 56 10 Z"
                  fill={`${OLIVE}0C`}
                  stroke={`${OLIVE}30`}
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Puntos de ciudad */}
              {cities.map((city, idx) => {
                const isAct = active?.name === city.name;
                const d = dotSize[city.size];
                return (
                  <motion.button
                    key={city.name}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={inView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 0.3 + idx * 0.07, type: 'spring', stiffness: 300, damping: 20 }}
                    onClick={() => setActive(city === active ? null : city)}
                    aria-label={city.name}
                    className="absolute focus:outline-none"
                    style={{ left: `${city.x}%`, top: `${city.y}%`, transform: 'translate(-50%,-50%)' }}
                  >
                    {/* Halo en ciudades xl cuando activo o siempre */}
                    {(city.size === 'xl') && (
                      <motion.span
                        className="absolute rounded-full"
                        style={{ width: d * 3.6, height: d * 3.6, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', backgroundColor: `${OLIVE}${isAct ? '20' : '0E'}` }}
                        animate={{ scale: [1, 1.25, 1] }}
                        transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut', delay: idx * 0.4 }}
                      />
                    )}
                    <span
                      className="relative block rounded-full transition-all duration-200"
                      style={{
                        width: d, height: d,
                        backgroundColor: isAct ? OLIVE : `${OLIVE}55`,
                        boxShadow: isAct ? `0 0 0 3px ${OLIVE}25` : 'none',
                      }}
                    />
                  </motion.button>
                );
              })}

              {/* Tooltip */}
              <AnimatePresence>
                {active && (
                  <motion.div
                    key={active.name}
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.14 }}
                    className="absolute z-10 pointer-events-none"
                    style={{ left: `${active.x}%`, top: `calc(${active.y}% - 64px)`, transform: 'translateX(-50%)' }}
                  >
                    <div className="bg-white border border-stone-200 shadow-lg rounded-xl overflow-hidden min-w-[140px]">
                      <div className="px-3 py-2 border-b border-stone-100">
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: OLIVE }} />
                          <span className="text-[11px] font-semibold text-stone-900">{active.name}</span>
                        </div>
                        <div className="text-[9px] text-stone-400 pl-3">{active.department}</div>
                      </div>
                      <div className="grid grid-cols-2 divide-x divide-stone-100">
                        <div className="px-3 py-1.5">
                          <div className="text-[8px] uppercase text-stone-400">Clientas</div>
                          <div className="text-[11px] font-semibold text-stone-900">+{active.clients.toLocaleString()}</div>
                        </div>
                        <div className="px-3 py-1.5">
                          <div className="text-[8px] uppercase text-stone-400">Envío</div>
                          <div className="text-[11px] font-semibold text-stone-900">{active.deliveryDays}</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-center"><div className="w-2 h-2 bg-white border-r border-b border-stone-200 rotate-45 -mt-[1px]" /></div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Badge esquina */}
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/85 backdrop-blur-sm border border-stone-200/80 rounded-full px-3 py-1.5">
                <Truck className="w-3 h-3 flex-shrink-0" style={{ color: OLIVE }} strokeWidth={1.8} />
                <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: OLIVE }}>Envío a toda Colombia</span>
              </div>
            </div>
          </motion.div>

          {/* LISTA DE CIUDADES */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, delay: 0.15 }}
            className="flex flex-col gap-4"
          >
            <p className="text-[9px] tracking-[0.35em] uppercase text-stone-400 font-medium">Ciudades principales</p>

            <div className="divide-y divide-stone-200">
              {cities.map(city => {
                const isAct = active?.name === city.name;
                return (
                  <button
                    key={city.name}
                    onClick={() => setActive(city === active ? null : city)}
                    className="w-full flex items-center justify-between py-2.5 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all"
                        style={{ backgroundColor: isAct ? OLIVE : '#ccc' }}
                      />
                      <div>
                        <div className={`text-xs font-medium transition-colors ${isAct ? 'text-stone-900' : 'text-stone-600 group-hover:text-stone-900'}`}>{city.name}</div>
                        <div className="text-[9px] text-stone-400">{city.deliveryDays}</div>
                      </div>
                    </div>
                    <span className="text-[9px] text-stone-400">+{city.clients.toLocaleString()}</span>
                  </button>
                );
              })}
            </div>

            {/* Envío gratis */}
            <div
              className="mt-2 rounded-xl p-4 border"
              style={{ background: `${OLIVE}07`, borderColor: `${OLIVE}18` }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Package className="w-3.5 h-3.5" style={{ color: OLIVE }} strokeWidth={2} />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: OLIVE }}>Envío gratis</span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">En compras mayores a <strong className="text-stone-800">$80.000 COP</strong> a cualquier ciudad.</p>
            </div>
          </motion.div>
        </div>

        {/* ── Trust strip ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Package, title: 'Envío seguro',     desc: 'Empaque protegido y rastreable en toda Colombia' },
            { icon: Clock,   title: 'Entrega estimada', desc: '2 a 5 días hábiles según tu ciudad' },
            { icon: Shield,  title: 'Compra protegida', desc: 'Garantía de 30 días en todos los productos' },
          ].map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex items-start gap-3 p-4 rounded-xl bg-white border border-stone-100"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${OLIVE}0E` }}>
                <Icon className="w-3.5 h-3.5" style={{ color: OLIVE }} strokeWidth={1.6} />
              </div>
              <div>
                <div className="text-xs font-semibold text-stone-800 mb-0.5">{title}</div>
                <p className="text-[11px] text-stone-400 leading-relaxed">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}

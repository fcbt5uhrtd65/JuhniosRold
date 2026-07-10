import { useState, useRef, useEffect } from 'react';
import { motion, useInView } from 'motion/react';
import { Package, Clock, Shield, Truck } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

const OLIVE = '#2D3A1F';

interface City {
  name: string;
  department: string;
  lat: number;
  lng: number;
  clients: number;
  deliveryDays: string;
  size: 'xl' | 'lg' | 'md' | 'sm';
}

const cities: City[] = [
  { name: 'Bogotá',       department: 'Cundinamarca',    lat: 4.7110,  lng: -74.0721, clients: 3820, deliveryDays: '2–3 días', size: 'xl' },
  { name: 'Medellín',     department: 'Antioquia',       lat: 6.2442,  lng: -75.5812, clients: 2140, deliveryDays: '2–3 días', size: 'xl' },
  { name: 'Cali',         department: 'Valle del Cauca', lat: 3.4516,  lng: -76.5320, clients: 1560, deliveryDays: '3–4 días', size: 'lg' },
  { name: 'Barranquilla', department: 'Atlántico',       lat: 10.9639, lng: -74.7964, clients:  980, deliveryDays: '3–4 días', size: 'lg' },
  { name: 'Cartagena',    department: 'Bolívar',         lat: 10.3910, lng: -75.4794, clients:  720, deliveryDays: '3–4 días', size: 'md' },
  { name: 'Bucaramanga',  department: 'Santander',       lat: 7.1193,  lng: -73.1227, clients:  640, deliveryDays: '3–4 días', size: 'md' },
  { name: 'Pereira',      department: 'Risaralda',       lat: 4.8143,  lng: -75.6946, clients:  530, deliveryDays: '4–5 días', size: 'sm' },
  { name: 'Manizales',    department: 'Caldas',          lat: 5.0689,  lng: -75.5174, clients:  410, deliveryDays: '4–5 días', size: 'sm' },
];

const totalCities  = 28;
const totalClients = cities.reduce((s, c) => s + c.clients, 0);

const radiusBySize = { xl: 11, lg: 9, md: 7, sm: 6 };

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

function CoverageMap({ active, onSelect, inView }: {
  active: City | null;
  onSelect: (city: City) => void;
  inView: boolean;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Record<string, any>>({});
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!inView || !mapContainerRef.current || mapRef.current) return;

    let cancelled = false;

    (async () => {
      const leafletModule = await import('leaflet');
      const L = leafletModule.default ?? leafletModule;

      // Fix default icon paths broken by bundlers (mismo patrón que AddressMap.tsx)
      // @ts-expect-error – accediendo a propiedad interna de Leaflet
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (cancelled || !mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      }).setView([4.5709, -74.2973], 5);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      cities.forEach((city) => {
        const marker = L.circleMarker([city.lat, city.lng], {
          radius: radiusBySize[city.size],
          color: OLIVE,
          weight: 2,
          fillColor: OLIVE,
          fillOpacity: 0.55,
        }).addTo(map);
        marker.bindTooltip(
          `<strong>${city.name}</strong><br/>+${city.clients.toLocaleString()} clientas · ${city.deliveryDays}`,
          { direction: 'top', offset: [0, -6] },
        );
        marker.on('click', () => onSelect(city));
        markersRef.current[city.name] = marker;
      });

      mapRef.current = map;
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = {};
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  // Resalta el marcador activo y centra el mapa sobre él
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    Object.entries(markersRef.current).forEach(([name, marker]) => {
      const isActive = active?.name === name;
      marker.setStyle({
        fillOpacity: isActive ? 0.9 : 0.55,
        weight: isActive ? 3 : 2,
      });
    });
    if (active) {
      mapRef.current.flyTo([active.lat, active.lng], 7, { duration: 0.6 });
    }
  }, [active, mapReady]);

  return <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />;
}

export function LocationMap() {
  const [active, setActive] = useState<City | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const inView     = useInView(sectionRef, { once: true, margin: '-80px' });

  const countCities  = useCounter(totalCities,                     inView);
  const countClients = useCounter(Math.floor(totalClients / 1000), inView, 1800);

  return (
    <section ref={sectionRef} className="py-16 md:py-24 bg-white overflow-hidden">
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
              className="relative w-full rounded-2xl overflow-hidden z-0"
              style={{ aspectRatio: '16/9', minHeight: 280, background: '#FFFFFF' }}
            >
              <CoverageMap active={active} onSelect={(city) => setActive(city === active ? null : city)} inView={inView} />

              {/* Badge esquina */}
              <div className="absolute bottom-3 left-3 z-[500] flex items-center gap-1.5 bg-white/90 backdrop-blur-sm border border-stone-200/80 rounded-full px-3 py-1.5 pointer-events-none">
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
              className="mt-2 rounded-xl p-4 border bg-white"
              style={{ borderColor: `${OLIVE}18` }}
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

import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';

// Dynamically import Leaflet to avoid SSR issues and keep bundle clean
let leafletLoaded = false;

interface LatLng {
  lat: number;
  lng: number;
}

interface AddressMapProps {
  /** Full address string to geocode and display */
  address: string;
  city: string;
  country?: string;
  className?: string;
}

async function geocode(query: string): Promise<LatLng | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'es', 'User-Agent': 'JuhniosRoldApp/1.0' },
    });
    const data: Array<{ lat: string; lon: string }> = await res.json();
    if (!data[0]) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export function AddressMap({ address, city, country = 'Colombia', className = '' }: AddressMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'found' | 'error'>('idle');

  const query = [address, city, country].filter(Boolean).join(', ');

  // Init or destroy map
  useEffect(() => {
    if (!mapRef.current) return;

    let cancelled = false;

    async function init() {
      // Lazy-load Leaflet CSS once
      if (!leafletLoaded) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        leafletLoaded = true;
      }

      const leafletModule = await import('leaflet');
      const L = leafletModule.default ?? leafletModule;

      // Fix default icon paths broken by Vite/webpack
      // @ts-expect-error – accessing internal Leaflet property
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (cancelled || !mapRef.current) return;

      // Destroy previous instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }

      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false });
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Default view: Colombia
      map.setView([4.711, -74.0721], 5);

      if (!query.trim()) return;

      setStatus('loading');
      const coords = await geocode(query);
      if (cancelled) return;

      if (coords) {
        map.setView([coords.lat, coords.lng], 15);
        const marker = L.marker([coords.lat, coords.lng]).addTo(map);
        marker.bindPopup(`<b>${address || city}</b><br/>${city}${country ? `, ${country}` : ''}`).openPopup();
        markerRef.current = marker;
        setStatus('found');
      } else {
        setStatus('error');
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  // Re-run when query changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (!query.trim()) return null;

  return (
    <div className={`relative ${className}`}>
      {/* Status banner */}
      {status === 'loading' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1.5 bg-background/90 border border-border px-3 py-1.5 text-[10px] shadow-sm">
          <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} />
          Buscando ubicación…
        </div>
      )}
      {status === 'found' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1.5 bg-background/90 border border-border px-3 py-1.5 text-[10px] shadow-sm text-green-700">
          <MapPin className="w-3 h-3" strokeWidth={1.5} />
          Ubicación encontrada
        </div>
      )}
      {status === 'error' && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1.5 bg-background/90 border border-border px-3 py-1.5 text-[10px] shadow-sm text-orange-600">
          <AlertCircle className="w-3 h-3" strokeWidth={1.5} />
          Dirección no encontrada en el mapa
        </div>
      )}
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}

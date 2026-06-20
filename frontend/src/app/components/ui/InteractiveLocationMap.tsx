import { useEffect, useRef } from 'react';

// Dynamically import Leaflet to avoid SSR issues and keep bundle clean
let leafletLoaded = false;

interface InteractiveLocationMapProps {
  /** Current marker position. Pass null while no location has been picked yet. */
  lat: number | null;
  lng: number | null;
  /** Called when the user drags the marker or clicks elsewhere on the map. */
  onMarkerMove: (lat: number, lng: number) => void;
  className?: string;
}

const DEFAULT_VIEW: [number, number] = [4.711, -74.0721]; // Colombia
const DEFAULT_ZOOM = 5;
const FOCUSED_ZOOM = 16;

export function InteractiveLocationMap({ lat, lng, onMarkerMove, className = '' }: InteractiveLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  const onMarkerMoveRef = useRef(onMarkerMove);
  onMarkerMoveRef.current = onMarkerMove;

  // Init map once
  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    async function init() {
      if (!leafletLoaded) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        leafletLoaded = true;
      }

      const leafletModule = await import('leaflet');
      const L = leafletModule.default ?? leafletModule;

      // @ts-expect-error – accessing internal Leaflet property
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (cancelled || !mapRef.current) return;
      leafletRef.current = L;

      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: false });
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
        placeMarker(e.latlng.lat, e.latlng.lng);
        onMarkerMoveRef.current(e.latlng.lat, e.latlng.lng);
      });

      if (lat !== null && lng !== null) {
        map.setView([lat, lng], FOCUSED_ZOOM);
        placeMarker(lat, lng);
      } else {
        map.setView(DEFAULT_VIEW, DEFAULT_ZOOM);
      }
    }

    function placeMarker(markerLat: number, markerLng: number) {
      const L = leafletRef.current;
      const map = mapInstanceRef.current;
      if (!L || !map) return;
      if (markerRef.current) {
        markerRef.current.setLatLng([markerLat, markerLng]);
        return;
      }
      const marker = L.marker([markerLat, markerLng], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onMarkerMoveRef.current(pos.lat, pos.lng);
      });
      markerRef.current = marker;
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
    // Map is initialized once; subsequent lat/lng updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep marker/view in sync when lat/lng change from outside (search selection, geolocation)
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    if (lat === null || lng === null) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        onMarkerMoveRef.current(pos.lat, pos.lng);
      });
      markerRef.current = marker;
    }
    map.setView([lat, lng], FOCUSED_ZOOM);
  }, [lat, lng]);

  return (
    <div className={`relative ${className}`}>
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Loader2, LocateFixed, MapPin, Pencil, Search, ShieldCheck } from 'lucide-react';
import { useGeolocation } from '../../hooks/useGeolocation';
import { getApproximateLocationByIp, mapNominatimAddressToFields, reverseGeocode, searchAddress } from '../../services/nominatim.service';
import { geographyService } from '../../services/geography.service';
import type { NominatimResult } from '../../services/nominatim.types';
import type { LocationValue } from '../../services/geography.types';
import type { DeliveryLocationValue } from '../../services/delivery-location.types';
import { InteractiveLocationMap } from './InteractiveLocationMap';

const OLIVE = '#2D3A1F';
// 250ms es el punto dulce entre "sentirse instantáneo" (Rappi/Google Places apuntan a ~200-300ms)
// y no saturar el throttle de geocoding con una request por tecla en nombres largos.
const SEARCH_DEBOUNCE_MS = 250;
const MIN_SEARCH_QUERY_LENGTH = 3;
/** ISO-2 country code(s) Nominatim/LocationIQ will hard-filter to, comma-separated (e.g. "co" or "co,ec"). */
const DEFAULT_COUNTRY_CODES = 'co';

interface DeliveryLocationSectionProps {
  value: DeliveryLocationValue;
  onChange: (value: DeliveryLocationValue) => void;
  /** Department/state and country selected in the LocationPicker above, used to scope the address search. */
  searchScope?: { state?: string; country?: string };
  /** Valid municipality names for the selected department, used to ignore neighbourhoods/corregimientos returned by the geocoder. */
  cityOptions?: string[];
  /** ISO-2 country code(s) to hard-filter address search results to. Defaults to Colombia ("co"). Pass '' to disable the hard filter. */
  countryCodes?: string;
  /** Called when the resolved address points to a different city than the one picked manually, so the city selector can stay in sync. */
  onCityResolved?: (city: string) => void;
  /**
   * Called after geolocation or a marker move resolves a full país/departamento/ciudad against
   * our catalog (with IDs), so the LocationPicker above can be kept in sync even when the user
   * hasn't picked a department yet (e.g. right after "Usar mi ubicación actual"). This correctly
   * normalizes corregimientos/veredas to their parent municipality, unlike onCityResolved which
   * only receives a bare city name.
   */
  onLocationResolved?: (location: LocationValue) => void;
}

export function DeliveryLocationSection({
  value,
  onChange,
  searchScope,
  cityOptions,
  countryCodes = DEFAULT_COUNTRY_CODES,
  onCityResolved,
  onLocationResolved,
}: DeliveryLocationSectionProps) {
  const geolocation = useGeolocation();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [reverseLoading, setReverseLoading] = useState(false);
  const [approximateCenter, setApproximateCenter] = useState<{ lat: number; lng: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Close suggestions dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Pre-center the map near the user's real area (via IP) before they interact with it, so it
  // doesn't open on the whole-country default view. Only fetched when there's no pin yet — this
  // never sets the actual delivery location, just the initial map viewport.
  useEffect(() => {
    if (value.lat !== null && value.lng !== null) return;
    let cancelled = false;
    getApproximateLocationByIp().then(location => {
      if (!cancelled && location) setApproximateCenter(location);
    });
    return () => { cancelled = true; };
    // Only worth checking once per mount — if the user later clears the pin, re-fetching
    // wouldn't change anything since the IP hasn't moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to a successful browser geolocation lookup
  useEffect(() => {
    if (geolocation.status !== 'success' || !geolocation.coords) return;
    const { lat, lng } = geolocation.coords;
    let cancelled = false;
    setReverseLoading(true);
    reverseGeocode(lat, lng).then(async result => {
      if (cancelled) return;
      const fields = result ? mapNominatimAddressToFields(result, { validCities: cityOptions }) : { city: '', state: '', country: '' };
      const resolvedLocation = result ? await geographyService.resolveLocationFromGeocode(result) : null;
      if (cancelled) return;
      setReverseLoading(false);
      const resolvedCity = resolvedLocation?.cityName || fields.city;
      const resolvedState = resolvedLocation?.stateName || fields.state;
      const resolvedCountry = resolvedLocation?.countryName || fields.country;
      onChange({
        ...value,
        lat,
        lng,
        address: result?.display_name || value.address,
        city: resolvedCity,
        state: resolvedState,
        country: resolvedCountry,
        confirmed: false,
      });
      if (resolvedLocation?.cityId) {
        onLocationResolved?.(resolvedLocation);
      } else if (resolvedCity) {
        onCityResolved?.(resolvedCity);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geolocation.status, geolocation.coords, cityOptions]);

  // Debounced address search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < MIN_SEARCH_QUERY_LENGTH) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchAddress(query, {
        state: searchScope?.state,
        country: searchScope?.country,
        countryCodes: countryCodes || undefined,
        strictScope: true,
      });
      setSearching(false);
      setSuggestions(results);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchScope?.state, searchScope?.country, countryCodes]);

  async function handleSelectSuggestion(result: NominatimResult) {
    const fields = mapNominatimAddressToFields(result, { validCities: cityOptions });
    const resolvedLocation = await geographyService.resolveLocationFromGeocode(result);
    const resolvedCity = resolvedLocation.cityName || fields.city;
    const resolvedState = resolvedLocation.stateName || fields.state;
    const resolvedCountry = resolvedLocation.countryName || fields.country;
    onChange({
      ...value,
      address: result.display_name,
      city: resolvedCity,
      state: resolvedState,
      country: resolvedCountry,
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      confirmed: false,
    });
    if (resolvedLocation.cityId) {
      onLocationResolved?.(resolvedLocation);
    } else if (resolvedCity) {
      onCityResolved?.(resolvedCity);
    }
    setQuery('');
    setSuggestions([]);
    setSuggestionsOpen(false);
  }

  function handleMarkerMove(lat: number, lng: number) {
    onChange({ ...value, lat, lng, confirmed: false });
    setReverseLoading(true);
    reverseGeocode(lat, lng).then(async result => {
      if (!result) {
        setReverseLoading(false);
        return;
      }
      const fields = mapNominatimAddressToFields(result, { validCities: cityOptions });
      const resolvedLocation = await geographyService.resolveLocationFromGeocode(result);
      setReverseLoading(false);
      const resolvedCity = resolvedLocation.cityName || fields.city;
      const resolvedState = resolvedLocation.stateName || fields.state;
      const resolvedCountry = resolvedLocation.countryName || fields.country;
      onChange({
        ...value,
        lat,
        lng,
        address: result.display_name,
        city: resolvedCity,
        state: resolvedState,
        country: resolvedCountry,
        confirmed: false,
      });
      if (resolvedLocation.cityId) {
        onLocationResolved?.(resolvedLocation);
      } else if (resolvedCity) {
        onCityResolved?.(resolvedCity);
      }
    });
  }

  const canConfirm = value.lat !== null && value.lng !== null && value.address.trim().length > 0;

  return (
    <div className="space-y-3">
      {/* Usar ubicación actual */}
      <button
        type="button"
        onClick={geolocation.requestLocation}
        disabled={geolocation.status === 'loading'}
        className="w-full flex items-center justify-center gap-2 py-3 border rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
        style={{ borderColor: OLIVE, color: OLIVE }}
      >
        {geolocation.status === 'loading' ? (
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
        ) : (
          <LocateFixed className="w-4 h-4" strokeWidth={1.5} />
        )}
        Usar mi ubicación actual
      </button>

      {/* Explicación previa al permiso nativo del navegador */}
      {geolocation.status === 'prompt' && (
        <div className="flex items-start gap-2.5 px-3.5 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 leading-relaxed">
          <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="flex-1 space-y-2">
            <p>
              Tu navegador va a pedirte permiso para compartir tu ubicación. La usamos solo para ubicar el pin en el mapa
              y calcular tu envío con precisión — acepta el permiso cuando aparezca.
            </p>
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={geolocation.confirmRequest}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
              >
                Permitir ubicación
              </button>
              <button
                type="button"
                onClick={geolocation.cancelPrompt}
                className="px-3 py-2 text-blue-700 hover:text-blue-900 transition-colors"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner de error / fallback */}
      {(geolocation.status === 'error' || geolocation.status === 'unsupported') && (
        <div className="flex items-start gap-2.5 px-3.5 py-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="flex-1 space-y-1.5">
            <p>{geolocation.errorMessage}</p>
            {geolocation.permissionBlocked && (
              <p className="text-amber-700">
                En Chrome/Edge: toca el ícono de candado o "ⓘ" junto a la dirección del sitio → Permisos del sitio →
                Ubicación → Permitir, y recarga la página.
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                searchInputRef.current?.focus();
              }}
              className="underline font-medium hover:text-amber-950 transition-colors"
            >
              Buscar manualmente
            </button>
          </div>
        </div>
      )}

      {/* Buscador de direcciones */}
      <div className="relative" ref={searchContainerRef}>
        <label className="block text-[9px] tracking-[0.28em] uppercase text-stone-400 font-medium mb-1.5">
          Buscar dirección
        </label>
        <div className="relative flex items-center rounded-xl border border-stone-200 bg-white">
          <Search className="absolute left-3.5 w-4 h-4 text-stone-300" strokeWidth={1.3} />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSuggestionsOpen(true); }}
            onFocus={() => setSuggestionsOpen(true)}
            placeholder="Calle, barrio, ciudad o punto de referencia"
            className="w-full pl-10 pr-9 py-3 bg-transparent text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none rounded-xl"
          />
          {searching && <Loader2 className="absolute right-3.5 w-3.5 h-3.5 animate-spin text-stone-300" strokeWidth={1.5} />}
        </div>

        {suggestionsOpen && suggestions.length > 0 && (
          <div className="absolute z-[1100] left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
            {suggestions.map(result => (
              <button
                key={result.place_id}
                type="button"
                onMouseDown={e => { e.preventDefault(); handleSelectSuggestion(result); }}
                className="w-full text-left px-4 py-2.5 text-xs text-stone-700 hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0"
              >
                {result.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mapa interactivo */}
      <InteractiveLocationMap
        lat={value.lat}
        lng={value.lng}
        onMarkerMove={handleMarkerMove}
        initialCenter={approximateCenter}
        className="h-56 sm:h-64 rounded-xl overflow-hidden border border-stone-200"
      />

      {/* Dirección resultante */}
      {value.address && (
        <div className="flex items-start gap-2 px-3.5 py-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-600 leading-relaxed">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: OLIVE }} strokeWidth={1.5} />
          <span className="flex-1">
            {value.address}
            {reverseLoading && <Loader2 className="inline w-3 h-3 ml-1.5 animate-spin" strokeWidth={1.5} />}
          </span>
        </div>
      )}

      {/* Referencia adicional */}
      <div>
        <label className="block text-[9px] tracking-[0.28em] uppercase text-stone-400 font-medium mb-1.5">
          Referencia adicional (opcional)
        </label>
        <div className="relative flex items-center rounded-xl border border-stone-200 bg-white">
          <input
            type="text"
            value={value.reference}
            onChange={e => onChange({ ...value, reference: e.target.value })}
            placeholder="Ej: Casa azul, portón negro, frente al parque"
            className="w-full px-4 py-3 bg-transparent text-sm text-stone-800 placeholder:text-stone-300 focus:outline-none rounded-xl"
          />
        </div>
      </div>

      {/* Confirmar ubicación */}
      {value.confirmed ? (
        <div className="flex items-center justify-between gap-2 px-3.5 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
            <Check className="w-3.5 h-3.5" strokeWidth={1.5} />
            Ubicación confirmada
          </span>
          <button
            type="button"
            onClick={() => onChange({ ...value, confirmed: false })}
            className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 transition-colors"
          >
            <Pencil className="w-3 h-3" strokeWidth={1.5} />
            Cambiar
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => onChange({ ...value, confirmed: true })}
          className="w-full py-3 text-white text-[11px] tracking-[0.18em] uppercase font-medium rounded-xl transition-opacity disabled:opacity-40"
          style={{ backgroundColor: OLIVE }}
        >
          Confirmar ubicación
        </button>
      )}
    </div>
  );
}

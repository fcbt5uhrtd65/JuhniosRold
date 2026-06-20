import type { NominatimResult } from './nominatim.types';

// Nominatim (OpenStreetMap) no requiere API key. Si en el futuro se migra a un
// proveedor con clave (Google/Mapbox), inyectarla aquí (ej. import.meta.env.VITE_GEOCODING_API_KEY)
// sin tocar a los consumidores de este servicio.
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const REQUEST_HEADERS = { 'Accept-Language': 'es', 'User-Agent': 'JuhniosRoldApp/1.0' };

export async function searchAddress(
  query: string,
  opts?: { countryCodes?: string; state?: string; country?: string },
): Promise<NominatimResult[]> {
  if (!query.trim()) return [];
  try {
    // Appending the department/state and country to the free-text query biases
    // Nominatim's results toward that region without forcing the user to type
    // the city — the actual city is read back from the chosen result instead.
    const contextualQuery = [query, opts?.state, opts?.country].filter(Boolean).join(', ');
    const params = new URLSearchParams({
      format: 'json',
      addressdetails: '1',
      limit: '5',
      q: contextualQuery,
    });
    if (opts?.countryCodes) params.set('countrycodes', opts.countryCodes);
    const res = await fetch(`${NOMINATIM_BASE_URL}/search?${params.toString()}`, {
      headers: REQUEST_HEADERS,
    });
    if (!res.ok) return [];
    return (await res.json()) as NominatimResult[];
  } catch {
    return [];
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<NominatimResult | null> {
  try {
    const params = new URLSearchParams({
      format: 'json',
      addressdetails: '1',
      lat: String(lat),
      lon: String(lng),
    });
    const res = await fetch(`${NOMINATIM_BASE_URL}/reverse?${params.toString()}`, {
      headers: REQUEST_HEADERS,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NominatimResult & { error?: string };
    if (!data || data.error) return null;
    return data;
  } catch {
    return null;
  }
}

function normalizePlaceName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(municipio|distrito|ciudad|corregimiento|de|del|la|el)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveValidCity(result: NominatimResult, validCities?: string[]): string {
  if (!validCities?.length) return '';

  const validCityByName = new Map<string, string>();
  validCities.forEach(city => {
    const normalized = normalizePlaceName(city);
    if (normalized) validCityByName.set(normalized, city);
  });

  const address = result.address;
  const addressCandidates = [
    address?.city,
    address?.town,
    address?.municipality,
    address?.county,
    address?.city_district,
    address?.district,
    address?.borough,
    address?.suburb,
    address?.village,
    address?.hamlet,
    address?.locality,
    address?.neighbourhood,
  ];
  const displayCandidates = result.display_name.split(',').map(part => part.trim());

  for (const candidate of [...addressCandidates, ...displayCandidates]) {
    if (!candidate) continue;
    const match = validCityByName.get(normalizePlaceName(candidate));
    if (match) return match;
  }

  return '';
}

export function mapNominatimAddressToFields(result: NominatimResult, opts?: { validCities?: string[] }): {
  city: string;
  state: string;
  country: string;
} {
  const address = result.address;
  const validCity = resolveValidCity(result, opts?.validCities);
  return {
    city: validCity || address?.city || address?.town || address?.municipality || address?.county || address?.city_district || address?.village || address?.suburb || '',
    state: address?.state ?? '',
    country: address?.country ?? '',
  };
}

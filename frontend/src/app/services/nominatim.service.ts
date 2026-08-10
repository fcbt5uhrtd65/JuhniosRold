import { publicApi } from './api';
import type { NominatimResult } from './nominatim.types';

/** Approximate location from the visitor's IP — only meant to pre-center a map before the
 * user interacts with it, never to set the actual delivery pin (IP geolocation is city-level
 * at best). Returns null when it can't be resolved (local/private IPs, provider errors). */
export async function getApproximateLocationByIp(): Promise<{ lat: number; lng: number; city?: string } | null> {
  try {
    const res = await publicApi.get<{ lat: number | null; lng: number | null; city?: string }>(
      '/geography/geocoding/ip-location/',
    );
    const data = res.data;
    if (!data || data.lat === null || data.lng === null) return null;
    return { lat: data.lat, lng: data.lng, city: data.city };
  } catch {
    return null;
  }
}

function normalizeForCompare(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Candidatos de campo de dirección donde Nominatim puede reportar la ciudad de un resultado
 * — igual lista que resolveValidCity más abajo, reusada aquí para comparar contra la ciudad
 * ya elegida arriba en el flujo. */
function resultCityCandidates(result: NominatimResult): string[] {
  const address = result.address;
  return [
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
  ].filter((value): value is string => Boolean(value));
}

export async function searchAddress(
  query: string,
  opts?: {
    countryCodes?: string;
    state?: string;
    country?: string;
    /** Ciudad ya elegida arriba en el flujo (LocationPicker) — cuando se pasa, la búsqueda se hace en modo estructurado (calle+ciudad como campos separados, no un solo texto libre) para que Nominatim filtre duro por esa ciudad en vez de solo usarla como sesgo de ranking. */
    city?: string;
    /** When true, drops results whose address.state/country/city don't match opts — Nominatim's own `state`/`country`/`city` params only bias ranking in "q" mode, they don't hard-filter (structured mode with `city` does filter server-side, but this stays as a second line of defense). */
    strictScope?: boolean;
  },
): Promise<NominatimResult[]> {
  if (!query.trim()) return [];
  try {
    const params = new URLSearchParams({
      limit: '5',
      q: query,
    });
    if (opts?.state) params.set('state', opts.state);
    if (opts?.country) params.set('country', opts.country);
    if (opts?.city) params.set('city', opts.city);
    if (opts?.countryCodes) params.set('countrycodes', opts.countryCodes);

    const res = await publicApi.get<NominatimResult[]>(
      `/geography/geocoding/search/?${params.toString()}`,
    );
    const results = res.data ?? [];
    if (!opts?.strictScope || (!opts.state && !opts.country && !opts.city)) return results;

    const wantState = opts.state ? normalizeForCompare(opts.state) : null;
    const wantCountry = opts.country ? normalizeForCompare(opts.country) : null;
    const wantCity = opts.city ? normalizeForCompare(opts.city) : null;
    return results.filter((result) => {
      const resultState = result.address?.state ? normalizeForCompare(result.address.state) : '';
      const resultCountry = result.address?.country ? normalizeForCompare(result.address.country) : '';
      if (wantCountry && resultCountry && resultCountry !== wantCountry) return false;
      if (wantState && resultState && resultState !== wantState) return false;
      if (wantCity) {
        const candidates = resultCityCandidates(result).map(normalizeForCompare);
        if (candidates.length > 0 && !candidates.includes(wantCity)) return false;
      }
      return true;
    });
  } catch {
    return [];
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<NominatimResult | null> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
    });
    const res = await publicApi.get<NominatimResult & { error?: string }>(
      `/geography/geocoding/reverse/?${params.toString()}`,
    );
    const data = res.data;
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

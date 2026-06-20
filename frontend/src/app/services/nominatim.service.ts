import { publicApi } from './api';
import type { NominatimResult } from './nominatim.types';

export async function searchAddress(
  query: string,
  opts?: { countryCodes?: string; state?: string; country?: string },
): Promise<NominatimResult[]> {
  if (!query.trim()) return [];
  try {
    const params = new URLSearchParams({
      limit: '5',
      q: query,
    });
    if (opts?.state) params.set('state', opts.state);
    if (opts?.country) params.set('country', opts.country);
    if (opts?.countryCodes) params.set('countrycodes', opts.countryCodes);

    const res = await publicApi.get<NominatimResult[]>(
      `/geography/geocoding/search/?${params.toString()}`,
    );
    return res.data ?? [];
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

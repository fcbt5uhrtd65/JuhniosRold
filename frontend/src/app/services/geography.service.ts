import { publicApi } from './api';
import { EMPTY_LOCATION, type LocationValue } from './geography.types';
import type { NominatimResult } from './nominatim.types';

export interface Country {
  id: number;
  name: string;
  iso_code: string;
  phone_code: string;
}

export interface State {
  id: number;
  name: string;
  code: string;
  country: number;
}

export interface City {
  id: number;
  name: string;
  state: number;
  country: number;
}

interface PaginatedResponse<T> {
  count: number;
  results: T[];
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const geographyService = {
  async getCountries(search?: string): Promise<Country[]> {
    const qs = buildQuery({ search: search ?? '', page_size: 50 });
    const res = await publicApi.get<PaginatedResponse<Country>>(`/geography/countries/${qs}`);
    return res.data?.results ?? [];
  },

  async getStates(countryId: number, search?: string): Promise<State[]> {
    const qs = buildQuery({ country: countryId, search: search ?? '', page_size: 100 });
    const res = await publicApi.get<PaginatedResponse<State>>(`/geography/states/${qs}`);
    return res.data?.results ?? [];
  },

  async getCities(stateId: number, search?: string): Promise<City[]> {
    const qs = buildQuery({ state: stateId, search: search ?? '', page_size: 300 });
    const res = await publicApi.get<PaginatedResponse<City>>(`/geography/cities/${qs}`);
    return res.data?.results ?? [];
  },

  /**
   * Resuelve nombres sueltos de país/departamento/ciudad (tal como se guardan en el
   * perfil del cliente) a un LocationValue completo con sus IDs, para poder
   * precargar el LocationPicker con la ubicación ya registrada.
   */
  async resolveLocationByNames(names: {
    country?: string;
    state?: string;
    city?: string;
  }): Promise<LocationValue> {
    const result: LocationValue = { ...EMPTY_LOCATION };
    if (!names.country) return result;

    const countries = await geographyService.getCountries(names.country);
    const country = countries.find(
      (c) => c.name.toLowerCase() === names.country!.toLowerCase(),
    ) ?? countries[0];
    if (!country) return result;
    result.countryId = country.id;
    result.countryName = country.name;

    if (!names.state) return result;
    const states = await geographyService.getStates(country.id, names.state);
    const state = states.find(
      (s) => s.name.toLowerCase() === names.state!.toLowerCase(),
    ) ?? states[0];
    if (!state) return result;
    result.stateId = state.id;
    result.stateName = state.name;

    if (!names.city) return result;
    const cities = await geographyService.getCities(state.id, names.city);
    const city = cities.find(
      (c) => c.name.toLowerCase() === names.city!.toLowerCase(),
    ) ?? cities[0];
    if (!city) return result;
    result.cityId = city.id;
    result.cityName = city.name;

    return result;
  },

  /**
   * Resuelve un resultado de geocodificación (Nominatim/LocationIQ) a un país/departamento/
   * ciudad válidos de nuestro catálogo. A diferencia de resolveLocationByNames, no cae en el
   * primer resultado cuando la ciudad no matchea exacto: prueba los distintos niveles que
   * Nominatim ofrece (city/town/municipality/county/village/hamlet/suburb — este último cubre
   * corregimientos y veredas) contra el catálogo de ciudades del departamento ya resuelto, para
   * que un corregimiento como "La Playa" se normalice al municipio real (p.ej. Barranquilla) en
   * vez de guardarse tal cual o quedar vacío.
   */
  async resolveLocationFromGeocode(result: NominatimResult): Promise<LocationValue> {
    const address = result.address;
    const resolved: LocationValue = { ...EMPTY_LOCATION };
    if (!address?.country) return resolved;

    const countries = await geographyService.getCountries(address.country);
    const country = countries.find((c) => c.name.toLowerCase() === address.country!.toLowerCase()) ?? countries[0];
    if (!country) return resolved;
    resolved.countryId = country.id;
    resolved.countryName = country.name;

    if (!address.state) return resolved;
    const states = await geographyService.getStates(country.id, address.state);
    const state = states.find((s) => s.name.toLowerCase() === address.state!.toLowerCase()) ?? states[0];
    if (!state) return resolved;
    resolved.stateId = state.id;
    resolved.stateName = state.name;

    const cities = await geographyService.getCities(state.id);
    if (!cities.length) return resolved;

    const cityCandidates = [
      address.city,
      address.town,
      address.municipality,
      address.county,
      address.city_district,
      address.district,
      address.borough,
      address.village,
      address.hamlet,
      address.suburb,
      address.locality,
    ].filter((c): c is string => Boolean(c));

    for (const candidate of cityCandidates) {
      const match = cities.find((c) => c.name.toLowerCase() === candidate.toLowerCase());
      if (match) {
        resolved.cityId = match.id;
        resolved.cityName = match.name;
        return resolved;
      }
    }

    return resolved;
  },
};

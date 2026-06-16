import { publicApi } from './api';

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
    const qs = buildQuery({ state: stateId, search: search ?? '', page_size: 50 });
    const res = await publicApi.get<PaginatedResponse<City>>(`/geography/cities/${qs}`);
    return res.data?.results ?? [];
  },
};

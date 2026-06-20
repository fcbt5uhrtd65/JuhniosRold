export interface NominatimAddress {
  road?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  city_district?: string;
  municipality?: string;
  county?: string;
  district?: string;
  borough?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  locality?: string;
  state?: string;
  country?: string;
  country_code?: string;
  postcode?: string;
}

export interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

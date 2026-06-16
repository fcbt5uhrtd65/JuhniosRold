export interface LocationValue {
  countryId: number | null;
  countryName: string;
  stateId: number | null;
  stateName: string;
  cityId: number | null;
  cityName: string;
}

export const EMPTY_LOCATION: LocationValue = {
  countryId: null,
  countryName: '',
  stateId: null,
  stateName: '',
  cityId: null,
  cityName: '',
};

export interface DeliveryLocationValue {
  address: string;
  reference: string;
  city: string;
  state: string;
  country: string;
  lat: number | null;
  lng: number | null;
  confirmed: boolean;
}

export const EMPTY_DELIVERY_LOCATION: DeliveryLocationValue = {
  address: '',
  reference: '',
  city: '',
  state: '',
  country: '',
  lat: null,
  lng: null,
  confirmed: false,
};

// ============================================================
// Shipping Service — Juhnios Rold Frontend
// Calculadora de costos de envío: cotización pública + configuración admin.
// ============================================================

import { api, publicApi } from './api';

export type ShippingQuoteStatus = 'calculado' | 'gratis' | 'pendiente_manual' | 'sin_cobertura';
export type ShippingQuoteMethod = 'ZONE' | 'DISTANCE' | 'FREE' | 'MANUAL';
export type ShippingZoneType = 'LOCAL' | 'REGIONAL' | 'NATIONAL';

export interface ShippingQuoteRequest {
  city?: string;
  department?: string;
  latitude?: number | null;
  longitude?: number | null;
  subtotal?: number;
}

export interface ShippingQuoteResponse {
  status: ShippingQuoteStatus;
  method: ShippingQuoteMethod;
  shipping_cost: string;
  distance_km: string | null;
  message: string;
}

export interface ShippingSettings {
  id: string;
  local_rate: string;
  regional_rate: string;
  national_rate: string;
  enable_distance_calc: boolean;
  base_rate: string;
  rate_per_km: string;
  min_charge: string;
  max_charge: string;
  enable_free_shipping: boolean;
  free_shipping_threshold: string;
  enable_manual_quote_fallback: boolean;
  origin_address: string;
  origin_city: string;
  origin_department: string;
  origin_latitude: string | null;
  origin_longitude: string | null;
  updated_at: string;
}

export interface ShippingZone {
  id: string;
  name: string;
  zone_type: ShippingZoneType;
  department: string;
  city: string;
  surcharge: string;
  requires_manual_quote: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export async function getShippingQuote(
  payload: ShippingQuoteRequest,
  signal?: AbortSignal,
): Promise<ShippingQuoteResponse> {
  const res = await publicApi.post<ShippingQuoteResponse>('/shipping-quote/', payload, signal);
  if (!res.data) throw new Error(res.message);
  return res.data;
}

export async function getShippingSettings(): Promise<ShippingSettings> {
  const res = await publicApi.get<ShippingSettings>('/shipping-settings/');
  if (!res.data) throw new Error(res.message);
  return res.data;
}

export async function updateShippingSettings(payload: Partial<ShippingSettings>): Promise<ShippingSettings> {
  const res = await api.patch<ShippingSettings>('/shipping-settings/', payload);
  if (!res.data) throw new Error(res.message);
  return res.data;
}

export async function getShippingZones(): Promise<ShippingZone[]> {
  const res = await api.get<ShippingZone[] | PaginatedResponse<ShippingZone>>('/shipping-zones/');
  if (!res.data) throw new Error(res.message);
  return Array.isArray(res.data) ? res.data : res.data.results;
}

export async function createShippingZone(payload: Partial<ShippingZone>): Promise<ShippingZone> {
  const res = await api.post<ShippingZone>('/shipping-zones/', payload);
  if (!res.data) throw new Error(res.message);
  return res.data;
}

export async function updateShippingZone(id: string, payload: Partial<ShippingZone>): Promise<ShippingZone> {
  const res = await api.patch<ShippingZone>(`/shipping-zones/${id}/`, payload);
  if (!res.data) throw new Error(res.message);
  return res.data;
}

export async function deleteShippingZone(id: string): Promise<void> {
  await api.delete(`/shipping-zones/${id}/`);
}

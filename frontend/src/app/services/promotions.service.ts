// ============================================================
// Promotions Service — Juhnios Rold Frontend
// CRUD de promociones (descuento % o monto fijo por producto/variante/categoría).
// ============================================================

import { api, publicApi } from './api';

const PROMOTIONS_PATH = '/promotions/';

type UUID = string;

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type PromotionScope = 'PRODUCT' | 'VARIANT' | 'CATEGORY';

interface BackendPromotion {
  id: UUID;
  name: string;
  description: string;
  discount_type: DiscountType;
  discount_value: string;
  scope: PromotionScope;
  product: UUID | null;
  variant: UUID | null;
  category: UUID | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface Promotion {
  id: UUID;
  name: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  scope: PromotionScope;
  product: UUID | null;
  variant: UUID | null;
  category: UUID | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface PromotionSummary {
  id: UUID;
  name: string;
  discount_type: DiscountType;
  discount_value: number;
  ends_at: string | null;
}

export interface CreatePromotionPayload {
  name: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  scope: PromotionScope;
  product?: string;
  variant?: string;
  category?: string;
  starts_at: string;
  ends_at?: string | null;
  is_active?: boolean;
  priority?: number;
}

export type UpdatePromotionPayload = Partial<CreatePromotionPayload>;

function normalizePromotion(promotion: BackendPromotion): Promotion {
  return {
    ...promotion,
    discount_value: Number(promotion.discount_value) || 0,
  };
}

function buildQuery(params?: { product?: string; variant?: string; category?: string; is_active?: boolean }): string {
  if (!params) return '';
  const query = new URLSearchParams();
  if (params.product) query.set('product', params.product);
  if (params.variant) query.set('variant', params.variant);
  if (params.category) query.set('category', params.category);
  if (params.is_active !== undefined) query.set('is_active', String(params.is_active));
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export async function getPromotions(params?: {
  product?: string;
  variant?: string;
  category?: string;
  is_active?: boolean;
}): Promise<Promotion[]> {
  const res = await publicApi.get<PaginatedResponse<BackendPromotion> | BackendPromotion[]>(
    `${PROMOTIONS_PATH}${buildQuery(params)}`,
  );
  const results = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
  return results.map(normalizePromotion);
}

export async function getPromotionsForProduct(productId: string): Promise<Promotion[]> {
  return getPromotions({ product: productId });
}

export async function createPromotion(payload: CreatePromotionPayload): Promise<Promotion> {
  const res = await api.post<BackendPromotion>(PROMOTIONS_PATH, {
    ...payload,
    discount_value: String(payload.discount_value),
  });
  if (!res.data) {
    throw new Error('No se pudo crear la promoción.');
  }
  return normalizePromotion(res.data);
}

export async function updatePromotion(id: string, payload: UpdatePromotionPayload): Promise<Promotion> {
  const res = await api.patch<BackendPromotion>(`${PROMOTIONS_PATH}${id}/`, {
    ...payload,
    ...(payload.discount_value !== undefined ? { discount_value: String(payload.discount_value) } : {}),
  });
  if (!res.data) {
    throw new Error('No se pudo actualizar la promoción.');
  }
  return normalizePromotion(res.data);
}

export async function deletePromotion(id: string): Promise<void> {
  await api.delete(`${PROMOTIONS_PATH}${id}/`);
}

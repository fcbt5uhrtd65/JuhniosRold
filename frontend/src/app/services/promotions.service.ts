// ============================================================
// Promotions Service — Juhnios Rold Frontend
// CRUD de promociones (descuento % o monto fijo por producto/variante/categoría).
// ============================================================

import { api } from './api';

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

interface BackendSellerDiscountCode {
  id: UUID;
  code: string;
  seller: UUID;
  seller_name: string;
  name: string;
  discount_type: DiscountType;
  discount_value: string | number;
  min_order_amount: string | number;
  starts_at: string;
  ends_at: string;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SellerDiscountCode {
  id: UUID;
  code: string;
  seller: UUID;
  seller_name: string;
  name: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_amount: number;
  starts_at: string;
  ends_at: string;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSellerDiscountCodePayload {
  seller: string;
  code?: string;
  name?: string;
  discount_type: DiscountType;
  discount_value: number;
  min_order_amount?: number;
  starts_at?: string;
  ends_at?: string;
  duration_hours?: number;
  max_uses?: number | null;
  is_active?: boolean;
}

export type UpdateSellerDiscountCodePayload = Partial<CreateSellerDiscountCodePayload>;

export interface SellerDiscountValidation {
  id: string;
  code: string;
  seller: string;
  seller_name: string;
  discount_type: DiscountType;
  discount_value: number;
  discount_amount: number;
  min_order_amount: number;
  starts_at: string;
  ends_at: string;
  uses_count: number;
  max_uses: number | null;
  is_active: boolean;
}

function normalizePromotion(promotion: BackendPromotion): Promotion {
  return {
    ...promotion,
    discount_value: Number(promotion.discount_value) || 0,
  };
}

function normalizeSellerCode(code: BackendSellerDiscountCode): SellerDiscountCode {
  return {
    ...code,
    discount_value: Number(code.discount_value) || 0,
    min_order_amount: Number(code.min_order_amount) || 0,
  };
}

function buildQuery(params?: Record<string, string | number | boolean | null | undefined>): string {
  if (!params) return '';
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

export async function getPromotions(params?: {
  product?: string;
  variant?: string;
  category?: string;
  is_active?: boolean;
}): Promise<Promotion[]> {
  const res = await api.get<PaginatedResponse<BackendPromotion> | BackendPromotion[]>(
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

const SELLER_CODES_PATH = '/promotions/seller-codes/';

export async function getSellerDiscountCodes(params?: {
  seller?: string;
  is_active?: boolean;
}): Promise<SellerDiscountCode[]> {
  const query = buildQuery(params);
  const res = await api.get<PaginatedResponse<BackendSellerDiscountCode> | BackendSellerDiscountCode[]>(
    `${SELLER_CODES_PATH}${query}`,
  );
  const results = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
  return results.map(normalizeSellerCode);
}

export async function createSellerDiscountCode(payload: CreateSellerDiscountCodePayload): Promise<SellerDiscountCode> {
  const res = await api.post<BackendSellerDiscountCode>(SELLER_CODES_PATH, {
    ...payload,
    discount_value: String(payload.discount_value),
    min_order_amount: String(payload.min_order_amount ?? 0),
  });
  if (!res.data) throw new Error('No se pudo crear el codigo.');
  return normalizeSellerCode(res.data);
}

export async function updateSellerDiscountCode(
  id: string,
  payload: UpdateSellerDiscountCodePayload,
): Promise<SellerDiscountCode> {
  const res = await api.patch<BackendSellerDiscountCode>(`${SELLER_CODES_PATH}${id}/`, {
    ...payload,
    ...(payload.discount_value !== undefined ? { discount_value: String(payload.discount_value) } : {}),
    ...(payload.min_order_amount !== undefined ? { min_order_amount: String(payload.min_order_amount) } : {}),
  });
  if (!res.data) throw new Error('No se pudo actualizar el codigo.');
  return normalizeSellerCode(res.data);
}

export async function validateSellerDiscountCode(code: string, subtotal: number): Promise<SellerDiscountValidation> {
  const res = await api.post<Record<string, unknown>>(`${SELLER_CODES_PATH}validate/`, {
    code,
    subtotal,
  });
  if (!res.data) throw new Error('No se pudo validar el codigo.');
  return {
    id: String(res.data.id),
    code: String(res.data.code),
    seller: String(res.data.seller),
    seller_name: String(res.data.seller_name),
    discount_type: res.data.discount_type as DiscountType,
    discount_value: Number(res.data.discount_value) || 0,
    discount_amount: Number(res.data.discount_amount) || 0,
    min_order_amount: Number(res.data.min_order_amount) || 0,
    starts_at: String(res.data.starts_at),
    ends_at: String(res.data.ends_at),
    uses_count: Number(res.data.uses_count) || 0,
    max_uses: res.data.max_uses === null ? null : Number(res.data.max_uses),
    is_active: Boolean(res.data.is_active),
  };
}

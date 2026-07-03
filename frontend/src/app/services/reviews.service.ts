// ============================================================
// Reviews Service — Juhnios Rold Frontend
// Normalizes the DRF catalog reviews API into frontend-friendly models.
// ============================================================

import { api, publicApi } from './api';

const REVIEWS_PATH = '/catalog/reviews/';

type UUID = string;

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface BackendReview {
  id: UUID;
  product: UUID;
  user: UUID;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
}

export interface ProductReview {
  id: UUID;
  product: UUID;
  user: UUID;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewPayload {
  rating: number;
  comment: string;
}

function normalizeReview(review: BackendReview): ProductReview {
  return {
    id: review.id,
    product: review.product,
    user: review.user,
    userName: review.user_name,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.created_at,
    updatedAt: review.updated_at,
  };
}

export async function getProductReviews(productId: string): Promise<ProductReview[]> {
  const res = await publicApi.get<PaginatedResponse<BackendReview>>(
    `${REVIEWS_PATH}?product=${productId}&ordering=-created_at`,
  );
  return (res.data?.results ?? []).map(normalizeReview);
}

export async function createProductReview(
  productId: string,
  payload: ReviewPayload,
): Promise<ProductReview> {
  const res = await api.post<BackendReview>(REVIEWS_PATH, {
    product: productId,
    rating: payload.rating,
    comment: payload.comment,
  });
  if (!res.data) {
    throw new Error('No se pudo publicar la reseña.');
  }
  return normalizeReview(res.data);
}

export async function updateProductReview(
  reviewId: string,
  payload: ReviewPayload,
): Promise<ProductReview> {
  const res = await api.patch<BackendReview>(`${REVIEWS_PATH}${reviewId}/`, {
    rating: payload.rating,
    comment: payload.comment,
  });
  if (!res.data) {
    throw new Error('No se pudo actualizar la reseña.');
  }
  return normalizeReview(res.data);
}

export async function deleteProductReview(reviewId: string): Promise<void> {
  await api.delete(`${REVIEWS_PATH}${reviewId}/`);
}

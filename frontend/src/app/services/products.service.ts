// ============================================================
// Products Service — Juhnios Rold Frontend
// ============================================================

import { api } from './api';

export type ProductCategory =
  | 'aceites'
  | 'siliconas'
  | 'tratamientos'
  | 'corporal'
  | 'baby'
  | 'personal';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description?: string;
  category: ProductCategory;
  price: number;
  pro_price: number;
  stock: number;
  sku?: string;
  images: string[];
  ingredients: string[];
  benefits: string[];
  how_to_use?: string;
  weight_ml?: number;
  is_active: boolean;
  is_featured: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ProductsQueryParams {
  page?: number;
  limit?: number;
  category?: ProductCategory;
  search?: string;
  featured?: boolean;
  active?: boolean;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'name';
}

export interface PaginatedProducts {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateProductPayload {
  name: string;
  slug: string;
  description: string;
  short_description?: string;
  category: ProductCategory;
  price: number;
  pro_price: number;
  stock: number;
  sku?: string;
  images?: string[];
  ingredients?: string[];
  benefits?: string[];
  how_to_use?: string;
  weight_ml?: number;
  is_active?: boolean;
  is_featured?: boolean;
  tags?: string[];
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

// ---- List products ----
export async function getProducts(params?: ProductsQueryParams): Promise<PaginatedProducts> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.category) query.set('category', params.category);
  if (params?.search) query.set('search', params.search);
  if (params?.featured !== undefined) query.set('featured', String(params.featured));
  if (params?.sort) query.set('sort', params.sort);

  const endpoint = `/products${query.toString() ? `?${query}` : ''}`;
  const res = await api.get<PaginatedProducts>(endpoint);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Featured products ----
export async function getFeaturedProducts(): Promise<Product[]> {
  const res = await api.get<Product[]>('/products/featured');
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Get by ID ----
export async function getProductById(id: string): Promise<Product> {
  const res = await api.get<Product>(`/products/${id}`);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Get by slug ----
export async function getProductBySlug(slug: string): Promise<Product> {
  const res = await api.get<Product>(`/products/slug/${slug}`);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Low stock (admin) ----
export async function getLowStockProducts(): Promise<Product[]> {
  const res = await api.get<Product[]>('/products/low-stock');
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Create (admin) ----
export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const res = await api.post<Product>('/products', payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Update (admin) ----
export async function updateProduct(id: string, payload: UpdateProductPayload): Promise<Product> {
  const res = await api.patch<Product>(`/products/${id}`, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Update stock (admin/staff) ----
export async function updateProductStock(id: string, stock: number, reason?: string): Promise<Product> {
  const res = await api.patch<Product>(`/products/${id}/stock`, { stock, reason });
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Delete (admin) ----
export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/products/${id}`);
}

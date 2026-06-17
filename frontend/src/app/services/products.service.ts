// ============================================================
// Products Service — Juhnios Rold Frontend
// Normalizes the DRF catalog API into frontend-friendly models.
// ============================================================

import { api, publicApi } from './api';

const CATALOG_BASE_PATH = '/catalog';
const PRODUCTS_PATH = `${CATALOG_BASE_PATH}/products/`;
const CATEGORIES_PATH = `${CATALOG_BASE_PATH}/categories/`;
const VARIANTS_PATH = `${CATALOG_BASE_PATH}/variants/`;
const PRICES_PATH = `${CATALOG_BASE_PATH}/prices/`;

type UUID = string;

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface BackendCategory {
  id: UUID;
  name: string;
  slug: string;
  image_url: string;
  parent: UUID | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface BackendPrice {
  id: UUID;
  variant: UUID;
  amount: string;
  currency: string;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface BackendVariant {
  id: UUID;
  product: UUID;
  sku: string;
  name: string;
  attributes: Record<string, unknown>;
  cost: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  prices: BackendPrice[];
}

interface BackendImage {
  id: UUID;
  product: UUID;
  image: string;
  alt_text: string;
  position: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface BackendProduct {
  id: UUID;
  category: UUID;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  variants: BackendVariant[];
  images: BackendImage[];
}

export interface ProductCategory {
  id: UUID;
  name: string;
  slug: string;
  image_url: string;
  parent: UUID | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductPrice {
  id: UUID;
  variant: UUID;
  amount: number;
  currency: string;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: UUID;
  product: UUID;
  sku: string;
  name: string;
  attributes: Record<string, unknown>;
  cost: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  prices: ProductPrice[];
  current_price: number | null;
  presentation: string;
}

export interface ProductImage {
  id: UUID;
  product: UUID;
  image: string;
  alt_text: string;
  position: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: UUID;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  category: string;
  category_id: UUID;
  category_name: string;
  category_slug: string;
  price: number | null;
  currency: string | null;
  primary_image: string | null;
  image_urls: string[];
  images: ProductImage[];
  variants: ProductVariant[];
  sizes: string[];
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductsQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  slug?: string;
  search?: string;
  featured?: boolean;
  active?: boolean;
  ordering?: 'name' | '-name' | 'created_at' | '-created_at';
}

export interface PaginatedProducts {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  next: string | null;
  previous: string | null;
}

export interface CreateProductPayload {
  category: string;
  name: string;
  slug: string;
  description?: string;
  is_active?: boolean;
  is_featured?: boolean;
  short_description?: string;
  price?: number;
  pro_price?: number;
  stock?: number;
  sku?: string;
  images?: string[];
  image_url?: string;
  variant_name?: string;
  variant_attributes?: Record<string, unknown>;
  cost?: number;
  ingredients?: string[];
  benefits?: string[];
  how_to_use?: string;
  weight_ml?: number;
  tags?: string[];
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

let categoriesCache: ProductCategory[] | null = null;

function parseAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeImageUrl(url: string): string {
  return url;
}

function normalizePrice(price: BackendPrice): ProductPrice {
  return {
    ...price,
    amount: parseAmount(price.amount) ?? 0,
  };
}

function getCurrentPrice(prices: BackendPrice[]): ProductPrice | null {
  const activePrice = prices.find((price) => price.is_active) ?? prices[0];
  return activePrice ? normalizePrice(activePrice) : null;
}

function buildPresentation(variant: BackendVariant): string {
  if (variant.name.trim()) {
    return variant.name.trim();
  }

  const attributes = Object.values(variant.attributes ?? {})
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (attributes.length > 0) {
    return attributes.join(' / ');
  }

  return variant.sku;
}

function normalizeVariant(variant: BackendVariant): ProductVariant {
  const currentPrice = getCurrentPrice(variant.prices);

  return {
    ...variant,
    cost: parseAmount(variant.cost) ?? 0,
    prices: variant.prices.map(normalizePrice),
    current_price: currentPrice?.amount ?? null,
    presentation: buildPresentation(variant),
  };
}

function normalizeImage(image: BackendImage): ProductImage {
  return {
    ...image,
    image: normalizeImageUrl(image.image),
  };
}

function pickPrimaryImage(images: ProductImage[]): string | null {
  if (images.length === 0) {
    return null;
  }

  const ordered = [...images].sort((left, right) => {
    if (left.is_primary !== right.is_primary) {
      return left.is_primary ? -1 : 1;
    }

    return left.position - right.position;
  });

  return ordered[0]?.image ?? null;
}

function pickProductPrice(variants: ProductVariant[]): { price: number | null; currency: string | null } {
  const prices = variants
    .map((variant) => variant.prices.find((price) => price.is_active) ?? variant.prices[0] ?? null)
    .filter((price): price is ProductPrice => price !== null)
    .sort((left, right) => left.amount - right.amount);

  if (prices.length === 0) {
    return { price: null, currency: null };
  }

  return {
    price: prices[0].amount,
    currency: prices[0].currency,
  };
}

function normalizeCategory(category: BackendCategory): ProductCategory {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    image_url: category.image_url,
    parent: category.parent,
    is_active: category.is_active,
    created_at: category.created_at,
    updated_at: category.updated_at,
  };
}

function normalizeProduct(
  product: BackendProduct,
  categoryMap: Map<string, ProductCategory>,
): Product {
  const category = categoryMap.get(product.category);
  const variants = product.variants.map(normalizeVariant);
  const images = product.images.map(normalizeImage);
  const { price, currency } = pickProductPrice(variants);

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    image_url: product.image_url,
    category: category?.slug ?? product.category,
    category_id: product.category,
    category_name: category?.name ?? 'Sin categoría',
    category_slug: category?.slug ?? '',
    price,
    currency,
    primary_image:
      (pickPrimaryImage(images) ?? product.image_url) ||
      category?.image_url ||
      null,
    image_urls: images.map((image) => image.image),
    images,
    variants,
    sizes: uniqueValues(variants.map((variant) => variant.presentation)),
    is_active: product.is_active,
    is_featured: product.is_featured,
    created_at: product.created_at,
    updated_at: product.updated_at,
  };
}

function buildProductsQuery(params?: ProductsQueryParams): string {
  const query = new URLSearchParams();

  if (params?.page) {
    query.set('page', String(params.page));
  }

  if (params?.limit) {
    query.set('page_size', String(params.limit));
  }

  if (params?.category) {
    query.set('category', params.category);
  }

  if (params?.slug) {
    query.set('slug', params.slug);
  }

  if (params?.search) {
    query.set('search', params.search);
  }

  if (params?.featured !== undefined) {
    query.set('is_featured', String(params.featured));
  }

  if (params?.active !== undefined) {
    query.set('is_active', String(params.active));
  }

  if (params?.ordering) {
    query.set('ordering', params.ordering);
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

function buildCategoriesQuery(limit = 100): string {
  const query = new URLSearchParams();
  query.set('page_size', String(limit));
  return `?${query.toString()}`;
}

async function getCategoryMap(forceRefresh = false): Promise<Map<string, ProductCategory>> {
  if (!forceRefresh && categoriesCache) {
    return new Map(categoriesCache.map((category) => [category.id, category]));
  }

  const categories = await getCategories(forceRefresh);
  return new Map(categories.map((category) => [category.id, category]));
}

async function resolveCategoryId(value: string): Promise<string> {
  const categories = await getCategories();
  const category = categories.find((item) => item.id === value || item.slug === value);
  if (!category) {
    throw new Error('La categoria seleccionada no existe.');
  }
  return category.id;
}

export async function getCategories(forceRefresh = false): Promise<ProductCategory[]> {
  if (!forceRefresh && categoriesCache) {
    return categoriesCache;
  }

  const res = await publicApi.get<PaginatedResponse<BackendCategory>>(
    `${CATEGORIES_PATH}${buildCategoriesQuery()}`,
  );

  const categories = (res.data?.results ?? []).map(normalizeCategory);
  categoriesCache = categories;
  return categories;
}

export async function getProducts(params?: ProductsQueryParams): Promise<PaginatedProducts> {
  const [res, categoryMap] = await Promise.all([
    publicApi.get<PaginatedResponse<BackendProduct>>(`${PRODUCTS_PATH}${buildProductsQuery(params)}`),
    getCategoryMap(),
  ]);

  const payload = res.data;
  const results = payload?.results ?? [];
  const page = params?.page ?? 1;
  const limit = params?.limit ?? (results.length || 20);

  return {
    data: results.map((product) => normalizeProduct(product, categoryMap)),
    total: payload?.count ?? results.length,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil((payload?.count ?? results.length) / Math.max(limit, 1))),
    next: payload?.next ?? null,
    previous: payload?.previous ?? null,
  };
}

export async function getAllProducts(): Promise<Product[]> {
  const firstPage = await getProducts({ page: 1, limit: 100 });
  if (firstPage.totalPages <= 1) {
    return firstPage.data;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      getProducts({ page: index + 2, limit: 100 }),
    ),
  );

  return [
    ...firstPage.data,
    ...remainingPages.flatMap(page => page.data),
  ];
}

export async function getFeaturedProducts(limit = 100): Promise<Product[]> {
  const res = await getProducts({
    limit,
    featured: true,
    active: true,
  });

  return res.data;
}

export async function getProductById(id: string): Promise<Product> {
  const [res, categoryMap] = await Promise.all([
    publicApi.get<BackendProduct>(`${PRODUCTS_PATH}${id}/`),
    getCategoryMap(),
  ]);

  if (!res.data) {
    throw new Error('No se pudo cargar el producto solicitado.');
  }

  return normalizeProduct(res.data, categoryMap);
}

export async function getProductBySlug(slug: string): Promise<Product> {
  const res = await getProducts({
    limit: 1,
    active: true,
    slug,
  });

  const product = res.data[0];
  if (!product) {
    throw new Error('No se encontró el producto solicitado.');
  }

  return product;
}

export async function getLowStockProducts(): Promise<Product[]> {
  return [];
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const categoryId = await resolveCategoryId(payload.category);
  const res = await api.post<BackendProduct>(PRODUCTS_PATH, {
    category: categoryId,
    name: payload.name,
    slug: payload.slug,
    description: payload.description ?? '',
    image_url: payload.image_url ?? payload.images?.[0] ?? '',
    is_active: payload.is_active ?? true,
    is_featured: payload.is_featured ?? false,
  });

  const categoryMap = await getCategoryMap(true);
  if (!res.data) {
    throw new Error('No se pudo crear el producto.');
  }

  if (
    payload.price !== undefined ||
    payload.variant_name !== undefined ||
    payload.sku !== undefined
  ) {
    const variantResponse = await api.post<BackendVariant>(VARIANTS_PATH, {
      product: res.data.id,
      sku: payload.sku || `JR-${Date.now()}`,
      name: payload.variant_name ||
        (payload.weight_ml ? `${payload.weight_ml} ml` : 'Presentación única'),
      attributes: payload.variant_attributes ??
        (payload.weight_ml ? { weight_ml: payload.weight_ml } : {}),
      cost: String(payload.cost ?? 0),
      is_active: payload.is_active ?? true,
    });
    if (!variantResponse.data) {
      throw new Error('El producto se creo, pero no fue posible crear su variante.');
    }

    if (payload.price !== undefined) {
      await api.post<BackendPrice>(PRICES_PATH, {
        variant: variantResponse.data.id,
        amount: String(payload.price),
        currency: 'COP',
        valid_from: new Date().toISOString(),
        valid_until: null,
        is_active: true,
      });
    }
    return getProductById(res.data.id);
  }

  return normalizeProduct(res.data, categoryMap);
}

export async function updateProduct(id: string, payload: UpdateProductPayload): Promise<Product> {
  const categoryId = payload.category
    ? await resolveCategoryId(payload.category)
    : undefined;
  const res = await api.patch<BackendProduct>(`${PRODUCTS_PATH}${id}/`, {
    ...(categoryId ? { category: categoryId } : {}),
    ...(payload.name !== undefined ? { name: payload.name } : {}),
    ...(payload.slug !== undefined ? { slug: payload.slug } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.image_url !== undefined || payload.images !== undefined
      ? { image_url: payload.image_url ?? payload.images?.[0] ?? '' }
      : {}),
    ...(payload.is_active !== undefined ? { is_active: payload.is_active } : {}),
    ...(payload.is_featured !== undefined ? { is_featured: payload.is_featured } : {}),
  });

  const categoryMap = await getCategoryMap(true);
  if (!res.data) {
    throw new Error('No se pudo actualizar el producto.');
  }

  const variant = res.data.variants.find((item) => item.is_active) ?? res.data.variants[0];
  if (variant && (payload.variant_name !== undefined || payload.variant_attributes !== undefined)) {
    await api.patch<BackendVariant>(`${VARIANTS_PATH}${variant.id}/`, {
      ...(payload.variant_name !== undefined ? { name: payload.variant_name } : {}),
      ...(payload.variant_attributes !== undefined
        ? { attributes: { ...variant.attributes, ...payload.variant_attributes } }
        : {}),
    });
  }

  if (payload.price !== undefined) {
    const price = variant?.prices.find((item) => item.is_active) ?? variant?.prices[0];
    if (price) {
      await api.patch<BackendPrice>(`${PRICES_PATH}${price.id}/`, {
        amount: String(payload.price),
      });
      return getProductById(id);
    }
  }

  return normalizeProduct(res.data, categoryMap);
}

export async function updateProductStock(_id: string, _stock: number, _reason?: string): Promise<Product> {
  throw new Error('El stock se administra desde el módulo de inventario.');
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`${PRODUCTS_PATH}${id}/`);
}

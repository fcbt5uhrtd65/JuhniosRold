// ============================================================
// Products Service — Juhnios Rold Frontend
// Normalizes the DRF catalog API into frontend-friendly models.
// ============================================================

import { api, publicApi } from './api';
import type { PromotionSummary } from './promotions.service';

const CATALOG_BASE_PATH = '/catalog';
const PRODUCTS_PATH = `${CATALOG_BASE_PATH}/products/`;
const CATEGORIES_PATH = `${CATALOG_BASE_PATH}/categories/`;
const VARIANTS_PATH = `${CATALOG_BASE_PATH}/variants/`;
const PRICES_PATH = `${CATALOG_BASE_PATH}/prices/`;
const IMAGES_PATH = `${CATALOG_BASE_PATH}/images/`;
const VARIANT_IMAGES_PATH = `${CATALOG_BASE_PATH}/variant-images/`;
const EXPORTS_PATH = `${CATALOG_BASE_PATH}/exports/`;
const MAX_PRODUCT_IMAGES = 3;
const MAX_VARIANT_IMAGES = 3;

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
  presentation_number?: string | number | null;
  presentation_unit?: 'ML' | 'LT' | 'GR' | 'KG' | 'UND' | '';
  presentation_label?: string;
  image_url?: string;
  attributes: Record<string, unknown>;
  cost: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  prices: BackendPrice[];
  images: BackendVariantImage[];
  active_promotion?: PromotionSummary | null;
  discounted_price?: string | number | null;
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

interface BackendVariantImage {
  id: UUID;
  variant: UUID;
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
  rating_average: number | null;
  rating_count: number;
  active_promotion?: PromotionSummary | null;
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

export interface ProductVariantImage {
  id: UUID;
  variant: UUID;
  image: string;
  alt_text: string;
  position: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: UUID;
  product: UUID;
  sku: string;
  name: string;
  presentation_number?: number | null;
  presentation_unit?: 'ML' | 'LT' | 'GR' | 'KG' | 'UND' | '';
  image_url: string;
  images: ProductVariantImage[];
  attributes: Record<string, unknown>;
  cost: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  prices: ProductPrice[];
  current_price: number | null;
  presentation: string;
  available_quantity: number | null;
  minimum_quantity: number | null;
  active_promotion: PromotionSummary | null;
  discounted_price: number | null;
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
  rating_average: number | null;
  rating_count: number;
  active_promotion: PromotionSummary | null;
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
  presentation_number?: number;
  presentation_unit?: 'ML' | 'LT' | 'GR' | 'KG' | 'UND';
  cost?: number;
  ingredients?: string[];
  benefits?: string[];
  how_to_use?: string;
  weight_ml?: number;
  tags?: string[];
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

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

/** Genera un SKU corto tipo "JR-8K3P2Q": prefijo de 2 letras + 5-6 caracteres alfanuméricos. */
function generateShortSku(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin caracteres ambiguos (0/O, 1/I/L)
  const length = 5 + Math.round(Math.random());
  let suffix = '';
  for (let i = 0; i < length; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `JR-${suffix}`;
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
  if (variant.presentation_label?.trim()) {
    return variant.presentation_label.trim();
  }

  const presentationNumber = parseAmount(variant.presentation_number);
  if (presentationNumber !== null && variant.presentation_unit) {
    return `${presentationNumber.toLocaleString('es-CO', { maximumFractionDigits: 3 })} ${variant.presentation_unit}`;
  }

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
    presentation_number: parseAmount(variant.presentation_number),
    presentation_unit: variant.presentation_unit ?? '',
    image_url: variant.image_url ? normalizeImageUrl(variant.image_url) : '',
    images: (variant.images ?? []).map(normalizeVariantImage),
    prices: variant.prices.map(normalizePrice),
    current_price: currentPrice?.amount ?? null,
    presentation: buildPresentation(variant),
    available_quantity: (variant as any).available_quantity ?? null,
    minimum_quantity: (variant as any).minimum_quantity ?? null,
    active_promotion: variant.active_promotion ?? null,
    discounted_price: parseAmount(variant.discounted_price ?? null),
  };
}

function normalizeImage(image: BackendImage): ProductImage {
  return {
    ...image,
    image: normalizeImageUrl(image.image),
  };
}

function normalizeVariantImage(image: BackendVariantImage): ProductVariantImage {
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
    image_urls: images.length > 0 ? images.map((image) => image.image) : (product.image_url ? [product.image_url] : []),
    images,
    variants,
    sizes: uniqueValues(variants.map((variant) => variant.presentation)),
    is_active: product.is_active,
    is_featured: product.is_featured,
    rating_average: product.rating_average,
    rating_count: product.rating_count,
    active_promotion: product.active_promotion ?? null,
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

async function getCategoryMap(useAuth = false, forceRefresh = false): Promise<Map<string, ProductCategory>> {
  const categories = await getCategories(useAuth, forceRefresh);
  return new Map(categories.map((category) => [category.id, category]));
}

async function resolveCategoryId(value: string): Promise<string> {
  const categories = await getCategories(true);
  const category = categories.find((item) => item.id === value || item.slug === value);
  if (!category) {
    throw new Error('La categoria seleccionada no existe.');
  }
  return category.id;
}

// El panel admin debe ver todas las categorías (incluidas las inactivas) para
// poder resolver y gestionar productos cuya categoría fue desactivada; el
// storefront público solo debe ver las activas. Se cachean por separado para
// que una consulta no contamine el resultado de la otra.
let publicCategoriesCache: ProductCategory[] | null = null;
let adminCategoriesCache: ProductCategory[] | null = null;

export async function getCategories(useAuth = false, forceRefresh = false): Promise<ProductCategory[]> {
  const cache = useAuth ? adminCategoriesCache : publicCategoriesCache;
  if (!forceRefresh && cache) {
    return cache;
  }

  const client = useAuth ? api : publicApi;
  const res = await client.get<PaginatedResponse<BackendCategory>>(
    `${CATEGORIES_PATH}${buildCategoriesQuery()}`,
  );

  const categories = (res.data?.results ?? []).map(normalizeCategory);
  if (useAuth) {
    adminCategoriesCache = categories;
  } else {
    publicCategoriesCache = categories;
  }
  return categories;
}

async function fetchProducts(
  params: ProductsQueryParams | undefined,
  useAuth: boolean,
): Promise<PaginatedProducts> {
  const client = useAuth ? api : publicApi;
  const [res, categoryMap] = await Promise.all([
    client.get<PaginatedResponse<BackendProduct>>(`${PRODUCTS_PATH}${buildProductsQuery(params)}`),
    getCategoryMap(useAuth),
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

export async function getProducts(params?: ProductsQueryParams): Promise<PaginatedProducts> {
  return fetchProducts(params, false);
}

async function getAllProductsInternal(useAuth: boolean): Promise<Product[]> {
  const firstPage = await fetchProducts({ page: 1, limit: 100 }, useAuth);
  if (firstPage.totalPages <= 1) {
    return firstPage.data;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      fetchProducts({ page: index + 2, limit: 100 }, useAuth),
    ),
  );

  return [
    ...firstPage.data,
    ...remainingPages.flatMap(page => page.data),
  ];
}

export async function getAllProducts(): Promise<Product[]> {
  return getAllProductsInternal(false);
}

/**
 * Igual que getAllProducts, pero autenticado — usado por el panel admin para
 * ver también productos inactivos (el backend solo filtra por is_active
 * cuando la petición NO viene autenticada).
 */
export async function getAllProductsForAdmin(): Promise<Product[]> {
  return getAllProductsInternal(true);
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

/**
 * Reemplaza las imágenes (hasta 3) de un producto: borra las existentes que ya
 * no están en la lista nueva y crea/actualiza el resto, preservando el orden
 * (posición 0 = imagen principal).
 */
async function syncProductImages(
  productId: string,
  images: string[],
  existing: BackendImage[] = [],
): Promise<void> {
  const nextImages = images.filter(Boolean).slice(0, MAX_PRODUCT_IMAGES);

  const toDelete = existing.filter((image) => !nextImages.includes(image.image));
  await Promise.all(toDelete.map((image) => api.delete(`${IMAGES_PATH}${image.id}/`)));

  const remainingExisting = existing.filter((image) => nextImages.includes(image.image));

  await Promise.all(
    nextImages.map((url, position) => {
      const current = remainingExisting.find((image) => image.image === url);
      const body = { product: productId, image: url, position, is_primary: position === 0 };
      if (current) {
        return api.patch(`${IMAGES_PATH}${current.id}/`, body);
      }
      return api.post(IMAGES_PATH, body);
    }),
  );
}

/**
 * Reemplaza las imágenes (hasta 3) de una variante específica: borra las
 * existentes que ya no están en la lista nueva y crea/actualiza el resto,
 * preservando el orden (posición 0 = imagen principal de la variante).
 */
async function syncVariantImages(
  variantId: string,
  images: string[],
  existing: BackendVariantImage[] = [],
): Promise<void> {
  const nextImages = images.filter(Boolean).slice(0, MAX_VARIANT_IMAGES);

  const toDelete = existing.filter((image) => !nextImages.includes(image.image));
  await Promise.all(toDelete.map((image) => api.delete(`${VARIANT_IMAGES_PATH}${image.id}/`)));

  const remainingExisting = existing.filter((image) => nextImages.includes(image.image));

  await Promise.all(
    nextImages.map((url, position) => {
      const current = remainingExisting.find((image) => image.image === url);
      const body = { variant: variantId, image: url, position, is_primary: position === 0 };
      if (current) {
        return api.patch(`${VARIANT_IMAGES_PATH}${current.id}/`, body);
      }
      return api.post(VARIANT_IMAGES_PATH, body);
    }),
  );
}

export async function updateVariantImages(variantId: string, images: string[]): Promise<ProductVariantImage[]> {
  const res = await api.get<BackendVariantImage[] | PaginatedResponse<BackendVariantImage>>(
    `${VARIANT_IMAGES_PATH}?variant=${variantId}`,
  );
  const existing = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
  await syncVariantImages(variantId, images, existing);
  const refreshed = await api.get<BackendVariantImage[] | PaginatedResponse<BackendVariantImage>>(
    `${VARIANT_IMAGES_PATH}?variant=${variantId}`,
  );
  const nextExisting = Array.isArray(refreshed.data) ? refreshed.data : refreshed.data?.results ?? [];
  return nextExisting.map(normalizeVariantImage);
}

export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const categoryId = await resolveCategoryId(payload.category);

  const hasVariantData =
    payload.price !== undefined ||
    payload.variant_name !== undefined ||
    payload.sku !== undefined;

  if (!hasVariantData) {
    // Producto simple sin variante/precio: un único POST es suficiente y seguro.
    const res = await api.post<BackendProduct>(PRODUCTS_PATH, {
      category: categoryId,
      name: payload.name,
      slug: payload.slug,
      description: payload.description ?? '',
      image_url: payload.image_url ?? payload.images?.[0] ?? '',
      is_active: payload.is_active ?? true,
      is_featured: payload.is_featured ?? false,
    });
    if (!res.data) {
      throw new Error('No se pudo crear el producto.');
    }
    if (payload.images && payload.images.length > 0) {
      await syncProductImages(res.data.id, payload.images);
      return getProductById(res.data.id);
    }
    const categoryMap = await getCategoryMap(true);
    return normalizeProduct(res.data, categoryMap);
  }

  // Producto con variante/precio: se crea todo en una sola transacción atómica
  // en el backend, evitando dejar un producto huérfano si el SKU está duplicado
  // o falla la creación del precio.
  const res = await api.post<BackendProduct>(`${CATALOG_BASE_PATH}/products/create-complete/`, {
    category: categoryId,
    name: payload.name,
    slug: payload.slug,
    description: payload.description ?? '',
    image_url: payload.image_url ?? payload.images?.[0] ?? '',
    images: payload.images ?? [],
    is_active: payload.is_active ?? true,
    is_featured: payload.is_featured ?? false,
    sku: payload.sku || generateShortSku(),
    variant_name: payload.variant_name ||
      (payload.presentation_number && payload.presentation_unit
        ? `${payload.presentation_number} ${payload.presentation_unit}`
        : payload.weight_ml ? `${payload.weight_ml} ml` : 'Presentación única'),
    ...(payload.presentation_number !== undefined ? { presentation_number: String(payload.presentation_number) } : {}),
    ...(payload.presentation_unit !== undefined ? { presentation_unit: payload.presentation_unit } : {}),
    variant_attributes: payload.variant_attributes ??
      (payload.weight_ml ? { weight_ml: payload.weight_ml } : {}),
    cost: String(payload.cost ?? 0),
    price: String(payload.price ?? 0),
  });

  if (!res.data) {
    throw new Error('No se pudo crear el producto.');
  }

  return getProductById(res.data.id);
}

export interface UpdateVariantPayload {
  sku?: string;
  presentation_number?: number;
  presentation_unit?: 'ML' | 'LT' | 'GR' | 'KG' | 'UND';
  cost?: number;
  price?: number;
  image_url?: string;
  is_active?: boolean;
}

/**
 * Actualiza UNA variante específica por su propio id (no "la primera activa
 * del producto" como hace updateProduct), para permitir editar cada
 * presentación de un producto multi-variante de forma independiente.
 */
export async function updateProductVariant(variantId: string, payload: UpdateVariantPayload): Promise<void> {
  const hasVariantFields =
    payload.sku !== undefined ||
    payload.presentation_number !== undefined ||
    payload.presentation_unit !== undefined ||
    payload.cost !== undefined ||
    payload.image_url !== undefined ||
    payload.is_active !== undefined;

  if (hasVariantFields) {
    await api.patch(`${VARIANTS_PATH}${variantId}/`, {
      ...(payload.sku !== undefined ? { sku: payload.sku } : {}),
      ...(payload.presentation_number !== undefined ? { presentation_number: String(payload.presentation_number) } : {}),
      ...(payload.presentation_unit !== undefined ? { presentation_unit: payload.presentation_unit } : {}),
      ...(payload.cost !== undefined ? { cost: String(payload.cost) } : {}),
      ...(payload.image_url !== undefined ? { image_url: payload.image_url } : {}),
      ...(payload.is_active !== undefined ? { is_active: payload.is_active } : {}),
    });
  }

  if (payload.price !== undefined) {
    const res = await api.get<BackendVariant>(`${VARIANTS_PATH}${variantId}/`);
    const price = res.data?.prices.find((item) => item.is_active) ?? res.data?.prices[0];
    if (price) {
      await api.patch(`${PRICES_PATH}${price.id}/`, { amount: String(payload.price) });
    }
  }
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

  if (!res.data) {
    throw new Error('No se pudo actualizar el producto.');
  }

  if (payload.images !== undefined) {
    await syncProductImages(id, payload.images, res.data.images);
  }

  const categoryMap = await getCategoryMap(true);

  const variant = res.data.variants.find((item) => item.is_active) ?? res.data.variants[0];
  if (
    variant &&
    (
      payload.variant_name !== undefined ||
      payload.variant_attributes !== undefined ||
      payload.presentation_number !== undefined ||
      payload.presentation_unit !== undefined
    )
  ) {
    await api.patch<BackendVariant>(`${VARIANTS_PATH}${variant.id}/`, {
      ...(payload.variant_name !== undefined ? { name: payload.variant_name } : {}),
      ...(payload.presentation_number !== undefined ? { presentation_number: String(payload.presentation_number) } : {}),
      ...(payload.presentation_unit !== undefined ? { presentation_unit: payload.presentation_unit } : {}),
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

  if (payload.images !== undefined) {
    return getProductById(id);
  }

  return normalizeProduct(res.data, categoryMap);
}

export async function updateProductStock(_id: string, _stock: number, _reason?: string): Promise<Product> {
  throw new Error('El stock se administra desde el módulo de inventario.');
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`${PRODUCTS_PATH}${id}/`);
}

export type ExportFormat = 'xlsx' | 'pdf';
export type PdfLayout = 'table' | 'catalog';

interface ExportQueuedResponse {
  task_id: string;
  status: 'queued';
}

export interface ExportStatusResponse {
  status: 'pending' | 'success' | 'failure';
  url?: string;
  count?: number;
  error?: string;
}

export async function requestProductsExport(
  format: ExportFormat,
  productIds: string[],
  pdfLayout: PdfLayout = 'table',
): Promise<string> {
  const res = await api.post<ExportQueuedResponse>(EXPORTS_PATH, {
    product_ids: productIds,
    format,
    pdf_layout: pdfLayout,
  });
  if (!res.data?.task_id) {
    throw new Error('No se pudo iniciar la exportación.');
  }
  return res.data.task_id;
}

export async function getExportStatus(taskId: string): Promise<ExportStatusResponse> {
  const res = await api.get<ExportStatusResponse>(`${EXPORTS_PATH}${taskId}/`);
  if (!res.data) {
    throw new Error('No se pudo consultar el estado de la exportación.');
  }
  return res.data;
}

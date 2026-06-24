import { api } from './api';

export interface BackendCartItem {
  id: string;
  variant_id: string;
  product_name: string;
  sku: string;
  presentation: string;
  category: string;
  unit_price: string | number | null;
  currency: string;
  image_url: string;
  quantity: string | number;
  subtotal: string | number | null;
}

export interface BackendCart {
  id: string;
  items: BackendCartItem[];
  subtotal: string | number;
  item_count: string | number;
  created_at: string;
  updated_at: string;
}

async function cartRequest(
  method: 'get' | 'post' | 'patch' | 'delete',
  endpoint: string,
  body?: unknown,
): Promise<BackendCart> {
  const response =
    method === 'get'
      ? await api.get<BackendCart>(endpoint)
      : method === 'delete'
        ? await api.delete<BackendCart>(endpoint)
        : method === 'post'
          ? await api.post<BackendCart>(endpoint, body)
          : await api.patch<BackendCart>(endpoint, body);
  if (!response.data) throw new Error(response.message);
  return response.data;
}

export const getActiveCart = () => cartRequest('get', '/commerce/cart/');

export const addActiveCartItem = (variantId: string, quantity: number) =>
  cartRequest('post', '/commerce/cart/items/', {
    variant_id: variantId,
    quantity,
  });

export const updateActiveCartItem = (itemId: string, quantity: number) =>
  cartRequest('patch', `/commerce/cart/items/${itemId}/`, { quantity });

export const removeActiveCartItem = (itemId: string) =>
  cartRequest('delete', `/commerce/cart/items/${itemId}/`);

export const clearActiveCart = () => cartRequest('delete', '/commerce/cart/');

export async function checkoutActiveCart(
  shippingAddress: string,
  wholesaleCode?: string,
): Promise<{ id: string; number: string; status: string }> {
  const response = await api.post<{ id: string; number: string; status: string }>(
    '/commerce/cart/checkout/',
    { shipping_address: shippingAddress, wholesale_code: wholesaleCode ?? '' },
  );
  if (!response.data) throw new Error(response.message);
  return response.data;
}

export interface WholesaleSettingsPayload {
  minimum_purchase: string | number;
  discount_percentage: string | number;
  is_active: boolean;
}

export async function getWholesaleSettingsApi(): Promise<WholesaleSettingsPayload> {
  const response = await api.get<WholesaleSettingsPayload>('/commerce/wholesale-settings/');
  if (!response.data) throw new Error(response.message);
  return response.data;
}

export async function updateWholesaleSettingsApi(
  payload: Partial<WholesaleSettingsPayload>,
): Promise<WholesaleSettingsPayload> {
  const response = await api.patch<WholesaleSettingsPayload>('/commerce/wholesale-settings/', payload);
  if (!response.data) throw new Error(response.message);
  return response.data;
}

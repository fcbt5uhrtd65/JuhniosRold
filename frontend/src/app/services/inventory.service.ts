import { api } from './api';

const INVENTORY_BASE_PATH = '/inventory';
const STOCK_PATH = `${INVENTORY_BASE_PATH}/stock/`;
const LOCATIONS_PATH = `${INVENTORY_BASE_PATH}/locations/`;
const WAREHOUSES_PATH = `${INVENTORY_BASE_PATH}/warehouses/`;
const MOVEMENTS_PATH = `${INVENTORY_BASE_PATH}/movements/`;

type UUID = string;

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface BackendWarehouse {
  id: UUID;
  name: string;
  code: string;
  address: string;
  is_active: boolean;
}

interface BackendLocation {
  id: UUID;
  warehouse: UUID;
  name: string;
  code: string;
  is_active: boolean;
}

interface BackendStock {
  id: UUID;
  variant: UUID;
  location: UUID;
  quantity: string;
  minimum_quantity: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryStock {
  id: UUID;
  variantId: UUID;
  locationId: UUID;
  quantity: number;
  minimumQuantity: number;
  locationName: string;
  locationCode: string;
  warehouseName: string;
  updatedAt: string;
}

function parseQuantity(value: string | number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getPage<T>(path: string): Promise<T[]> {
  const firstResponse = await api.get<PaginatedResponse<T>>(`${path}?page_size=100`);
  const firstPage = firstResponse.data;
  if (!firstPage) {
    return [];
  }

  const totalPages = Math.ceil(firstPage.count / 100);
  if (totalPages <= 1) {
    return firstPage.results;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      api.get<PaginatedResponse<T>>(`${path}?page_size=100&page=${index + 2}`),
    ),
  );

  return [
    ...firstPage.results,
    ...remainingPages.flatMap(response => response.data?.results ?? []),
  ];
}

export async function getInventoryStock(): Promise<InventoryStock[]> {
  const [stocks, locations, warehouses] = await Promise.all([
    getPage<BackendStock>(STOCK_PATH),
    getPage<BackendLocation>(LOCATIONS_PATH),
    getPage<BackendWarehouse>(WAREHOUSES_PATH),
  ]);

  const locationMap = new Map(locations.map((location) => [location.id, location]));
  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));

  return stocks.map((stock) => {
    const location = locationMap.get(stock.location);
    const warehouse = location ? warehouseMap.get(location.warehouse) : undefined;

    return {
      id: stock.id,
      variantId: stock.variant,
      locationId: stock.location,
      quantity: parseQuantity(stock.quantity),
      minimumQuantity: parseQuantity(stock.minimum_quantity),
      locationName: location?.name ?? 'Ubicación sin nombre',
      locationCode: location?.code ?? '',
      warehouseName: warehouse?.name ?? 'Bodega sin nombre',
      updatedAt: stock.updated_at,
    };
  });
}

/**
 * Consulta directamente al backend si ya existe un Stock para esta variante,
 * en vez de confiar en el estado local `inventory` del admin (que puede estar
 * desactualizado y llevar a intentar crear un Stock duplicado — (variant,
 * location) es único en el backend).
 */
export async function findStockByVariant(variantId: string): Promise<{ id: string } | null> {
  const res = await api.get<PaginatedResponse<BackendStock>>(
    `${STOCK_PATH}?variant=${variantId}&page_size=1`,
  );
  const stock = res.data?.results?.[0];
  return stock ? { id: stock.id } : null;
}

export async function createInitialStock(
  variantId: string,
  minimumQuantity = 10,
): Promise<{ locationId: string } | null> {
  const locations = await getPage<BackendLocation>(LOCATIONS_PATH);
  const location = locations.find((item) => item.is_active) ?? locations[0];

  if (!location) {
    return null;
  }

  await api.post<BackendStock>(STOCK_PATH, {
    variant: variantId,
    location: location.id,
    minimum_quantity: String(minimumQuantity),
  });

  return { locationId: location.id };
}

export async function updateStockMinimum(
  stockId: string,
  minimumQuantity: number,
): Promise<void> {
  await api.patch<BackendStock>(`${STOCK_PATH}${stockId}/`, {
    minimum_quantity: String(minimumQuantity),
  });
}

export async function setInventoryQuantity(
  stock: Pick<InventoryStock, 'variantId' | 'locationId' | 'quantity'>,
  targetQuantity: number,
  reason = 'Ajuste manual desde el panel administrativo',
): Promise<void> {
  if (!Number.isFinite(targetQuantity) || targetQuantity < 0) {
    throw new Error('El stock debe ser un número mayor o igual a cero.');
  }

  const difference = targetQuantity - stock.quantity;
  if (difference === 0) {
    return;
  }

  await api.post(MOVEMENTS_PATH, {
    variant: stock.variantId,
    location: stock.locationId,
    movement_type: difference > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
    quantity: String(Math.abs(difference)),
    reason,
    reference: 'ADMIN_PANEL',
  });
}

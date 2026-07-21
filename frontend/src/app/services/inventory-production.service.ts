import { api } from './api';
import { getAllProductsForAdmin, type ProductVariant } from './products.service';

const BASE = '/inventory';

type UUID = string;

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

async function getPage<T>(path: string): Promise<T[]> {
  const firstResponse = await api.get<PaginatedResponse<T>>(`${path}?page_size=100`);
  const firstPage = firstResponse.data;
  if (!firstPage) return [];

  const totalPages = Math.ceil(firstPage.count / 100);
  if (totalPages <= 1) return firstPage.results;

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

function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface WarehouseRef {
  id: UUID;
  name: string;
  code: string;
  address: string;
  is_active: boolean;
}

export interface LocationRef {
  id: UUID;
  warehouse: UUID;
  name: string;
  code: string;
  is_active: boolean;
}

export interface UnitRef {
  id: UUID;
  code: string;
  name: string;
  abbreviation: string;
}

export interface ItemGroupRef {
  id: UUID;
  code: string;
  name: string;
  is_inventoried: boolean;
}

export interface ItemTypeRef {
  id: UUID;
  name: string;
  description: string;
  is_inventoried: boolean;
}

export interface SupplierRef {
  id: UUID;
  nit: string;
  name: string;
  contact_name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  is_active: boolean;
}

export interface InventoryItem {
  id: UUID;
  code: string;
  name: string;
  item_type: UUID;
  item_group: UUID;
  unit: UUID;
  supplier: UUID | null;
  cost: string;
  tax_rate: string;
  minimum_quantity: string;
  maximum_quantity: string;
  description: string;
  tracks_inventory: boolean;
  tracks_batches: boolean;
  is_active: boolean;
}

export interface StockRecord {
  id: UUID;
  variant: UUID;
  location: UUID;
  quantity: string;
  reserved_quantity: string;
  minimum_quantity: string;
  created_at: string;
  updated_at: string;
}

export type MovementType = 'ENTRY' | 'EXIT' | 'LOSS' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';

export interface InventoryMovementRecord {
  id: UUID;
  variant: UUID;
  location: UUID;
  movement_type: MovementType;
  quantity: string;
  reason: string;
  reference: string;
  created_by: UUID | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderLineRecord {
  id?: UUID;
  item: UUID;
  quantity: string;
  unit_price: string;
  received_quantity: string;
}

export interface PurchaseOrderRecord {
  id: UUID;
  number: string;
  supplier: UUID;
  status: 'DRAFT' | 'SENT' | 'PARTIAL' | 'CLOSED' | 'VOIDED';
  issued_at: string;
  expected_at: string | null;
  destination_location: UUID | null;
  notes: string;
  created_by: UUID | null;
  total: string;
  lines: PurchaseOrderLineRecord[];
  created_at: string;
  updated_at: string;
}

export interface FormulaLineRecord {
  id?: UUID;
  item: UUID;
  quantity: string;
}

export interface FormulaRecord {
  id: UUID;
  code: string;
  name: string;
  output_item: UUID;
  yield_quantity: string;
  yield_unit: UUID;
  is_active: boolean;
  lines: FormulaLineRecord[];
}

export interface ProductionOrderRecord {
  id: UUID;
  number: string;
  formula: UUID;
  output_item: UUID;
  status: 'PENDING' | 'IN_PROGRESS' | 'CLOSED' | 'VOIDED';
  planned_quantity: string;
  actual_quantity: string;
  batch_code: string;
  started_at: string | null;
  closed_at: string | null;
  responsible: string;
  is_dispensed: boolean;
  is_output_received: boolean;
  notes: string;
}

export interface StockConversionRecord {
  id: UUID;
  number: string;
  occurred_on: string;
  source_item: UUID;
  source_location: UUID;
  source_quantity: string;
  target_item: UUID;
  target_location: UUID;
  target_quantity: string;
  reason: string;
  created_by: UUID | null;
}

export interface InventoryWorkspace {
  warehouses: WarehouseRef[];
  locations: LocationRef[];
  units: UnitRef[];
  itemGroups: ItemGroupRef[];
  itemTypes: ItemTypeRef[];
  suppliers: SupplierRef[];
  items: InventoryItem[];
  stocks: StockRecord[];
  movements: InventoryMovementRecord[];
  purchaseOrders: PurchaseOrderRecord[];
  formulas: FormulaRecord[];
  productionOrders: ProductionOrderRecord[];
  conversions: StockConversionRecord[];
  variants: ProductVariant[];
  productNameByVariantId: Map<string, string>;
}

export async function getInventoryWorkspace(): Promise<InventoryWorkspace> {
  const [
    warehouses,
    locations,
    units,
    itemGroups,
    itemTypes,
    suppliers,
    items,
    stocks,
    movements,
    purchaseOrders,
    formulas,
    productionOrders,
    conversions,
    products,
  ] = await Promise.all([
    getPage<WarehouseRef>(`${BASE}/warehouses/`),
    getPage<LocationRef>(`${BASE}/locations/`),
    getPage<UnitRef>(`${BASE}/units/`),
    getPage<ItemGroupRef>(`${BASE}/item-groups/`),
    getPage<ItemTypeRef>(`${BASE}/item-types/`),
    getPage<SupplierRef>(`${BASE}/suppliers/`),
    getPage<InventoryItem>(`${BASE}/items/`),
    getPage<StockRecord>(`${BASE}/stock/`),
    getPage<InventoryMovementRecord>(`${BASE}/movements/`),
    getPage<PurchaseOrderRecord>(`${BASE}/purchase-orders/`),
    getPage<FormulaRecord>(`${BASE}/formulas/`),
    getPage<ProductionOrderRecord>(`${BASE}/production-orders/`),
    getPage<StockConversionRecord>(`${BASE}/conversions/`),
    getAllProductsForAdmin().catch(() => []),
  ]);

  const variants = products.flatMap(product => product.variants);
  const productNameByVariantId = new Map<string, string>();
  products.forEach(product => {
    product.variants.forEach(variant => {
      const presentation = variant.presentation && variant.presentation !== variant.sku
        ? ` - ${variant.presentation}`
        : '';
      productNameByVariantId.set(variant.id, `${product.name}${presentation}`);
    });
  });

  return {
    warehouses,
    locations,
    units,
    itemGroups,
    itemTypes,
    suppliers,
    items,
    stocks,
    movements,
    purchaseOrders,
    formulas,
    productionOrders,
    conversions,
    variants,
    productNameByVariantId,
  };
}

export async function getProductionPlanningWorkspace(): Promise<InventoryWorkspace> {
  const [units, items, formulas, productionOrders] = await Promise.all([
    getPage<UnitRef>(`${BASE}/units/`),
    getPage<InventoryItem>(`${BASE}/items/`),
    getPage<FormulaRecord>(`${BASE}/formulas/`),
    getPage<ProductionOrderRecord>(`${BASE}/production-orders/`),
  ]);

  return {
    warehouses: [],
    locations: [],
    units,
    itemGroups: [],
    itemTypes: [],
    suppliers: [],
    items,
    stocks: [],
    movements: [],
    purchaseOrders: [],
    formulas,
    productionOrders,
    conversions: [],
    variants: [],
    productNameByVariantId: new Map(),
  };
}

export function numeric(value: string | number | null | undefined): number {
  return toNumber(value);
}

export async function createPurchaseOrder(input: {
  supplier: string;
  issued_at: string;
  expected_at: string | null;
  destination_location: string | null;
  notes: string;
  lines: Array<{ item: string; quantity: number; unit_price: number }>;
}): Promise<PurchaseOrderRecord> {
  const { data } = await api.post<PurchaseOrderRecord>(`${BASE}/purchase-orders/`, {
    ...input,
    lines: input.lines.map(line => ({
      item: line.item,
      quantity: String(line.quantity),
      unit_price: String(line.unit_price),
      received_quantity: '0',
    })),
  });
  return data as PurchaseOrderRecord;
}

export async function createInventoryMovement(input: {
  variant: string;
  location: string;
  movement_type: MovementType;
  quantity: number;
  reason: string;
  reference: string;
}): Promise<InventoryMovementRecord> {
  const { data } = await api.post<InventoryMovementRecord>(`${BASE}/movements/`, {
    ...input,
    quantity: String(input.quantity),
  });
  return data as InventoryMovementRecord;
}

export async function createFormula(input: {
  code: string;
  name: string;
  output_item: string;
  yield_quantity: number;
  yield_unit: string;
  lines: Array<{ item: string; quantity: number }>;
}): Promise<FormulaRecord> {
  const { data } = await api.post<FormulaRecord>(`${BASE}/formulas/`, {
    ...input,
    yield_quantity: String(input.yield_quantity),
    lines: input.lines.map(line => ({ item: line.item, quantity: String(line.quantity) })),
  });
  return data as FormulaRecord;
}

export async function getProductionOrders(): Promise<ProductionOrderRecord[]> {
  return getPage<ProductionOrderRecord>(`${BASE}/production-orders/`);
}

export async function createProductionOrder(input: {
  formula: string;
  output_item: string;
  planned_quantity: number;
  batch_code: string;
  started_at: string | null;
  responsible: string;
  notes: string;
}): Promise<ProductionOrderRecord> {
  const { data } = await api.post<ProductionOrderRecord>(`${BASE}/production-orders/`, input);
  return data as ProductionOrderRecord;
}

export async function createStockConversion(input: {
  occurred_on: string;
  source_item: string;
  source_location: string;
  source_quantity: number;
  target_item: string;
  target_location: string;
  target_quantity: number;
  reason: string;
}): Promise<StockConversionRecord> {
  const { data } = await api.post<StockConversionRecord>(`${BASE}/conversions/`, {
    ...input,
    source_quantity: String(input.source_quantity),
    target_quantity: String(input.target_quantity),
  });
  return data as StockConversionRecord;
}

export async function closeProductionOrder(input: {
  id: string;
  actual_quantity: number;
  closed_at: string;
  notes?: string;
}): Promise<ProductionOrderRecord> {
  const { data } = await api.patch<ProductionOrderRecord>(`${BASE}/production-orders/${input.id}/`, {
    status: 'CLOSED',
    actual_quantity: String(input.actual_quantity),
    closed_at: input.closed_at,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  });
  return data as ProductionOrderRecord;
}

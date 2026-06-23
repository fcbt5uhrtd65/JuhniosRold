import { api } from './api';

const BASE = '/inventory';
const WAREHOUSES_PATH = `${BASE}/warehouses/`;
const UNITS_PATH = `${BASE}/units/`;
const ITEM_GROUPS_PATH = `${BASE}/item-groups/`;
const ITEM_TYPES_PATH = `${BASE}/item-types/`;
const SUPPLIERS_PATH = `${BASE}/suppliers/`;
const ITEMS_PATH = `${BASE}/items/`;

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

/* ── Bodegas ─────────────────────────────────────────────────────────── */

export interface Warehouse {
  id: UUID;
  name: string;
  code: string;
  address: string;
  isActive: boolean;
}

interface BackendWarehouse {
  id: UUID;
  name: string;
  code: string;
  address: string;
  is_active: boolean;
}

function mapWarehouse(w: BackendWarehouse): Warehouse {
  return { id: w.id, name: w.name, code: w.code, address: w.address, isActive: w.is_active };
}

export async function getWarehouses(): Promise<Warehouse[]> {
  const data = await getPage<BackendWarehouse>(WAREHOUSES_PATH);
  return data.map(mapWarehouse);
}

export async function createWarehouse(input: Omit<Warehouse, 'id'>): Promise<Warehouse> {
  const { data } = await api.post<BackendWarehouse>(WAREHOUSES_PATH, {
    name: input.name,
    code: input.code,
    address: input.address,
    is_active: input.isActive,
  });
  return mapWarehouse(data as BackendWarehouse);
}

export async function updateWarehouse(id: UUID, input: Partial<Omit<Warehouse, 'id'>>): Promise<Warehouse> {
  const { data } = await api.patch<BackendWarehouse>(`${WAREHOUSES_PATH}${id}/`, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.code !== undefined && { code: input.code }),
    ...(input.address !== undefined && { address: input.address }),
    ...(input.isActive !== undefined && { is_active: input.isActive }),
  });
  return mapWarehouse(data as BackendWarehouse);
}

export async function deleteWarehouse(id: UUID): Promise<void> {
  await api.delete(`${WAREHOUSES_PATH}${id}/`);
}

/* ── Unidades de medida ──────────────────────────────────────────────── */

export interface UnitOfMeasure {
  id: UUID;
  code: string;
  name: string;
  abbreviation: string;
}

function mapUnit(u: UnitOfMeasure): UnitOfMeasure {
  return u;
}

export async function getUnits(): Promise<UnitOfMeasure[]> {
  return getPage<UnitOfMeasure>(UNITS_PATH);
}

export async function createUnit(input: Omit<UnitOfMeasure, 'id'>): Promise<UnitOfMeasure> {
  const { data } = await api.post<UnitOfMeasure>(UNITS_PATH, input);
  return mapUnit(data as UnitOfMeasure);
}

/* ── Grupos de artículo ──────────────────────────────────────────────── */

export interface ItemGroup {
  id: UUID;
  code: string;
  name: string;
  isInventoried: boolean;
}

interface BackendItemGroup {
  id: UUID;
  code: string;
  name: string;
  is_inventoried: boolean;
}

function mapItemGroup(g: BackendItemGroup): ItemGroup {
  return { id: g.id, code: g.code, name: g.name, isInventoried: g.is_inventoried };
}

export async function getItemGroups(): Promise<ItemGroup[]> {
  const data = await getPage<BackendItemGroup>(ITEM_GROUPS_PATH);
  return data.map(mapItemGroup);
}

export async function createItemGroup(input: Omit<ItemGroup, 'id'>): Promise<ItemGroup> {
  const { data } = await api.post<BackendItemGroup>(ITEM_GROUPS_PATH, {
    code: input.code,
    name: input.name,
    is_inventoried: input.isInventoried,
  });
  return mapItemGroup(data as BackendItemGroup);
}

/* ── Tipos de artículo ───────────────────────────────────────────────── */

export interface ItemType {
  id: UUID;
  name: string;
  description: string;
  isInventoried: boolean;
}

interface BackendItemType {
  id: UUID;
  name: string;
  description: string;
  is_inventoried: boolean;
}

function mapItemType(t: BackendItemType): ItemType {
  return { id: t.id, name: t.name, description: t.description, isInventoried: t.is_inventoried };
}

export async function getItemTypes(): Promise<ItemType[]> {
  const data = await getPage<BackendItemType>(ITEM_TYPES_PATH);
  return data.map(mapItemType);
}

/* ── Proveedores ─────────────────────────────────────────────────────── */

export interface Supplier {
  id: UUID;
  nit: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  isActive: boolean;
}

interface BackendSupplier {
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

function mapSupplier(s: BackendSupplier): Supplier {
  return {
    id: s.id,
    nit: s.nit,
    name: s.name,
    contactName: s.contact_name,
    phone: s.phone,
    email: s.email,
    city: s.city,
    address: s.address,
    isActive: s.is_active,
  };
}

export async function getSuppliers(): Promise<Supplier[]> {
  const data = await getPage<BackendSupplier>(SUPPLIERS_PATH);
  return data.map(mapSupplier);
}

export async function createSupplier(input: Omit<Supplier, 'id'>): Promise<Supplier> {
  const { data } = await api.post<BackendSupplier>(SUPPLIERS_PATH, {
    nit: input.nit,
    name: input.name,
    contact_name: input.contactName,
    phone: input.phone,
    email: input.email,
    city: input.city,
    address: input.address,
    is_active: input.isActive,
  });
  return mapSupplier(data as BackendSupplier);
}

/* ── Artículos ───────────────────────────────────────────────────────── */

export interface Item {
  id: UUID;
  code: string;
  name: string;
  itemTypeId: UUID;
  itemGroupId: UUID;
  unitId: UUID;
  supplierId: UUID | null;
  cost: number;
  taxRate: number;
  minimumQuantity: number;
  maximumQuantity: number;
  description: string;
  tracksInventory: boolean;
  tracksBatches: boolean;
  isActive: boolean;
}

interface BackendItem {
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

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapItem(i: BackendItem): Item {
  return {
    id: i.id,
    code: i.code,
    name: i.name,
    itemTypeId: i.item_type,
    itemGroupId: i.item_group,
    unitId: i.unit,
    supplierId: i.supplier,
    cost: toNumber(i.cost),
    taxRate: toNumber(i.tax_rate),
    minimumQuantity: toNumber(i.minimum_quantity),
    maximumQuantity: toNumber(i.maximum_quantity),
    description: i.description,
    tracksInventory: i.tracks_inventory,
    tracksBatches: i.tracks_batches,
    isActive: i.is_active,
  };
}

export async function getItems(): Promise<Item[]> {
  const data = await getPage<BackendItem>(ITEMS_PATH);
  return data.map(mapItem);
}

export async function createItem(input: Omit<Item, 'id'>): Promise<Item> {
  const { data } = await api.post<BackendItem>(ITEMS_PATH, {
    code: input.code,
    name: input.name,
    item_type: input.itemTypeId,
    item_group: input.itemGroupId,
    unit: input.unitId,
    supplier: input.supplierId,
    cost: String(input.cost),
    tax_rate: String(input.taxRate),
    minimum_quantity: String(input.minimumQuantity),
    maximum_quantity: String(input.maximumQuantity),
    description: input.description,
    tracks_inventory: input.tracksInventory,
    tracks_batches: input.tracksBatches,
    is_active: input.isActive,
  });
  return mapItem(data as BackendItem);
}

export async function updateItem(id: UUID, input: Partial<Omit<Item, 'id'>>): Promise<Item> {
  const payload: Record<string, unknown> = {};
  if (input.code !== undefined) payload.code = input.code;
  if (input.name !== undefined) payload.name = input.name;
  if (input.itemTypeId !== undefined) payload.item_type = input.itemTypeId;
  if (input.itemGroupId !== undefined) payload.item_group = input.itemGroupId;
  if (input.unitId !== undefined) payload.unit = input.unitId;
  if (input.supplierId !== undefined) payload.supplier = input.supplierId;
  if (input.cost !== undefined) payload.cost = String(input.cost);
  if (input.taxRate !== undefined) payload.tax_rate = String(input.taxRate);
  if (input.minimumQuantity !== undefined) payload.minimum_quantity = String(input.minimumQuantity);
  if (input.maximumQuantity !== undefined) payload.maximum_quantity = String(input.maximumQuantity);
  if (input.description !== undefined) payload.description = input.description;
  if (input.tracksInventory !== undefined) payload.tracks_inventory = input.tracksInventory;
  if (input.tracksBatches !== undefined) payload.tracks_batches = input.tracksBatches;
  if (input.isActive !== undefined) payload.is_active = input.isActive;

  const { data } = await api.patch<BackendItem>(`${ITEMS_PATH}${id}/`, payload);
  return mapItem(data as BackendItem);
}

export async function deleteItem(id: UUID): Promise<void> {
  await api.delete(`${ITEMS_PATH}${id}/`);
}

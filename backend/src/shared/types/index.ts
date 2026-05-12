// ============================================================
// Shared Types — Juhnios Rold Backend
// ============================================================

// ---- Roles ----
export enum UserRole {
  ADMIN = 'ADMIN',
  PRO = 'PRO',
  SELLER = 'SELLER',
  DISTRIBUTOR = 'DISTRIBUTOR',
  CLIENT = 'CLIENT',
}

// ---- Product Categories ----
export enum ProductCategory {
  ACEITES = 'aceites',
  SILICONAS = 'siliconas',
  TRATAMIENTOS = 'tratamientos',
  CORPORAL = 'corporal',
  BABY = 'baby',
  PERSONAL = 'personal',
}

// ---- Order Status ----
export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

// ---- Payment Status ----
export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// ---- Pro Profile Status ----
export enum ProStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
}

// ---- Business Types ----
export enum BusinessType {
  SALON = 'salon',
  STYLIST = 'stylist',
  DISTRIBUTOR = 'distributor',
  SPA = 'spa',
  BARBERSHOP = 'barbershop',
  OTHER = 'other',
}

// ---- User Entity ----
export interface User {
  id: string;
  name?: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone?: string;
  document_type?: string;
  document_number?: string;
  company_name?: string;
  tax_id?: string;
  role: UserRole;
  is_active: boolean;
  avatar_url?: string;
  created_at: Date;
  updated_at: Date;
}

export type SafeUser = Omit<User, 'password_hash'>;

// ---- Product Entity ----
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description?: string;
  category: ProductCategory;
  type?: string;
  presentation?: string;
  price: number;
  wholesale_price?: number;
  pro_price: number;
  stock: number;
  min_stock: number;
  location?: string;
  lot?: string;
  sku?: string;
  image_url?: string;
  images: string[];
  ingredients: string[];
  benefits: string[];
  how_to_use?: string;
  weight_ml?: number;
  is_active: boolean;
  is_featured: boolean;
  active?: boolean;
  featured?: boolean;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

// ---- Order Item Entity ----
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_sku?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  total?: number;
  created_at: Date;
}

// ---- Shipping Address ----
export interface ShippingAddress {
  full_name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  department: string;
  postal_code?: string;
  phone: string;
  country: string;
}

// ---- Order Entity ----
export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  total_amount: number;
  total?: number;
  subtotal: number;
  shipping_cost: number;
  shipping?: number;
  tax?: number;
  discount_amount: number;
  discount?: number;
  shipping_address: ShippingAddress;
  payment_method: string;
  payment_status: PaymentStatus;
  payment_reference?: string;
  notes?: string;
  items?: OrderItem[];
  created_at: Date;
  updated_at: Date;
}

// ---- Pro Profile Entity ----
export interface ProProfile {
  id: string;
  user_id: string;
  business_name: string;
  business_type: BusinessType;
  nit?: string;
  tax_id?: string;
  message?: string;
  city: string;
  department: string;
  website_url?: string;
  social_media?: Record<string, string>;
  status: ProStatus;
  approved_by?: string;
  reviewed_by?: string;
  approved_at?: Date;
  reviewed_at?: Date;
  rejection_reason?: string;
  discount_percentage: number;
  priority_shipping: boolean;
  early_access: boolean;
  benefits: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

// ---- Saved Product Entity ----
export interface SavedProduct {
  id: string;
  user_id: string;
  product_id: string;
  created_at: Date;
}

// ---- Inventory Movement Entity ----
export interface InventoryMovement {
  id: string;
  product_id: string;
  user_id?: string;
  type: 'adjustment' | 'in' | 'out' | 'sale' | 'return';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reason?: string;
  created_at: Date;
}

// ---- JWT Payload ----
export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// ---- Pagination ----
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---- API Response ----
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
  meta?: Record<string, unknown>;
}

// ============================================================
// AdminContext — Juhnios Rold Frontend
// Admin auth + data management with real API + localStorage fallback
// ============================================================

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User, Product, Inventory, Order, Payment, Customer } from '../types/admin';
import {
  loginUser,
  getCurrentUser,
  logoutUser,
} from '../services/auth.service';
import {
  getAllProducts,
  createProduct as apiCreateProduct,
  updateProduct as apiUpdateProduct,
  deleteProduct as apiDeleteProduct,
  type Product as ApiProduct,
} from '../services/products.service';
import {
  createInitialStock,
  getInventoryStock,
  setInventoryQuantity,
  type InventoryStock,
} from '../services/inventory.service';
import {
  getOrders,
  updateOrderStatus as apiUpdateOrderStatus,
} from '../services/orders.service';
import {
  createCustomer as apiCreateCustomer,
  getCustomers,
  type BackendCustomer,
} from '../services/customers.service';
import {
  getAccessToken,
  clearTokens,
  isBackendAvailable,
} from '../services/api';

interface AdminContextType {
  currentUser: User | null;
  products: Product[];
  inventory: Inventory[];
  orders: Order[];
  payments: Payment[];
  customers: Customer[];
  isLoading: boolean;
  backendOnline: boolean;
  login: (email: string, password: string) => boolean | Promise<boolean>;
  logout: () => void;
  addProduct: (product: Omit<Product, 'id'>) => void | Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => void | Promise<void>;
  deleteProduct: (id: string) => void | Promise<void>;
  updateInventory: (productId: string, stock: number) => void | Promise<void>;
  updateOrderStatus: (orderId: string, status: Order['estado']) => void | Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id' | 'totalCompras'>) => void | Promise<void>;
  refreshData: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: 'admin_user',
  PRODUCTS: 'admin_products',
  INVENTORY: 'admin_inventory',
  ORDERS: 'admin_orders',
  PAYMENTS: 'admin_payments',
  CUSTOMERS: 'admin_customers',
};

const DEMO_ADMIN_PASSWORD = 'Admin123!';

// Offline demo users mirror the accounts created by seed_admin_users.
const MOCK_USERS: User[] = [
  { id: '1', nombre: 'Admin Principal', email: 'admin@juhnios.com', rol: 'admin' },
  { id: '2', nombre: 'Admin Secundario', email: 'administrador2@juhnios.com', rol: 'admin' },
];

const INITIAL_PRODUCTS: Product[] = [
  {
    id: '1',
    nombre: 'Aceite de Romero',
    categoria: 'capilar',
    tipo: 'Aceite',
    presentacion: '120ml',
    precio: 28900,
    descripcion: 'Estimula el crecimiento capilar',
    imagen: 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=600&q=80',
    estado: 'activo',
  },
  {
    id: '2',
    nombre: 'Silicona de Lino',
    categoria: 'capilar',
    tipo: 'Silicona',
    presentacion: '50ml',
    precio: 24900,
    descripcion: 'Brillo y suavidad',
    imagen: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&q=80',
    estado: 'activo',
  },
  {
    id: '3',
    nombre: 'Tratamiento Keratina',
    categoria: 'capilar',
    tipo: 'Tratamiento',
    presentacion: '220gr',
    precio: 38900,
    descripcion: 'Reconstrucción profunda',
    imagen: 'https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=600&q=80',
    estado: 'activo',
  },
];

const INITIAL_INVENTORY: Inventory[] = [
  { id: '1', productoId: '1', stockActual: 8, stockMinimo: 10, lote: 'L001', ubicacion: 'Bodega Principal' },
  { id: '2', productoId: '2', stockActual: 25, stockMinimo: 15, lote: 'L002', ubicacion: 'Bodega Principal' },
  { id: '3', productoId: '3', stockActual: 3, stockMinimo: 5, lote: 'L003', ubicacion: 'Tienda' },
];

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: '1',
    documento: '1000000001',
    nombre: 'María González',
    telefono: '3001234567',
    email: 'maria@email.com',
    direccion: 'Calle 123 #45-67',
    ciudad: 'Bogotá',
    totalCompras: 145600,
    ultimaCompra: new Date().toISOString(),
  },
  {
    id: '2',
    documento: '1000000002',
    nombre: 'Andrea Ramírez',
    telefono: '3009876543',
    email: 'andrea@email.com',
    direccion: 'Carrera 50 #12-34',
    ciudad: 'Medellín',
    totalCompras: 89500,
    ultimaCompra: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

const INITIAL_ORDERS: Order[] = [
  {
    id: '1',
    clienteId: '1',
    productos: [
      { productoId: '1', nombre: 'Aceite de Romero', cantidad: 2, precio: 28900 },
      { productoId: '2', nombre: 'Silicona de Lino', cantidad: 1, precio: 24900 },
    ],
    total: 82700,
    estado: 'enviado',
    fecha: new Date().toISOString(),
    metodoPago: 'nequi',
  },
  {
    id: '2',
    clienteId: '2',
    productos: [
      { productoId: '3', nombre: 'Tratamiento Keratina', cantidad: 1, precio: 38900 },
    ],
    total: 38900,
    estado: 'pendiente',
    fecha: new Date(Date.now() - 3600000).toISOString(),
  },
];

const INITIAL_PAYMENTS: Payment[] = [
  {
    id: '1',
    pedidoId: '1',
    metodo: 'nequi',
    estado: 'aprobado',
    referencia: 'NEQ123456789',
    monto: 82700,
    fecha: new Date().toISOString(),
  },
];

// ---- Map API product → admin Product ----
function mapApiProduct(p: ApiProduct): Product {
  const primaryVariant = p.variants.find(variant => variant.is_active) ?? p.variants[0];
  const productType = primaryVariant?.attributes?.type;

  return {
    id: p.id,
    nombre: p.name,
    categoria: p.category_slug || p.category,
    tipo: typeof productType === 'string' ? productType : p.category_name,
    presentacion: p.sizes[0] ?? '',
    precio: p.price ?? 0,
    descripcion: p.description,
    imagen: p.primary_image ?? '',
    estado: p.is_active ? 'activo' : 'inactivo',
  };
}

// ---- Map API order → admin Order ----
function mapApiOrder(o: {
  id: string; status: string; total_amount: number; created_at: string;
  payment_method?: string; user_id?: string; items?: Array<{
    product_id: string; product_name: string; quantity: number; unit_price: number;
  }>;
}): Order {
  const statusMap: Record<string, Order['estado']> = {
    pending: 'pendiente',
    confirmed: 'confirmado',
    processing: 'procesando',
    shipped: 'enviado',
    delivered: 'entregado',
    cancelled: 'cancelado',
  };
  return {
    id: o.id,
    clienteId: o.user_id ?? '',
    productos: (o.items ?? []).map(i => ({
      productoId: i.product_id,
      nombre: i.product_name,
      cantidad: i.quantity,
      precio: i.unit_price,
    })),
    total: o.total_amount,
    estado: statusMap[o.status] ?? 'pendiente',
    fecha: o.created_at,
    metodoPago: o.payment_method,
  };
}

function mapApiCustomer(customer: BackendCustomer): Customer {
  return {
    id: customer.id,
    documento: customer.document_number,
    nombre: `${customer.first_name} ${customer.last_name}`.trim(),
    telefono: customer.phone,
    email: customer.email,
    direccion: customer.address,
    ciudad: customer.city,
    totalCompras: 0,
    ultimaCompra: customer.updated_at || customer.created_at,
  };
}

function mapApiInventory(stocks: InventoryStock[], apiProducts: ApiProduct[]): Inventory[] {
  const productByVariant = new Map(
    apiProducts.flatMap(product =>
      product.variants.map(variant => [variant.id, product.id] as const),
    ),
  );

  return stocks.flatMap(stock => {
    const productId = productByVariant.get(stock.variantId);
    if (!productId) {
      return [];
    }

    return [{
      id: stock.id,
      productoId: productId,
      varianteId: stock.variantId,
      ubicacionId: stock.locationId,
      stockActual: stock.quantity,
      stockMinimo: stock.minimumQuantity,
      ubicacion: [stock.warehouseName, stock.locationName].filter(Boolean).join(' / '),
    }];
  });
}

function mapAdminUser(user: Awaited<ReturnType<typeof getCurrentUser>>): User {
  return {
    id: user.id,
    nombre: `${user.first_name} ${user.last_name}`.trim() || user.email,
    email: user.email,
    rol: 'admin',
  };
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);

  // Restore data and validate an administrative session on mount.
  useEffect(() => {
    const savedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    setProducts(savedProducts ? JSON.parse(savedProducts) : INITIAL_PRODUCTS);

    const savedInventory = localStorage.getItem(STORAGE_KEYS.INVENTORY);
    setInventory(savedInventory ? JSON.parse(savedInventory) : INITIAL_INVENTORY);

    const savedOrders = localStorage.getItem(STORAGE_KEYS.ORDERS);
    setOrders(savedOrders ? JSON.parse(savedOrders) : INITIAL_ORDERS);

    const savedPayments = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
    setPayments(savedPayments ? JSON.parse(savedPayments) : INITIAL_PAYMENTS);

    const savedCustomers = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    setCustomers(savedCustomers ? JSON.parse(savedCustomers) : INITIAL_CUSTOMERS);

    async function restoreSession() {
      const online = await isBackendAvailable().catch(() => false);
      setBackendOnline(online);

      if (online && getAccessToken()) {
        try {
          const user = await getCurrentUser();
          if (user.role === 'ADMIN') {
            const adminUser = mapAdminUser(user);
            setCurrentUser(adminUser);
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(adminUser));
          } else {
            setCurrentUser(null);
            localStorage.removeItem(STORAGE_KEYS.USER);
          }
        } catch {
          setCurrentUser(null);
          localStorage.removeItem(STORAGE_KEYS.USER);
        }
      } else if (!online) {
        const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser) as User;
            if (MOCK_USERS.some(user => user.email === parsed.email)) {
              setCurrentUser(parsed);
            }
          } catch {
            localStorage.removeItem(STORAGE_KEYS.USER);
          }
        }
      }

      setIsLoading(false);
    }

    void restoreSession();
  }, []);

  // Persist changes
  useEffect(() => { if (products.length > 0) localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products)); }, [products]);
  useEffect(() => { if (inventory.length > 0) localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => { if (orders.length > 0) localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders)); }, [orders]);
  useEffect(() => { if (payments.length > 0) localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments)); }, [payments]);
  useEffect(() => { if (customers.length > 0) localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers)); }, [customers]);

  // ---- Fetch data from API (when online and admin) ----
  const refreshData = useCallback(async () => {
    let online = false;
    try {
      online = await isBackendAvailable();
    } catch {
      online = false;
    }
    setBackendOnline(online);
    if (!online || !getAccessToken()) return;

    setIsLoading(true);
    try {
      const [apiProducts, stock] = await Promise.all([
        getAllProducts(),
        getInventoryStock(),
      ]);
      const mappedProducts = apiProducts.map(mapApiProduct);
      const mappedInventory = mapApiInventory(stock, apiProducts);
      setProducts(mappedProducts);
      setInventory(mappedInventory);
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(mappedProducts));
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(mappedInventory));

      // Orders
      const ordersRes = await getOrders({ limit: 100 }).catch(() => null);
      if (ordersRes?.data) {
        const mapped = ordersRes.data.map(mapApiOrder);
        setOrders(mapped);
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(mapped));
      }

      // Customers are business profiles, not identity users.
      const customersRes = await getCustomers({ limit: 100 }).catch(() => null);
      if (customersRes?.data) {
        const mapped = customersRes.data.map(mapApiCustomer);
        setCustomers(mapped);
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(mapped));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser && backendOnline && getAccessToken()) {
      void refreshData().catch(() => {});
    }
  }, [currentUser, backendOnline, refreshData]);

  // ---- LOGIN ----
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    // Try real API
    let online = false;
    try {
      online = await isBackendAvailable();
    } catch {
      online = false;
    }
    setBackendOnline(online);

    if (online) {
      try {
        const apiUser = await loginUser({ email, password });
        if (apiUser.role !== 'ADMIN') {
          clearTokens();
          return false;
        } else {
          const adminUser = mapAdminUser(apiUser);
          setCurrentUser(adminUser);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(adminUser));
          return true;
        }
      } catch {
        clearTokens();
        return false;
      }
    }

    // Offline demo login.
    const user = MOCK_USERS.find(
      candidate =>
        candidate.email === email.toLowerCase() &&
        password === DEMO_ADMIN_PASSWORD,
    );
    if (user) {
      setCurrentUser(user);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    if (backendOnline && getAccessToken()) {
      logoutUser().catch(() => {});
    }
    setCurrentUser(null);
    clearTokens();
    localStorage.removeItem(STORAGE_KEYS.USER);
  }, [backendOnline]);

  // ---- Product CRUD ----
  const addProduct = useCallback(async (product: Omit<Product, 'id'>) => {
    if (backendOnline && getAccessToken()) {
      const slugBase = product.nombre
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const created = await apiCreateProduct({
        name: product.nombre,
        slug: `${slugBase}-${Date.now()}`,
        description: product.descripcion,
        category: product.categoria,
        price: product.precio,
        image_url: product.imagen,
        variant_name: product.presentacion,
        variant_attributes: { type: product.tipo },
        is_active: product.estado === 'activo',
      });
      const variant = created.variants.find(item => item.is_active) ?? created.variants[0];
      if (variant) {
        await createInitialStock(variant.id);
      }
      await refreshData();
      return;
    }

    const newProduct: Product = { ...product, id: Date.now().toString() };
    setProducts(prev => [...prev, newProduct]);
    setInventory(prev => [
      ...prev,
      { id: Date.now().toString(), productoId: newProduct.id, stockActual: 0, stockMinimo: 10, ubicacion: 'Bodega Principal' },
    ]);
  }, [backendOnline, refreshData]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    if (backendOnline && getAccessToken()) {
      await apiUpdateProduct(id, {
        name: updates.nombre,
        description: updates.descripcion,
        category: updates.categoria,
        price: updates.precio,
        image_url: updates.imagen,
        variant_name: updates.presentacion,
        variant_attributes: updates.tipo !== undefined ? { type: updates.tipo } : undefined,
        is_active: updates.estado !== undefined ? updates.estado === 'activo' : undefined,
      });
      await refreshData();
      return;
    }
    setProducts(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
  }, [backendOnline, refreshData]);

  const deleteProduct = useCallback(async (id: string) => {
    if (backendOnline && getAccessToken()) {
      await apiDeleteProduct(id);
      await refreshData();
      return;
    }
    setProducts(prev => prev.filter(p => p.id !== id));
    setInventory(prev => prev.filter(i => i.productoId !== id));
  }, [backendOnline, refreshData]);

  const updateInventory = useCallback(async (inventoryId: string, stock: number) => {
    if (backendOnline && getAccessToken()) {
      const inventoryItem = inventory.find(item => item.id === inventoryId);
      if (!inventoryItem?.varianteId || !inventoryItem.ubicacionId) {
        throw new Error('No se encontró la ubicación de inventario seleccionada.');
      }
      await setInventoryQuantity({
        variantId: inventoryItem.varianteId,
        locationId: inventoryItem.ubicacionId,
        quantity: inventoryItem.stockActual,
      }, stock);
      await refreshData();
      return;
    }
    setInventory(prev =>
      prev.map(inv => inv.id === inventoryId ? { ...inv, stockActual: stock } : inv),
    );
  }, [backendOnline, inventory, refreshData]);

  // ---- Order status update ----
  const updateOrderStatus = useCallback(async (orderId: string, status: Order['estado']) => {
    const statusMap: Record<Order['estado'], string> = {
      pendiente: 'pending',
      confirmado: 'confirmed',
      procesando: 'processing',
      pagado: 'confirmed',
      enviado: 'shipped',
      entregado: 'delivered',
      cancelado: 'cancelled',
    };

    if (backendOnline && getAccessToken()) {
      try {
        await apiUpdateOrderStatus(orderId, { status: statusMap[status] as 'pending' });
      } catch { /* fallback */ }
    }
    setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, estado: status } : o)));
  }, [backendOnline]);

  const addCustomer = async (customer: Omit<Customer, 'id' | 'totalCompras'>) => {
    if (backendOnline && getAccessToken()) {
      const nameParts = customer.nombre.trim().split(/\s+/);
      const created = await apiCreateCustomer({
        document_number: customer.documento,
        first_name: nameParts[0] ?? customer.nombre,
        last_name: nameParts.slice(1).join(' '),
        email: customer.email,
        phone: customer.telefono,
        address: customer.direccion,
        city: customer.ciudad,
        is_active: true,
      });
      setCustomers(prev => [...prev, mapApiCustomer(created)]);
      return;
    }

    const newCustomer: Customer = { ...customer, id: Date.now().toString(), totalCompras: 0 };
    setCustomers(prev => [...prev, newCustomer]);
  };

  return (
    <AdminContext.Provider
      value={{
        currentUser,
        products,
        inventory,
        orders,
        payments,
        customers,
        isLoading,
        backendOnline,
        login,
        logout,
        addProduct,
        updateProduct,
        deleteProduct,
        updateInventory,
        updateOrderStatus,
        addCustomer,
        refreshData,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error('useAdmin must be used within AdminProvider');
  return context;
}

// ============================================================
// AdminContext — Juhnios Rold Frontend
// Admin auth + data management with real API + localStorage fallback
// ============================================================

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { User, Product, Inventory, Order, Payment, Customer } from '../types/admin';
import {
  loginUser,
  getCurrentUser,
  logoutUser,
  type AuthUser,
} from '../services/auth.service';
import {
  getProducts,
  createProduct as apiCreateProduct,
  updateProduct as apiUpdateProduct,
  deleteProduct as apiDeleteProduct,
  updateProductStock as apiUpdateStock,
} from '../services/products.service';
import {
  getOrders,
  updateOrderStatus as apiUpdateOrderStatus,
  getOrderStats,
} from '../services/orders.service';
import { getAllUsers } from '../services/users.service';
import {
  getAccessToken,
  clearTokens,
  isBackendAvailable,
  setTokens,
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
  addCustomer: (customer: Omit<Customer, 'id' | 'totalCompras'>) => void;
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

// Mock admin users
const MOCK_USERS: User[] = [
  { id: '1', nombre: 'Admin Principal', email: 'admin@juhnios.com', rol: 'admin' },
  { id: '2', nombre: 'Vendedor 1', email: 'vendedor@juhnios.com', rol: 'vendedor' },
  { id: '3', nombre: 'Distribuidor', email: 'distribuidor@juhnios.com', rol: 'distribuidor' },
  { id: '4', nombre: 'Contador Principal', email: 'contador@juhnios.com', rol: 'contador' },
  { id: '5', nombre: 'Jefe de RRHH', email: 'rrhh@juhnios.com', rol: 'rrhh' },
  { id: '6', nombre: 'Abogado Corporativo', email: 'abogado@juhnios.com', rol: 'abogado' },
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
function mapApiProduct(p: {
  id: string; name: string; category: string; price: number;
  pro_price?: number; description: string; images?: string[];
  is_active?: boolean; stock?: number; short_description?: string;
}): Product {
  return {
    id: p.id,
    nombre: p.name,
    categoria: p.category as Product['categoria'],
    tipo: '',
    presentacion: '',
    precio: p.price,
    descripcion: p.description,
    imagen: p.images?.[0] ?? '',
    estado: p.is_active !== false ? 'activo' : 'inactivo',
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

export function AdminProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
    if (savedUser) setCurrentUser(JSON.parse(savedUser));

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
      // Products
      const prodRes = await getProducts({ limit: 100 }).catch(() => null);
      if (prodRes?.data) {
        const mapped = prodRes.data.map(mapApiProduct);
        setProducts(mapped);
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(mapped));
      }

      // Orders
      const ordersRes = await getOrders({ limit: 100 }).catch(() => null);
      if (ordersRes?.data) {
        const mapped = ordersRes.data.map(mapApiOrder);
        setOrders(mapped);
        localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(mapped));
      }

      // Customers
      const usersRes = await getAllUsers({ limit: 100 } as Parameters<typeof getAllUsers>[0]).catch(() => null);
      if (usersRes?.data) {
        const mapped: Customer[] = usersRes.data.map((u: AuthUser) => ({
          id: u.id,
          nombre: `${u.first_name} ${u.last_name}`.trim(),
          telefono: u.phone ?? '',
          email: u.email,
          direccion: '',
          ciudad: '',
          totalCompras: 0,
          ultimaCompra: u.updated_at,
        }));
        setCustomers(mapped);
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(mapped));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

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
        // Only allow admin roles
        if (!['ADMIN', 'SELLER', 'DISTRIBUTOR'].includes(apiUser.role)) {
          clearTokens();
          // Fall through to mock
        } else {
          const roleMap: Record<string, User['rol']> = {
            ADMIN: 'admin',
            SELLER: 'vendedor',
            DISTRIBUTOR: 'distribuidor',
          };
          const adminUser: User = {
            id: apiUser.id,
            nombre: `${apiUser.first_name} ${apiUser.last_name}`.trim(),
            email: apiUser.email,
            rol: roleMap[apiUser.role] ?? 'vendedor',
          };
          setCurrentUser(adminUser);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(adminUser));
          await refreshData();
          return true;
        }
      } catch { /* fallback */ }
    }

    // Mock login
    const user = MOCK_USERS.find(u => u.email === email);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      return true;
    }
    return false;
  }, [refreshData]);

  const logout = useCallback(() => {
    if (backendOnline && getAccessToken()) {
      logoutUser().catch(() => {});
    }
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.USER);
  }, [backendOnline]);

  // ---- Product CRUD ----
  const addProduct = useCallback(async (product: Omit<Product, 'id'>) => {
    if (backendOnline && getAccessToken()) {
      try {
        const created = await apiCreateProduct({
          name: product.nombre,
          slug: product.nombre.toLowerCase().replace(/\s+/g, '-'),
          description: product.descripcion,
          category: product.categoria as 'aceites',
          price: product.precio,
          pro_price: product.precio * 0.85,
          stock: 0,
          images: product.imagen ? [product.imagen] : [],
          is_active: product.estado === 'activo',
        });
        const mapped = mapApiProduct(created);
        setProducts(prev => [...prev, mapped]);
        setInventory(prev => [
          ...prev,
          { id: created.id + '_inv', productoId: created.id, stockActual: 0, stockMinimo: 10, ubicacion: 'Bodega Principal' },
        ]);
        return;
      } catch { /* fallback */ }
    }

    const newProduct: Product = { ...product, id: Date.now().toString() };
    setProducts(prev => [...prev, newProduct]);
    setInventory(prev => [
      ...prev,
      { id: Date.now().toString(), productoId: newProduct.id, stockActual: 0, stockMinimo: 10, ubicacion: 'Bodega Principal' },
    ]);
  }, [backendOnline]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    if (backendOnline && getAccessToken()) {
      try {
        await apiUpdateProduct(id, {
          name: updates.nombre,
          description: updates.descripcion,
          price: updates.precio,
          images: updates.imagen ? [updates.imagen] : undefined,
          is_active: updates.estado === 'activo',
        });
      } catch { /* fallback */ }
    }
    setProducts(prev => prev.map(p => (p.id === id ? { ...p, ...updates } : p)));
  }, [backendOnline]);

  const deleteProduct = useCallback(async (id: string) => {
    if (backendOnline && getAccessToken()) {
      try { await apiDeleteProduct(id); } catch { /* fallback */ }
    }
    setProducts(prev => prev.filter(p => p.id !== id));
    setInventory(prev => prev.filter(i => i.productoId !== id));
  }, [backendOnline]);

  const updateInventory = useCallback(async (productId: string, stock: number) => {
    if (backendOnline && getAccessToken()) {
      try { await apiUpdateStock(productId, stock, 'Admin manual update'); } catch { /* fallback */ }
    }
    setInventory(prev =>
      prev.map(inv => inv.productoId === productId ? { ...inv, stockActual: stock } : inv),
    );
  }, [backendOnline]);

  // ---- Order status update ----
  const updateOrderStatus = useCallback(async (orderId: string, status: Order['estado']) => {
    const statusMap: Record<Order['estado'], string> = {
      pendiente: 'pending',
      confirmado: 'confirmed',
      procesando: 'processing',
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

  // ---- Add customer (mock only) ----
  const addCustomer = (customer: Omit<Customer, 'id' | 'totalCompras'>) => {
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
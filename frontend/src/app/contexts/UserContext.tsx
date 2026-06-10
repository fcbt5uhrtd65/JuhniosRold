// ============================================================
// UserContext — Juhnios Rold Frontend
// Auth + saved products + orders with real API + localStorage fallback
// ============================================================

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  loginUser,
  registerUser,
  getCurrentUser,
  logoutUser,
  type AuthUser,
} from '../services/auth.service';
import {
  createOrder,
  getOrders,
  type Order,
  type CreateOrderPayload,
} from '../services/orders.service';
import { getAccessToken, clearTokens, isBackendAvailable } from '../services/api';

// ---- Normalised customer profile (compatible with legacy mock) ----
export interface CustomerUser {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  role?: AuthUser['role'];
  /** true when session comes from real backend JWT */
  fromApi?: boolean;
}

// ---- Legacy localStorage order format (used as fallback) ----
export interface CustomerOrder {
  id: string;
  order_number?: string;
  productos: Array<{
    productoId: string;
    nombre: string;
    cantidad: number;
    precio: number;
  }>;
  total: number;
  estado:
    | 'pendiente'
    | 'procesando'
    | 'enviado'
    | 'entregado'
    | 'cancelado'
    | 'confirmed'
    | 'processing'
    | 'shipped'
    | 'delivered'
    | 'refunded';
  fecha: string;
  direccionEnvio: string;
}

export interface SavedProduct {
  id: string;
  productoId: string;
  fecha: string;
}

interface UserContextType {
  currentUser: CustomerUser | null;
  savedProducts: SavedProduct[];
  orders: CustomerOrder[];
  isLoadingAuth: boolean;
  backendOnline: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (nombre: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  toggleSaveProduct: (productoId: string) => void;
  isProductSaved: (productoId: string) => boolean;
  addOrder: (
    order: Omit<CustomerOrder, 'id' | 'fecha'> & {
      apiPayload?: CreateOrderPayload;
    },
  ) => Promise<void>;
  loadOrders: () => Promise<void>;
  resetPassword: (email: string) => boolean;
  updateProfile: (updates: Partial<CustomerUser>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: 'customer_user',
  SAVED: 'customer_saved',
  ORDERS: 'customer_orders',
  USERS_DB: 'customer_users_db',
};

// ---- localStorage mock helpers ----
interface MockUser extends CustomerUser { password: string }

const getMockUsers = (): MockUser[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.USERS_DB);
  return stored ? JSON.parse(stored) : [];
};

const saveMockUsers = (users: MockUser[]) => {
  localStorage.setItem(STORAGE_KEYS.USERS_DB, JSON.stringify(users));
};

// ---- Map backend AuthUser → CustomerUser ----
function mapAuthUser(u: AuthUser): CustomerUser {
  const parts = `${u.first_name} ${u.last_name}`.trim();
  return {
    id: u.id,
    nombre: parts || u.email.split('@')[0],
    email: u.email,
    telefono: u.phone,
    role: u.role,
    fromApi: true,
  };
}

// ---- Map backend Order → CustomerOrder ----
function mapApiOrder(o: Order): CustomerOrder {
  return {
    id: o.id,
    order_number: o.order_number,
    productos: (o.items ?? []).map(item => ({
      productoId: item.product_id,
      nombre: item.product_name,
      cantidad: item.quantity,
      precio: item.unit_price,
    })),
    total: o.total_amount,
    estado: o.status as CustomerOrder['estado'],
    fecha: o.created_at,
    direccionEnvio: `${o.shipping_address.address_line1}, ${o.shipping_address.city}, ${o.shipping_address.department}`,
  };
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CustomerUser | null>(null);
  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);

  // ---- On mount: restore session ----
  useEffect(() => {
    async function restoreSession() {
      setIsLoadingAuth(true);

      // 1. Check if backend is reachable (fails silently if down)
      let online = false;
      try {
        online = await isBackendAvailable();
      } catch {
        online = false;
      }
      setBackendOnline(online);

      if (online && getAccessToken()) {
        try {
          const user = await getCurrentUser();
          setCurrentUser(mapAuthUser(user));
          loadLocalSaved();
          await fetchOrdersFromApi();
          setIsLoadingAuth(false);
          return;
        } catch {
          clearTokens();
        }
      }

      // 2. Fallback: restore from localStorage
      const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
      if (savedUser) {
        try { setCurrentUser(JSON.parse(savedUser)); } catch { /* ignore corrupt data */ }
      }

      loadLocalSaved();
      loadLocalOrders();
      setIsLoadingAuth(false);
    }

    restoreSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- localStorage helpers ----
  const loadLocalSaved = () => {
    const saved = localStorage.getItem(STORAGE_KEYS.SAVED);
    if (saved) setSavedProducts(JSON.parse(saved));
  };

  const loadLocalOrders = () => {
    const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
    if (saved) setOrders(JSON.parse(saved));
  };

  const fetchOrdersFromApi = async () => {
    try {
      const result = await getOrders({ limit: 50 });
      const mapped = result.data.map(mapApiOrder);
      setOrders(mapped);
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(mapped));
    } catch {
      loadLocalOrders();
    }
  };

  // Persist saved products
  useEffect(() => {
    if (savedProducts.length > 0) {
      localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(savedProducts));
    }
  }, [savedProducts]);

  // ---- LOGIN ----
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    // Try real API first
    const online = await isBackendAvailable();
    setBackendOnline(online);

    if (online) {
      try {
        const user = await loginUser({ email, password });
        const mapped = mapAuthUser(user);
        setCurrentUser(mapped);
        await fetchOrdersFromApi();
        return true;
      } catch {
        // Fall through to mock
      }
    }

    // Mock localStorage login
    const users = getMockUsers();
    const found = users.find(u => u.email === email && u.password === password);
    if (found) {
      const { password: _, ...withoutPw } = found;
      setCurrentUser(withoutPw);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(withoutPw));
      loadLocalOrders();
      return true;
    }
    return false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- REGISTER ----
  const register = useCallback(async (
    nombre: string,
    email: string,
    password: string,
  ): Promise<boolean> => {
    const online = await isBackendAvailable();
    setBackendOnline(online);

    if (online) {
      try {
        const parts = nombre.trim().split(' ');
        const first_name = parts[0] ?? nombre;
        const last_name = parts.slice(1).join(' ') || '';
        const user = await registerUser({ first_name, last_name, email, password });
        setCurrentUser(mapAuthUser(user));
        return true;
      } catch {
        // Check duplicate email in mock
      }
    }

    // Mock register
    const users = getMockUsers();
    if (users.find(u => u.email === email)) return false;

    const newUser: MockUser = {
      id: Date.now().toString(),
      nombre,
      email,
      password,
    };
    users.push(newUser);
    saveMockUsers(users);

    const { password: _, ...withoutPw } = newUser;
    setCurrentUser(withoutPw);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(withoutPw));
    return true;
  }, []);

  // ---- LOGOUT ----
  const logout = useCallback(async () => {
    if (backendOnline && getAccessToken()) {
      try { await logoutUser(); } catch { /* ignore */ }
    }
    setCurrentUser(null);
    setOrders([]);
    localStorage.removeItem(STORAGE_KEYS.USER);
  }, [backendOnline]);

  // ---- SAVED PRODUCTS ----
  const toggleSaveProduct = (productoId: string) => {
    setSavedProducts(prev => {
      const exists = prev.find(sp => sp.productoId === productoId);
      const updated = exists
        ? prev.filter(sp => sp.productoId !== productoId)
        : [...prev, { id: Date.now().toString(), productoId, fecha: new Date().toISOString() }];
      localStorage.setItem(STORAGE_KEYS.SAVED, JSON.stringify(updated));
      return updated;
    });
  };

  const isProductSaved = (productoId: string): boolean =>
    savedProducts.some(sp => sp.productoId === productoId);

  // ---- ADD ORDER ----
  const addOrder = useCallback(async (
    orderData: Omit<CustomerOrder, 'id' | 'fecha'> & { apiPayload?: CreateOrderPayload },
  ) => {
    // Try real API
    if (backendOnline && getAccessToken() && orderData.apiPayload) {
      try {
        const created = await createOrder(orderData.apiPayload);
        const mapped = mapApiOrder(created);
        setOrders(prev => {
          const updated = [...prev, mapped];
          localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updated));
          return updated;
        });
        return;
      } catch { /* fallback */ }
    }

    // localStorage fallback
    const newOrder: CustomerOrder = {
      ...orderData,
      id: Date.now().toString(),
      fecha: new Date().toISOString(),
    };
    setOrders(prev => {
      const updated = [...prev, newOrder];
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updated));
      return updated;
    });
  }, [backendOnline]);

  // ---- LOAD ORDERS ----
  const loadOrders = useCallback(async () => {
    if (backendOnline && getAccessToken()) {
      await fetchOrdersFromApi();
    } else {
      loadLocalOrders();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendOnline]);

  // ---- RESET PASSWORD (mock only) ----
  const resetPassword = (email: string): boolean => {
    const users = getMockUsers();
    const idx = users.findIndex(u => u.email === email);
    if (idx === -1) return false;

    const tempPassword = Math.random().toString(36).slice(-8);
    users[idx].password = tempPassword;
    saveMockUsers(users);
    alert(`Tu contraseña temporal es: ${tempPassword}\n\nEn producción, esto se enviará a tu correo.`);
    return true;
  };

  // ---- UPDATE PROFILE ----
  const updateProfile = (updates: Partial<CustomerUser>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...updates };
    setCurrentUser(updated);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));

    const users = getMockUsers();
    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...updates };
      saveMockUsers(users);
    }
  };

  return (
    <UserContext.Provider
      value={{
        currentUser,
        savedProducts,
        orders,
        isLoadingAuth,
        backendOnline,
        login,
        register,
        logout,
        toggleSaveProduct,
        isProductSaved,
        addOrder,
        loadOrders,
        resetPassword,
        updateProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
}
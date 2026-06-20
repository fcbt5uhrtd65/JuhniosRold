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
  startRegistration,
  verifyRegistrationCode,
  resendRegistrationCode,
  getCurrentUser,
  logoutUser,
  requestPasswordResetCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
  type AuthUser,
} from '../services/auth.service';
import {
  createOrder,
  getOrders,
  type Order,
  type CreateOrderPayload,
} from '../services/orders.service';
import {
  ApiError,
  getAccessToken,
  clearTokens,
  onAuthSessionInvalidated,
  isBackendAvailable,
} from '../services/api';

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
    | 'pending'
    | 'payment_pending'
    | 'paid'
    | 'failed'
    | 'confirmed'
    | 'processing'
    | 'packed'
    | 'shipped'
    | 'in_transit'
    | 'delivered'
    | 'returned'
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
  login: (email: string, password: string) => Promise<AuthActionResult>;
  register: (
    nombre: string,
    email: string,
    password: string,
    extra?: {
      phone?: string;
      address?: string;
      city?: string;
      document_type?: string;
      document_number?: string;
    },
  ) => Promise<RegistrationActionResult>;
  verifyRegistration: (
    verificationId: string,
    code: string,
  ) => Promise<AuthActionResult>;
  resendRegistrationCode: (
    verificationId: string,
  ) => Promise<RegistrationActionResult>;
  logout: () => Promise<void>;
  toggleSaveProduct: (productoId: string) => void;
  isProductSaved: (productoId: string) => boolean;
  addOrder: (
    order: Omit<CustomerOrder, 'id' | 'fecha'> & {
      apiPayload?: CreateOrderPayload;
    },
  ) => Promise<void>;
  loadOrders: () => Promise<void>;
  resetPassword: (email: string) => Promise<RegistrationActionResult>;
  verifyPasswordReset: (
    verificationId: string,
    code: string,
  ) => Promise<PasswordResetVerifyActionResult>;
  confirmPasswordReset: (
    resetToken: string,
    newPassword: string,
  ) => Promise<AuthActionResult>;
  updateProfile: (updates: Partial<CustomerUser>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: 'customer_user',
  SAVED: 'customer_saved',
  ORDERS: 'customer_orders',
  USERS_DB: 'customer_users_db',
};

const CUSTOMER_ROLES = new Set<AuthUser['role']>(['CLIENT', 'PRO']);

interface AuthActionResult {
  ok: boolean;
  message?: string;
}

interface RegistrationActionResult extends AuthActionResult {
  verificationId?: string;
  email?: string;
  expiresAt?: string;
  debugCode?: string;
}

interface PasswordResetVerifyActionResult extends AuthActionResult {
  resetToken?: string;
}

function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.errors?.join(' ') || error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

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

function isCustomerUser(user: AuthUser): boolean {
  return CUSTOMER_ROLES.has(user.role);
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

  const resetUserSession = useCallback(() => {
    setCurrentUser(null);
    setSavedProducts([]);
    setOrders([]);
    setBackendOnline(false);
    setIsLoadingAuth(false);
  }, []);

  // ---- On mount: restore session ----
  useEffect(() => {
    async function restoreSession() {
      setIsLoadingAuth(true);
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.USERS_DB);

      if (getAccessToken()) {
        try {
          const user = await getCurrentUser();
          setBackendOnline(true);
          if (!isCustomerUser(user)) {
            setCurrentUser(null);
            setOrders([]);
            loadLocalSaved();
            setIsLoadingAuth(false);
            return;
          }
          setCurrentUser(mapAuthUser(user));
          loadLocalSaved();
          await fetchOrdersFromApi();
          setIsLoadingAuth(false);
          return;
        } catch (error) {
          const serverResponded = error instanceof ApiError;
          setBackendOnline(serverResponded);
          if (serverResponded && error.status === 401) {
            clearTokens();
            resetUserSession();
            return;
          }
        }
      } else {
        const online = await isBackendAvailable().catch(() => false);
        setBackendOnline(online);
      }

      loadLocalSaved();
      loadLocalOrders();
      setIsLoadingAuth(false);
    }

    restoreSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return onAuthSessionInvalidated(() => {
      resetUserSession();
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.USERS_DB);
    });
  }, [resetUserSession]);

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
  const login = useCallback(async (
    email: string,
    password: string,
  ): Promise<AuthActionResult> => {
    try {
      const user = await loginUser({
        email: email.trim().toLowerCase(),
        password,
      });
      setBackendOnline(true);
      if (!isCustomerUser(user)) {
        setCurrentUser(null);
        return {
          ok: false,
          message: 'Esta cuenta pertenece al panel interno. Usa el acceso administrativo.',
        };
      }
      const mapped = mapAuthUser(user);
      setCurrentUser(mapped);
      await fetchOrdersFromApi();
      return { ok: true };
    } catch (error) {
      clearTokens();
      const serverResponded = error instanceof ApiError;
      setBackendOnline(serverResponded);
      return {
        ok: false,
        message: serverResponded
          ? authErrorMessage(error, 'Email o contraseña incorrectos.')
          : 'No hay conexión con el servidor. Intenta nuevamente.',
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- REGISTER ----
  const register = useCallback(async (
    nombre: string,
    email: string,
    password: string,
    extra?: {
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
      country?: string;
      latitude?: number | null;
      longitude?: number | null;
      reference?: string;
      document_type?: string;
      document_number?: string;
    },
  ): Promise<AuthActionResult> => {
    try {
      const parts = nombre.trim().split(/\s+/);
      const first_name = parts[0] ?? nombre;
      const last_name = parts.slice(1).join(' ');
      const verification = await startRegistration({
        first_name,
        last_name,
        email: email.trim().toLowerCase(),
        password,
        phone: extra?.phone,
        address: extra?.address,
        city: extra?.city,
        state: extra?.state,
        country: extra?.country,
        latitude: extra?.latitude,
        longitude: extra?.longitude,
        reference: extra?.reference,
        document_type: extra?.document_type,
        document_number: extra?.document_number,
      });
      setBackendOnline(true);
      return {
        ok: true,
        message: verification.message,
        verificationId: verification.verification_id,
        email: verification.email,
        expiresAt: verification.expires_at,
        debugCode: verification.debug_code,
      };
    } catch (error) {
      clearTokens();
      const serverResponded = error instanceof ApiError;
      setBackendOnline(serverResponded);
      return {
        ok: false,
        message: serverResponded
          ? authErrorMessage(error, 'No fue posible crear la cuenta.')
          : 'No hay conexión con el servidor. No se creó ninguna cuenta.',
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verifyRegistration = useCallback(async (
    verificationId: string,
    code: string,
  ): Promise<AuthActionResult> => {
    try {
      const user = await verifyRegistrationCode(verificationId, code);
      setBackendOnline(true);
      if (!isCustomerUser(user)) {
        setCurrentUser(null);
        return {
          ok: false,
          message: 'Esta cuenta pertenece al panel interno. Usa el acceso administrativo.',
        };
      }
      setCurrentUser(mapAuthUser(user));
      await fetchOrdersFromApi();
      return { ok: true };
    } catch (error) {
      clearTokens();
      const serverResponded = error instanceof ApiError;
      setBackendOnline(serverResponded);
      return {
        ok: false,
        message: serverResponded
          ? authErrorMessage(error, 'No fue posible verificar el codigo.')
          : 'No hay conexión con el servidor. Intenta nuevamente.',
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resendRegistration = useCallback(async (
    verificationId: string,
  ): Promise<RegistrationActionResult> => {
    try {
      const verification = await resendRegistrationCode(verificationId);
      setBackendOnline(true);
      return {
        ok: true,
        message: verification.message,
        verificationId: verification.verification_id,
        email: verification.email,
        expiresAt: verification.expires_at,
        debugCode: verification.debug_code,
      };
    } catch (error) {
      const serverResponded = error instanceof ApiError;
      setBackendOnline(serverResponded);
      return {
        ok: false,
        message: serverResponded
          ? authErrorMessage(error, 'No fue posible reenviar el codigo.')
          : 'No hay conexión con el servidor. Intenta nuevamente.',
      };
    }
  }, []);

  // ---- LOGOUT ----
  const logout = useCallback(async () => {
    if (backendOnline && getAccessToken()) {
      try { await logoutUser(); } catch { /* ignore */ }
    }
    resetUserSession();
    localStorage.removeItem(STORAGE_KEYS.USER);
  }, [backendOnline, resetUserSession]);

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

  const resetPassword = async (email: string): Promise<RegistrationActionResult> => {
    try {
      const result = await requestPasswordResetCode(email);
      setBackendOnline(true);
      return {
        ok: true,
        message: result.message,
        verificationId: result.verification_id,
        email: result.email,
        expiresAt: result.expires_at,
        debugCode: result.debug_code,
      };
    } catch (error) {
      const serverResponded = error instanceof ApiError;
      setBackendOnline(serverResponded);
      return {
        ok: false,
        message: serverResponded
          ? authErrorMessage(
              error,
              'No fue posible solicitar la recuperación de contraseña.',
            )
          : 'No hay conexión con el servidor.',
      };
    }
  };

  const verifyPasswordReset = async (
    verificationId: string,
    code: string,
  ): Promise<PasswordResetVerifyActionResult> => {
    try {
      const result = await verifyPasswordResetCode(verificationId, code);
      setBackendOnline(true);
      return {
        ok: true,
        message: result.message,
        resetToken: result.reset_token,
      };
    } catch (error) {
      const serverResponded = error instanceof ApiError;
      setBackendOnline(serverResponded);
      return {
        ok: false,
        message: serverResponded
          ? authErrorMessage(error, 'No fue posible verificar el codigo.')
          : 'No hay conexión con el servidor.',
      };
    }
  };

  const confirmResetPassword = async (
    resetToken: string,
    newPassword: string,
  ): Promise<AuthActionResult> => {
    try {
      await confirmPasswordReset(resetToken, newPassword);
      setBackendOnline(true);
      return { ok: true };
    } catch (error) {
      const serverResponded = error instanceof ApiError;
      setBackendOnline(serverResponded);
      return {
        ok: false,
        message: serverResponded
          ? authErrorMessage(error, 'No fue posible restablecer la contraseña.')
          : 'No hay conexión con el servidor.',
      };
    }
  };

  // ---- UPDATE PROFILE ----
  const updateProfile = (updates: Partial<CustomerUser>) => {
    if (!currentUser) return;
    const updated = { ...currentUser, ...updates };
    setCurrentUser(updated);
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
        verifyRegistration,
        resendRegistrationCode: resendRegistration,
        logout,
        toggleSaveProduct,
        isProductSaved,
        addOrder,
        loadOrders,
        resetPassword,
        verifyPasswordReset,
        confirmPasswordReset: confirmResetPassword,
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

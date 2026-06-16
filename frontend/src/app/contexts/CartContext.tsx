import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  addActiveCartItem,
  clearActiveCart,
  getActiveCart,
  removeActiveCartItem,
  updateActiveCartItem,
  type BackendCart,
} from '../services/cart.service';
import { useToast } from './ToastContext';
import { useUser } from './UserContext';

export interface CartItem {
  id: string;
  variantId: string;
  name: string;
  category: string;
  size: string;
  price: number;
  quantity: number;
  image: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (
    item: Omit<CartItem, 'id' | 'quantity' | 'variantId'> & {
      variantId?: string;
      quantity?: number;
    },
  ) => Promise<boolean>;
  removeItem: (id: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  reloadCart: () => Promise<void>;
  isLoading: boolean;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

function mapCart(cart: BackendCart): CartItem[] {
  return cart.items.map((item) => ({
    id: item.id,
    variantId: item.variant_id,
    name: item.product_name,
    category: item.category,
    size: item.presentation,
    price: Number(item.unit_price ?? 0),
    quantity: Number(item.quantity),
    image: item.image_url,
  }));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useUser();
  const toast = useToast();
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const canUseApiCart =
    currentUser?.fromApi === true &&
    (currentUser.role === 'CLIENT' || currentUser.role === 'PRO');

  const reloadCart = useCallback(async () => {
    if (!canUseApiCart) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    try {
      setItems(mapCart(await getActiveCart()));
      localStorage.removeItem('cart_items');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No fue posible cargar el carrito.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [canUseApiCart, toast]);

  useEffect(() => {
    void reloadCart();
  }, [reloadCart]);

  const addItem = useCallback(
    async (
      item: Omit<CartItem, 'id' | 'quantity' | 'variantId'> & {
        variantId?: string;
        quantity?: number;
      },
    ) => {
      if (!canUseApiCart) {
        toast.info('Inicia sesión para guardar productos en tu carrito.');
        return false;
      }
      if (!item.variantId) {
        toast.warning('Este producto solo puede comprarse desde el catálogo conectado.');
        return false;
      }
      try {
        setItems(mapCart(await addActiveCartItem(item.variantId, item.quantity ?? 1)));
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'No fue posible agregar el producto.',
        );
        return false;
      }
    },
    [canUseApiCart, toast],
  );

  const updateQuantity = useCallback(
    async (id: string, quantity: number) => {
      try {
        if (quantity <= 0) {
          setItems(mapCart(await removeActiveCartItem(id)));
          return;
        }
        setItems((current) =>
          current.map((item) => (item.id === id ? { ...item, quantity } : item)),
        );
        setItems(mapCart(await updateActiveCartItem(id, quantity)));
      } catch (error) {
        await reloadCart();
        toast.error(
          error instanceof Error
            ? error.message
            : 'No fue posible actualizar la cantidad.',
        );
      }
    },
    [reloadCart, toast],
  );

  const removeItem = useCallback(
    async (id: string) => {
      try {
        setItems(mapCart(await removeActiveCartItem(id)));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'No fue posible retirar el producto.',
        );
      }
    },
    [toast],
  );

  const clearCart = useCallback(async () => {
    if (!canUseApiCart) {
      setItems([]);
      return;
    }
    try {
      setItems(mapCart(await clearActiveCart()));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No fue posible vaciar el carrito.',
      );
    }
  }, [canUseApiCart, toast]);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );
  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        reloadCart,
        isLoading,
        total,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}

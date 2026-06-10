import { motion } from 'motion/react';
import { X, Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useCart } from '../contexts/CartContext';
import { useAdmin } from '../contexts/AdminContext';

interface SavedProductsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SavedProducts({ isOpen, onClose }: SavedProductsProps) {
  const { savedProducts, toggleSaveProduct } = useUser();
  const { addItem } = useCart();
  const { products } = useAdmin();

  if (!isOpen) return null;

  // Get full product details for saved items
  const savedProductsWithDetails = savedProducts
    .map((saved) => {
      const product = products.find((p) => p.id === saved.productoId);
      return product ? { ...product, savedDate: saved.fecha } : null;
    })
    .filter((p) => p !== null);

  const handleAddToCart = (product: any) => {
    addItem({
      id: product.id,
      name: product.nombre,
      price: product.precio,
      image: product.imagen || 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=600&q=80',
      size: product.presentacion,
      quantity: 1,
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-foreground/40 z-50"
      />

      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.3 }}
        className="fixed top-0 right-0 bottom-0 w-full max-w-2xl bg-background z-50 flex flex-col"
      >
        {/* Header */}
        <div className="p-8 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-xs tracking-[0.2em] uppercase mb-2">
              Productos Guardados
            </div>
            <div className="text-xs text-muted-foreground">
              {savedProductsWithDetails.length} {savedProductsWithDetails.length === 1 ? 'producto' : 'productos'}
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:opacity-50 transition-opacity"
          >
            <X className="w-5 h-5" strokeWidth={1} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {savedProductsWithDetails.length === 0 ? (
            <div className="text-center py-20">
              <Heart className="w-16 h-16 mx-auto mb-4 text-muted-foreground/40" strokeWidth={1} />
              <div className="text-sm text-muted-foreground mb-2">
                No tienes productos guardados
              </div>
              <div className="text-xs text-muted-foreground">
                Guarda tus productos favoritos para verlos después
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {savedProductsWithDetails.map((product: any) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="border border-border group hover:border-foreground/20 transition-colors"
                >
                  {/* Product Image */}
                  <div className="relative aspect-square overflow-hidden bg-secondary">
                    <img
                      src={product.imagen || 'https://images.unsplash.com/photo-1571875257727-256c39da42af?w=600&q=80'}
                      alt={product.nombre}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Remove Button */}
                    <button
                      onClick={() => toggleSaveProduct(product.id)}
                      className="absolute top-3 right-3 p-2 bg-background/90 hover:bg-background transition-colors"
                      title="Quitar de guardados"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1} />
                    </button>

                    {/* Badge if on sale or featured */}
                    {product.estado === 'destacado' && (
                      <div className="absolute top-3 left-3 px-3 py-1 bg-foreground text-background text-[9px] tracking-wider uppercase">
                        Destacado
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4">
                    <div className="mb-3">
                      <div className="text-[10px] tracking-wider uppercase text-muted-foreground mb-1">
                        {product.tipo}
                      </div>
                      <div className="text-sm mb-1">{product.nombre}</div>
                      <div className="text-xs text-muted-foreground">
                        {product.presentacion}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-lg">
                        ${product.precio.toLocaleString('es-CO')}
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAddToCart(product)}
                        className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-[10px] tracking-wider uppercase hover:opacity-90 transition-opacity"
                      >
                        <ShoppingCart className="w-3 h-3" strokeWidth={1} />
                        Agregar
                      </motion.button>
                    </div>

                    {/* Saved Date */}
                    <div className="mt-3 pt-3 border-t border-border text-[9px] text-muted-foreground">
                      Guardado el {new Date(product.savedDate).toLocaleDateString('es-CO', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {savedProductsWithDetails.length > 0 && (
          <div className="p-8 border-t border-border">
            <button
              onClick={onClose}
              className="w-full py-4 border border-border text-xs tracking-wider uppercase hover:bg-secondary transition-colors"
            >
              Continuar navegando
            </button>
          </div>
        )}
      </motion.div>
    </>
  );
}

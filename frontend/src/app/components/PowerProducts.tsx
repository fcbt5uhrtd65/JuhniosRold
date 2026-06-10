import { useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'motion/react';
import { ShoppingBag, Eye, Package, Heart, Star, X } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';

interface Product {
  name: string;
  category: string;
  price: string;
  image: string;
  number: string;
  stock?: number;
  viewing?: number;
  id: string;
  sizes?: string[];
  description?: string;
  benefits?: string[];
  ingredients?: string[];
}

interface ProductCardProps {
  product: Product;
  index: number;
  onQuickView: (product: Product) => void;
  onViewDetails: (product: Product) => void;
  onAddToCart: (product: Product) => void;
}

function ProductCard({ product, index, onQuickView, onViewDetails, onAddToCart }: ProductCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-100, 100], [2, -2]));
  const rotateY = useSpring(useTransform(x, [-100, 100], [-2, 2]));

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set(e.clientX - centerX);
    y.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, delay: index * 0.1 }}
      className="group"
    >
      <div className="grid md:grid-cols-12 gap-5 md:gap-8 items-center">
        <div className="hidden md:block md:col-span-1 text-muted-foreground text-xs mono">
          {product.number}
        </div>

        <motion.div
          className="md:col-span-5 aspect-[4/5] bg-secondary overflow-hidden relative cursor-pointer"
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={handleMouseLeave}
          style={{
            rotateX,
            rotateY,
            transformStyle: "preserve-3d"
          }}
        >
          <motion.img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            animate={{
              scale: isHovered ? 1.08 : 1
            }}
            transition={{ duration: 0.6 }}
          />

          {/* Hover Overlay */}
          <motion.div
            className="absolute inset-0 bg-foreground/80 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.button
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: isHovered ? 1 : 0.8,
                opacity: isHovered ? 1 : 0
              }}
              transition={{ delay: 0.1 }}
              onClick={() => onQuickView(product)}
              className="flex items-center gap-2 px-6 py-3 bg-background text-foreground text-xs tracking-wider uppercase hover:scale-105 transition-transform"
            >
              <Eye className="w-4 h-4" strokeWidth={1} />
              Vista rápida
            </motion.button>
          </motion.div>

          {/* Badges */}
          {product.stock && product.stock <= 10 && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-4 left-4 bg-background px-3 py-1.5 text-xs tracking-wider uppercase flex items-center gap-2"
            >
              <Package className="w-3 h-3" strokeWidth={1} />
              Solo quedan {product.stock}
            </motion.div>
          )}
          {product.viewing && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute bottom-4 right-4 bg-background/90 backdrop-blur-sm px-3 py-1.5 text-xs flex items-center gap-2"
            >
              <Eye className="w-3 h-3" strokeWidth={1} />
              {product.viewing} viendo
            </motion.div>
          )}
        </motion.div>

        <div className="md:col-span-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 + 0.2 }}
            className="flex items-center gap-3 text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-4"
          >
            <span className="md:hidden text-muted-foreground/60">{product.number}</span>
            {product.category}
          </motion.div>

          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 + 0.3 }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 leading-tight"
          >
            {product.name}
          </motion.h3>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 + 0.4 }}
            className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-lg"
          >
            Formulado con ingredientes naturales de la más alta calidad para resultados profesionales.
            Diseñado para uso diario y cuidado intensivo del cabello.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 + 0.5 }}
            className="flex items-baseline gap-3 mb-8"
          >
            <div className="text-3xl">${product.price}</div>
            <div className="text-xs text-muted-foreground">COP</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 + 0.6 }}
            className="flex flex-col sm:flex-row gap-3 md:gap-4"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onAddToCart(product)}
              className="px-6 py-3 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90 transition-opacity"
            >
              Añadir al carrito
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onViewDetails(product)}
              className="px-6 py-3 border border-border text-xs tracking-wider uppercase hover:bg-secondary transition-colors"
            >
              Ver detalles
            </motion.button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.1 + 0.7 }}
            className="mt-8 pt-6 border-t border-border"
          >
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <div className="text-muted-foreground mb-1">Tipo</div>
                <div>Natural</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Tamaños</div>
                <div>8ml - 120ml</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Stock</div>
                <div>{product.stock ? `${product.stock} unidades` : 'Disponible'}</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {index < 2 && (
        <div className="mt-16 h-px bg-border"></div>
      )}
    </motion.div>
  );
}

export function PowerProducts() {
  const { toggleSaveProduct, isProductSaved } = useUser();
  const { addItem } = useCart();
  const toast = useToast();
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [detailsProduct, setDetailsProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<Record<string, string>>({});

  const handleAddToCart = (product: Product, closeModal?: () => void) => {
    const size = selectedSize[product.id] || product.sizes?.[0] || '120ml';
    addItem({
      id: `${product.id}-${size}`,
      name: product.name,
      category: product.category,
      size,
      price: parseFloat(product.price.replace('.', '')),
      image: product.image,
    });
    toast.success(`${product.name} añadido al carrito`);
    if (closeModal) closeModal();
  };

  const handleToggleSave = (productId: string, productName: string) => {
    const wasSaved = isProductSaved(productId);
    toggleSaveProduct(productId);
    if (wasSaved) {
      toast.info(`${productName} eliminado de guardados`);
    } else {
      toast.success(`${productName} guardado para después`);
    }
  };

  const products: Product[] = [
    {
      id: "aceite-romero",
      name: "Aceite de Romero",
      category: "Aceites Capilares",
      price: "28.900",
      image: "https://images.unsplash.com/photo-1571875257727-256c39da42af?w=600&q=80",
      number: "01",
      stock: 8,
      viewing: 12,
      sizes: ['8ml', '60ml', '120ml'],
      description: 'Estimula el crecimiento capilar de forma natural. Rico en antioxidantes y nutrientes esenciales para un cabello saludable.',
      benefits: [
        'Estimula el crecimiento del cabello',
        'Fortalece las raíces',
        'Previene la caída',
        'Aporta brillo natural'
      ],
      ingredients: ['Aceite de romero', 'Vitamina E', 'Extracto de menta', 'Aceite de jojoba']
    },
    {
      id: "silicona-lino",
      name: "Silicona de Lino",
      category: "Siliconas Capilares",
      price: "24.900",
      image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&q=80",
      number: "02",
      viewing: 5,
      sizes: ['8ml', '30ml', '50ml'],
      description: 'Protección térmica superior con acabado sedoso. Controla el frizz y aporta brillo instantáneo sin dejar residuos.',
      benefits: [
        'Protección térmica hasta 230°C',
        'Control de frizz duradero',
        'Brillo intenso',
        'Textura sedosa'
      ],
      ingredients: ['Aceite de lino', 'Ciclometicona', 'Dimeticona', 'Vitamina E']
    },
    {
      id: "tratamiento-keratina",
      name: "Tratamiento Keratina",
      category: "Tratamientos",
      price: "38.900",
      image: "https://images.unsplash.com/photo-1519415510236-718bdfcd89c8?w=600&q=80",
      number: "03",
      stock: 3,
      viewing: 18,
      sizes: ['30gr', '220gr'],
      description: 'Reconstrucción profunda del cabello dañado. Resultados visibles desde la primera aplicación con tecnología de keratina hidrolizada.',
      benefits: [
        'Repara el cabello dañado',
        'Reconstrucción profunda',
        'Suavidad extrema',
        'Efecto liso prolongado'
      ],
      ingredients: ['Keratina hidrolizada', 'Colágeno', 'Aminoácidos', 'Pantenol', 'Aceite de argán']
    }
  ];

  return (
    <section id="productos" className="py-20 bg-background">
      <div className="max-w-[1400px] mx-auto px-8 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
                PRODUCTOS DESTACADOS
              </div>
              <h2 className="text-4xl md:text-5xl leading-none">
                Esenciales
              </h2>
            </div>
            <button className="hidden md:block text-xs tracking-wider uppercase border-b border-foreground pb-1 hover:opacity-50 transition-opacity">
              Ver todo →
            </button>
          </div>
        </motion.div>

        <div className="space-y-16">
          {products.map((product, index) => (
            <ProductCard
              key={product.number}
              product={product}
              index={index}
              onQuickView={setQuickViewProduct}
              onViewDetails={setDetailsProduct}
              onAddToCart={handleAddToCart}
            />
          ))}
        </div>
      </div>

      {/* Quick View Modal */}
      <AnimatePresence>
        {quickViewProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQuickViewProduct(null)}
              className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-background border border-border z-50 max-h-[90vh] overflow-y-auto"
            >
              <div className="grid md:grid-cols-2">
                {/* Image */}
                <div className="aspect-[4/3] md:aspect-square bg-secondary relative">
                  <img
                    src={quickViewProduct.image}
                    alt={quickViewProduct.name}
                    className="w-full h-full object-cover"
                  />
                  {quickViewProduct.stock && quickViewProduct.stock <= 10 && (
                    <div className="absolute top-6 left-6 bg-foreground text-background px-4 py-2 text-[10px] tracking-[0.2em] uppercase font-medium flex items-center gap-2">
                      <Package className="w-3 h-3" strokeWidth={1.5} />
                      Solo quedan {quickViewProduct.stock}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-6 md:p-12 flex flex-col">
                  <button
                    onClick={() => setQuickViewProduct(null)}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors text-2xl leading-none"
                    aria-label="Cerrar vista rápida"
                  >
                    <X className="w-5 h-5" strokeWidth={1} />
                  </button>

                  <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
                    {quickViewProduct.category}
                  </div>

                  <h2 className="text-3xl md:text-4xl mb-4 leading-tight">
                    {quickViewProduct.name}
                  </h2>

                  {quickViewProduct.description && (
                    <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                      {quickViewProduct.description}
                    </p>
                  )}

                  <div className="text-3xl mb-6">${quickViewProduct.price}</div>

                  {/* Size Selector */}
                  {quickViewProduct.sizes && (
                    <div className="mb-8">
                      <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                        Tamaño
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {quickViewProduct.sizes.map((size) => (
                          <button
                            key={size}
                            onClick={() => setSelectedSize({ ...selectedSize, [quickViewProduct.id]: size })}
                            className={`px-4 py-2 text-xs border transition-all ${
                              selectedSize[quickViewProduct.id] === size
                                ? 'bg-foreground text-background border-foreground'
                                : 'border-border hover:border-foreground'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 mt-auto">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAddToCart(quickViewProduct, () => setQuickViewProduct(null))}
                      className="flex-1 py-4 bg-foreground text-background text-xs tracking-[0.25em] uppercase hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
                      Añadir al carrito
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleToggleSave(quickViewProduct.id, quickViewProduct.name)}
                      className={`p-4 border border-border hover:border-foreground transition-colors ${
                        isProductSaved(quickViewProduct.id) ? 'bg-foreground text-background border-foreground' : ''
                      }`}
                      aria-label="Guardar"
                    >
                      <Heart
                        className={`w-4 h-4 ${isProductSaved(quickViewProduct.id) ? 'fill-current' : ''}`}
                        strokeWidth={1.5}
                      />
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence>
        {detailsProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailsProduct(null)}
              className="fixed inset-0 bg-foreground/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl bg-background border border-border z-50 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setDetailsProduct(null)}
                className="absolute top-6 right-6 text-muted-foreground hover:text-foreground transition-colors z-10"
                aria-label="Cerrar detalles"
              >
                <X className="w-6 h-6" strokeWidth={1} />
              </button>

              <div className="grid md:grid-cols-2">
                {/* Image Section */}
                <div className="relative bg-secondary">
                  <div className="aspect-square">
                    <img
                      src={detailsProduct.image}
                      alt={detailsProduct.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {detailsProduct.stock && detailsProduct.stock <= 10 && (
                    <div className="absolute top-6 left-6 bg-foreground text-background px-4 py-2 text-[10px] tracking-[0.2em] uppercase font-medium flex items-center gap-2">
                      <Package className="w-3 h-3" strokeWidth={1.5} />
                      Solo {detailsProduct.stock} disponibles
                    </div>
                  )}
                </div>

                {/* Content Section */}
                <div className="p-8 md:p-12">
                  <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
                    {detailsProduct.category}
                  </div>

                  <h2 className="text-4xl md:text-5xl mb-6 leading-tight">
                    {detailsProduct.name}
                  </h2>

                  <div className="text-4xl mb-8">${detailsProduct.price}</div>

                  {detailsProduct.description && (
                    <div className="mb-8">
                      <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                        Descripción
                      </div>
                      <p className="text-sm leading-relaxed">
                        {detailsProduct.description}
                      </p>
                    </div>
                  )}

                  {/* Benefits */}
                  {detailsProduct.benefits && detailsProduct.benefits.length > 0 && (
                    <div className="mb-8">
                      <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-4">
                        Beneficios
                      </div>
                      <ul className="space-y-2">
                        {detailsProduct.benefits.map((benefit, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Star className="w-3 h-3 mt-1 flex-shrink-0 fill-foreground" strokeWidth={1} />
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Ingredients */}
                  {detailsProduct.ingredients && detailsProduct.ingredients.length > 0 && (
                    <div className="mb-8 pb-8 border-b border-border">
                      <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                        Ingredientes Principales
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {detailsProduct.ingredients.map((ingredient, idx) => (
                          <span key={idx} className="px-3 py-1 bg-secondary text-xs border border-border">
                            {ingredient}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Size Selector */}
                  {detailsProduct.sizes && (
                    <div className="mb-8">
                      <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                        Selecciona tu tamaño
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {detailsProduct.sizes.map((size) => (
                          <button
                            key={size}
                            onClick={() => setSelectedSize({ ...selectedSize, [detailsProduct.id]: size })}
                            className={`px-5 py-3 text-xs border transition-all ${
                              selectedSize[detailsProduct.id] === size
                                ? 'bg-foreground text-background border-foreground'
                                : 'border-border hover:border-foreground'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAddToCart(detailsProduct, () => setDetailsProduct(null))}
                      className="flex-1 py-4 bg-foreground text-background text-xs tracking-[0.25em] uppercase hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
                      Añadir al carrito
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleToggleSave(detailsProduct.id, detailsProduct.name)}
                      className={`p-4 border border-border hover:border-foreground transition-colors ${
                        isProductSaved(detailsProduct.id) ? 'bg-foreground text-background border-foreground' : ''
                      }`}
                      aria-label="Guardar producto"
                    >
                      <Heart
                        className={`w-4 h-4 ${isProductSaved(detailsProduct.id) ? 'fill-current' : ''}`}
                        strokeWidth={1.5}
                      />
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}
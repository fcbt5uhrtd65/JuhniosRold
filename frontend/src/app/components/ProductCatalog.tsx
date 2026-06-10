import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Star,
  Search,
  Filter,
  Grid,
  List,
  Heart,
  Eye,
  ShoppingCart as CartIcon,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useSearch } from '../contexts/SearchContext';
import { useUser } from '../contexts/UserContext';
import { useToast } from '../contexts/ToastContext';

interface Product {
  id: string;
  name: string;
  category: string;
  sizes: string[];
  price: string;
  image: string;
  rating?: number;
  reviews?: number;
  badge?: 'nuevo' | 'popular' | 'oferta';
  description?: string;
}

interface CatalogItem {
  id: number;
  name: string;
  unitsPerDisplay: string;
  stock: number;
  price: number;
}

export function ProductCatalog() {
  const { addItem } = useCart();
  const { searchQuery: globalSearchQuery } = useSearch();
  const { toggleSaveProduct, isProductSaved } = useUser();
  const toast = useToast();

  const [activeCategory, setActiveCategory] = useState('capilar');
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [priceRange, setPriceRange] = useState<'all' | 'low' | 'mid' | 'high'>('all');
  const [minRating, setMinRating] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const handleAddToCart = (product: Product, closeModal?: boolean) => {
    const size = selectedSizes[product.id] || product.sizes[0];

    addItem({
      id: `${product.id}-${size}`,
      name: product.name,
      category: product.category,
      size,
      price: parseFloat(product.price.replace(/\./g, '')),
      image: product.image,
    });

    toast.success(`${product.name} añadido al carrito`);

    if (closeModal) {
      setQuickViewProduct(null);
    }
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

  useEffect(() => {
    if (globalSearchQuery) {
      setLocalSearchQuery(globalSearchQuery);
    }
  }, [globalSearchQuery]);

  const categories = [
    { id: 'capilar', label: 'Capilar' },
    { id: 'corporal', label: 'Corporal' },
    { id: 'baby', label: 'Baby' },
    { id: 'personal', label: 'Personal' },
    { id: 'aseo', label: 'Aseo' },
    { id: 'antibacterial', label: 'Antibacterial' },
    { id: 'laboratorio', label: 'Laboratorio' }
  ];

  const productImageByCategory: Record<string, string> = {
    capilar: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600&q=80',
    corporal: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&q=80',
    baby: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&q=80',
    personal: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=600&q=80',
    aseo: 'https://images.unsplash.com/photo-1583947581924-860bda6a26df?w=600&q=80',
    antibacterial: 'https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=600&q=80',
    laboratorio: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=600&q=80'
  };

  const getCategoryFromName = (name: string): string => {
    const normalized = name.toLowerCase();

    if (
      normalized.includes('bebe') ||
      normalized.includes('bebé')
    ) {
      return 'baby';
    }

    if (
      normalized.includes('capilar') ||
      normalized.includes('shampoo') ||
      normalized.includes('acondicionador') ||
      normalized.includes('crema de peinar') ||
      normalized.includes('silicona') ||
      normalized.includes('keratina') ||
      normalized.includes('full liso') ||
      normalized.includes('tono sobre tono') ||
      normalized.includes('fusion amino')
    ) {
      return 'capilar';
    }

    if (
      normalized.includes('corporal') ||
      normalized.includes('crema para manos') ||
      normalized.includes('body splash') ||
      normalized.includes('locion') ||
      normalized.includes('menthus') ||
      normalized.includes('pomada') ||
      normalized.includes('vaselina')
    ) {
      return 'corporal';
    }

    if (
      normalized.includes('desodorante') ||
      normalized.includes('removedor')
    ) {
      return 'personal';
    }

    if (
      normalized.includes('alcohol') ||
      normalized.includes('amonio') ||
      normalized.includes('jabon') ||
      normalized.includes('jabón') ||
      normalized === 'galon' ||
      normalized === 'pimpina' ||
      normalized.includes('galon') ||
      normalized.includes('pimpina')
    ) {
      return 'aseo';
    }

    if (normalized.includes('gel antibacterial')) {
      return 'antibacterial';
    }

    if (normalized.includes('recolector')) {
      return 'laboratorio';
    }

    return 'personal';
  };

  const formatPrice = (price: number): string => {
    return price.toLocaleString('es-CO');
  };

  const catalogItems: CatalogItem[] = [
    { id: 1, name: 'ACEITE BEBE / AGUACATE 50ML * 12 DISPLAY', unitsPerDisplay: '12', stock: 432, price: 1609 },
    { id: 2, name: 'ACEITE BEBE / AGUACATE 70ML * 12 DISPLAY', unitsPerDisplay: '12', stock: 336, price: 2052 },
    { id: 3, name: 'ACEITE BEBE / AGUACATE 90ML * 12 DISPLAY', unitsPerDisplay: '12', stock: 288, price: 2337 },
    { id: 4, name: 'ACEITES 3 MAS', unitsPerDisplay: '6', stock: 288, price: 1472 },
    { id: 5, name: 'ACEITES SACHET 8 ML', unitsPerDisplay: '30', stock: 1440, price: 754 },
    { id: 6, name: 'ACEITE CAPILAR 60ML', unitsPerDisplay: 'N/A', stock: 290, price: 2940 },
    { id: 7, name: 'ACEITE CAPILAR 120ML', unitsPerDisplay: 'N/A', stock: 110, price: 4324 },
    { id: 8, name: 'ACEITE CORPORAL 120ML', unitsPerDisplay: 'N/A', stock: 110, price: 4527 },
    { id: 9, name: 'ACEITE CORPORAL 250ML', unitsPerDisplay: 'N/A', stock: 60, price: 7888 },
    { id: 10, name: 'BODY SPLASH 250ML', unitsPerDisplay: 'N/A', stock: 70, price: 10823 },
    { id: 11, name: 'CREMA PARA MANOS Y CUERPO 1000ML', unitsPerDisplay: 'N/A', stock: 15, price: 14540 },
    { id: 12, name: 'CREMA PARA MANOS Y CUERPO 120ML', unitsPerDisplay: 'N/A', stock: 110, price: 3114 },
    { id: 13, name: 'CREMA PARA MANOS Y CUERPO 250ML', unitsPerDisplay: 'N/A', stock: 80, price: 7165 },
    { id: 14, name: 'CREMA PARA MANOS Y CUERPO 500ML', unitsPerDisplay: 'N/A', stock: 30, price: 10219 },
    { id: 15, name: 'FULL LISO TERMOPROTECTOR DISPLAY * 30 UNDS 15grms', unitsPerDisplay: '24', stock: 28, price: 892 },
    { id: 16, name: 'FULL LISO DISPLAY * 30 UNDS 15grms', unitsPerDisplay: '36', stock: 960, price: 846 },
    { id: 17, name: 'FUSION AMINO 3 PASOS DISPLAY * 6 PAQUETES', unitsPerDisplay: '6', stock: 84, price: 12701 },
    { id: 18, name: 'GEL CAPILAR 1000gr DISPLAY * 12 UNDS', unitsPerDisplay: '12', stock: 24, price: 17107 },
    { id: 19, name: 'GEL CAPILAR 100gr DISPLAY * 48 UNDS', unitsPerDisplay: '48', stock: 192, price: 2642 },
    { id: 20, name: 'GEL CAPILAR 250gr DISPLAY * 40 UNDS', unitsPerDisplay: '40', stock: 80, price: 5093 },
    { id: 21, name: 'GEL CAPILAR 500gr DISPLAY * 24 UNDS', unitsPerDisplay: '24', stock: 48, price: 9289 },
    { id: 22, name: 'GEL CAPILAR SACHET 12gr DISPLAY * 36 SOBRES', unitsPerDisplay: '36', stock: 1440, price: 558 },
    { id: 23, name: 'GEL CAPILAR SACHET 30gr DISPLAY * 24 SOBRES', unitsPerDisplay: '24', stock: 576, price: 999 },
    { id: 24, name: 'GEL CAPILAR SACHET 80gr DISPLAY * 12 SOBRES', unitsPerDisplay: '20', stock: 240, price: 2032 },
    { id: 25, name: 'LOCION TERMICA ARNICA / CANNABIS 375ml', unitsPerDisplay: 'N/A', stock: 54, price: 22804 },
    { id: 26, name: 'LOCION TERMICA ARNICA/ CANNABIS 150mL', unitsPerDisplay: 'N/A', stock: 110, price: 10770 },
    { id: 27, name: 'LOCION TERMICA ARNICA/ CANNABIS 60mL', unitsPerDisplay: 'N/A', stock: 290, price: 6036 },
    { id: 28, name: 'LOCION MENTOLADA (Pinguino)', unitsPerDisplay: 'N/A', stock: 110, price: 10151 },
    { id: 29, name: 'MENTHUS 1000gr VERDE & AZUL', unitsPerDisplay: '12', stock: 24, price: 21280 },
    { id: 30, name: 'MENTHUS 10gr VERDE & AZUL', unitsPerDisplay: '36', stock: 1440, price: 940 },
    { id: 31, name: 'MENTHUS 110gr VERDE & AZUL', unitsPerDisplay: '48', stock: 192, price: 4387 },
    { id: 32, name: 'MENTHUS 220gr VERDE & AZUL', unitsPerDisplay: '40', stock: 80, price: 8807 },
    { id: 33, name: 'MENTHUS 30gr VERDE & AZUL', unitsPerDisplay: '12', stock: 576, price: 1778 },
    { id: 34, name: 'MENTHUS NUEVA PRESENTACION 120gr', unitsPerDisplay: '48', stock: 192, price: 4403 },
    { id: 35, name: 'MENTHUS NUEVA PRESENTACION 250gr', unitsPerDisplay: '40', stock: 80, price: 7959 },
    { id: 36, name: 'POMADA RUBIC 20gr', unitsPerDisplay: '12', stock: 576, price: 2202 },
    { id: 37, name: 'POMADA RUBIC 80gr', unitsPerDisplay: '40', stock: 80, price: 5785 },
    { id: 38, name: 'POMADA RUBIC 200gr', unitsPerDisplay: '48', stock: 192, price: 14310 },
    { id: 39, name: 'RECOLECTOR 50*50', unitsPerDisplay: '50', stock: 1000, price: 322 },
    { id: 40, name: 'RECOLECTOR COPRO', unitsPerDisplay: '50', stock: 1000, price: 355 },
    { id: 41, name: 'RECOLECTOR MUESTRA', unitsPerDisplay: '50', stock: 1000, price: 339 },
    { id: 42, name: 'REMOVEDOR 50ML DISPLAY * 12 UNDS', unitsPerDisplay: '12', stock: 432, price: 1447 },
    { id: 43, name: 'SHAMPOO CEBOLLA/ROMERO 350gr', unitsPerDisplay: 'N/A', stock: 60, price: 1152 },
    { id: 44, name: 'ACONDICIONADOR CEBOLLA/ROMERO 350gr', unitsPerDisplay: 'N/A', stock: 60, price: 11398 },
    { id: 45, name: 'CREMA DE PEINAR CEBOLLA/ROMERO 350gr', unitsPerDisplay: 'N/A', stock: 60, price: 11398 },
    { id: 46, name: 'SHAMPOO CEBOLLA/ROMERO 30gr', unitsPerDisplay: '22', stock: 576, price: 1305 },
    { id: 47, name: 'ACONDICIONADOR CEBOLLA/ROMERO 30gr', unitsPerDisplay: '22', stock: 528, price: 1305 },
    { id: 48, name: 'CREMA DE PEINAR CEBOLLA/ROMERO 30gr', unitsPerDisplay: '22', stock: 528, price: 1305 },
    { id: 49, name: 'SILICONA VERDE (LINO) / ARGAN 30ML', unitsPerDisplay: '12', stock: 576, price: 4549 },
    { id: 50, name: 'SILICONA VERDE (LINO) / ARGAN 50ML', unitsPerDisplay: '12', stock: 336, price: 5484 },
    { id: 51, name: 'SILICONA VERDE (LINO) / ARGAN 8ML (SACHET)', unitsPerDisplay: '30', stock: 1800, price: 1443 },
    { id: 52, name: 'SILICONA VERDE (LINO) / ARGAN 8ML (VIDRIO)', unitsPerDisplay: '175', stock: 700, price: 2126 },
    { id: 53, name: 'TONO SOBRE TONO 30gr DISPLAY * 24 UNDS', unitsPerDisplay: '24', stock: 576, price: 1694 },
    { id: 54, name: 'TRATAMIENTO KERATINA 250gr', unitsPerDisplay: '40', stock: 80, price: 5944 },
    { id: 55, name: 'TRATAMIENTO KERATINA 30gr', unitsPerDisplay: '24', stock: 576, price: 1270 },
    { id: 56, name: 'VASELINA ROSADA / AZUL 20gr', unitsPerDisplay: '12', stock: 576, price: 1439 },
    { id: 57, name: 'VASELINA ROSADA / AZUL 80gr', unitsPerDisplay: '48', stock: 80, price: 4420 },
    { id: 58, name: 'VASELINA ROSADA / AZUL 200gr', unitsPerDisplay: '40', stock: 192, price: 9992 },
    { id: 59, name: 'DESODORANTE CORPORAL 8G', unitsPerDisplay: '18', stock: 48, price: 1059 },
    { id: 60, name: 'JABON T/ VALVULA 1000ML', unitsPerDisplay: '1000', stock: 15, price: 9198 },
    { id: 61, name: 'JABON T/ CHUPO 1000ML', unitsPerDisplay: '1000', stock: 15, price: 8313 },
    { id: 62, name: 'JABON T/ VALVULA 500ML', unitsPerDisplay: '500', stock: 30, price: 5874 },
    { id: 63, name: 'JABON T/ CHUPO 500ML', unitsPerDisplay: '500', stock: 30, price: 4830 },
    { id: 64, name: 'JABON T/ VALVULA 300ML', unitsPerDisplay: '300', stock: 50, price: 4892 },
    { id: 65, name: 'JABON T/ CHUPO 300ML', unitsPerDisplay: '300', stock: 50, price: 3557 },
    { id: 66, name: 'JABON T/ VALVULA 120ML', unitsPerDisplay: '120', stock: 120, price: 2059 },
    { id: 67, name: 'GALON', unitsPerDisplay: '3750', stock: 6, price: 26148 },
    { id: 68, name: 'PIMPINA', unitsPerDisplay: '20000', stock: 1, price: 151265 },
    { id: 69, name: 'ALCOHOL 70% T / SPRAY 1000ML', unitsPerDisplay: '1000', stock: 15, price: 13114 },
    { id: 70, name: 'ALCOHOL 70% T / ROSCA 1000ML', unitsPerDisplay: '1000', stock: 15, price: 11601 },
    { id: 71, name: 'ALCOHOL 70% T / SPRAY 800ML', unitsPerDisplay: '800', stock: 38, price: 10398 },
    { id: 72, name: 'ALCOHOL 70% T / ROSCA 800ML', unitsPerDisplay: '800', stock: 38, price: 8975 },
    { id: 73, name: 'ALCOHOL 70% T / SPRAY 700ML', unitsPerDisplay: '700', stock: 38, price: 9653 },
    { id: 74, name: 'ALCOHOL 70% T / ROSCA 700ML', unitsPerDisplay: '700', stock: 38, price: 8129 },
    { id: 75, name: 'ALCOHOL 70% T / SPRAY 500ML', unitsPerDisplay: '500', stock: 30, price: 7672 },
    { id: 76, name: 'ALCOHOL 70% T / ROSCA 500ML', unitsPerDisplay: '500', stock: 30, price: 6435 },
    { id: 77, name: 'ALCOHOL 70% T / SPRAY 250ML', unitsPerDisplay: '250', stock: 65, price: 5420 },
    { id: 78, name: 'ALCOHOL 70% T / ROSCA 250ML', unitsPerDisplay: '250', stock: 65, price: 4014 },
    { id: 79, name: 'ALCOHOL 70% T / SPRAY 120ML', unitsPerDisplay: '120', stock: 110, price: 2756 },
    { id: 80, name: 'ALCOHOL 70% GALON', unitsPerDisplay: '3750', stock: 6, price: 41289 },
    { id: 81, name: 'ALCOHOL 70% PIMPINA', unitsPerDisplay: '20000', stock: 1, price: 231883 },
    { id: 82, name: 'AMONIO T / SPRAY 1000ML', unitsPerDisplay: '1000', stock: 15, price: 9218 },
    { id: 83, name: 'AMONIO GALON', unitsPerDisplay: '3750', stock: 6, price: 25567 },
    { id: 84, name: 'AMONIO PIMPINA', unitsPerDisplay: '20000', stock: 1, price: 145933 },
    { id: 85, name: 'GEL ANTIBACTERIAL 50ML', unitsPerDisplay: '50', stock: 432, price: 1608 },
    { id: 86, name: 'GEL ANTIBACTERIAL 120ML', unitsPerDisplay: '120', stock: 110, price: 2975 },
    { id: 87, name: 'GEL ANTIBACTERIAL T/CHUPO 240ML', unitsPerDisplay: '240', stock: 60, price: 5165 },
    { id: 88, name: 'GEL ANTIBACTERIAL T/VALVULA 240ML', unitsPerDisplay: '240', stock: 60, price: 6588 },
    { id: 89, name: 'GEL ANTIBACTERIAL T/CHUPO 500ML', unitsPerDisplay: '500', stock: 30, price: 8882 },
    { id: 90, name: 'GEL ANTIBACTERIAL T/VALVULA 500ML', unitsPerDisplay: '500', stock: 30, price: 10233 },
    { id: 91, name: 'GEL ANTIBACTERIAL T/CHUPO 1000ML', unitsPerDisplay: '1000', stock: 15, price: 16272 },
    { id: 92, name: 'GEL ANTIBACTERIAL T/VALVULA 1000ML', unitsPerDisplay: '1000', stock: 15, price: 17623 },
    { id: 93, name: 'GEL ANTIBACTERIAL GALON', unitsPerDisplay: '3750', stock: 6, price: 50084 },
    { id: 94, name: 'GEL ANTIBACTERIAL PIMPINA', unitsPerDisplay: '20000', stock: 1, price: 291155 }
  ];

  const products: Record<string, Product[]> = catalogItems.reduce((acc, item) => {
    const categoryId = getCategoryFromName(item.name);

    const size =
      item.unitsPerDisplay === 'N/A'
        ? 'Unidad'
        : `${item.unitsPerDisplay} unds`;

    const product: Product = {
      id: `producto-${item.id}`,
      name: item.name,
      category: categories.find((category) => category.id === categoryId)?.label || 'Personal',
      sizes: [size],
      price: formatPrice(item.price),
      image: productImageByCategory[categoryId],
      rating: item.stock <= 10 ? 4 : 5,
      reviews: item.stock,
      badge: item.id <= 5 ? 'nuevo' : item.stock >= 1000 ? 'popular' : undefined,
      description: `Stock disponible: ${item.stock} unidades. Presentación: ${size}.`
    };

    if (!acc[categoryId]) {
      acc[categoryId] = [];
    }

    acc[categoryId].push(product);

    return acc;
  }, {} as Record<string, Product[]>);

  const allProducts = products[activeCategory] || [];

  const currentProducts = allProducts.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(localSearchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(localSearchQuery.toLowerCase()) ||
      product.sizes.some((size) => size.toLowerCase().includes(localSearchQuery.toLowerCase()));

    const price = parseFloat(product.price.replace(/\./g, ''));

    let matchesPrice = true;

    if (priceRange === 'low') {
      matchesPrice = price < 25000;
    } else if (priceRange === 'mid') {
      matchesPrice = price >= 25000 && price < 100000;
    } else if (priceRange === 'high') {
      matchesPrice = price >= 100000;
    }

    const matchesRating = !product.rating || product.rating >= minRating;

    return matchesSearch && matchesPrice && matchesRating;
  });

  return (
    <section id="catalogo" className="py-20 bg-secondary">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-8 md:px-12">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground mb-3">
            CATÁLOGO COMPLETO
          </div>

          <h2 className="text-4xl md:text-5xl font-bold leading-none mb-8">
            Todos los<br />Productos
          </h2>

          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                strokeWidth={1}
              />

              <input
                type="search"
                value={localSearchQuery}
                onChange={(e) => setLocalSearchQuery(e.target.value)}
                placeholder="Buscar productos..."
                className="w-full pl-10 pr-4 py-3 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-3 border border-border transition-colors ${
                  showFilters ? 'bg-foreground text-background' : 'hover:bg-secondary'
                }`}
                title="Filtros"
              >
                <Filter className="w-4 h-4" strokeWidth={1} />
              </button>

              <button
                onClick={() => setViewMode('grid')}
                className={`p-3 border border-border transition-colors ${
                  viewMode === 'grid' ? 'bg-foreground text-background' : 'hover:bg-secondary'
                }`}
                title="Vista en cuadrícula"
              >
                <Grid className="w-4 h-4" strokeWidth={1} />
              </button>

              <button
                onClick={() => setViewMode('list')}
                className={`p-3 border border-border transition-colors ${
                  viewMode === 'list' ? 'bg-foreground text-background' : 'hover:bg-secondary'
                }`}
                title="Vista en lista"
              >
                <List className="w-4 h-4" strokeWidth={1} />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid md:grid-cols-2 gap-6 p-6 bg-background border border-border mt-4">
                  <div>
                    <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                      Precio
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'all', label: 'Todos' },
                        { value: 'low', label: 'Menos de $25k' },
                        { value: 'mid', label: '$25k - $100k' },
                        { value: 'high', label: 'Más de $100k' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setPriceRange(option.value as 'all' | 'low' | 'mid' | 'high')}
                          className={`px-3 py-1.5 text-xs border transition-colors ${
                            priceRange === option.value
                              ? 'bg-foreground text-background border-foreground'
                              : 'border-border hover:border-foreground'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                      Calificación mínima
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {[0, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          onClick={() => setMinRating(rating)}
                          className={`px-3 py-1.5 text-xs border transition-colors flex items-center gap-1 ${
                            minRating === rating
                              ? 'bg-foreground text-background border-foreground'
                              : 'border-border hover:border-foreground'
                          }`}
                        >
                          {rating === 0 ? (
                            'Todas'
                          ) : (
                            <>
                              {rating}
                              <Star className="w-3 h-3 fill-current" strokeWidth={1} />
                              +
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-4 border-b border-border overflow-x-auto scrollbar-hide mt-8">
            {categories.map((category) => {
              const count = products[category.id]?.length || 0;

              return (
                <button
                  key={category.id}
                  onClick={() => {
                    setActiveCategory(category.id);
                    setLocalSearchQuery('');
                  }}
                  className={`pb-3 px-2 text-xs tracking-wider uppercase transition-all relative whitespace-nowrap flex-shrink-0 ${
                    activeCategory === category.id
                      ? 'opacity-100'
                      : 'opacity-40 hover:opacity-70'
                  }`}
                >
                  {category.label}
                  <span className="ml-2 text-[10px] opacity-60">
                    ({count})
                  </span>

                  {activeCategory === category.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-px bg-foreground"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        {localSearchQuery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground mb-4"
          >
            {currentProducts.length} resultado{currentProducts.length !== 1 ? 's' : ''} encontrado{currentProducts.length !== 1 ? 's' : ''}
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeCategory}-${viewMode}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 md:grid-cols-3 gap-px bg-border'
                : 'space-y-px bg-border'
            }
          >
            {currentProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={`group bg-background ${viewMode === 'list' ? 'flex' : ''} relative`}
              >
                <div
                  className={`bg-secondary overflow-hidden relative ${
                    viewMode === 'grid' ? 'aspect-[3/4]' : 'w-32 h-32'
                  }`}
                >
                  <motion.img
                    whileHover={{ scale: 1.08 }}
                    transition={{ duration: 0.6 }}
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />

                  {product.badge && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="absolute top-3 left-3 px-3 py-1.5 bg-foreground text-background text-[9px] tracking-[0.2em] uppercase font-medium flex items-center gap-1.5"
                    >
                      {product.badge === 'nuevo' && (
                        <Sparkles className="w-3 h-3" strokeWidth={1.5} />
                      )}

                      {product.badge === 'popular' && (
                        <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
                      )}

                      {product.badge}
                    </motion.div>
                  )}

                  <motion.div
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    className="absolute inset-0 bg-foreground/60 backdrop-blur-sm flex items-center justify-center gap-2 opacity-0 transition-opacity"
                  >
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setQuickViewProduct(product)}
                      className="p-3 bg-background text-foreground rounded-full hover:bg-background/90 transition-colors"
                      aria-label="Vista rápida"
                    >
                      <Eye className="w-4 h-4" strokeWidth={1.5} />
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleToggleSave(product.id, product.name)}
                      className="p-3 bg-background text-foreground rounded-full hover:bg-background/90 transition-colors"
                      aria-label={isProductSaved(product.id) ? 'Quitar de guardados' : 'Guardar producto'}
                    >
                      <Heart
                        className={`w-4 h-4 ${isProductSaved(product.id) ? 'fill-current' : ''}`}
                        strokeWidth={1.5}
                      />
                    </motion.button>
                  </motion.div>
                </div>

                <div
                  className={`p-4 border-t border-border ${
                    viewMode === 'list'
                      ? 'flex-1 border-t-0 border-l flex flex-col justify-center'
                      : ''
                  }`}
                >
                  <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1.5">
                    {product.category}
                  </div>

                  <h3 className={viewMode === 'grid' ? 'text-sm mb-2' : 'text-base mb-3'}>
                    {product.name}
                  </h3>

                  {product.rating && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-2.5 h-2.5 ${
                              i < product.rating! ? 'fill-foreground' : ''
                            }`}
                            strokeWidth={1}
                          />
                        ))}
                      </div>

                      <span className="text-[10px] text-muted-foreground">
                        Stock: {product.reviews}
                      </span>
                    </div>
                  )}

                  <div className={`flex flex-wrap gap-1.5 mb-3 ${viewMode === 'list' ? 'mb-4' : ''}`}>
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSizes({ ...selectedSizes, [product.id]: size })}
                        className={`text-[10px] border px-1.5 py-0.5 transition-colors ${
                          selectedSizes[product.id] === size
                            ? 'bg-foreground text-background border-foreground'
                            : 'text-muted-foreground border-border hover:border-foreground'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className={viewMode === 'grid' ? 'text-xs' : 'text-sm'}>
                      ${product.price}
                    </div>

                    <motion.button
                      whileHover={{ x: 3 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleAddToCart(product)}
                      className="text-[10px] tracking-wider uppercase hover:opacity-50 transition-opacity"
                    >
                      Añadir →
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {currentProducts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Search
              className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20"
              strokeWidth={1}
            />

            <div className="text-sm text-muted-foreground">
              No se encontraron productos
            </div>
          </motion.div>
        )}
      </div>

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
                <div className="aspect-[4/3] md:aspect-square bg-secondary relative">
                  <img
                    src={quickViewProduct.image}
                    alt={quickViewProduct.name}
                    className="w-full h-full object-cover"
                  />

                  {quickViewProduct.badge && (
                    <div className="absolute top-6 left-6 px-4 py-2 bg-foreground text-background text-[10px] tracking-[0.2em] uppercase font-medium flex items-center gap-2">
                      {quickViewProduct.badge === 'nuevo' && (
                        <Sparkles className="w-3 h-3" strokeWidth={1.5} />
                      )}

                      {quickViewProduct.badge === 'popular' && (
                        <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
                      )}

                      {quickViewProduct.badge}
                    </div>
                  )}
                </div>

                <div className="p-6 md:p-12 flex flex-col relative">
                  <button
                    onClick={() => setQuickViewProduct(null)}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Cerrar vista rápida"
                  >
                    ✕
                  </button>

                  <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground mb-4">
                    {quickViewProduct.category}
                  </div>

                  <h2 className="text-3xl md:text-4xl mb-4 leading-tight">
                    {quickViewProduct.name}
                  </h2>

                  {quickViewProduct.rating && (
                    <div className="flex items-center gap-2 mb-6">
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < quickViewProduct.rating! ? 'fill-foreground' : 'fill-muted'
                            }`}
                            strokeWidth={1}
                          />
                        ))}
                      </div>

                      <span className="text-xs text-muted-foreground">
                        Stock: {quickViewProduct.reviews}
                      </span>
                    </div>
                  )}

                  {quickViewProduct.description && (
                    <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                      {quickViewProduct.description}
                    </p>
                  )}

                  <div className="text-3xl mb-6">
                    ${quickViewProduct.price}
                  </div>

                  <div className="mb-8">
                    <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">
                      Presentación
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {quickViewProduct.sizes.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSizes({ ...selectedSizes, [quickViewProduct.id]: size })}
                          className={`px-4 py-2 text-xs border transition-all ${
                            selectedSizes[quickViewProduct.id] === size
                              ? 'bg-foreground text-background border-foreground'
                              : 'border-border hover:border-foreground'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 mt-auto">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAddToCart(quickViewProduct, true)}
                      className="flex-1 py-4 bg-foreground text-background text-xs tracking-[0.25em] uppercase hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      <CartIcon className="w-4 h-4" strokeWidth={1.5} />
                      Añadir al carrito
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleToggleSave(quickViewProduct.id, quickViewProduct.name)}
                      className={`p-4 border border-border hover:border-foreground transition-colors ${
                        isProductSaved(quickViewProduct.id)
                          ? 'bg-foreground text-background border-foreground'
                          : ''
                      }`}
                      aria-label="Guardar"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          isProductSaved(quickViewProduct.id) ? 'fill-current' : ''
                        }`}
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
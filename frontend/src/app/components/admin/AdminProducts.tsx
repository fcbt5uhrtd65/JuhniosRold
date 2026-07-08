import { useEffect, useState, useMemo, useRef } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import {
  Plus, Edit2, Trash2, Eye, EyeOff, Grid3x3, List, ArrowUpDown,
  X, Upload, AlertTriangle, ChevronDown, Package, Warehouse,
  Download, FileSpreadsheet, FileText, Star, Tag, MoreVertical, Images,
  ChevronLeft, ChevronRight, Check,
} from 'lucide-react';
import type { Product, Inventory } from '../../types/admin';
import { SearchBar } from './SearchBar';
import { FilterPanel, type FilterGroup } from './FilterPanel';
import { Pagination } from './Pagination';
import { AdminProductPromotionModal } from './AdminProductPromotionModal';
import { useToast } from '../../contexts/ToastContext';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '../ui/dropdown-menu';
import { requestProductsExport, getCategories, getProductById, updateProductVariant, updateVariantImages, createProductVariant, type ExportFormat, type PdfLayout, type ProductVariant } from '../../services/products.service';
import { createInitialStock } from '../../services/inventory.service';
import { getProductReviews, type ProductReview } from '../../services/reviews.service';
import { getWholesaleSettingsApi, updateWholesaleSettingsApi } from '../../services/cart.service';
import { pollExportStatus, downloadFile } from '../../utils/pollExportStatus';
import { resolveBackendUrl, ApiError } from '../../services/api';
import { getWholesaleSettings, saveWholesaleSettings } from '../../utils/wholesale';
import { Card, Badge, type BadgeColor, Table, Th, Td, Modal, EmptyState, inputCls, selectCls, ImageUploader } from './AdminUI';
import { AdminVariantImagesModal } from './AdminVariantImagesModal';
import { AddVariantModal } from './AddVariantModal';

type ViewMode = 'grid' | 'table';
type SortField = 'nombre' | 'precio' | 'categoria' | 'estado' | 'stock';
type SortOrder = 'asc' | 'desc';
type ModalMode = 'create' | 'edit' | 'view' | null;

const TIPOS = ['Aceite', 'Gel', 'Silicona', 'Shampoo', 'Tratamiento', 'Acondicionador', 'Crema', 'Sérum', 'Mascarilla'];
const PRESENTATION_UNITS: NonNullable<Product['presentacionUnidad']>[] = ['ML', 'LT', 'GR', 'KG', 'UND'];

const EMPTY_FORM: Omit<Product, 'id'> = {
  nombre: '',
  categoria: 'capilar',
  tipo: '',
  presentacion: '',
  presentacionNumero: undefined,
  presentacionUnidad: 'ML',
  precio: 0,
  precioCosto: undefined,
  descripcion: '',
  imagen: '',
  imagenes: [],
  estado: 'activo',
  codigo: '',
  marca: '',
  beneficios: '',
  modoDeUso: '',
  ingredientes: '',
  controlarInventario: true,
  stockMinimo: 10,
  stockInicial: 0,
  fechaCreacion: '',
};

function variantImageList(variant: ProductVariant | undefined, fallback?: string): string[] {
  if (!variant) return fallback ? [fallback] : [];
  if (variant.images.length > 0) {
    return [...variant.images]
      .sort((a, b) => (a.is_primary === b.is_primary ? a.position - b.position : a.is_primary ? -1 : 1))
      .map(img => img.image);
  }
  return variant.image_url ? [variant.image_url] : (fallback ? [fallback] : []);
}

function margenGanancia(venta: number, costo: number | undefined): string | null {
  if (!costo || costo <= 0 || venta <= 0) return null;
  return (((venta - costo) / venta) * 100).toFixed(1) + '%';
}

function RatingStars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={size}
          className={i < Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}
          strokeWidth={0}
        />
      ))}
    </div>
  );
}

function formatReviewDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ProductReviewsPanel({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setShowAll(false);
    getProductReviews(productId)
      .then(data => { if (isMounted) setReviews(data); })
      .finally(() => { if (isMounted) setLoading(false); });
    return () => { isMounted = false; };
  }, [productId]);

  const average = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null;

  // Colapsado: el CSS muestra solo la 1ra reseña en pantallas pequeñas y hasta 2 en pantallas grandes.
  const collapsedReviews = reviews.slice(0, 2);
  const visibleReviews = showAll ? reviews : collapsedReviews;
  const hasMore = reviews.length > collapsedReviews.length;

  return (
    <div className="pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Reseñas</p>
        {average !== null && (
          <div className="flex items-center gap-1.5">
            <RatingStars rating={average} />
            <span className="text-xs font-semibold text-gray-700">{average.toFixed(1)}</span>
            <span className="text-[11px] text-gray-400">({reviews.length})</span>
          </div>
        )}
      </div>

      {loading && <p className="text-xs text-gray-400">Cargando reseñas...</p>}

      {!loading && reviews.length === 0 && (
        <p className="text-xs text-gray-400">Este producto aún no tiene reseñas.</p>
      )}

      {!loading && reviews.length > 0 && (
        <div className="space-y-3">
          {visibleReviews.map((review, i) => (
            <div key={review.id} className={`${i >= 1 ? 'hidden sm:block' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-800">{review.userName}</span>
                <span className="text-[11px] text-gray-400">{formatReviewDate(review.createdAt)}</span>
              </div>
              <RatingStars rating={review.rating} size={11} />
              {review.comment && (
                <p className="text-xs text-gray-600 mt-1 leading-relaxed">{review.comment}</p>
              )}
            </div>
          ))}
          {!showAll && hasMore && (
            <button
              onClick={() => setShowAll(true)}
              className="text-[11px] font-semibold text-[#2a4038] hover:underline"
            >
              Ver más ({reviews.length - collapsedReviews.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function estadoBadge(estado: Product['estado'], stockActual?: number, stockMinimo?: number) {
  const isLow = stockActual !== undefined && stockMinimo !== undefined && stockActual > 0 && stockActual < stockMinimo;
  if (estado === 'agotado' || stockActual === 0) {
    return <Badge label="Agotado" color="red" />;
  }
  if (estado === 'inactivo') {
    return <Badge label={<span className="flex items-center gap-1"><EyeOff size={11} />Inactivo</span>} color="gray" />;
  }
  if (isLow) {
    return <Badge label={<span className="flex items-center gap-1"><AlertTriangle size={11} />Stock bajo</span>} color="yellow" />;
  }
  return <Badge label={<span className="flex items-center gap-1"><Eye size={11} />Activo</span>} color="green" />;
}

interface ComboboxProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  id?: string;
}

function Combobox({ value, onChange, options, placeholder, required, id }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  // Si el valor actual ya coincide con una opción (fue seleccionada, no
  // tecleada), al abrir se muestran todas las opciones en vez de filtrar
  // por el propio texto ya cargado, que solo se emparejaría consigo mismo.
  const isExactOption = options.some(o => o.toLowerCase() === value.toLowerCase());
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className="relative">
      <div className="flex">
        <input
          id={id}
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          required={required}
          className={inputCls + ' pr-8'}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen(o => !o)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
        >
          <ChevronDown size={13} />
        </button>
      </div>
      {open && options.length > 0 && (
        <ul className="absolute z-20 w-full bg-white border border-gray-100 rounded-xl shadow-lg max-h-48 overflow-y-auto mt-1">
          {(isExactOption ? options : options.filter(o => o.toLowerCase().includes(value.toLowerCase())))
            .map(option => (
              <li
                key={option}
                onMouseDown={() => { onChange(option); setOpen(false); }}
                className="px-3 py-2 text-xs cursor-pointer hover:bg-gray-50"
              >
                {option}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

interface AdminProductsProps {
  onViewInInventory?: (search: string) => void;
}

export function AdminProducts({ onViewInInventory }: AdminProductsProps = {}) {
  const { products, inventory, addProduct, updateProduct, deleteProduct, refreshData } = useAdmin();
  const toast = useToast();
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [promotionModalProduct, setPromotionModalProduct] = useState<Product | null>(null);
  const [variantImagesModalProduct, setVariantImagesModalProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeSection, setActiveSection] = useState<'general' | 'precios' | 'inventario' | 'adicional'>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  const [formData, setFormData] = useState<Omit<Product, 'id'>>(EMPTY_FORM);
  const [wholesaleSettings, setWholesaleSettings] = useState(getWholesaleSettings);
  const [catalogCategories, setCatalogCategories] = useState<string[]>([]);
  const [editVariants, setEditVariants] = useState<ProductVariant[]>([]);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [isLoadingEditVariants, setIsLoadingEditVariants] = useState(false);
  const [editVariantImages, setEditVariantImages] = useState<string[]>([]);
  const [primaryVariantId, setPrimaryVariantId] = useState<string | null>(null);
  const [isAddingVariant, setAddingVariant] = useState(false);

  const set = (patch: Partial<Omit<Product, 'id'>>) => setFormData(prev => ({ ...prev, ...patch }));

  useEffect(() => {
    getCategories(true)
      .then(categories => setCatalogCategories(categories.map(c => c.name)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    getWholesaleSettingsApi()
      .then(settings => {
        const normalized = {
          minimumPurchase: Number(settings.minimum_purchase),
          discountPercentage: Number(settings.discount_percentage),
        };
        setWholesaleSettings(normalized);
        saveWholesaleSettings(normalized);
      })
      .catch(() => undefined);
  }, []);

  const saveWholesale = async () => {
    saveWholesaleSettings(wholesaleSettings);
    try {
      await updateWholesaleSettingsApi({
        minimum_purchase: wholesaleSettings.minimumPurchase,
        discount_percentage: wholesaleSettings.discountPercentage,
        is_active: true,
      });
      toast.success('Regla mayorista actualizada');
    } catch {
      toast.success('Regla mayorista guardada localmente');
    }
  };

  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setSelectedProduct(null);
    setActiveSection('general');
    setModalMode('create');
  };

  const openEdit = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      nombre: product.nombre,
      categoria: product.categoria,
      tipo: product.tipo,
      presentacion: product.presentacion,
      presentacionNumero: product.presentacionNumero,
      presentacionUnidad: product.presentacionUnidad ?? 'ML',
      precio: product.precio,
      precioCosto: product.precioCosto,
      descripcion: product.descripcion,
      imagen: product.imagen,
      imagenes: product.imagenes ?? (product.imagen ? [product.imagen] : []),
      estado: product.estado,
      codigo: product.codigo ?? '',
      marca: product.marca ?? '',
      beneficios: product.beneficios ?? '',
      modoDeUso: product.modoDeUso ?? '',
      ingredientes: product.ingredientes ?? '',
      controlarInventario: product.controlarInventario ?? true,
      stockMinimo: product.stockMinimo ?? 10,
      fechaCreacion: product.fechaCreacion ?? '',
    });
    setActiveSection('general');
    setModalMode('edit');
    setEditVariants([]);
    setEditingVariantId(null);
    setEditVariantImages(product.imagen ? [product.imagen] : []);
    setIsLoadingEditVariants(true);
    getProductById(product.id)
      .then(full => {
        setEditVariants(full.variants);
        const primary = full.variants.find(v => v.presentation === product.presentacion) ?? full.variants[0];
        setEditingVariantId(primary?.id ?? null);
        setPrimaryVariantId(primary?.id ?? null);
        setEditVariantImages(variantImageList(primary, product.imagen));
      })
      .catch(() => setEditVariants([]))
      .finally(() => setIsLoadingEditVariants(false));
  };

  const selectEditVariant = (variant: ProductVariant) => {
    setEditingVariantId(variant.id);
    setEditVariantImages(variantImageList(variant));
    set({
      presentacion: variant.presentation,
      presentacionNumero: variant.presentation_number ?? undefined,
      presentacionUnidad: (variant.presentation_unit || 'ML') as NonNullable<Product['presentacionUnidad']>,
      precio: variant.current_price ?? 0,
      precioCosto: variant.cost || undefined,
      codigo: variant.sku,
    });
  };

  const handleVariantCreated = async (full: Awaited<ReturnType<typeof getProductById>>) => {
    setEditVariants(full.variants);
    const newest = full.variants[full.variants.length - 1];
    if (newest) selectEditVariant(newest);
    setAddingVariant(false);
    await refreshData();
    toast.success('Presentación agregada correctamente');
  };

  const openView = (product: Product) => {
    setSelectedProduct(product);
    setModalMode('view');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedProduct(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLastSection) {
      // Un Enter dentro de un input dispara el submit del <form>; en un paso
      // intermedio del wizard eso debe avanzar de sección, no guardar ya.
      goToNextSection();
      return;
    }
    const finalStepError = validateSection(activeSection);
    if (finalStepError) {
      toast.error(finalStepError);
      return;
    }
    const categoryExists = catalogCategories.some(
      c => c.toLowerCase() === formData.categoria.toLowerCase(),
    );
    if (catalogCategories.length > 0 && !categoryExists) {
      toast.error(`La categoría "${formData.categoria}" no existe. Elige una de la lista sugerida.`);
      return;
    }
    setIsSubmitting(true);
    try {
      if (modalMode === 'edit' && selectedProduct) {
        const isEditingSiblingVariant = editingVariantId !== null && editingVariantId !== primaryVariantId;
        const productFields = {
          nombre: formData.nombre,
          categoria: formData.categoria,
          descripcion: formData.descripcion,
          estado: formData.estado,
          marca: formData.marca,
          tipo: formData.tipo,
          beneficios: formData.beneficios,
          modoDeUso: formData.modoDeUso,
          ingredientes: formData.ingredientes,
          stockMinimo: formData.stockMinimo,
        };
        const tasks: Promise<unknown>[] = [
          isEditingSiblingVariant
            ? updateProduct(selectedProduct.id, productFields)
            : updateProduct(selectedProduct.id, { ...productFields, precio: formData.precio, precioCosto: formData.precioCosto, codigo: formData.codigo, presentacion: formData.presentacion, presentacionNumero: formData.presentacionNumero, presentacionUnidad: formData.presentacionUnidad }),
        ];
        if (isEditingSiblingVariant) {
          tasks.push(updateProductVariant(editingVariantId, {
            sku: formData.codigo,
            presentation_number: formData.presentacionNumero,
            presentation_unit: formData.presentacionUnidad,
            cost: formData.precioCosto,
            price: formData.precio,
          }));
        }
        if (editingVariantId) {
          tasks.push(updateVariantImages(editingVariantId, editVariantImages));
        }
        await Promise.all(tasks);
        toast.success('Producto actualizado correctamente');
      } else {
        await addProduct(formData);
        toast.success('Producto creado correctamente');
      }
      closeModal();
    } catch (error) {
      if (error instanceof ApiError && error.errors && error.errors.length > 0) {
        toast.error(error.errors.join(' — '));
      } else {
        toast.error(error instanceof Error ? error.message : 'No fue posible guardar el producto');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      await deleteProduct(productId);
      toast.success('Producto eliminado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible eliminar el producto');
    }
  };

  const categoryOptions = useMemo(
    () => Array.from(new Set(products.map(p => p.categoria).filter(Boolean))).sort(),
    [products],
  );

  const filterGroups: FilterGroup[] = [
    {
      id: 'categoria',
      label: 'Categoría',
      multiple: true,
      options: categoryOptions.map(c => ({ label: c.charAt(0).toUpperCase() + c.slice(1), value: c })),
    },
    {
      id: 'estado',
      label: 'Estado',
      multiple: true,
      options: [
        { label: 'Activo', value: 'activo' },
        { label: 'Inactivo', value: 'inactivo' },
        { label: 'Agotado', value: 'agotado' },
      ],
    },
    {
      id: 'stock',
      label: 'Stock',
      multiple: false,
      options: [
        { label: 'Con stock', value: 'available' },
        { label: 'Stock bajo', value: 'low' },
        { label: 'Sin stock', value: 'out' },
      ],
    },
  ];

  const processedProducts = useMemo(() => {
    let filtered = [...products];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.nombre.toLowerCase().includes(q) ||
        p.tipo.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q) ||
        p.presentacion.toLowerCase().includes(q) ||
        (p.marca ?? '').toLowerCase().includes(q) ||
        (p.codigo ?? '').toLowerCase().includes(q),
      );
    }

    if (activeFilters.categoria?.length) {
      filtered = filtered.filter(p => activeFilters.categoria.includes(p.categoria));
    }
    if (activeFilters.estado?.length) {
      filtered = filtered.filter(p => activeFilters.estado.includes(p.estado));
    }
    if (activeFilters.stock?.length) {
      const sf = activeFilters.stock[0];
      filtered = filtered.filter(p => {
        const inv = inventory.find(i => i.productoId === p.id);
        if (!inv) return sf === 'out';
        if (sf === 'available') return inv.stockActual >= inv.stockMinimo;
        if (sf === 'low') return inv.stockActual > 0 && inv.stockActual < inv.stockMinimo;
        if (sf === 'out') return inv.stockActual === 0;
        return true;
      });
    }

    filtered.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      if (sortField === 'stock') {
        aVal = inventory.find(i => i.productoId === a.id)?.stockActual ?? 0;
        bVal = inventory.find(i => i.productoId === b.id)?.stockActual ?? 0;
      } else if (sortField === 'precio') {
        aVal = a.precio;
        bVal = b.precio;
      } else {
        aVal = a[sortField] as string;
        bVal = b[sortField] as string;
      }
      return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    return filtered;
  }, [products, inventory, searchQuery, activeFilters, sortField, sortOrder]);

  const totalPages = Math.ceil(processedProducts.length / itemsPerPage);
  const paginatedProducts = processedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleExport = async (format: ExportFormat, pdfLayout: PdfLayout = 'table') => {
    if (processedProducts.length === 0) {
      toast.warning('No hay productos para exportar.');
      return;
    }
    setIsExporting(true);
    toast.info('Generando exportación, esto puede tardar unos segundos...');
    try {
      const ids = processedProducts.map(p => p.id);
      const taskId = await requestProductsExport(format, ids, pdfLayout);
      const relativeUrl = await pollExportStatus(taskId);
      await downloadFile(resolveBackendUrl(relativeUrl));
      toast.success('Exportación lista.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar los productos');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const SortBtn = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-700"
    >
      {children}
      {sortField === field && <ArrowUpDown size={11} />}
    </button>
  );

  // ---- FORM SECTIONS ----
  const SECTIONS = [
    { id: 'general', label: 'General' },
    { id: 'precios', label: 'Precios' },
    { id: 'inventario', label: 'Inventario' },
    { id: 'adicional', label: 'Adicional' },
  ] as const;

  // El botón "Guardar" ocupa el mismo lugar del DOM que ocupaba "Siguiente"
  // en el paso anterior; si el foco del teclado quedó sobre ese botón,
  // cualquier evento de activación residual (Enter, Space) podría reenviarse
  // contra el nuevo botón submit. Se quita el foco explícitamente al entrar
  // al último paso (los `key` distintos en cada botón ya evitan que el nodo
  // DOM se reutilice, esto es una salvaguarda adicional).
  useEffect(() => {
    if (activeSection !== 'adicional' || modalMode === null) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [activeSection, modalMode]);

  const sectionIndex = SECTIONS.findIndex(s => s.id === activeSection);
  const isLastSection = sectionIndex === SECTIONS.length - 1;

  const validateSection = (sectionId: (typeof SECTIONS)[number]['id']): string | null => {
    if (sectionId === 'general') {
      if (!formData.nombre.trim()) return 'Ingresa el nombre del producto.';
      if (!formData.categoria.trim()) return 'Selecciona una categoría.';
      if (!formData.tipo.trim()) return 'Selecciona un tipo de producto.';
      if (!formData.presentacionNumero || formData.presentacionNumero <= 0) return 'Ingresa el número de presentación.';
      if (!formData.presentacionUnidad) return 'Selecciona la unidad de presentación.';
    }
    if (sectionId === 'precios') {
      if (!formData.precio || formData.precio <= 0) return 'Ingresa un precio de venta válido.';
    }
    return null;
  };

  const goToNextSection = () => {
    const error = validateSection(activeSection);
    if (error) {
      toast.error(error);
      return;
    }
    if (!isLastSection) setActiveSection(SECTIONS[sectionIndex + 1].id);
  };

  const goToPrevSection = () => {
    if (sectionIndex > 0) setActiveSection(SECTIONS[sectionIndex - 1].id);
  };

  const goToSection = (targetId: (typeof SECTIONS)[number]['id']) => {
    const targetIndex = SECTIONS.findIndex(s => s.id === targetId);
    // Solo permite saltar hacia adelante si todas las secciones intermedias son válidas.
    if (targetIndex > sectionIndex) {
      for (let i = sectionIndex; i < targetIndex; i++) {
        const error = validateSection(SECTIONS[i].id);
        if (error) {
          toast.error(error);
          return;
        }
      }
    }
    setActiveSection(targetId);
  };

  const margen = margenGanancia(formData.precio, formData.precioCosto);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Productos</h2>
          <p className="text-xs text-gray-500 mt-0.5">{processedProducts.length} de {products.length} productos</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors"
        >
          <Plus size={14} />
          Nuevo Producto
        </button>
      </div>

      <Card className="p-4 mb-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px_140px_auto] lg:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Regla de descuento mayorista</p>
            <p className="mt-1 text-xs text-gray-500">
              Se aplica automáticamente cuando el carrito supera la compra mínima configurada.
            </p>
          </div>
          <div>
            <FormLabel>Compra mínima</FormLabel>
            <input
              type="number"
              min="0"
              step="1000"
              value={wholesaleSettings.minimumPurchase}
              onChange={e => setWholesaleSettings(prev => ({ ...prev, minimumPurchase: Number(e.target.value) }))}
              className={inputCls}
            />
          </div>
          <div>
            <FormLabel>Descuento %</FormLabel>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={wholesaleSettings.discountPercentage}
              onChange={e => setWholesaleSettings(prev => ({ ...prev, discountPercentage: Number(e.target.value) }))}
              className={inputCls}
            />
          </div>
          <button
            type="button"
            onClick={saveWholesale}
            className="h-10 rounded-lg bg-[#2a4038] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#3d5c4e]"
          >
            Guardar regla
          </button>
        </div>
      </Card>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-6">
        <SearchBar
          value={searchQuery}
          onChange={v => { setSearchQuery(v); setCurrentPage(1); }}
          placeholder="Buscar por nombre, tipo, marca, código..."
          className="flex-1"
        />
        <FilterPanel
          filters={filterGroups}
          activeFilters={activeFilters}
          onFilterChange={(id, vals) => { setActiveFilters(prev => ({ ...prev, [id]: vals })); setCurrentPage(1); }}
          onClearAll={() => { setActiveFilters({}); setCurrentPage(1); }}
        />
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2.5 rounded-xl border transition-colors ${viewMode === 'grid' ? 'bg-[#2a4038] text-white border-[#2a4038]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            title="Cuadrícula"
          >
            <Grid3x3 size={15} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2.5 rounded-xl border transition-colors ${viewMode === 'table' ? 'bg-[#2a4038] text-white border-[#2a4038]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            title="Tabla"
          >
            <List size={15} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={isExporting || processedProducts.length === 0}
                className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Exportar productos filtrados"
              >
                <Download size={14} />
                Exportar
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FileText className="w-4 h-4 mr-2" strokeWidth={1} />
                  Exportar a PDF
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onSelect={() => handleExport('pdf', 'table')}>
                    Tipo tabla
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => handleExport('pdf', 'catalog')}>
                    Tipo catálogo
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onSelect={() => handleExport('xlsx')}>
                <FileSpreadsheet className="w-4 h-4 mr-2" strokeWidth={1} />
                Exportar a Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Empty state */}
      {paginatedProducts.length === 0 && (
        <EmptyState
          title="No se encontraron productos"
          action={
            <button
              onClick={openCreate}
              className="px-4 py-2.5 bg-[#2a4038] text-white rounded-xl text-xs font-semibold hover:bg-[#3d5c4e] transition-colors"
            >
              Agregar producto
            </button>
          }
        />
      )}

      {/* Grid View */}
      {viewMode === 'grid' && paginatedProducts.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {paginatedProducts.map(product => {
            const inv = inventory.find(i => i.productoId === product.id);
            const stockActual = inv?.stockActual;
            const stockMinimo = inv?.stockMinimo;

            return (
              <Card key={product.id} className="overflow-hidden">
                <div className="aspect-[4/3] bg-gray-50 overflow-hidden relative">
                  {product.imagen ? (
                    <img src={product.imagen} alt={product.nombre} className="w-full h-full object-contain p-2" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={32} className="text-gray-300" />
                    </div>
                  )}
                  {product.marca && (
                    <span className="absolute top-2 left-2 bg-white/90 rounded-lg text-[10px] font-semibold px-2 py-0.5 text-gray-700">
                      {product.marca}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                        {product.categoria}{product.codigo ? ` · ${product.codigo}` : ''}
                      </p>
                      <h3 className="text-[13px] font-semibold text-gray-900 mb-1 truncate">{product.nombre}</h3>
                      <p className="text-[11px] text-gray-400">{product.tipo} · {product.presentacion}</p>
                      {product.otrasPresentaciones && product.otrasPresentaciones.length > 0 && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          +{product.otrasPresentaciones.length} presentación(es): {product.otrasPresentaciones.join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="ml-2 flex-shrink-0">
                      {estadoBadge(product.estado, stockActual, stockMinimo)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mb-2">
                    <RatingStars rating={product.calificacionPromedio ?? 0} size={11} />
                    <span className="text-[11px] text-gray-500">
                      {product.calificacionPromedio != null
                        ? `${product.calificacionPromedio.toFixed(1)} (${product.cantidadReseñas ?? 0})`
                        : 'Sin reseñas'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">${product.precio.toLocaleString()}</p>
                      {Boolean(product.precioCosto) && product.precioCosto! > 0 && (
                        <p className="text-[11px] text-gray-400">
                          Costo: ${product.precioCosto!.toLocaleString()}
                          {margenGanancia(product.precio, product.precioCosto) && (
                            <span className="ml-1 text-emerald-600 font-medium">
                              ({margenGanancia(product.precio, product.precioCosto)})
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => openView(product)}
                      className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center justify-center gap-1.5 text-xs font-medium"
                    >
                      <Eye size={13} /> Ver
                    </button>
                    <button
                      onClick={() => openEdit(product)}
                      className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-colors flex items-center justify-center gap-1.5 text-xs font-medium"
                    >
                      <Edit2 size={13} /> Editar
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors flex-shrink-0"
                          title="Más acciones"
                        >
                          <MoreVertical size={15} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPromotionModalProduct(product)}>
                          <Tag size={14} /> Promoción
                        </DropdownMenuItem>
                        {product.otrasPresentaciones && product.otrasPresentaciones.length > 0 && (
                          <DropdownMenuItem onClick={() => setVariantImagesModalProduct(product)}>
                            <Images size={14} /> Imágenes por presentación
                          </DropdownMenuItem>
                        )}
                        {onViewInInventory && (
                          <DropdownMenuItem onClick={() => onViewInInventory(product.nombre)}>
                            <Warehouse size={14} /> Ver en inventario
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => { if (confirm('¿Eliminar este producto?')) void handleDelete(product.id); }}
                        >
                          <Trash2 size={14} /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && paginatedProducts.length > 0 && (
        <Table>
          <thead>
            <tr>
              <th className="px-4 py-3 text-left bg-gray-50 border-b border-gray-100"><SortBtn field="nombre">Producto</SortBtn></th>
              <th className="px-4 py-3 text-left bg-gray-50 border-b border-gray-100"><SortBtn field="categoria">Categoría</SortBtn></th>
              <Th>Presentación</Th>
              <th className="px-4 py-3 text-left bg-gray-50 border-b border-gray-100"><SortBtn field="precio">Precio</SortBtn></th>
              <th className="px-4 py-3 text-center bg-gray-50 border-b border-gray-100"><SortBtn field="stock">Stock</SortBtn></th>
              <th className="px-4 py-3 text-center bg-gray-50 border-b border-gray-100"><SortBtn field="estado">Estado</SortBtn></th>
              <Th>Creación</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map(product => {
              const inv = inventory.find(i => i.productoId === product.id);
              const stockActual = inv?.stockActual ?? 0;
              const stockMinimo = inv?.stockMinimo ?? 0;
              const isLow = inv && stockActual > 0 && stockActual < stockMinimo;

              return (
                <tr key={product.id} className="hover:bg-gray-50/50">
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 flex-shrink-0 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden">
                        {product.imagen ? (
                          <img src={product.imagen} alt={product.nombre} className="w-full h-full object-contain p-1" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package size={15} className="text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-900">{product.nombre}</p>
                        <p className="text-[11px] text-gray-400">{product.tipo}{product.marca ? ` · ${product.marca}` : ''}</p>
                        {product.codigo && <p className="text-[11px] text-gray-400 font-mono">{product.codigo}</p>}
                      </div>
                    </div>
                  </Td>
                  <Td className="capitalize">{product.categoria}</Td>
                  <Td>
                    <p>{product.presentacion}</p>
                    {product.otrasPresentaciones && product.otrasPresentaciones.length > 0 && (
                      <p className="text-[10px] text-gray-400">
                        +{product.otrasPresentaciones.join(', ')}
                      </p>
                    )}
                  </Td>
                  <Td>
                    <div className="font-semibold">${product.precio.toLocaleString()}</div>
                    {Boolean(product.precioCosto) && product.precioCosto! > 0 && (
                      <div className="text-[11px] text-gray-400">Costo: ${product.precioCosto!.toLocaleString()}</div>
                    )}
                  </Td>
                  <Td className="text-center">
                    <div className={`text-xs font-semibold ${isLow ? 'text-amber-600' : stockActual === 0 ? 'text-red-600' : 'text-gray-700'}`}>
                      {inv ? stockActual : '—'}
                    </div>
                    {inv && stockActual < stockMinimo && stockActual > 0 && (
                      <div className="text-[10px] text-amber-500">mín. {stockMinimo}</div>
                    )}
                  </Td>
                  <Td className="text-center">{estadoBadge(product.estado, inv?.stockActual, inv?.stockMinimo)}</Td>
                  <Td>
                    {product.fechaCreacion ? (
                      <span className="text-gray-400">
                        {new Date(product.fechaCreacion).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    ) : '—'}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openView(product)} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Ver"><Eye size={13} /></button>
                      <button onClick={() => openEdit(product)} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Editar"><Edit2 size={13} /></button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors" title="Más acciones">
                            <MoreVertical size={13} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setPromotionModalProduct(product)}>
                            <Tag size={14} /> Promoción
                          </DropdownMenuItem>
                          {product.otrasPresentaciones && product.otrasPresentaciones.length > 0 && (
                            <DropdownMenuItem onClick={() => setVariantImagesModalProduct(product)}>
                              <Images size={14} /> Imágenes por presentación
                            </DropdownMenuItem>
                          )}
                          {onViewInInventory && (
                            <DropdownMenuItem onClick={() => onViewInInventory(product.nombre)}>
                              <Warehouse size={14} /> Ver en inventario
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => { if (confirm('¿Eliminar este producto?')) void handleDelete(product.id); }}
                          >
                            <Trash2 size={14} /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <div className="mt-4">
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={processedProducts.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={count => { setItemsPerPage(count); setCurrentPage(1); }}
        />
      </div>

      {/* ---- MODALS ---- */}
      <Modal
        title={modalMode === 'create' ? 'Nuevo Producto' : modalMode === 'edit' ? 'Editar Producto' : (selectedProduct?.nombre ?? '')}
        open={modalMode !== null}
        onClose={closeModal}
        wide
        disableOverlayClose={modalMode === 'create' || modalMode === 'edit'}
      >
        {/* VIEW MODE */}
        {modalMode === 'view' && selectedProduct && (
          <ProductViewPanel
            product={selectedProduct}
            inventory={inventory}
            onEdit={() => { closeModal(); openEdit(selectedProduct); }}
            onPromotion={() => setPromotionModalProduct(selectedProduct)}
            onClose={closeModal}
          />
        )}

        {/* CREATE / EDIT MODE */}
        {(modalMode === 'create' || modalMode === 'edit') && (
          <form onSubmit={handleSubmit} className="flex flex-col">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              {SECTIONS.map((s, i) => {
                const isCompleted = i < sectionIndex;
                const isCurrent = i === sectionIndex;
                return (
                  <div key={s.id} className="flex items-center flex-1 last:flex-initial">
                    <button
                      type="button"
                      onClick={() => goToSection(s.id)}
                      className="flex items-center gap-2 flex-shrink-0"
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                          isCurrent
                            ? 'bg-[#2a4038] text-white'
                            : isCompleted
                              ? 'bg-[#2a4038]/15 text-[#2a4038]'
                              : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {isCompleted ? <Check size={13} /> : i + 1}
                      </span>
                      <span className={`text-xs font-medium hidden sm:inline ${isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>
                        {s.label}
                      </span>
                    </button>
                    {i < SECTIONS.length - 1 && (
                      <div className={`h-px flex-1 mx-2 ${isCompleted ? 'bg-[#2a4038]/30' : 'bg-gray-100'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Section content */}
            <div>
              {/* GENERAL */}
              {activeSection === 'general' && (
                <div className="space-y-5">
                  {modalMode === 'edit' && (editVariants.length > 0 || isLoadingEditVariants) && (
                    <div>
                      <FormLabel>Presentaciones de este producto</FormLabel>
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {editVariants.map(variant => (
                          <button
                            key={variant.id}
                            type="button"
                            onClick={() => selectEditVariant(variant)}
                            title={variant.presentation}
                            className={`flex flex-col items-center gap-1 flex-shrink-0 group`}
                          >
                            <div
                              className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                                editingVariantId === variant.id
                                  ? 'border-[#2a4038] shadow-sm'
                                  : 'border-gray-200 opacity-60 group-hover:opacity-100 group-hover:border-gray-300'
                              }`}
                            >
                              {variant.image_url ? (
                                <img src={variant.image_url} alt={variant.presentation} className="w-full h-full object-contain bg-gray-50 p-1" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-50">
                                  <Package size={16} className="text-gray-300" />
                                </div>
                              )}
                            </div>
                            <span className={`text-[10px] font-medium ${editingVariantId === variant.id ? 'text-[#2a4038]' : 'text-gray-400'}`}>
                              {variant.presentation}
                            </span>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setAddingVariant(true)}
                          title="Agregar nueva presentación"
                          className="flex flex-col items-center gap-1 flex-shrink-0"
                        >
                          <div className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-[#2a4038] hover:text-[#2a4038] transition-colors">
                            <Plus size={20} />
                          </div>
                          <span className="text-[10px] font-medium text-gray-400">Nueva</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {isLoadingEditVariants ? 'Cargando presentaciones...' : 'Haz clic en una presentación para editar su SKU, precio, costo e imágenes específicos.'}
                      </p>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <FormLabel required>Nombre del producto</FormLabel>
                      <input
                        type="text"
                        value={formData.nombre}
                        onChange={e => set({ nombre: e.target.value })}
                        className={inputCls}
                        required
                      />
                    </div>

                    <div>
                      <FormLabel required>Categoría</FormLabel>
                      <Combobox
                        value={formData.categoria}
                        onChange={v => set({ categoria: v.toLowerCase() })}
                        options={catalogCategories}
                        required
                      />
                      <p className="text-[11px] text-gray-400 mt-1">Selecciona una categoría existente de la lista.</p>
                    </div>

                    <div>
                      <FormLabel required>Tipo</FormLabel>
                      <Combobox
                        value={formData.tipo}
                        onChange={v => set({ tipo: v })}
                        options={TIPOS}
                        placeholder="Aceite, Gel, Silicona..."
                        required
                      />
                    </div>

                    <div>
                      <FormLabel required>Número de presentación</FormLabel>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={formData.presentacionNumero ?? ''}
                        onChange={e => {
                          const number = e.target.value ? Number(e.target.value) : undefined;
                          const unit = formData.presentacionUnidad ?? 'ML';
                          set({
                            presentacionNumero: number,
                            presentacionUnidad: unit,
                            presentacion: number ? `${number} ${unit}` : '',
                          });
                        }}
                        className={inputCls}
                        placeholder="60, 120, 250, 1"
                        required
                      />
                    </div>

                    <div>
                      <FormLabel required>Unidad</FormLabel>
                      <select
                        value={formData.presentacionUnidad ?? 'ML'}
                        onChange={e => {
                          const unit = e.target.value as NonNullable<Product['presentacionUnidad']>;
                          set({
                            presentacionUnidad: unit,
                            presentacion: formData.presentacionNumero ? `${formData.presentacionNumero} ${unit}` : '',
                          });
                        }}
                        className={selectCls}
                        required
                      >
                        {PRESENTATION_UNITS.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <FormLabel>Marca</FormLabel>
                      <input
                        type="text"
                        value={formData.marca ?? ''}
                        onChange={e => set({ marca: e.target.value })}
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <FormLabel>Código / Referencia</FormLabel>
                      <input
                        type="text"
                        value={formData.codigo ?? ''}
                        onChange={e => set({ codigo: e.target.value })}
                        className={inputCls}
                        placeholder="SKU-001"
                      />
                    </div>

                    <div>
                      <FormLabel required>Estado</FormLabel>
                      <select
                        value={formData.estado}
                        onChange={e => set({ estado: e.target.value as Product['estado'] })}
                        className={selectCls}
                      >
                        <option value="activo">Activo</option>
                        <option value="inactivo">Inactivo</option>
                        <option value="agotado">Agotado</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <FormLabel>Descripción</FormLabel>
                    <textarea
                      value={formData.descripcion}
                      onChange={e => set({ descripcion: e.target.value })}
                      className={inputCls + ' resize-none'}
                      rows={3}
                    />
                  </div>

                  <div className="rounded-xl border-2 border-[#2a4038]/15 bg-[#2a4038]/[0.03] p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Images size={13} className="text-[#2a4038]" />
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#2a4038]">
                        Imágenes de la presentación {formData.presentacion} (hasta 3)
                      </p>
                    </div>
                    <p className="text-[11px] text-gray-500 mb-3">
                      Estas son las fotos que verán los clientes al elegir esta presentación en la tienda.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[0, 1, 2].map(slot => (
                        <ImageUploader
                          key={slot}
                          value={editVariantImages[slot] ?? ''}
                          onChange={v => {
                            const next = [...editVariantImages];
                            if (v) {
                              next[slot] = v;
                            } else {
                              next.splice(slot, 1);
                            }
                            setEditVariantImages(next.filter(Boolean).slice(0, 3));
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* PRECIOS */}
              {activeSection === 'precios' && (
                <div className="space-y-5">
                  {modalMode === 'edit' && editVariants.length > 1 && (
                    <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                      Estás editando el precio de la presentación <strong>{formData.presentacion}</strong>. Cambia de presentación en la pestaña General para editar otro precio.
                    </p>
                  )}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <FormLabel required>Precio de venta (COP)</FormLabel>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={formData.precio || ''}
                        onChange={e => set({ precio: Number(e.target.value) })}
                        className={inputCls}
                        required
                      />
                    </div>
                    <div>
                      <FormLabel>Precio de costo (COP)</FormLabel>
                      <input
                        type="number"
                        min="0"
                        step="100"
                        value={formData.precioCosto ?? ''}
                        onChange={e => set({ precioCosto: e.target.value ? Number(e.target.value) : undefined })}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {margen && (
                    <Card className="p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Margen de ganancia calculado</p>
                      <p className="text-2xl font-bold text-emerald-600">{margen}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Ganancia: ${(formData.precio - (formData.precioCosto ?? 0)).toLocaleString()} por unidad
                      </p>
                    </Card>
                  )}

                  {(!formData.precio || formData.precio <= 0) && (
                    <div className="text-[11px] text-gray-500 border border-gray-100 rounded-xl p-3 bg-gray-50">
                      Ingresa el precio de venta para calcular el margen.
                    </div>
                  )}
                </div>
              )}

              {/* INVENTARIO */}
              {activeSection === 'inventario' && (
                <div className="space-y-5">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      id="controlarInventario"
                      type="checkbox"
                      checked={formData.controlarInventario ?? true}
                      onChange={e => set({ controlarInventario: e.target.checked })}
                      className="w-4 h-4 accent-[#2a4038]"
                    />
                    <span className="text-xs text-gray-700">Controlar inventario para este producto</span>
                  </label>

                  {formData.controlarInventario && (
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <FormLabel>Stock mínimo</FormLabel>
                          <input
                            type="number"
                            min="0"
                            value={formData.stockMinimo ?? ''}
                            onChange={e => set({ stockMinimo: e.target.value === '' ? undefined : Number(e.target.value) })}
                            onBlur={e => { if (e.target.value === '') set({ stockMinimo: 10 }); }}
                            className={inputCls}
                          />
                          <p className="text-[11px] text-gray-400 mt-1">
                            Se mostrará una alerta cuando el stock esté por debajo de este valor.
                          </p>
                        </div>
                      </div>

                      {modalMode === 'edit' && selectedProduct && (() => {
                        const inv = inventory.find(i => i.productoId === selectedProduct.id);
                        if (!inv) return null;
                        return (
                          <Card className="p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Stock actual</p>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-[11px] text-gray-400 mb-1">Disponible</p>
                                <p className={`text-3xl font-bold ${inv.stockActual === 0 ? 'text-red-600' : inv.stockActual < inv.stockMinimo ? 'text-amber-600' : 'text-gray-900'}`}>
                                  {inv.stockActual}
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] text-gray-400 mb-1">Ubicación</p>
                                <p className="text-xs text-gray-700">{inv.ubicacion}</p>
                              </div>
                            </div>
                            {inv.stockActual < inv.stockMinimo && (
                              <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                                <AlertTriangle size={13} />
                                Stock por debajo del mínimo. Ajusta el stock desde el módulo de Inventario.
                              </div>
                            )}
                          </Card>
                        );
                      })()}

                      {modalMode === 'create' && (
                        <div>
                          <FormLabel>Stock inicial</FormLabel>
                          <input
                            type="number"
                            min="0"
                            value={formData.stockInicial ?? ''}
                            onChange={e => set({ stockInicial: e.target.value === '' ? undefined : Number(e.target.value) })}
                            onBlur={e => { if (e.target.value === '') set({ stockInicial: 0 }); }}
                            className={inputCls}
                          />
                          <p className="text-[11px] text-gray-400 mt-1">
                            Cantidad disponible al publicar el producto. Podrás ajustarla luego desde el módulo de Inventario.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ADICIONAL */}
              {activeSection === 'adicional' && (
                <div className="space-y-5">
                  <div>
                    <FormLabel>Beneficios del producto</FormLabel>
                    <textarea
                      value={formData.beneficios ?? ''}
                      onChange={e => set({ beneficios: e.target.value })}
                      className={inputCls + ' resize-none'}
                      rows={3}
                      placeholder="Lista los beneficios principales..."
                    />
                  </div>
                  <div>
                    <FormLabel>Modo de uso</FormLabel>
                    <textarea
                      value={formData.modoDeUso ?? ''}
                      onChange={e => set({ modoDeUso: e.target.value })}
                      className={inputCls + ' resize-none'}
                      rows={3}
                      placeholder="¿Cómo se aplica el producto?"
                    />
                  </div>
                  <div>
                    <FormLabel>Ingredientes</FormLabel>
                    <textarea
                      value={formData.ingredientes ?? ''}
                      onChange={e => set({ ingredientes: e.target.value })}
                      className={inputCls + ' resize-none'}
                      rows={3}
                      placeholder="Ingredientes principales (opcional)"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 mt-8 pt-5 border-t border-gray-100">
              {sectionIndex > 0 && (
                <button
                  type="button"
                  onClick={goToPrevSection}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft size={15} /> Anterior
                </button>
              )}
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <div className="flex-1" />
              {isLastSection ? (
                <button
                  key="save-button"
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {isSubmitting
                    ? 'Guardando...'
                    : (
                      <>
                        <Check size={15} />
                        {modalMode === 'edit' ? 'Actualizar Producto' : 'Guardar Producto'}
                      </>
                    )}
                </button>
              ) : (
                <button
                  key="next-button"
                  type="button"
                  onClick={e => { e.currentTarget.blur(); goToNextSection(); }}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-6 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] transition-colors"
                >
                  Siguiente <ChevronRight size={15} />
                </button>
              )}
            </div>
          </form>
        )}
      </Modal>

      {promotionModalProduct && (
        <AdminProductPromotionModal
          open={promotionModalProduct !== null}
          onClose={() => setPromotionModalProduct(null)}
          productId={promotionModalProduct.id}
          productName={promotionModalProduct.nombre}
          categorySlug={promotionModalProduct.categoria}
          onChanged={refreshData}
        />
      )}

      {variantImagesModalProduct && (
        <AdminVariantImagesModal
          open={variantImagesModalProduct !== null}
          onClose={() => setVariantImagesModalProduct(null)}
          productId={variantImagesModalProduct.id}
          productName={variantImagesModalProduct.nombre}
          onChanged={refreshData}
        />
      )}

      {selectedProduct && modalMode === 'edit' && (
        <AddVariantModal
          open={isAddingVariant}
          onClose={() => setAddingVariant(false)}
          productId={selectedProduct.id}
          productName={selectedProduct.nombre}
          onCreated={handleVariantCreated}
        />
      )}
    </div>
  );
}

function FormLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

interface ProductViewPanelProps {
  product: Product;
  inventory: Inventory[];
  onEdit: () => void;
  onPromotion: () => void;
  onClose: () => void;
}

function ProductViewPanel({ product, inventory, onEdit, onPromotion, onClose }: ProductViewPanelProps) {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);
  const lastLoadedProductId = useRef<string | null>(null);

  useEffect(() => {
    if (lastLoadedProductId.current === product.id) return;
    lastLoadedProductId.current = product.id;
    setVariants([]);
    setSelectedVariantId(null);
    if (!product.otrasPresentaciones || product.otrasPresentaciones.length === 0) return;

    setIsLoadingVariants(true);
    getProductById(product.id)
      .then(full => {
        setVariants(full.variants);
        setSelectedVariantId(full.variants.find(v => v.presentation === product.presentacion)?.id ?? full.variants[0]?.id ?? null);
      })
      .catch(() => setVariants([]))
      .finally(() => setIsLoadingVariants(false));
  }, [product.id, product.otrasPresentaciones, product.presentacion]);

  const selectedVariant = variants.find(v => v.id === selectedVariantId) ?? null;
  const inv = selectedVariant
    ? inventory.find(i => i.varianteId === selectedVariant.id)
    : inventory.find(i => i.productoId === product.id);

  const displayImage = selectedVariant?.image_url || product.imagen;
  const displayPrecio = selectedVariant?.current_price ?? product.precio;
  const displayCosto = selectedVariant ? selectedVariant.cost : product.precioCosto;
  const displayPresentacion = selectedVariant?.presentation ?? product.presentacion;
  const displayCodigo = selectedVariant?.sku ?? product.codigo;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Image + variant thumbnails */}
        <div className="space-y-4">
          <div className="flex gap-3">
            {variants.length > 1 && (
              <div className="flex flex-col gap-2 flex-shrink-0">
                {variants.map(variant => (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setSelectedVariantId(variant.id)}
                    title={variant.presentation}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                      selectedVariantId === variant.id
                        ? 'border-[#2a4038] shadow-sm'
                        : 'border-gray-200 opacity-60 hover:opacity-100 hover:border-gray-300'
                    }`}
                  >
                    {variant.image_url ? (
                      <img src={variant.image_url} alt={variant.presentation} className="w-full h-full object-contain bg-gray-50 p-1" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        <Package size={16} className="text-gray-300" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 aspect-square rounded-xl bg-gray-50 border border-gray-100 overflow-hidden">
              {displayImage ? (
                <img src={displayImage} alt={product.nombre} className="w-full h-full object-contain p-3" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package size={56} className="text-gray-300" />
                </div>
              )}
            </div>
          </div>
          {variants.length > 1 && (
            <p className="text-[11px] text-gray-400 text-center">
              {isLoadingVariants ? 'Cargando presentaciones...' : 'Haz clic en una miniatura para ver esa presentación'}
            </p>
          )}
          {/* Stock card */}
          {inv && (
            <Card className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Inventario{selectedVariant ? ` · ${selectedVariant.presentation}` : ''}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">Stock actual</p>
                  <p className={`text-2xl font-bold ${inv.stockActual === 0 ? 'text-red-600' : inv.stockActual < inv.stockMinimo ? 'text-amber-600' : 'text-gray-900'}`}>
                    {inv.stockActual}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">Stock mínimo</p>
                  <p className="text-2xl font-bold text-gray-900">{inv.stockMinimo}</p>
                </div>
              </div>
              {inv.stockActual < inv.stockMinimo && (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertTriangle size={13} className="flex-shrink-0" />
                  Stock por debajo del mínimo
                </div>
              )}
              <p className="mt-2 text-[11px] text-gray-400">{inv.ubicacion}</p>
            </Card>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          <div>{estadoBadge(product.estado, inv?.stockActual, inv?.stockMinimo)}</div>

          <div className="grid grid-cols-2 gap-3">
            <ViewField label="Categoría" value={product.categoria} capitalize />
            <ViewField label="Tipo" value={product.tipo} />
            <ViewField label="Presentación" value={displayPresentacion} />
            {product.marca && <ViewField label="Marca" value={product.marca} />}
            {displayCodigo && <ViewField label="Código / SKU" value={displayCodigo} mono />}
            {variants.length <= 1 && product.otrasPresentaciones && product.otrasPresentaciones.length > 0 && (
              <ViewField label="Otras presentaciones" value={product.otrasPresentaciones.join(', ')} />
            )}
          </div>

          <Card className="p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Precio{selectedVariant ? ` · ${selectedVariant.presentation}` : ''}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">${(displayPrecio ?? 0).toLocaleString()}</span>
              <span className="text-[11px] text-gray-400">COP</span>
            </div>
            {Boolean(displayCosto) && displayCosto! > 0 && (
              <p className="text-xs text-gray-500">
                Costo: ${displayCosto!.toLocaleString()}
                {margenGanancia(displayPrecio ?? 0, displayCosto) && (
                  <span className="ml-2 text-emerald-600 font-semibold">
                    Margen: {margenGanancia(displayPrecio ?? 0, displayCosto)}
                  </span>
                )}
              </p>
            )}
          </Card>

          {product.descripcion && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Descripción</p>
              <p className="text-xs leading-relaxed text-gray-600">{product.descripcion}</p>
            </div>
          )}

          {product.fechaCreacion && (
            <p className="text-[11px] text-gray-400">
              Creado: {new Date(product.fechaCreacion).toLocaleDateString('es-CO', { dateStyle: 'long' })}
            </p>
          )}
        </div>
      </div>

      {/* Additional info */}
      {(product.beneficios || product.modoDeUso || product.ingredientes) && (
        <div className="grid md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
          {product.beneficios && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Beneficios</p>
              <p className="text-xs leading-relaxed whitespace-pre-line text-gray-600">{product.beneficios}</p>
            </div>
          )}
          {product.modoDeUso && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Modo de uso</p>
              <p className="text-xs leading-relaxed whitespace-pre-line text-gray-600">{product.modoDeUso}</p>
            </div>
          )}
          {product.ingredientes && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Ingredientes</p>
              <p className="text-xs leading-relaxed whitespace-pre-line text-gray-600">{product.ingredientes}</p>
            </div>
          )}
        </div>
      )}

      <ProductReviewsPanel productId={product.id} />

      <div className="flex gap-3 pt-4 border-t border-gray-100">
        <button
          onClick={onEdit}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white rounded-xl text-xs font-semibold hover:bg-[#3d5c4e] transition-colors"
        >
          <Edit2 size={13} />
          Editar
        </button>
        <button
          onClick={onPromotion}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
        >
          <Tag size={13} />
          Promoción
        </button>
        <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          Cerrar
        </button>
      </div>
    </div>
  );
}

function ViewField({ label, value, capitalize, mono }: { label: string; value: string; capitalize?: boolean; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
      <p className={`text-xs text-gray-700 ${capitalize ? 'capitalize' : ''} ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAdmin } from '../../contexts/AdminContext';
import {
  Plus, Edit2, Trash2, Eye, EyeOff, Grid3x3, List, ArrowUpDown,
  X, Upload, AlertTriangle, ChevronDown, Package,
} from 'lucide-react';
import type { Product } from '../../types/admin';
import { SearchBar } from './SearchBar';
import { FilterPanel, type FilterGroup } from './FilterPanel';
import { Pagination } from './Pagination';
import { useToast } from '../../contexts/ToastContext';

type ViewMode = 'grid' | 'table';
type SortField = 'nombre' | 'precio' | 'categoria' | 'estado' | 'stock';
type SortOrder = 'asc' | 'desc';
type ModalMode = 'create' | 'edit' | 'view' | null;

const CATEGORIAS = ['Capilar', 'Facial', 'Corporal', 'Barbería', 'Baby', 'Personal'];
const TIPOS = ['Aceite', 'Gel', 'Silicona', 'Shampoo', 'Tratamiento', 'Acondicionador', 'Crema', 'Sérum', 'Mascarilla'];
const PRESENTACIONES = ['30 ml', '50 ml', '120 ml', '250 ml', '500 ml', '1 L', '30 gr', '50 gr', '120 gr', '250 gr', '500 gr'];

const EMPTY_FORM: Omit<Product, 'id'> = {
  nombre: '',
  categoria: 'capilar',
  tipo: '',
  presentacion: '',
  precio: 0,
  precioCosto: undefined,
  descripcion: '',
  imagen: '',
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

function margenGanancia(venta: number, costo: number | undefined): string | null {
  if (!costo || costo <= 0 || venta <= 0) return null;
  return (((venta - costo) / venta) * 100).toFixed(1) + '%';
}

function estadoBadge(estado: Product['estado'], stockActual?: number, stockMinimo?: number) {
  const isLow = stockActual !== undefined && stockMinimo !== undefined && stockActual > 0 && stockActual < stockMinimo;
  if (estado === 'agotado' || stockActual === 0) {
    return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-red-100 text-red-800 uppercase tracking-wide">Agotado</span>;
  }
  if (estado === 'inactivo') {
    return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 uppercase tracking-wide"><EyeOff className="w-3 h-3" strokeWidth={1} />Inactivo</span>;
  }
  if (isLow) {
    return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-orange-100 text-orange-800 uppercase tracking-wide"><AlertTriangle className="w-3 h-3" strokeWidth={1} />Stock bajo</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-green-100 text-green-800 uppercase tracking-wide"><Eye className="w-3 h-3" strokeWidth={1} />Activo</span>;
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
          className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground pr-8"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setOpen(o => !o)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          <ChevronDown className="w-3 h-3" strokeWidth={1} />
        </button>
      </div>
      {open && options.length > 0 && (
        <ul className="absolute z-20 w-full bg-background border border-border shadow-lg max-h-48 overflow-y-auto">
          {options
            .filter(o => o.toLowerCase().includes(value.toLowerCase()))
            .map(option => (
              <li
                key={option}
                onMouseDown={() => { onChange(option); setOpen(false); }}
                className="px-3 py-2 text-xs cursor-pointer hover:bg-secondary"
              >
                {option}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
}

function ImageUploader({ value, onChange }: ImageUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => onChange(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('image/')) handleFile(file);
  };

  return (
    <div className="space-y-3">
      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt="Vista previa"
            className="w-full h-48 object-cover border border-border bg-secondary"
          />
          <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-background text-[10px] uppercase tracking-wider px-3 py-1.5 border border-background hover:bg-background hover:text-foreground transition-colors"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-background text-[10px] uppercase tracking-wider px-3 py-1.5 border border-background hover:bg-background hover:text-foreground transition-colors"
            >
              Eliminar
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="border border-dashed border-border h-48 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-secondary transition-colors"
        >
          <Upload className="w-6 h-6 text-muted-foreground" strokeWidth={1} />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Subir imagen</span>
          <span className="text-[10px] text-muted-foreground">o arrastra aquí</span>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <div>
        <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1 block">
          O pega una URL de imagen
        </label>
        <input
          type="url"
          value={value.startsWith('data:') ? '' : value}
          onChange={e => onChange(e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
        />
      </div>
    </div>
  );
}

export function AdminProducts() {
  const { products, inventory, addProduct, updateProduct, deleteProduct } = useAdmin();
  const toast = useToast();
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState<'general' | 'precios' | 'inventario' | 'adicional'>('general');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  const [formData, setFormData] = useState<Omit<Product, 'id'>>(EMPTY_FORM);

  const set = (patch: Partial<Omit<Product, 'id'>>) => setFormData(prev => ({ ...prev, ...patch }));

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
      precio: product.precio,
      precioCosto: product.precioCosto,
      descripcion: product.descripcion,
      imagen: product.imagen,
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
    setIsSubmitting(true);
    try {
      if (modalMode === 'edit' && selectedProduct) {
        await updateProduct(selectedProduct.id, formData);
        toast.success('Producto actualizado correctamente');
      } else {
        await addProduct(formData);
        toast.success('Producto creado correctamente');
      }
      closeModal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible guardar el producto');
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

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortOrder('asc'); }
  };

  const SortBtn = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground"
    >
      {children}
      {sortField === field && <ArrowUpDown className="w-3 h-3" strokeWidth={1} />}
    </button>
  );

  // ---- FORM SECTIONS ----
  const SECTIONS = [
    { id: 'general', label: 'General' },
    { id: 'precios', label: 'Precios' },
    { id: 'inventario', label: 'Inventario' },
    { id: 'adicional', label: 'Adicional' },
  ] as const;

  const margen = margenGanancia(formData.precio, formData.precioCosto);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl mb-2">Productos</h1>
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
            {processedProducts.length} de {products.length} productos
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90"
        >
          <Plus className="w-4 h-4" strokeWidth={1} />
          Nuevo Producto
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
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
            className={`p-2 border border-border transition-colors ${viewMode === 'grid' ? 'bg-foreground text-background' : 'hover:bg-secondary'}`}
            title="Cuadrícula"
          >
            <Grid3x3 className="w-4 h-4" strokeWidth={1} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 border border-border transition-colors ${viewMode === 'table' ? 'bg-foreground text-background' : 'hover:bg-secondary'}`}
            title="Tabla"
          >
            <List className="w-4 h-4" strokeWidth={1} />
          </button>
        </div>
      </div>

      {/* Empty state */}
      {paginatedProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Package className="w-12 h-12 text-muted-foreground mb-4" strokeWidth={1} />
          <p className="text-sm text-muted-foreground mb-6">No se encontraron productos</p>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90"
          >
            Agregar producto
          </button>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && paginatedProducts.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedProducts.map(product => {
            const inv = inventory.find(i => i.productoId === product.id);
            const stockActual = inv?.stockActual;
            const stockMinimo = inv?.stockMinimo;

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-secondary border border-border overflow-hidden"
              >
                <div className="aspect-square bg-background overflow-hidden relative">
                  {product.imagen ? (
                    <img src={product.imagen} alt={product.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-12 h-12 text-muted-foreground" strokeWidth={1} />
                    </div>
                  )}
                  {product.marca && (
                    <div className="absolute top-2 left-2 bg-background/90 text-[10px] px-2 py-0.5 uppercase tracking-wider">
                      {product.marca}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1">
                        {product.categoria}{product.codigo ? ` · ${product.codigo}` : ''}
                      </div>
                      <h3 className="text-sm mb-1 truncate">{product.nombre}</h3>
                      <div className="text-[10px] text-muted-foreground">
                        {product.tipo} · {product.presentacion}
                      </div>
                    </div>
                    <div className="ml-2 flex-shrink-0">
                      {estadoBadge(product.estado, stockActual, stockMinimo)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div>
                      <div className="text-sm">${product.precio.toLocaleString()}</div>
                      {product.precioCosto && product.precioCosto > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          Costo: ${product.precioCosto.toLocaleString()}
                          {margenGanancia(product.precio, product.precioCosto) && (
                            <span className="ml-1 text-green-700">
                              ({margenGanancia(product.precio, product.precioCosto)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => openView(product)}
                      className="flex-1 py-2 border border-border text-[10px] tracking-wider uppercase hover:bg-background transition-colors flex items-center justify-center gap-1"
                      title="Ver"
                    >
                      <Eye className="w-3 h-3" strokeWidth={1} />
                    </button>
                    <button
                      onClick={() => openEdit(product)}
                      className="flex-1 py-2 border border-border text-[10px] tracking-wider uppercase hover:bg-background transition-colors flex items-center justify-center gap-1"
                      title="Editar"
                    >
                      <Edit2 className="w-3 h-3" strokeWidth={1} />
                    </button>
                    <button
                      onClick={() => { if (confirm('¿Eliminar este producto?')) void handleDelete(product.id); }}
                      className="flex-1 py-2 border border-border text-[10px] tracking-wider uppercase hover:bg-background transition-colors flex items-center justify-center gap-1"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={1} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && paginatedProducts.length > 0 && (
        <div className="bg-secondary border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left"><SortBtn field="nombre">Producto</SortBtn></th>
                  <th className="px-4 py-3 text-left"><SortBtn field="categoria">Categoría</SortBtn></th>
                  <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Presentación</th>
                  <th className="px-4 py-3 text-left"><SortBtn field="precio">Precio</SortBtn></th>
                  <th className="px-4 py-3 text-center"><SortBtn field="stock">Stock</SortBtn></th>
                  <th className="px-4 py-3 text-center"><SortBtn field="estado">Estado</SortBtn></th>
                  <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Creación</th>
                  <th className="px-4 py-3 text-center text-[10px] tracking-[0.2em] uppercase text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedProducts.map(product => {
                  const inv = inventory.find(i => i.productoId === product.id);
                  const stockActual = inv?.stockActual ?? 0;
                  const stockMinimo = inv?.stockMinimo ?? 0;
                  const isLow = inv && stockActual > 0 && stockActual < stockMinimo;

                  return (
                    <tr key={product.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 flex-shrink-0 bg-background border border-border overflow-hidden">
                            {product.imagen ? (
                              <img src={product.imagen} alt={product.nombre} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-xs">{product.nombre}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {product.tipo}{product.marca ? ` · ${product.marca}` : ''}
                            </div>
                            {product.codigo && (
                              <div className="text-[10px] text-muted-foreground font-mono">{product.codigo}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs capitalize">{product.categoria}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">{product.presentacion}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">${product.precio.toLocaleString()}</div>
                        {product.precioCosto && product.precioCosto > 0 && (
                          <div className="text-[10px] text-muted-foreground">
                            Costo: ${product.precioCosto.toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className={`text-xs ${isLow ? 'text-orange-600 font-medium' : stockActual === 0 ? 'text-red-600 font-medium' : ''}`}>
                          {inv ? stockActual : '—'}
                        </div>
                        {inv && stockActual < stockMinimo && stockActual > 0 && (
                          <div className="text-[10px] text-orange-500">mín. {stockMinimo}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {estadoBadge(product.estado, inv?.stockActual, inv?.stockMinimo)}
                      </td>
                      <td className="px-4 py-3">
                        {product.fechaCreacion ? (
                          <div className="text-[10px] text-muted-foreground">
                            {new Date(product.fechaCreacion).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openView(product)} className="p-1.5 border border-border hover:bg-background transition-colors" title="Ver"><Eye className="w-3 h-3" strokeWidth={1} /></button>
                          <button onClick={() => openEdit(product)} className="p-1.5 border border-border hover:bg-background transition-colors" title="Editar"><Edit2 className="w-3 h-3" strokeWidth={1} /></button>
                          <button onClick={() => { if (confirm('¿Eliminar este producto?')) void handleDelete(product.id); }} className="p-1.5 border border-border hover:bg-background transition-colors" title="Eliminar"><Trash2 className="w-3 h-3" strokeWidth={1} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={processedProducts.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={count => { setItemsPerPage(count); setCurrentPage(1); }}
      />

      {/* ---- MODALS ---- */}
      <AnimatePresence>
        {modalMode !== null && (
          <div className="fixed inset-0 bg-foreground/90 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-background w-full max-w-3xl max-h-[92vh] flex flex-col"
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                <h2 className="text-xl">
                  {modalMode === 'create' && 'Nuevo Producto'}
                  {modalMode === 'edit' && 'Editar Producto'}
                  {modalMode === 'view' && selectedProduct?.nombre}
                </h2>
                <button onClick={closeModal} className="p-1 hover:bg-secondary transition-colors">
                  <X className="w-5 h-5" strokeWidth={1} />
                </button>
              </div>

              {/* VIEW MODE */}
              {modalMode === 'view' && selectedProduct && (() => {
                const inv = inventory.find(i => i.productoId === selectedProduct.id);
                return (
                  <div className="overflow-y-auto flex-1 p-6 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Image */}
                      <div className="space-y-4">
                        <div className="aspect-square bg-secondary border border-border overflow-hidden">
                          {selectedProduct.imagen ? (
                            <img src={selectedProduct.imagen} alt={selectedProduct.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-16 h-16 text-muted-foreground" strokeWidth={1} />
                            </div>
                          )}
                        </div>
                        {/* Stock card */}
                        {inv && (
                          <div className="border border-border p-4">
                            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">Inventario</div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className="text-[10px] text-muted-foreground mb-0.5">Stock actual</div>
                                <div className={`text-2xl ${inv.stockActual === 0 ? 'text-red-600' : inv.stockActual < inv.stockMinimo ? 'text-orange-600' : ''}`}>
                                  {inv.stockActual}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] text-muted-foreground mb-0.5">Stock mínimo</div>
                                <div className="text-2xl">{inv.stockMinimo}</div>
                              </div>
                            </div>
                            {inv.stockActual < inv.stockMinimo && (
                              <div className="mt-3 flex items-center gap-2 text-[10px] text-orange-700 bg-orange-50 px-3 py-2">
                                <AlertTriangle className="w-3 h-3 flex-shrink-0" strokeWidth={1} />
                                Stock por debajo del mínimo
                              </div>
                            )}
                            <div className="mt-2 text-[10px] text-muted-foreground">{inv.ubicacion}</div>
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="space-y-4">
                        <div>
                          {estadoBadge(selectedProduct.estado, inv?.stockActual, inv?.stockMinimo)}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <ViewField label="Categoría" value={selectedProduct.categoria} capitalize />
                          <ViewField label="Tipo" value={selectedProduct.tipo} />
                          <ViewField label="Presentación" value={selectedProduct.presentacion} />
                          {selectedProduct.marca && <ViewField label="Marca" value={selectedProduct.marca} />}
                          {selectedProduct.codigo && <ViewField label="Código / SKU" value={selectedProduct.codigo} mono />}
                        </div>

                        <div className="border border-border p-4 space-y-2">
                          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">Precio</div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl">${selectedProduct.precio.toLocaleString()}</span>
                            <span className="text-[10px] text-muted-foreground">COP</span>
                          </div>
                          {selectedProduct.precioCosto && selectedProduct.precioCosto > 0 && (
                            <div className="text-xs text-muted-foreground">
                              Costo: ${selectedProduct.precioCosto.toLocaleString()}
                              {margenGanancia(selectedProduct.precio, selectedProduct.precioCosto) && (
                                <span className="ml-2 text-green-700 font-medium">
                                  Margen: {margenGanancia(selectedProduct.precio, selectedProduct.precioCosto)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {selectedProduct.descripcion && (
                          <div>
                            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">Descripción</div>
                            <p className="text-xs leading-relaxed">{selectedProduct.descripcion}</p>
                          </div>
                        )}

                        {selectedProduct.fechaCreacion && (
                          <div className="text-[10px] text-muted-foreground">
                            Creado: {new Date(selectedProduct.fechaCreacion).toLocaleDateString('es-CO', { dateStyle: 'long' })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Additional info */}
                    {(selectedProduct.beneficios || selectedProduct.modoDeUso || selectedProduct.ingredientes) && (
                      <div className="grid md:grid-cols-3 gap-4 pt-4 border-t border-border">
                        {selectedProduct.beneficios && (
                          <div>
                            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">Beneficios</div>
                            <p className="text-xs leading-relaxed whitespace-pre-line">{selectedProduct.beneficios}</p>
                          </div>
                        )}
                        {selectedProduct.modoDeUso && (
                          <div>
                            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">Modo de uso</div>
                            <p className="text-xs leading-relaxed whitespace-pre-line">{selectedProduct.modoDeUso}</p>
                          </div>
                        )}
                        {selectedProduct.ingredientes && (
                          <div>
                            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">Ingredientes</div>
                            <p className="text-xs leading-relaxed whitespace-pre-line">{selectedProduct.ingredientes}</p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3 pt-2 border-t border-border">
                      <button
                        onClick={() => { closeModal(); openEdit(selectedProduct); }}
                        className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90"
                      >
                        <Edit2 className="w-3 h-3" strokeWidth={1} />
                        Editar
                      </button>
                      <button onClick={closeModal} className="px-4 py-2 border border-border text-xs tracking-wider uppercase hover:bg-secondary">
                        Cerrar
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* CREATE / EDIT MODE */}
              {(modalMode === 'create' || modalMode === 'edit') && (
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                  {/* Section tabs */}
                  <div className="flex border-b border-border flex-shrink-0 overflow-x-auto">
                    {SECTIONS.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveSection(s.id)}
                        className={`px-5 py-3 text-[10px] tracking-[0.2em] uppercase whitespace-nowrap transition-colors ${
                          activeSection === s.id
                            ? 'border-b-2 border-foreground text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* Section content */}
                  <div className="overflow-y-auto flex-1 p-6">
                    {/* GENERAL */}
                    {activeSection === 'general' && (
                      <div className="space-y-5">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <FormLabel required>Nombre del producto</FormLabel>
                            <input
                              type="text"
                              value={formData.nombre}
                              onChange={e => set({ nombre: e.target.value })}
                              className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                              required
                            />
                          </div>

                          <div>
                            <FormLabel required>Categoría</FormLabel>
                            <Combobox
                              value={formData.categoria}
                              onChange={v => set({ categoria: v.toLowerCase() })}
                              options={CATEGORIAS}
                              required
                            />
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
                            <FormLabel required>Presentación</FormLabel>
                            <Combobox
                              value={formData.presentacion}
                              onChange={v => set({ presentacion: v })}
                              options={PRESENTACIONES}
                              placeholder="120 ml, 50 gr..."
                              required
                            />
                          </div>

                          <div>
                            <FormLabel>Marca</FormLabel>
                            <input
                              type="text"
                              value={formData.marca ?? ''}
                              onChange={e => set({ marca: e.target.value })}
                              className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                            />
                          </div>

                          <div>
                            <FormLabel>Código / Referencia</FormLabel>
                            <input
                              type="text"
                              value={formData.codigo ?? ''}
                              onChange={e => set({ codigo: e.target.value })}
                              className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                              placeholder="SKU-001"
                            />
                          </div>

                          <div>
                            <FormLabel required>Estado</FormLabel>
                            <select
                              value={formData.estado}
                              onChange={e => set({ estado: e.target.value as Product['estado'] })}
                              className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
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
                            className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground resize-none"
                            rows={3}
                          />
                        </div>

                        <div>
                          <FormLabel>Imagen</FormLabel>
                          <ImageUploader value={formData.imagen} onChange={v => set({ imagen: v })} />
                        </div>
                      </div>
                    )}

                    {/* PRECIOS */}
                    {activeSection === 'precios' && (
                      <div className="space-y-5">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <FormLabel required>Precio de venta (COP)</FormLabel>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={formData.precio || ''}
                              onChange={e => set({ precio: Number(e.target.value) })}
                              className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
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
                              className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                            />
                          </div>
                        </div>

                        {margen && (
                          <div className="border border-border p-4">
                            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">Margen de ganancia calculado</div>
                            <div className="text-2xl text-green-700">{margen}</div>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              Ganancia: ${(formData.precio - (formData.precioCosto ?? 0)).toLocaleString()} por unidad
                            </div>
                          </div>
                        )}

                        {(!formData.precio || formData.precio <= 0) && (
                          <div className="text-[10px] text-muted-foreground border border-border p-3">
                            Ingresa el precio de venta para calcular el margen.
                          </div>
                        )}
                      </div>
                    )}

                    {/* INVENTARIO */}
                    {activeSection === 'inventario' && (
                      <div className="space-y-5">
                        <div className="flex items-center gap-3">
                          <input
                            id="controlarInventario"
                            type="checkbox"
                            checked={formData.controlarInventario ?? true}
                            onChange={e => set({ controlarInventario: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <label htmlFor="controlarInventario" className="text-xs">
                            Controlar inventario para este producto
                          </label>
                        </div>

                        {formData.controlarInventario && (
                          <div className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <FormLabel>Stock mínimo</FormLabel>
                                <input
                                  type="number"
                                  min="0"
                                  value={formData.stockMinimo ?? 10}
                                  onChange={e => set({ stockMinimo: Number(e.target.value) })}
                                  className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  Se mostrará una alerta cuando el stock esté por debajo de este valor.
                                </p>
                              </div>
                            </div>

                            {modalMode === 'edit' && selectedProduct && (() => {
                              const inv = inventory.find(i => i.productoId === selectedProduct.id);
                              if (!inv) return null;
                              return (
                                <div className="border border-border p-4">
                                  <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-3">Stock actual</div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <div className="text-[10px] text-muted-foreground mb-1">Disponible</div>
                                      <div className={`text-3xl ${inv.stockActual === 0 ? 'text-red-600' : inv.stockActual < inv.stockMinimo ? 'text-orange-600' : ''}`}>
                                        {inv.stockActual}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-[10px] text-muted-foreground mb-1">Ubicación</div>
                                      <div className="text-xs">{inv.ubicacion}</div>
                                    </div>
                                  </div>
                                  {inv.stockActual < inv.stockMinimo && (
                                    <div className="mt-3 flex items-center gap-2 text-[10px] text-orange-700 bg-orange-50 px-3 py-2">
                                      <AlertTriangle className="w-3 h-3" strokeWidth={1} />
                                      Stock por debajo del mínimo. Ajusta el stock desde el módulo de Inventario.
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {modalMode === 'create' && (
                              <div>
                                <FormLabel>Stock inicial</FormLabel>
                                <input
                                  type="number"
                                  min="0"
                                  value={formData.stockInicial ?? 0}
                                  onChange={e => set({ stockInicial: Number(e.target.value) })}
                                  className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                                />
                                <p className="text-[10px] text-muted-foreground mt-1">
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
                            className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground resize-none"
                            rows={3}
                            placeholder="Lista los beneficios principales..."
                          />
                        </div>
                        <div>
                          <FormLabel>Modo de uso</FormLabel>
                          <textarea
                            value={formData.modoDeUso ?? ''}
                            onChange={e => set({ modoDeUso: e.target.value })}
                            className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground resize-none"
                            rows={3}
                            placeholder="¿Cómo se aplica el producto?"
                          />
                        </div>
                        <div>
                          <FormLabel>Ingredientes</FormLabel>
                          <textarea
                            value={formData.ingredientes ?? ''}
                            onChange={e => set({ ingredientes: e.target.value })}
                            className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground resize-none"
                            rows={3}
                            placeholder="Ingredientes principales (opcional)"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex gap-3 p-6 border-t border-border flex-shrink-0">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-3 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Guardando...' : modalMode === 'edit' ? 'Actualizar Producto' : 'Crear Producto'}
                    </button>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 py-3 border border-border text-xs tracking-wider uppercase hover:bg-secondary"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FormLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
      {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function ViewField({ label, value, capitalize, mono }: { label: string; value: string; capitalize?: boolean; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-xs ${capitalize ? 'capitalize' : ''} ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

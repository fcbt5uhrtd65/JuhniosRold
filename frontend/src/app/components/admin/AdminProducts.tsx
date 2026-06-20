import { useState, useMemo, useRef } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import {
  Plus, Edit2, Trash2, Eye, EyeOff, Grid3x3, List, ArrowUpDown,
  X, Upload, AlertTriangle, ChevronDown, Package, Warehouse,
  Download, FileSpreadsheet, FileText,
} from 'lucide-react';
import type { Product } from '../../types/admin';
import { SearchBar } from './SearchBar';
import { FilterPanel, type FilterGroup } from './FilterPanel';
import { Pagination } from './Pagination';
import { useToast } from '../../contexts/ToastContext';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '../ui/dropdown-menu';
import { requestProductsExport, type ExportFormat, type PdfLayout } from '../../services/products.service';
import { pollExportStatus } from '../../utils/pollExportStatus';
import { resolveBackendUrl } from '../../services/api';
import { Card, Badge, type BadgeColor, Table, Th, Td, Modal, EmptyState, inputCls, selectCls } from './AdminUI';

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
          {options
            .filter(o => o.toLowerCase().includes(value.toLowerCase()))
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
            className="w-full h-48 object-cover rounded-xl border border-gray-100 bg-gray-50"
          />
          <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/70 hover:bg-white hover:text-gray-900 transition-colors"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/70 hover:bg-white hover:text-gray-900 transition-colors"
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
          className="border-2 border-dashed border-gray-200 rounded-xl h-48 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <Upload size={20} className="text-gray-400" />
          <span className="text-xs font-semibold text-gray-500">Subir imagen</span>
          <span className="text-[11px] text-gray-400">o arrastra aquí</span>
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
        <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">
          O pega una URL de imagen
        </label>
        <input
          type="url"
          value={value.startsWith('data:') ? '' : value}
          onChange={e => onChange(e.target.value)}
          placeholder="https://..."
          className={inputCls}
        />
      </div>
    </div>
  );
}

interface AdminProductsProps {
  onViewInInventory?: (search: string) => void;
}

export function AdminProducts({ onViewInInventory }: AdminProductsProps = {}) {
  const { products, inventory, addProduct, updateProduct, deleteProduct } = useAdmin();
  const toast = useToast();
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
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
      window.open(resolveBackendUrl(relativeUrl), '_blank');
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
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedProducts.map(product => {
            const inv = inventory.find(i => i.productoId === product.id);
            const stockActual = inv?.stockActual;
            const stockMinimo = inv?.stockMinimo;

            return (
              <Card key={product.id} className="overflow-hidden">
                <div className="aspect-square bg-gray-50 overflow-hidden relative">
                  {product.imagen ? (
                    <img src={product.imagen} alt={product.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={40} className="text-gray-300" />
                    </div>
                  )}
                  {product.marca && (
                    <span className="absolute top-2 left-2 bg-white/90 rounded-lg text-[10px] font-semibold px-2 py-0.5 text-gray-700">
                      {product.marca}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                        {product.categoria}{product.codigo ? ` · ${product.codigo}` : ''}
                      </p>
                      <h3 className="text-sm font-semibold text-gray-900 mb-1 truncate">{product.nombre}</h3>
                      <p className="text-[11px] text-gray-400">{product.tipo} · {product.presentacion}</p>
                    </div>
                    <div className="ml-2 flex-shrink-0">
                      {estadoBadge(product.estado, stockActual, stockMinimo)}
                    </div>
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
                      className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center"
                      title="Ver"
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      onClick={() => openEdit(product)}
                      className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center"
                      title="Editar"
                    >
                      <Edit2 size={13} />
                    </button>
                    {onViewInInventory && (
                      <button
                        onClick={() => onViewInInventory(product.nombre)}
                        className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center"
                        title="Ver en Inventario"
                      >
                        <Warehouse size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => { if (confirm('¿Eliminar este producto?')) void handleDelete(product.id); }}
                      className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors flex items-center justify-center"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
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
                          <img src={product.imagen} alt={product.nombre} className="w-full h-full object-cover" />
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
                  <Td>{product.presentacion}</Td>
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
                      {onViewInInventory && (
                        <button onClick={() => onViewInInventory(product.nombre)} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Ver en Inventario"><Warehouse size={13} /></button>
                      )}
                      <button onClick={() => { if (confirm('¿Eliminar este producto?')) void handleDelete(product.id); }} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Eliminar"><Trash2 size={13} /></button>
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
      >
        {/* VIEW MODE */}
        {modalMode === 'view' && selectedProduct && (() => {
          const inv = inventory.find(i => i.productoId === selectedProduct.id);
          return (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Image */}
                <div className="space-y-4">
                  <div className="aspect-square rounded-xl bg-gray-50 border border-gray-100 overflow-hidden">
                    {selectedProduct.imagen ? (
                      <img src={selectedProduct.imagen} alt={selectedProduct.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={56} className="text-gray-300" />
                      </div>
                    )}
                  </div>
                  {/* Stock card */}
                  {inv && (
                    <Card className="p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Inventario</p>
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
                  <div>{estadoBadge(selectedProduct.estado, inv?.stockActual, inv?.stockMinimo)}</div>

                  <div className="grid grid-cols-2 gap-3">
                    <ViewField label="Categoría" value={selectedProduct.categoria} capitalize />
                    <ViewField label="Tipo" value={selectedProduct.tipo} />
                    <ViewField label="Presentación" value={selectedProduct.presentacion} />
                    {selectedProduct.marca && <ViewField label="Marca" value={selectedProduct.marca} />}
                    {selectedProduct.codigo && <ViewField label="Código / SKU" value={selectedProduct.codigo} mono />}
                  </div>

                  <Card className="p-4 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Precio</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-gray-900">${selectedProduct.precio.toLocaleString()}</span>
                      <span className="text-[11px] text-gray-400">COP</span>
                    </div>
                    {Boolean(selectedProduct.precioCosto) && selectedProduct.precioCosto! > 0 && (
                      <p className="text-xs text-gray-500">
                        Costo: ${selectedProduct.precioCosto!.toLocaleString()}
                        {margenGanancia(selectedProduct.precio, selectedProduct.precioCosto) && (
                          <span className="ml-2 text-emerald-600 font-semibold">
                            Margen: {margenGanancia(selectedProduct.precio, selectedProduct.precioCosto)}
                          </span>
                        )}
                      </p>
                    )}
                  </Card>

                  {selectedProduct.descripcion && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Descripción</p>
                      <p className="text-xs leading-relaxed text-gray-600">{selectedProduct.descripcion}</p>
                    </div>
                  )}

                  {selectedProduct.fechaCreacion && (
                    <p className="text-[11px] text-gray-400">
                      Creado: {new Date(selectedProduct.fechaCreacion).toLocaleDateString('es-CO', { dateStyle: 'long' })}
                    </p>
                  )}
                </div>
              </div>

              {/* Additional info */}
              {(selectedProduct.beneficios || selectedProduct.modoDeUso || selectedProduct.ingredientes) && (
                <div className="grid md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                  {selectedProduct.beneficios && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Beneficios</p>
                      <p className="text-xs leading-relaxed whitespace-pre-line text-gray-600">{selectedProduct.beneficios}</p>
                    </div>
                  )}
                  {selectedProduct.modoDeUso && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Modo de uso</p>
                      <p className="text-xs leading-relaxed whitespace-pre-line text-gray-600">{selectedProduct.modoDeUso}</p>
                    </div>
                  )}
                  {selectedProduct.ingredientes && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Ingredientes</p>
                      <p className="text-xs leading-relaxed whitespace-pre-line text-gray-600">{selectedProduct.ingredientes}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button
                  onClick={() => { closeModal(); openEdit(selectedProduct); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white rounded-xl text-xs font-semibold hover:bg-[#3d5c4e] transition-colors"
                >
                  <Edit2 size={13} />
                  Editar
                </button>
                <button onClick={closeModal} className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  Cerrar
                </button>
              </div>
            </div>
          );
        })()}

        {/* CREATE / EDIT MODE */}
        {(modalMode === 'create' || modalMode === 'edit') && (
          <form onSubmit={handleSubmit} className="flex flex-col">
            {/* Section tabs */}
            <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 flex-wrap">
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSection(s.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    activeSection === s.id
                      ? 'bg-white text-[#2a4038] shadow-sm font-semibold'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Section content */}
            <div>
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
                        className={inputCls}
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
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando...' : modalMode === 'edit' ? 'Actualizar Producto' : 'Crear Producto'}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </Modal>
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

function ViewField({ label, value, capitalize, mono }: { label: string; value: string; capitalize?: boolean; mono?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{label}</p>
      <p className={`text-xs text-gray-700 ${capitalize ? 'capitalize' : ''} ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

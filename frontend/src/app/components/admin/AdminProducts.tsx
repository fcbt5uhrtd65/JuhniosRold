import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useAdmin } from '../../contexts/AdminContext';
import { Plus, Edit2, Trash2, Eye, EyeOff, Grid3x3, List, ArrowUpDown } from 'lucide-react';
import type { Product } from '../../types/admin';
import { SearchBar } from './SearchBar';
import { FilterPanel, type FilterGroup } from './FilterPanel';
import { Pagination } from './Pagination';

type ViewMode = 'grid' | 'table';
type SortField = 'nombre' | 'precio' | 'categoria' | 'estado' | 'stock';
type SortOrder = 'asc' | 'desc';

export function AdminProducts() {
  const { products, inventory, addProduct, updateProduct, deleteProduct } = useAdmin();
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  const [formData, setFormData] = useState({
    nombre: '',
    categoria: 'capilar' as Product['categoria'],
    tipo: '',
    presentacion: '',
    precio: '',
    descripcion: '',
    imagen: '',
    estado: 'activo' as Product['estado'],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      updateProduct(editingProduct.id, {
        ...formData,
        precio: Number(formData.precio),
      });
    } else {
      addProduct({
        ...formData,
        precio: Number(formData.precio),
      });
    }
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      categoria: 'capilar',
      tipo: '',
      presentacion: '',
      precio: '',
      descripcion: '',
      imagen: '',
      estado: 'activo',
    });
    setEditingProduct(null);
    setShowModal(false);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      nombre: product.nombre,
      categoria: product.categoria,
      tipo: product.tipo,
      presentacion: product.presentacion,
      precio: product.precio.toString(),
      descripcion: product.descripcion,
      imagen: product.imagen,
      estado: product.estado,
    });
    setShowModal(true);
  };

  // Filter definitions
  const filterGroups: FilterGroup[] = [
    {
      id: 'categoria',
      label: 'Categoría',
      multiple: true,
      options: [
        { label: 'Capilar', value: 'capilar' },
        { label: 'Corporal', value: 'corporal' },
        { label: 'Baby', value: 'baby' },
        { label: 'Personal', value: 'personal' },
      ],
    },
    {
      id: 'estado',
      label: 'Estado',
      multiple: true,
      options: [
        { label: 'Activo', value: 'activo' },
        { label: 'Inactivo', value: 'inactivo' },
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

  // Filtered, sorted, and paginated products
  const processedProducts = useMemo(() => {
    let filtered = [...products];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.nombre.toLowerCase().includes(query) ||
          p.tipo.toLowerCase().includes(query) ||
          p.categoria.toLowerCase().includes(query) ||
          p.presentacion.toLowerCase().includes(query)
      );
    }

    // Filters
    if (activeFilters.categoria?.length) {
      filtered = filtered.filter(p => activeFilters.categoria.includes(p.categoria));
    }
    if (activeFilters.estado?.length) {
      filtered = filtered.filter(p => activeFilters.estado.includes(p.estado));
    }
    if (activeFilters.stock?.length) {
      const stockFilter = activeFilters.stock[0];
      filtered = filtered.filter(p => {
        const inv = inventory.find(i => i.productoId === p.id);
        if (!inv) return stockFilter === 'out';
        if (stockFilter === 'available') return inv.stockActual >= inv.stockMinimo;
        if (stockFilter === 'low') return inv.stockActual > 0 && inv.stockActual < inv.stockMinimo;
        if (stockFilter === 'out') return inv.stockActual === 0;
        return true;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortField === 'stock') {
        const invA = inventory.find(i => i.productoId === a.id);
        const invB = inventory.find(i => i.productoId === b.id);
        aVal = invA?.stockActual || 0;
        bVal = invB?.stockActual || 0;
      } else if (sortField === 'precio') {
        aVal = a.precio;
        bVal = b.precio;
      } else {
        aVal = a[sortField];
        bVal = b[sortField];
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [products, inventory, searchQuery, activeFilters, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(processedProducts.length / itemsPerPage);
  const paginatedProducts = processedProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleFilterChange = (filterId: string, values: string[]) => {
    setActiveFilters(prev => ({ ...prev, [filterId]: values }));
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setActiveFilters({});
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

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
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90"
        >
          <Plus className="w-4 h-4" strokeWidth={1} />
          Nuevo Producto
        </button>
      </div>

      {/* Toolbar: Search, Filters, View Toggle */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar por nombre, tipo, categoría..."
          className="flex-1"
        />
        <FilterPanel
          filters={filterGroups}
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          onClearAll={handleClearFilters}
        />
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 border border-border transition-colors ${
              viewMode === 'grid' ? 'bg-foreground text-background' : 'hover:bg-secondary'
            }`}
            title="Vista de cuadrícula"
          >
            <Grid3x3 className="w-4 h-4" strokeWidth={1} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 border border-border transition-colors ${
              viewMode === 'table' ? 'bg-foreground text-background' : 'hover:bg-secondary'
            }`}
            title="Vista de tabla"
          >
            <List className="w-4 h-4" strokeWidth={1} />
          </button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedProducts.map((product) => {
            const inv = inventory.find(i => i.productoId === product.id);
            const isLowStock = inv && inv.stockActual < inv.stockMinimo;

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-secondary border border-border overflow-hidden"
              >
                <div className="aspect-square bg-background overflow-hidden">
                  <img
                    src={product.imagen}
                    alt={product.nombre}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-xs tracking-[0.2em] uppercase text-muted-foreground mb-1">
                        {product.categoria}
                      </div>
                      <h3 className="text-sm mb-1">{product.nombre}</h3>
                      <div className="text-[10px] text-muted-foreground">
                        {product.tipo} · {product.presentacion}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {product.estado === 'activo' ? (
                        <Eye className="w-3 h-3 text-green-600" strokeWidth={1} />
                      ) : (
                        <EyeOff className="w-3 h-3 text-muted-foreground" strokeWidth={1} />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="text-sm">${product.precio.toLocaleString()}</div>
                    <div className="flex items-center gap-2">
                      {isLowStock && (
                        <span className="text-[10px] px-2 py-1 bg-orange-100 text-orange-800">
                          Stock bajo
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => handleEdit(product)}
                      className="flex-1 py-2 border border-border text-xs tracking-wider uppercase hover:bg-background transition-colors"
                    >
                      <Edit2 className="w-3 h-3 mx-auto" strokeWidth={1} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('¿Eliminar producto?')) {
                          deleteProduct(product.id);
                        }
                      }}
                      className="flex-1 py-2 border border-border text-xs tracking-wider uppercase hover:bg-background transition-colors"
                    >
                      <Trash2 className="w-3 h-3 mx-auto" strokeWidth={1} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-secondary border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('nombre')}
                      className="flex items-center gap-1 text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground"
                    >
                      Producto
                      {sortField === 'nombre' && (
                        <ArrowUpDown className="w-3 h-3" strokeWidth={1} />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('categoria')}
                      className="flex items-center gap-1 text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground"
                    >
                      Categoría
                      {sortField === 'categoria' && (
                        <ArrowUpDown className="w-3 h-3" strokeWidth={1} />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('precio')}
                      className="flex items-center gap-1 text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground"
                    >
                      Precio
                      {sortField === 'precio' && (
                        <ArrowUpDown className="w-3 h-3" strokeWidth={1} />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleSort('stock')}
                      className="flex items-center gap-1 text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground mx-auto"
                    >
                      Stock
                      {sortField === 'stock' && (
                        <ArrowUpDown className="w-3 h-3" strokeWidth={1} />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleSort('estado')}
                      className="flex items-center gap-1 text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground mx-auto"
                    >
                      Estado
                      {sortField === 'estado' && (
                        <ArrowUpDown className="w-3 h-3" strokeWidth={1} />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedProducts.map((product) => {
                  const inv = inventory.find(i => i.productoId === product.id);
                  const stockActual = inv?.stockActual || 0;
                  const isLowStock = inv && inv.stockActual < inv.stockMinimo;

                  return (
                    <tr key={product.id} className="hover:bg-background/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={product.imagen}
                            alt={product.nombre}
                            className="w-10 h-10 object-cover bg-background"
                          />
                          <div>
                            <div className="text-xs">{product.nombre}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {product.tipo} · {product.presentacion}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs capitalize">{product.categoria}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">${product.precio.toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div
                          className={`text-sm ${
                            isLowStock ? 'text-orange-600 font-medium' : ''
                          }`}
                        >
                          {stockActual}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {product.estado === 'activo' ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-800">
                            <Eye className="w-3 h-3" strokeWidth={1} />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 text-gray-800">
                            <EyeOff className="w-3 h-3" strokeWidth={1} />
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-2 border border-border hover:bg-background transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-3 h-3" strokeWidth={1} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('¿Eliminar producto?')) {
                                deleteProduct(product.id);
                              }
                            }}
                            className="p-2 border border-border hover:bg-background transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" strokeWidth={1} />
                          </button>
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

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={processedProducts.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(count) => {
          setItemsPerPage(count);
          setCurrentPage(1);
        }}
      />

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-foreground/90 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-background p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl mb-6">
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                    Categoría
                  </label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value as Product['categoria'] })}
                    className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                  >
                    <option value="capilar">Capilar</option>
                    <option value="corporal">Corporal</option>
                    <option value="baby">Baby</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                    Tipo
                  </label>
                  <input
                    type="text"
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                    placeholder="Aceite, Gel, Silicona..."
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                    Presentación
                  </label>
                  <input
                    type="text"
                    value={formData.presentacion}
                    onChange={(e) => setFormData({ ...formData, presentacion: e.target.value })}
                    className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                    placeholder="120ml, 50gr..."
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                    Precio
                  </label>
                  <input
                    type="number"
                    value={formData.precio}
                    onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                    className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                    required
                  />
                </div>

                <div>
                  <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                    Estado
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) => setFormData({ ...formData, estado: e.target.value as Product['estado'] })}
                    className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                  >
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground resize-none"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2 block">
                  URL Imagen
                </label>
                <input
                  type="url"
                  value={formData.imagen}
                  onChange={(e) => setFormData({ ...formData, imagen: e.target.value })}
                  className="w-full px-3 py-2 bg-transparent border border-border text-xs focus:outline-none focus:border-foreground"
                  placeholder="https://..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-foreground text-background text-xs tracking-wider uppercase hover:opacity-90"
                >
                  {editingProduct ? 'Actualizar' : 'Crear'} Producto
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 py-3 border border-border text-xs tracking-wider uppercase hover:bg-secondary"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

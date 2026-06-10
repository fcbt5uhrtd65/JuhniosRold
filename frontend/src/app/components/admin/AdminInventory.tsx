import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useAdmin } from '../../contexts/AdminContext';
import { AlertTriangle, TrendingUp, TrendingDown, Package, ArrowUpDown } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { FilterPanel, type FilterGroup } from './FilterPanel';
import { Pagination } from './Pagination';

type SortField = 'nombre' | 'categoria' | 'stockActual' | 'stockMinimo' | 'ubicacion';
type SortOrder = 'asc' | 'desc';

export function AdminInventory() {
  const { products, inventory, updateInventory } = useAdmin();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newStock, setNewStock] = useState('');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const handleUpdate = (productId: string) => {
    if (newStock) {
      updateInventory(productId, Number(newStock));
      setEditingId(null);
      setNewStock('');
    }
  };

  const inventoryWithProducts = inventory.map(inv => ({
    ...inv,
    product: products.find(p => p.id === inv.productoId),
  }));

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
      label: 'Estado de Stock',
      multiple: true,
      options: [
        { label: 'Stock OK', value: 'ok' },
        { label: 'Stock Bajo', value: 'low' },
        { label: 'Sin Stock', value: 'out' },
      ],
    },
  ];

  // Filtered, sorted, and paginated inventory
  const processedInventory = useMemo(() => {
    let filtered = [...inventoryWithProducts];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        inv =>
          inv.product?.nombre.toLowerCase().includes(query) ||
          inv.product?.categoria.toLowerCase().includes(query) ||
          inv.ubicacion.toLowerCase().includes(query) ||
          inv.lote?.toLowerCase().includes(query)
      );
    }

    // Filters
    if (activeFilters.categoria?.length) {
      filtered = filtered.filter(inv =>
        activeFilters.categoria.includes(inv.product?.categoria || '')
      );
    }
    if (activeFilters.estado?.length) {
      filtered = filtered.filter(inv => {
        const hasLow = activeFilters.estado.includes('low');
        const hasOk = activeFilters.estado.includes('ok');
        const hasOut = activeFilters.estado.includes('out');

        const isLow = inv.stockActual > 0 && inv.stockActual < inv.stockMinimo;
        const isOk = inv.stockActual >= inv.stockMinimo;
        const isOut = inv.stockActual === 0;

        return (hasLow && isLow) || (hasOk && isOk) || (hasOut && isOut);
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortField === 'nombre') {
        aVal = a.product?.nombre || '';
        bVal = b.product?.nombre || '';
      } else if (sortField === 'categoria') {
        aVal = a.product?.categoria || '';
        bVal = b.product?.categoria || '';
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
  }, [inventoryWithProducts, searchQuery, activeFilters, sortField, sortOrder]);

  const lowStock = processedInventory.filter(inv => inv.stockActual < inv.stockMinimo && inv.stockActual > 0);
  const okStock = processedInventory.filter(inv => inv.stockActual >= inv.stockMinimo);
  const outOfStock = processedInventory.filter(inv => inv.stockActual === 0);

  // Pagination
  const totalPages = Math.ceil(processedInventory.length / itemsPerPage);
  const paginatedInventory = processedInventory.slice(
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
      <div>
        <h1 className="text-3xl mb-2">Inventario</h1>
        <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          {processedInventory.length} de {inventory.length} productos · Control de stock en tiempo real
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-secondary p-4 border border-border"
        >
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Total SKUs
            </div>
          </div>
          <div className="text-xl">{inventory.length}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-secondary p-4 border border-border cursor-pointer hover:bg-background/50 transition-colors"
          onClick={() => {
            setActiveFilters({ estado: ['ok'] });
            setCurrentPage(1);
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Stock OK
            </div>
          </div>
          <div className="text-xl">{okStock.length}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-secondary p-4 border border-border cursor-pointer hover:bg-background/50 transition-colors"
          onClick={() => {
            setActiveFilters({ estado: ['low'] });
            setCurrentPage(1);
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Stock Bajo
            </div>
          </div>
          <div className="text-xl">{lowStock.length}</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-secondary p-4 border border-border cursor-pointer hover:bg-background/50 transition-colors"
          onClick={() => {
            setActiveFilters({ estado: ['out'] });
            setCurrentPage(1);
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-600" strokeWidth={1} />
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
              Sin Stock
            </div>
          </div>
          <div className="text-xl">{outOfStock.length}</div>
        </motion.div>
      </div>

      {/* Toolbar: Search & Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar por producto, categoría, ubicación, lote..."
          className="flex-1"
        />
        <FilterPanel
          filters={filterGroups}
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          onClearAll={handleClearFilters}
        />
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && !activeFilters.estado?.includes('low') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-orange-50 border border-orange-200 p-4 cursor-pointer hover:bg-orange-100 transition-colors"
          onClick={() => {
            setActiveFilters({ estado: ['low'] });
            setCurrentPage(1);
          }}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600" strokeWidth={1} />
            <div className="text-sm text-orange-900">
              {lowStock.length} producto(s) con stock bajo necesitan reabastecimiento
            </div>
            <div className="ml-auto text-xs text-orange-700 underline">
              Ver productos
            </div>
          </div>
        </motion.div>
      )}

      {/* Inventory Table */}
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
                <th className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleSort('stockActual')}
                    className="flex items-center gap-1 text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground mx-auto"
                  >
                    Stock Actual
                    {sortField === 'stockActual' && (
                      <ArrowUpDown className="w-3 h-3" strokeWidth={1} />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleSort('stockMinimo')}
                    className="flex items-center gap-1 text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground mx-auto"
                  >
                    Stock Mínimo
                    {sortField === 'stockMinimo' && (
                      <ArrowUpDown className="w-3 h-3" strokeWidth={1} />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button
                    onClick={() => handleSort('ubicacion')}
                    className="flex items-center gap-1 text-[10px] tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground"
                  >
                    Ubicación
                    {sortField === 'ubicacion' && (
                      <ArrowUpDown className="w-3 h-3" strokeWidth={1} />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Lote
                </th>
                <th className="px-4 py-3 text-center text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Estado
                </th>
                <th className="px-4 py-3 text-center text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginatedInventory.map((inv) => {
                const isLow = inv.stockActual < inv.stockMinimo;
                const isEditing = editingId === inv.productoId;

                return (
                  <tr key={inv.id} className="hover:bg-background/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={inv.product?.imagen}
                          alt={inv.product?.nombre}
                          className="w-10 h-10 object-cover bg-background"
                        />
                        <div>
                          <div className="text-xs">{inv.product?.nombre}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {inv.product?.presentacion}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs capitalize">{inv.product?.categoria}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <input
                          type="number"
                          value={newStock}
                          onChange={(e) => setNewStock(e.target.value)}
                          className="w-20 px-2 py-1 bg-transparent border border-border text-xs text-center focus:outline-none focus:border-foreground"
                          autoFocus
                        />
                      ) : (
                        <div className={`text-sm ${isLow ? 'text-orange-600 font-medium' : ''}`}>
                          {inv.stockActual}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-xs text-muted-foreground">{inv.stockMinimo}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">{inv.ubicacion}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted-foreground">{inv.lote || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-orange-100 text-orange-800">
                          <AlertTriangle className="w-3 h-3" strokeWidth={1} />
                          Bajo
                        </span>
                      ) : inv.stockActual === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-red-100 text-red-800">
                          Sin stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-green-100 text-green-800">
                          ✓ OK
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleUpdate(inv.productoId)}
                            className="text-xs px-2 py-1 bg-foreground text-background hover:opacity-90"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setNewStock('');
                            }}
                            className="text-xs px-2 py-1 border border-border hover:bg-background"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(inv.productoId);
                            setNewStock(inv.stockActual.toString());
                          }}
                          className="text-xs px-3 py-1 border border-border hover:bg-background transition-colors"
                        >
                          Ajustar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={processedInventory.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(count) => {
          setItemsPerPage(count);
          setCurrentPage(1);
        }}
      />
    </div>
  );
}

import { useState, useMemo } from 'react';
import { useAdmin } from '../../contexts/AdminContext';
import {
  AlertTriangle, TrendingUp, TrendingDown, Package, ArrowUpDown,
  Download, FileSpreadsheet, FileText,
} from 'lucide-react';
import { SearchBar } from './SearchBar';
import { FilterPanel, type FilterGroup } from './FilterPanel';
import { Pagination } from './Pagination';
import { useToast } from '../../contexts/ToastContext';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '../ui/dropdown-menu';
import { requestProductsExport, type ExportFormat, type PdfLayout } from '../../services/products.service';
import { pollExportStatus, downloadFile } from '../../utils/pollExportStatus';
import { resolveBackendUrl } from '../../services/api';
import { KpiCard, Table, Th, Td, Badge, inputCls } from './AdminUI';

type SortField = 'nombre' | 'categoria' | 'stockActual' | 'stockMinimo' | 'ubicacion';
type SortOrder = 'asc' | 'desc';

interface AdminInventoryProps {
  initialSearch?: string;
}

export function AdminInventory({ initialSearch = '' }: AdminInventoryProps) {
  const { products, inventory, updateInventory } = useAdmin();
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newStock, setNewStock] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const handleUpdate = async (inventoryId: string) => {
    if (newStock) {
      setIsUpdating(true);
      try {
        await updateInventory(inventoryId, Number(newStock));
        toast.success('Inventario actualizado correctamente');
        setEditingId(null);
        setNewStock('');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No fue posible actualizar el inventario');
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const inventoryWithProducts = inventory.map(inv => ({
    ...inv,
    product: products.find(p => p.id === inv.productoId),
  }));

  // Filter definitions
  const categoryOptions = useMemo(
    () => Array.from(new Set(products.map(product => product.categoria).filter(Boolean))).sort(),
    [products],
  );

  const filterGroups: FilterGroup[] = [
    {
      id: 'categoria',
      label: 'Categoría',
      multiple: true,
      options: categoryOptions.map(category => ({
        label: category.charAt(0).toUpperCase() + category.slice(1),
        value: category,
      })),
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
          inv.ubicacion.toLowerCase().includes(query)
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

  const handleExport = async (format: ExportFormat, pdfLayout: PdfLayout = 'table') => {
    const ids = Array.from(new Set(processedInventory.map(inv => inv.productoId)));
    if (ids.length === 0) {
      toast.warning('No hay productos para exportar.');
      return;
    }
    setIsExporting(true);
    toast.info('Generando exportación, esto puede tardar unos segundos...');
    try {
      const taskId = await requestProductsExport(format, ids, pdfLayout);
      const relativeUrl = await pollExportStatus(taskId);
      await downloadFile(resolveBackendUrl(relativeUrl));
      toast.success('Exportación lista.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar el inventario');
    } finally {
      setIsExporting(false);
    }
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

  const SortHeader = ({ field, children, center }: { field: SortField; children: React.ReactNode; center?: boolean }) => (
    <th className={`px-4 py-3 ${center ? 'text-center' : 'text-left'} bg-gray-50 border-b border-gray-100 whitespace-nowrap`}>
      <button
        onClick={() => handleSort(field)}
        className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-700 ${center ? 'mx-auto' : ''}`}
      >
        {children}
        {sortField === field && <ArrowUpDown size={11} />}
      </button>
    </th>
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Inventario</h2>
        <p className="text-xs text-gray-500 mt-0.5">{processedInventory.length} de {inventory.length} productos · Control de stock en tiempo real</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total SKUs" value={String(inventory.length)} icon={Package} color="text-gray-600 bg-gray-100" />
        <button
          onClick={() => { setActiveFilters({ estado: ['ok'] }); setCurrentPage(1); }}
          className="text-left"
        >
          <KpiCard label="Stock OK" value={String(okStock.length)} icon={TrendingUp} color="text-emerald-600 bg-emerald-50" />
        </button>
        <button
          onClick={() => { setActiveFilters({ estado: ['low'] }); setCurrentPage(1); }}
          className="text-left"
        >
          <KpiCard label="Stock Bajo" value={String(lowStock.length)} icon={AlertTriangle} color="text-amber-600 bg-amber-50" />
        </button>
        <button
          onClick={() => { setActiveFilters({ estado: ['out'] }); setCurrentPage(1); }}
          className="text-left"
        >
          <KpiCard label="Sin Stock" value={String(outOfStock.length)} icon={TrendingDown} color="text-red-600 bg-red-50" />
        </button>
      </div>

      {/* Toolbar: Search & Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-6">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar por producto, categoría, ubicación..."
          className="flex-1"
        />
        <FilterPanel
          filters={filterGroups}
          activeFilters={activeFilters}
          onFilterChange={handleFilterChange}
          onClearAll={handleClearFilters}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              disabled={isExporting || processedInventory.length === 0}
              className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Exportar inventario filtrado"
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

      {/* Low Stock Alert */}
      {lowStock.length > 0 && !activeFilters.estado?.includes('low') && (
        <button
          onClick={() => { setActiveFilters({ estado: ['low'] }); setCurrentPage(1); }}
          className="w-full flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6 hover:bg-amber-100/70 transition-colors text-left"
        >
          <AlertTriangle size={18} className="text-amber-500" />
          <p className="text-sm text-amber-900">{lowStock.length} producto(s) con stock bajo necesitan reabastecimiento</p>
          <span className="ml-auto text-xs text-amber-700 underline">Ver productos</span>
        </button>
      )}

      {/* Inventory Table */}
      <Table>
        <thead>
          <tr>
            <SortHeader field="nombre">Producto</SortHeader>
            <SortHeader field="categoria">Categoría</SortHeader>
            <SortHeader field="stockActual" center>Stock Actual</SortHeader>
            <SortHeader field="stockMinimo" center>Stock Mínimo</SortHeader>
            <SortHeader field="ubicacion">Ubicación</SortHeader>
            <Th>Estado</Th>
            <Th>Acción</Th>
          </tr>
        </thead>
        <tbody>
          {paginatedInventory.map((inv) => {
            const isLow = inv.stockActual < inv.stockMinimo;
            const isEditing = editingId === inv.id;

            return (
              <tr key={inv.id} className="hover:bg-gray-50/50">
                <Td>
                  <div className="flex items-center gap-3">
                    <img
                      src={inv.product?.imagen}
                      alt={inv.product?.nombre}
                      className="w-10 h-10 rounded-lg object-cover bg-gray-50 border border-gray-100"
                    />
                    <div>
                      <p className="text-xs font-medium text-gray-900">{inv.product?.nombre}</p>
                      <p className="text-[11px] text-gray-400">{inv.presentacionVariante ?? inv.product?.presentacion}</p>
                    </div>
                  </div>
                </Td>
                <Td className="capitalize">{inv.product?.categoria}</Td>
                <Td className="text-center">
                  {isEditing ? (
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={newStock}
                      onChange={(e) => setNewStock(e.target.value)}
                      className={inputCls + ' w-20 text-center py-1.5'}
                      autoFocus
                    />
                  ) : (
                    <span className={`text-sm font-semibold ${isLow ? 'text-amber-600' : 'text-gray-700'}`}>{inv.stockActual}</span>
                  )}
                </Td>
                <Td className="text-center text-gray-400">{inv.stockMinimo}</Td>
                <Td>{inv.ubicacion}</Td>
                <Td className="text-center">
                  {inv.stockActual === 0 ? (
                    <Badge label="Sin stock" color="red" />
                  ) : isLow ? (
                    <Badge label={<span className="flex items-center gap-1"><AlertTriangle size={11} />Bajo</span>} color="yellow" />
                  ) : (
                    <Badge label="✓ OK" color="green" />
                  )}
                </Td>
                <Td className="text-center">
                  {isEditing ? (
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => void handleUpdate(inv.id)}
                        disabled={isUpdating}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-[#2a4038] text-white hover:bg-[#3d5c4e] transition-colors"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setNewStock('');
                        }}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(inv.id);
                        setNewStock(inv.stockActual.toString());
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Ajustar
                    </button>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {/* Pagination */}
      <div className="mt-4">
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
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Edit2,
  Filter,
  FlaskConical,
  Loader2,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { useToast } from '../../contexts/ToastContext';
import {
  createItem,
  deleteItem,
  getItemGroups,
  getItemTypes,
  getItems,
  getSuppliers,
  getUnits,
  updateItem,
  type Item,
  type ItemGroup,
  type ItemType,
  type Supplier,
  type UnitOfMeasure,
} from '../../services/inventory-masters.service';
import {
  ActionsMenu,
  Badge,
  Card,
  EmptyState,
  Field,
  LoadingState,
  Modal,
  PageHeader,
  Table,
  Td,
  Th,
  actionsCellCls,
  inputCls,
  selectCls,
} from './AdminUI';

type MaterialForm = {
  code: string;
  name: string;
  itemTypeId: string;
  itemGroupId: string;
  unitId: string;
  supplierId: string;
  cost: string;
  taxRate: string;
  minimumQuantity: string;
  maximumQuantity: string;
  description: string;
  tracksInventory: boolean;
  tracksBatches: boolean;
  isActive: boolean;
};

type SortKey = 'name' | 'code' | 'cost' | 'status';

const RAW_KEYWORDS = ['materia prima', 'materia', 'fragancia', 'colorante', 'extracto'];

function normalize(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isRawMaterialLabel(value: string | null | undefined): boolean {
  const text = normalize(value);
  return RAW_KEYWORDS.some((keyword) => text.includes(keyword));
}

function isRawMaterial(item: Item, itemTypeById: Map<string, ItemType>, itemGroupById: Map<string, ItemGroup>): boolean {
  return isRawMaterialLabel(itemTypeById.get(item.itemTypeId)?.name) || isRawMaterialLabel(itemGroupById.get(item.itemGroupId)?.name);
}

function numeric(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function currency(value: number): string {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

function emptyForm(defaults: { typeId: string; groupId: string; unitId: string }): MaterialForm {
  return {
    code: '',
    name: '',
    itemTypeId: defaults.typeId,
    itemGroupId: defaults.groupId,
    unitId: defaults.unitId,
    supplierId: '',
    cost: '0',
    taxRate: '0',
    minimumQuantity: '0',
    maximumQuantity: '0',
    description: '',
    tracksInventory: true,
    tracksBatches: true,
    isActive: true,
  };
}

function formFromItem(item: Item): MaterialForm {
  return {
    code: item.code,
    name: item.name,
    itemTypeId: item.itemTypeId,
    itemGroupId: item.itemGroupId,
    unitId: item.unitId,
    supplierId: item.supplierId ?? '',
    cost: String(item.cost),
    taxRate: String(item.taxRate),
    minimumQuantity: String(item.minimumQuantity),
    maximumQuantity: String(item.maximumQuantity),
    description: item.description,
    tracksInventory: item.tracksInventory,
    tracksBatches: item.tracksBatches,
    isActive: item.isActive,
  };
}

export function AdminRawMaterials() {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');

  const itemTypeById = useMemo(() => new Map(itemTypes.map((item) => [item.id, item])), [itemTypes]);
  const itemGroupById = useMemo(() => new Map(itemGroups.map((item) => [item.id, item])), [itemGroups]);
  const unitById = useMemo(() => new Map(units.map((item) => [item.id, item])), [units]);
  const supplierById = useMemo(() => new Map(suppliers.map((item) => [item.id, item])), [suppliers]);

  const rawTypes = useMemo(() => itemTypes.filter((item) => isRawMaterialLabel(item.name)), [itemTypes]);
  const rawGroups = useMemo(() => itemGroups.filter((item) => isRawMaterialLabel(item.name)), [itemGroups]);
  const defaultIds = useMemo(() => ({
    typeId: rawTypes[0]?.id ?? itemTypes[0]?.id ?? '',
    groupId: rawGroups[0]?.id ?? itemGroups[0]?.id ?? '',
    unitId: units[0]?.id ?? '',
  }), [itemGroups, itemTypes, rawGroups, rawTypes, units]);
  const [form, setForm] = useState<MaterialForm>(() => emptyForm({ typeId: '', groupId: '', unitId: '' }));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [nextItems, nextTypes, nextGroups, nextUnits, nextSuppliers] = await Promise.all([
        getItems(),
        getItemTypes(),
        getItemGroups(),
        getUnits(),
        getSuppliers(),
      ]);
      setItems(nextItems);
      setItemTypes(nextTypes);
      setItemGroups(nextGroups);
      setUnits(nextUnits);
      setSuppliers(nextSuppliers);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las materias primas');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rawMaterials = useMemo(
    () => items.filter((item) => isRawMaterial(item, itemTypeById, itemGroupById)),
    [itemGroupById, itemTypeById, items],
  );

  const filteredItems = useMemo(() => {
    const query = normalize(search);
    return rawMaterials
      .filter((item) => {
        const type = itemTypeById.get(item.itemTypeId);
        const group = itemGroupById.get(item.itemGroupId);
        const supplier = item.supplierId ? supplierById.get(item.supplierId) : null;
        const unit = unitById.get(item.unitId);
        const text = normalize(`${item.code} ${item.name} ${item.description} ${type?.name} ${group?.name} ${supplier?.name} ${unit?.name}`);
        const matchesSearch = !query || text.includes(query);
        const matchesType = typeFilter === 'all' || item.itemTypeId === typeFilter;
        const matchesGroup = groupFilter === 'all' || item.itemGroupId === groupFilter;
        const matchesSupplier = supplierFilter === 'all' || item.supplierId === supplierFilter;
        const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? item.isActive : !item.isActive);
        return matchesSearch && matchesType && matchesGroup && matchesSupplier && matchesStatus;
      })
      .sort((left, right) => {
        if (sortKey === 'cost') return right.cost - left.cost;
        if (sortKey === 'status') return Number(right.isActive) - Number(left.isActive);
        const leftValue = sortKey === 'code' ? left.code : left.name;
        const rightValue = sortKey === 'code' ? right.code : right.name;
        return leftValue.localeCompare(rightValue, 'es', { numeric: true, sensitivity: 'base' });
      });
  }, [groupFilter, itemGroupById, itemTypeById, rawMaterials, search, sortKey, statusFilter, supplierById, supplierFilter, typeFilter, unitById]);

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm(defaultIds));
    setShowModal(true);
  };

  const openEdit = (item: Item) => {
    setEditingItem(item);
    setForm(formFromItem(item));
    setShowModal(true);
  };

  const setFormField = <K extends keyof MaterialForm>(key: K, value: MaterialForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const validateForm = () => {
    if (!form.code.trim()) return 'Indica el codigo interno.';
    if (!form.name.trim()) return 'Indica el nombre de la materia prima.';
    if (!form.itemTypeId) return 'Selecciona el tipo.';
    if (!form.itemGroupId) return 'Selecciona el grupo.';
    if (!form.unitId) return 'Selecciona la unidad.';
    if (!isRawMaterialLabel(itemTypeById.get(form.itemTypeId)?.name) && !isRawMaterialLabel(itemGroupById.get(form.itemGroupId)?.name)) {
      return 'Selecciona un tipo o grupo de materia prima, fragancia, colorante o extracto.';
    }
    return null;
  };

  const saveMaterial = async () => {
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        itemTypeId: form.itemTypeId,
        itemGroupId: form.itemGroupId,
        unitId: form.unitId,
        supplierId: form.supplierId || null,
        cost: numeric(form.cost),
        taxRate: numeric(form.taxRate),
        minimumQuantity: numeric(form.minimumQuantity),
        maximumQuantity: numeric(form.maximumQuantity),
        description: form.description.trim(),
        tracksInventory: form.tracksInventory,
        tracksBatches: form.tracksBatches,
        isActive: form.isActive,
      };
      if (editingItem) {
        await updateItem(editingItem.id, payload);
        toast.success('Materia prima actualizada');
      } else {
        await createItem(payload);
        toast.success('Materia prima creada');
      }
      setShowModal(false);
      await loadData();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'No se pudo guardar la materia prima');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: Item) => {
    try {
      await updateItem(item.id, { isActive: !item.isActive });
      toast.success(item.isActive ? 'Materia prima desactivada' : 'Materia prima activada');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el estado');
    }
  };

  const removeMaterial = async (item: Item) => {
    if (!window.confirm(`Eliminar ${item.name}?`)) return;
    try {
      await deleteItem(item.id);
      toast.info('Materia prima eliminada');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la materia prima');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setGroupFilter('all');
    setSupplierFilter('all');
    setStatusFilter('all');
    setSortKey('name');
  };

  const activeFilters = [search, typeFilter !== 'all', groupFilter !== 'all', supplierFilter !== 'all', statusFilter !== 'all'].filter(Boolean).length;
  const canCreate = Boolean(defaultIds.typeId && defaultIds.groupId && defaultIds.unitId && (rawTypes.length > 0 || rawGroups.length > 0));

  if (loading) return <LoadingState label="Cargando materias primas..." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Materias primas"
        subtitle="Catalogo interno de insumos separado de productos comerciales."
        onNew={canCreate ? openCreate : undefined}
        newLabel="Nueva materia prima"
        actions={
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            <RefreshCw size={14} />
            Actualizar
          </button>
        }
      />

      {!canCreate && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Configura al menos un tipo o grupo de materia prima, fragancia, colorante o extracto, y una unidad en Inventario para crear materias primas.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Registradas</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{rawMaterials.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Activas</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{rawMaterials.filter((item) => item.isActive).length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Con lote</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{rawMaterials.filter((item) => item.tracksBatches).length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Filtradas</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{filteredItems.length}</p>
        </Card>
      </div>

      <Card className="p-3">
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por codigo, nombre, proveedor o descripcion..."
              className={`${inputCls} pl-9`}
            />
          </div>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={selectCls}>
            <option value="all">Todos los tipos</option>
            {rawTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className={selectCls}>
            <option value="all">Todos los grupos</option>
            {rawGroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className={selectCls}>
            <option value="all">Todos los proveedores</option>
            {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={selectCls}>
            <option value="all">Todos los estados</option>
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
          </select>
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className={selectCls}>
            <option value="name">Ordenar por nombre</option>
            <option value="code">Ordenar por codigo</option>
            <option value="cost">Ordenar por costo</option>
            <option value="status">Ordenar por estado</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
            <Filter size={12} />
            {activeFilters ? `${activeFilters} filtro(s) activo(s)` : 'Sin filtros activos'}
          </p>
          {activeFilters > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-semibold text-gray-500 hover:bg-gray-50"
            >
              <X size={12} />
              Limpiar filtros
            </button>
          )}
        </div>
      </Card>

      {filteredItems.length === 0 ? (
        <EmptyState title="No hay materias primas para mostrar" description="Ajusta los filtros o crea una nueva materia prima." />
      ) : (
        <Table scrollable>
          <thead>
            <tr>
              <Th>Materia prima</Th>
              <Th>Tipo / grupo</Th>
              <Th>Unidad</Th>
              <Th>Proveedor</Th>
              <Th>Costo</Th>
              <Th>Control</Th>
              <Th>Estado</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50/50">
                <Td>
                  <div className="font-semibold text-gray-900">{item.name}</div>
                  <div className="mt-1 text-[11px] text-gray-400">{item.code}</div>
                  {item.description && <div className="mt-1 max-w-md text-[11px] text-gray-500">{item.description}</div>}
                </Td>
                <Td>
                  <div>{itemTypeById.get(item.itemTypeId)?.name ?? 'Sin tipo'}</div>
                  <div className="mt-1 text-[11px] text-gray-400">{itemGroupById.get(item.itemGroupId)?.name ?? 'Sin grupo'}</div>
                </Td>
                <Td>{unitById.get(item.unitId)?.abbreviation ?? '-'}</Td>
                <Td>{item.supplierId ? supplierById.get(item.supplierId)?.name ?? 'Proveedor' : 'Sin proveedor'}</Td>
                <Td>{currency(item.cost)}</Td>
                <Td>
                  <div>Min: {item.minimumQuantity}</div>
                  <div className="text-[11px] text-gray-400">Max: {item.maximumQuantity}</div>
                  {item.tracksBatches && <div className="mt-1 text-[11px] font-semibold text-[#2a4038]">Maneja lote</div>}
                </Td>
                <Td>
                  <Badge label={item.isActive ? 'Activa' : 'Inactiva'} color={item.isActive ? 'green' : 'gray'} />
                </Td>
                <Td className={actionsCellCls}>
                  <ActionsMenu
                    items={[
                      { label: 'Editar', icon: Edit2, onClick: () => openEdit(item) },
                      { label: item.isActive ? 'Desactivar' : 'Activar', icon: FlaskConical, onClick: () => void toggleStatus(item) },
                      { label: 'Eliminar', icon: Trash2, onClick: () => void removeMaterial(item), danger: true },
                    ]}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal title={editingItem ? 'Editar materia prima' : 'Nueva materia prima'} open={showModal} onClose={() => setShowModal(false)} wide disableOverlayClose={saving}>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Codigo" required>
              <input value={form.code} onChange={(event) => setFormField('code', event.target.value)} className={inputCls} placeholder="MP001" />
            </Field>
            <Field label="Nombre" required>
              <input value={form.name} onChange={(event) => setFormField('name', event.target.value)} className={inputCls} placeholder="Glicerina vegetal" />
            </Field>
            <Field label="Tipo" required>
              <select value={form.itemTypeId} onChange={(event) => setFormField('itemTypeId', event.target.value)} className={selectCls}>
                <option value="">Selecciona tipo</option>
                {itemTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="Grupo" required>
              <select value={form.itemGroupId} onChange={(event) => setFormField('itemGroupId', event.target.value)} className={selectCls}>
                <option value="">Selecciona grupo</option>
                {itemGroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="Unidad" required>
              <select value={form.unitId} onChange={(event) => setFormField('unitId', event.target.value)} className={selectCls}>
                <option value="">Selecciona unidad</option>
                {units.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.abbreviation})</option>)}
              </select>
            </Field>
            <Field label="Proveedor">
              <select value={form.supplierId} onChange={(event) => setFormField('supplierId', event.target.value)} className={selectCls}>
                <option value="">Sin proveedor</option>
                {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="Costo">
              <input type="number" min="0" value={form.cost} onChange={(event) => setFormField('cost', event.target.value)} className={inputCls} />
            </Field>
            <Field label="IVA %">
              <input type="number" min="0" value={form.taxRate} onChange={(event) => setFormField('taxRate', event.target.value)} className={inputCls} />
            </Field>
            <Field label="Stock minimo">
              <input type="number" min="0" value={form.minimumQuantity} onChange={(event) => setFormField('minimumQuantity', event.target.value)} className={inputCls} />
            </Field>
            <Field label="Stock maximo">
              <input type="number" min="0" value={form.maximumQuantity} onChange={(event) => setFormField('maximumQuantity', event.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Descripcion">
            <textarea value={form.description} onChange={(event) => setFormField('description', event.target.value)} className={`${inputCls} min-h-24 resize-none`} />
          </Field>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['tracksInventory', 'Controla inventario'],
              ['tracksBatches', 'Maneja lotes'],
              ['isActive', 'Activa'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={Boolean(form[key as keyof MaterialForm])}
                  onChange={(event) => setFormField(key as keyof MaterialForm, event.target.checked as never)}
                  className="h-4 w-4 accent-[#2a4038]"
                />
                <span className="font-medium">{label}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-col gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setShowModal(false)} disabled={saving} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              Cancelar
            </button>
            <button type="button" onClick={() => void saveMaterial()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2a4038] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3d5c4e] disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Guardar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

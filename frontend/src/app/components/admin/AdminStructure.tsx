import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Briefcase, FileDown, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  createDepartment,
  createPosition,
  deleteDepartment,
  deletePosition,
  exportDepartmentsPdf,
  exportPositionsPdf,
  getDepartments,
  getPositions,
  updateDepartment,
  updatePosition,
  type Department,
  type Position,
} from '../../services/employees.service';
import { Table, Th, Td, Modal, Field, EmptyState, LoadingState, inputCls, selectCls, PrimaryButton, SecondaryButton, Badge, TabBar } from './AdminUI';
import { Pagination } from './Pagination';
import { SearchBar } from './SearchBar';

const PAGE_SIZE = 10;

interface DepartmentFormState {
  name: string;
  description: string;
  is_active: boolean;
}

interface PositionFormState {
  department: string;
  name: string;
  description: string;
  is_active: boolean;
}

const EMPTY_DEPARTMENT_FORM: DepartmentFormState = { name: '', description: '', is_active: true };
const EMPTY_POSITION_FORM: PositionFormState = { department: '', name: '', description: '', is_active: true };

type CatalogTab = 'departments' | 'positions';

export function AdminStructure() {
  const toast = useToast();
  const [tab, setTab] = useState<CatalogTab>('departments');

  // ---- Departments state ----
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsTotal, setDepartmentsTotal] = useState(0);
  const [departmentsPage, setDepartmentsPage] = useState(1);
  const [departmentsSearch, setDepartmentsSearch] = useState('');
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);

  // ---- Positions state ----
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsTotal, setPositionsTotal] = useState(0);
  const [positionsPage, setPositionsPage] = useState(1);
  const [positionsSearch, setPositionsSearch] = useState('');
  const [isLoadingPositions, setIsLoadingPositions] = useState(true);

  // Solo para armar el select "Departamento" del formulario de cargo y para
  // mostrar el nombre del departamento en la tabla de cargos.
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);

  // ---- Modal state (compartido crear/editar) ----
  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [positionModalOpen, setPositionModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [departmentForm, setDepartmentForm] = useState<DepartmentFormState>(EMPTY_DEPARTMENT_FORM);
  const [positionForm, setPositionForm] = useState<PositionFormState>(EMPTY_POSITION_FORM);
  const [savingDepartment, setSavingDepartment] = useState(false);
  const [savingPosition, setSavingPosition] = useState(false);
  const [exportingDepartmentsPdf, setExportingDepartmentsPdf] = useState(false);
  const [exportingPositionsPdf, setExportingPositionsPdf] = useState(false);

  const loadDepartments = useCallback(async () => {
    setIsLoadingDepartments(true);
    try {
      const res = await getDepartments({ page: departmentsPage, limit: PAGE_SIZE, search: departmentsSearch });
      setDepartments(res.data);
      setDepartmentsTotal(res.total);
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar los departamentos');
    } finally {
      setIsLoadingDepartments(false);
    }
  }, [departmentsPage, departmentsSearch, toast]);

  const loadPositions = useCallback(async () => {
    setIsLoadingPositions(true);
    try {
      const res = await getPositions({ page: positionsPage, limit: PAGE_SIZE, search: positionsSearch });
      setPositions(res.data);
      setPositionsTotal(res.total);
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar los cargos');
    } finally {
      setIsLoadingPositions(false);
    }
  }, [positionsPage, positionsSearch, toast]);

  const loadAllDepartments = useCallback(async () => {
    try {
      const res = await getDepartments({ limit: 200 });
      setAllDepartments(res.data);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => { void loadDepartments(); }, [loadDepartments]);
  useEffect(() => { void loadPositions(); }, [loadPositions]);
  useEffect(() => { void loadAllDepartments(); }, [loadAllDepartments]);

  // Reset de página al cambiar de búsqueda
  useEffect(() => { setDepartmentsPage(1); }, [departmentsSearch]);
  useEffect(() => { setPositionsPage(1); }, [positionsSearch]);

  const departmentNames = useMemo(
    () => new Map(allDepartments.map((department) => [department.id, department.name])),
    [allDepartments],
  );

  const departmentsTotalPages = Math.max(1, Math.ceil(departmentsTotal / PAGE_SIZE));
  const positionsTotalPages = Math.max(1, Math.ceil(positionsTotal / PAGE_SIZE));

  // ---- Department CRUD ----
  const openCreateDepartment = () => {
    setEditingDepartment(null);
    setDepartmentForm(EMPTY_DEPARTMENT_FORM);
    setDepartmentModalOpen(true);
  };

  const openEditDepartment = (department: Department) => {
    setEditingDepartment(department);
    setDepartmentForm({ name: department.name, description: department.description, is_active: department.is_active });
    setDepartmentModalOpen(true);
  };

  const handleDepartmentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingDepartment(true);
    try {
      if (editingDepartment) {
        await updateDepartment(editingDepartment.id, departmentForm);
        toast.success('Departamento actualizado');
      } else {
        await createDepartment(departmentForm);
        toast.success('Departamento creado');
      }
      setDepartmentModalOpen(false);
      await Promise.all([loadDepartments(), loadAllDepartments()]);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo guardar el departamento');
    } finally {
      setSavingDepartment(false);
    }
  };

  const handleDeleteDepartment = async (department: Department) => {
    if (!window.confirm(`¿Eliminar el departamento "${department.name}"?`)) return;
    try {
      await deleteDepartment(department.id);
      toast.info('Departamento eliminado');
      await Promise.all([loadDepartments(), loadAllDepartments()]);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo eliminar el departamento');
    }
  };

  const handleDepartmentsPdfExport = async () => {
    setExportingDepartmentsPdf(true);
    try {
      await exportDepartmentsPdf();
      toast.success('PDF de departamentos generado');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar el PDF de departamentos');
    } finally {
      setExportingDepartmentsPdf(false);
    }
  };

  // ---- Position CRUD ----
  const openCreatePosition = () => {
    setEditingPosition(null);
    setPositionForm(EMPTY_POSITION_FORM);
    setPositionModalOpen(true);
  };

  const openEditPosition = (position: Position) => {
    setEditingPosition(position);
    setPositionForm({
      department: position.department,
      name: position.name,
      description: position.description,
      is_active: position.is_active,
    });
    setPositionModalOpen(true);
  };

  const handlePositionSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingPosition(true);
    try {
      if (editingPosition) {
        await updatePosition(editingPosition.id, positionForm);
        toast.success('Cargo actualizado');
      } else {
        await createPosition(positionForm);
        toast.success('Cargo creado');
      }
      setPositionModalOpen(false);
      await loadPositions();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo guardar el cargo');
    } finally {
      setSavingPosition(false);
    }
  };

  const handleDeletePosition = async (position: Position) => {
    if (!window.confirm(`¿Eliminar el cargo "${position.name}"?`)) return;
    try {
      await deletePosition(position.id);
      toast.info('Cargo eliminado');
      await loadPositions();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo eliminar el cargo');
    }
  };

  const handlePositionsPdfExport = async () => {
    setExportingPositionsPdf(true);
    try {
      await exportPositionsPdf();
      toast.success('PDF de cargos generado');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar el PDF de cargos');
    } finally {
      setExportingPositionsPdf(false);
    }
  };

  return (
    <div>
      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'departments', label: 'Departamentos', icon: Building2 },
          { id: 'positions', label: 'Cargos', icon: Briefcase },
        ]}
      />

      {tab === 'departments' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="w-full sm:w-72">
              <SearchBar value={departmentsSearch} onChange={setDepartmentsSearch} placeholder="Buscar departamento..." />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void handleDepartmentsPdfExport()}
                disabled={exportingDepartmentsPdf}
                className="flex items-center gap-2 px-4 py-2.5 border border-[#2a4038] text-[#2a4038] text-xs font-semibold rounded-xl hover:bg-[#eef4f1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {exportingDepartmentsPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                {exportingDepartmentsPdf ? 'Generando PDF...' : 'Exportar PDF'}
              </button>
              <button
                onClick={openCreateDepartment}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors whitespace-nowrap"
              >
                <Plus size={14} /> Nuevo departamento
              </button>
            </div>
          </div>

          {isLoadingDepartments ? (
            <LoadingState label="Cargando departamentos..." />
          ) : departments.length === 0 ? (
            <EmptyState
              title="No hay departamentos registrados"
              description={departmentsSearch ? 'Ajusta tu búsqueda e intenta de nuevo.' : 'Crea el primer departamento para empezar a organizar tu equipo.'}
            />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Departamento</Th>
                    <Th>Descripción</Th>
                    <Th>Estado</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((department) => (
                    <tr key={department.id}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                            <Building2 size={14} className="text-gray-400" />
                          </div>
                          <span className="font-medium text-gray-900">{department.name}</span>
                        </div>
                      </Td>
                      <Td className="max-w-xs truncate text-gray-500">{department.description || '—'}</Td>
                      <Td><Badge label={department.is_active ? 'Activo' : 'Inactivo'} color={department.is_active ? 'green' : 'gray'} /></Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditDepartment(department)} className="p-2 rounded-lg hover:bg-amber-50 hover:text-amber-600 text-gray-400 transition-colors" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => void handleDeleteDepartment(department)} className="p-2 rounded-lg hover:bg-red-50 hover:text-red-500 text-gray-400 transition-colors" title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="mt-4">
                <Pagination
                  currentPage={departmentsPage}
                  totalPages={departmentsTotalPages}
                  totalItems={departmentsTotal}
                  itemsPerPage={PAGE_SIZE}
                  onPageChange={setDepartmentsPage}
                />
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'positions' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="w-full sm:w-72">
              <SearchBar value={positionsSearch} onChange={setPositionsSearch} placeholder="Buscar cargo..." />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void handlePositionsPdfExport()}
                disabled={exportingPositionsPdf}
                className="flex items-center gap-2 px-4 py-2.5 border border-[#2a4038] text-[#2a4038] text-xs font-semibold rounded-xl hover:bg-[#eef4f1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {exportingPositionsPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                {exportingPositionsPdf ? 'Generando PDF...' : 'Exportar PDF'}
              </button>
              <button
                onClick={openCreatePosition}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors whitespace-nowrap"
              >
                <Plus size={14} /> Nuevo cargo
              </button>
            </div>
          </div>

          {isLoadingPositions ? (
            <LoadingState label="Cargando cargos..." />
          ) : positions.length === 0 ? (
            <EmptyState
              title="No hay cargos registrados"
              description={positionsSearch ? 'Ajusta tu búsqueda e intenta de nuevo.' : 'Crea el primer cargo para empezar a asignar empleados.'}
            />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Cargo</Th>
                    <Th>Departamento</Th>
                    <Th>Estado</Th>
                    <Th></Th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => (
                    <tr key={position.id}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                            <Briefcase size={14} className="text-gray-400" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{position.name}</p>
                            {position.description && <p className="text-xs text-gray-400 truncate max-w-xs">{position.description}</p>}
                          </div>
                        </div>
                      </Td>
                      <Td className="text-gray-500">{departmentNames.get(position.department) ?? '—'}</Td>
                      <Td><Badge label={position.is_active ? 'Activo' : 'Inactivo'} color={position.is_active ? 'green' : 'gray'} /></Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditPosition(position)} className="p-2 rounded-lg hover:bg-amber-50 hover:text-amber-600 text-gray-400 transition-colors" title="Editar">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => void handleDeletePosition(position)} className="p-2 rounded-lg hover:bg-red-50 hover:text-red-500 text-gray-400 transition-colors" title="Eliminar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="mt-4">
                <Pagination
                  currentPage={positionsPage}
                  totalPages={positionsTotalPages}
                  totalItems={positionsTotal}
                  itemsPerPage={PAGE_SIZE}
                  onPageChange={setPositionsPage}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Modal Departamento ── */}
      <Modal
        title={editingDepartment ? 'Editar departamento' : 'Nuevo departamento'}
        open={departmentModalOpen}
        onClose={() => setDepartmentModalOpen(false)}
      >
        <form onSubmit={handleDepartmentSubmit} className="space-y-4">
          <Field label="Nombre" required>
            <input
              type="text"
              required
              value={departmentForm.name}
              onChange={(event) => setDepartmentForm({ ...departmentForm, name: event.target.value })}
              placeholder="Ej. Marketing"
              className={inputCls}
            />
          </Field>
          <Field label="Descripción">
            <textarea
              value={departmentForm.description}
              onChange={(event) => setDepartmentForm({ ...departmentForm, description: event.target.value })}
              placeholder="Describe la función del departamento..."
              rows={3}
              className={inputCls + ' resize-none'}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={departmentForm.is_active}
              onChange={(event) => setDepartmentForm({ ...departmentForm, is_active: event.target.checked })}
              className="accent-[#2a4038]"
            />
            Departamento activo
          </label>
          <div className="flex gap-3 pt-2">
            <SecondaryButton onClick={() => setDepartmentModalOpen(false)}>Cancelar</SecondaryButton>
            <PrimaryButton type="submit" disabled={savingDepartment}>
              {savingDepartment ? 'Guardando...' : editingDepartment ? 'Actualizar' : 'Crear departamento'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>

      {/* ── Modal Cargo ── */}
      <Modal
        title={editingPosition ? 'Editar cargo' : 'Nuevo cargo'}
        open={positionModalOpen}
        onClose={() => setPositionModalOpen(false)}
      >
        <form onSubmit={handlePositionSubmit} className="space-y-4">
          <Field label="Departamento" required>
            <select
              required
              value={positionForm.department}
              onChange={(event) => setPositionForm({ ...positionForm, department: event.target.value })}
              className={selectCls}
            >
              <option value="">Selecciona un departamento</option>
              {allDepartments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Nombre del cargo" required>
            <input
              type="text"
              required
              value={positionForm.name}
              onChange={(event) => setPositionForm({ ...positionForm, name: event.target.value })}
              placeholder="Ej. Administrador de sistemas"
              className={inputCls}
            />
          </Field>
          <Field label="Descripción">
            <textarea
              value={positionForm.description}
              onChange={(event) => setPositionForm({ ...positionForm, description: event.target.value })}
              placeholder="Describe las responsabilidades y funciones del cargo..."
              rows={3}
              className={inputCls + ' resize-none'}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={positionForm.is_active}
              onChange={(event) => setPositionForm({ ...positionForm, is_active: event.target.checked })}
              className="accent-[#2a4038]"
            />
            Cargo activo
          </label>
          <div className="flex gap-3 pt-2">
            <SecondaryButton onClick={() => setPositionModalOpen(false)}>Cancelar</SecondaryButton>
            <PrimaryButton type="submit" disabled={savingPosition}>
              {savingPosition ? 'Guardando...' : editingPosition ? 'Actualizar' : 'Crear cargo'}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}

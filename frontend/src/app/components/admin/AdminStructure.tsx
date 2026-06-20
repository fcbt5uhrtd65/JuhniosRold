import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Briefcase, Edit2, Plus, Trash2, Users } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  createDepartment,
  createPosition,
  deleteDepartment,
  deletePosition,
  getDepartments,
  getEmployees,
  getPositions,
  updateDepartment,
  updatePosition,
  type Department,
  type Employee,
  type Position,
} from '../../services/employees.service';
import { Card, LoadingState, EmptyState, inputCls, selectCls } from './AdminUI';

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

const EMPTY_DEPARTMENT_FORM: DepartmentFormState = {
  name: '',
  description: '',
  is_active: true,
};

const EMPTY_POSITION_FORM: PositionFormState = {
  department: '',
  name: '',
  description: '',
  is_active: true,
};

export function AdminStructure() {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departmentForm, setDepartmentForm] = useState<DepartmentFormState>(EMPTY_DEPARTMENT_FORM);
  const [positionForm, setPositionForm] = useState<PositionFormState>(EMPTY_POSITION_FORM);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [savingDepartment, setSavingDepartment] = useState(false);
  const [savingPosition, setSavingPosition] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [departmentsRes, positionsRes, employeesRes] = await Promise.allSettled([
        getDepartments({ limit: 200 }),
        getPositions({ limit: 200 }),
        getEmployees({ limit: 200 }),
      ]);

      if (departmentsRes.status === 'fulfilled') setDepartments(departmentsRes.value.data);
      if (positionsRes.status === 'fulfilled') setPositions(positionsRes.value.data);
      if (employeesRes.status === 'fulfilled') setEmployees(employeesRes.value.data);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar el catálogo organizacional');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const employeesByDepartment = useMemo(() => {
    const counts = new Map<string, number>();
    employees.forEach((employee) => {
      counts.set(employee.department, (counts.get(employee.department) ?? 0) + 1);
    });
    return counts;
  }, [employees]);

  const employeesByPosition = useMemo(() => {
    const counts = new Map<string, number>();
    employees.forEach((employee) => {
      counts.set(employee.position, (counts.get(employee.position) ?? 0) + 1);
    });
    return counts;
  }, [employees]);

  const departmentNames = useMemo(() => {
    return new Map(departments.map(department => [department.id, department.name]));
  }, [departments]);

  const resetDepartmentForm = () => {
    setEditingDepartment(null);
    setDepartmentForm(EMPTY_DEPARTMENT_FORM);
  };

  const resetPositionForm = () => {
    setEditingPosition(null);
    setPositionForm(EMPTY_POSITION_FORM);
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
      await loadData();
      resetDepartmentForm();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo guardar el departamento');
    } finally {
      setSavingDepartment(false);
    }
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
      await loadData();
      resetPositionForm();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo guardar el cargo');
    } finally {
      setSavingPosition(false);
    }
  };

  const handleDeleteDepartment = async (department: Department) => {
    if (!window.confirm(`¿Eliminar el departamento ${department.name}?`)) return;
    try {
      await deleteDepartment(department.id);
      toast.info('Departamento eliminado');
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo eliminar el departamento');
    }
  };

  const handleDeletePosition = async (position: Position) => {
    if (!window.confirm(`¿Eliminar el cargo ${position.name}?`)) return;
    try {
      await deletePosition(position.id);
      toast.info('Cargo eliminado');
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo eliminar el cargo');
    }
  };

  if (isLoading) {
    return <LoadingState label="Cargando catálogo organizacional..." />;
  }

  return (
    <div className="grid xl:grid-cols-2 gap-6">
      <div>
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={15} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Departamentos</h3>
          </div>

          <form onSubmit={handleDepartmentSubmit} className="space-y-3 mb-6">
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={departmentForm.name}
                onChange={(event) => setDepartmentForm({ ...departmentForm, name: event.target.value })}
                placeholder="Nombre del departamento"
                className={inputCls}
              />
              <label className="flex items-center gap-2 px-3 rounded-lg border border-gray-200 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={departmentForm.is_active}
                  onChange={(event) => setDepartmentForm({ ...departmentForm, is_active: event.target.checked })}
                  className="accent-[#2a4038]"
                />
                Activo
              </label>
            </div>

            <textarea
              value={departmentForm.description}
              onChange={(event) => setDepartmentForm({ ...departmentForm, description: event.target.value })}
              placeholder="Descripción"
              rows={3}
              className={inputCls + ' resize-none'}
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetDepartmentForm}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Limpiar
              </button>
              <button
                type="submit"
                disabled={savingDepartment}
                className="px-4 py-2.5 bg-[#2a4038] text-white rounded-xl text-xs font-semibold hover:bg-[#3d5c4e] transition-colors disabled:opacity-50"
              >
                {savingDepartment ? 'Guardando...' : editingDepartment ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>

          <div className="divide-y divide-gray-100">
            {departments.map((department) => (
              <div key={department.id} className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">{department.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{department.description || 'Sin descripción'}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2">
                      {employeesByDepartment.get(department.id) ?? 0} empleados
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingDepartment(department);
                        setDepartmentForm({
                          name: department.name,
                          description: department.description,
                          is_active: department.is_active,
                        });
                      }}
                      className="p-2 rounded-lg hover:bg-amber-50 hover:text-amber-600 text-gray-400 transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => void handleDeleteDepartment(department)}
                      className="p-2 rounded-lg hover:bg-red-50 hover:text-red-500 text-gray-400 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {departments.length === 0 && (
              <EmptyState title="No hay departamentos registrados." />
            )}
          </div>
        </Card>
      </div>

      <div>
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase size={15} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Cargos</h3>
          </div>

          <form onSubmit={handlePositionSubmit} className="space-y-3 mb-6">
            <div className="grid sm:grid-cols-2 gap-3">
              <select
                required
                value={positionForm.department}
                onChange={(event) => setPositionForm({ ...positionForm, department: event.target.value })}
                className={selectCls}
              >
                <option value="">Selecciona un departamento</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 px-3 rounded-lg border border-gray-200 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={positionForm.is_active}
                  onChange={(event) => setPositionForm({ ...positionForm, is_active: event.target.checked })}
                  className="accent-[#2a4038]"
                />
                Activo
              </label>
            </div>

            <input
              type="text"
              required
              value={positionForm.name}
              onChange={(event) => setPositionForm({ ...positionForm, name: event.target.value })}
              placeholder="Nombre del cargo"
              className={inputCls}
            />

            <textarea
              value={positionForm.description}
              onChange={(event) => setPositionForm({ ...positionForm, description: event.target.value })}
              placeholder="Descripción"
              rows={3}
              className={inputCls + ' resize-none'}
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetPositionForm}
                className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Limpiar
              </button>
              <button
                type="submit"
                disabled={savingPosition}
                className="px-4 py-2.5 bg-[#2a4038] text-white rounded-xl text-xs font-semibold hover:bg-[#3d5c4e] transition-colors disabled:opacity-50"
              >
                {savingPosition ? 'Guardando...' : editingPosition ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </form>

          <div className="divide-y divide-gray-100">
            {positions.map((position) => (
              <div key={position.id} className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">{position.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{departmentNames.get(position.department) ?? 'Sin departamento'}</p>
                    <p className="text-xs text-gray-400 mt-1">{position.description || 'Sin descripción'}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2">
                      {employeesByPosition.get(position.id) ?? 0} empleados
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingPosition(position);
                        setPositionForm({
                          department: position.department,
                          name: position.name,
                          description: position.description,
                          is_active: position.is_active,
                        });
                      }}
                      className="p-2 rounded-lg hover:bg-amber-50 hover:text-amber-600 text-gray-400 transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => void handleDeletePosition(position)}
                      className="p-2 rounded-lg hover:bg-red-50 hover:text-red-500 text-gray-400 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {positions.length === 0 && (
              <EmptyState title="No hay cargos registrados." />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarClock,
  Clock3,
  Edit2,
  FileText,
  Mail,
  Phone,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { SearchBar } from './SearchBar';
import { useToast } from '../../contexts/ToastContext';
import {
  createEmployee,
  deleteEmployee,
  getDepartments,
  getEmployees,
  getPositions,
  type Department,
  type Employee,
  type EmployeePayload,
  type EmployeeStatus,
  type Position,
  updateEmployee,
} from '../../services/employees.service';
import {
  approveVacationRequest,
  getVacationRequests,
  rejectVacationRequest,
  type VacationRequest,
  type VacationRequestStatus,
} from '../../services/human-resources.service';
import { AdminStructure } from './AdminStructure';

type HRTab = 'employees' | 'catalog' | 'vacations';

interface EmployeeFormState {
  user: string;
  employee_code: string;
  document_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  department: string;
  position: string;
  manager: string;
  hire_date: string;
  termination_date: string;
  status: EmployeeStatus;
}

const EMPTY_EMPLOYEE_FORM: EmployeeFormState = {
  user: '',
  employee_code: '',
  document_number: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  address: '',
  department: '',
  position: '',
  manager: '',
  hire_date: '',
  termination_date: '',
  status: 'ACTIVE',
};

function parseDate(value: string | null | undefined): string {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-CO');
}

function formatCurrency(amount: number | string): string {
  const parsed = typeof amount === 'number' ? amount : Number(amount);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Number.isFinite(parsed) ? parsed : 0);
}

function getEmployeeName(employee: Employee): string {
  return `${employee.first_name} ${employee.last_name}`.trim() || employee.employee_code;
}

function statusLabel(status: EmployeeStatus): string {
  const labels: Record<EmployeeStatus, string> = {
    ACTIVE: 'Activo',
    LEAVE: 'En licencia',
    SUSPENDED: 'Suspendido',
    TERMINATED: 'Retirado',
  };
  return labels[status];
}

function statusBadge(status: EmployeeStatus): string {
  const styles: Record<EmployeeStatus, string> = {
    ACTIVE: 'bg-green-50 text-green-700 border-green-200',
    LEAVE: 'bg-blue-50 text-blue-700 border-blue-200',
    SUSPENDED: 'bg-amber-50 text-amber-700 border-amber-200',
    TERMINATED: 'bg-red-50 text-red-700 border-red-200',
  };
  return styles[status];
}

function requestStatusLabel(status: VacationRequestStatus): string {
  const labels: Record<VacationRequestStatus, string> = {
    PENDING: 'Pendiente',
    APPROVED: 'Aprobada',
    REJECTED: 'Rechazada',
  };
  return labels[status];
}

function requestStatusBadge(status: VacationRequestStatus): string {
  const styles: Record<VacationRequestStatus, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    APPROVED: 'bg-green-50 text-green-700 border-green-200',
    REJECTED: 'bg-red-50 text-red-700 border-red-200',
  };
  return styles[status];
}

export function AdminHR() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<HRTab>('employees');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
  const [vacationActionId, setVacationActionId] = useState<string | null>(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(EMPTY_EMPLOYEE_FORM);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [departmentsRes, positionsRes, employeesRes, vacationsRes] = await Promise.allSettled([
        getDepartments({ limit: 200 }),
        getPositions({ limit: 200 }),
        getEmployees({ limit: 200 }),
        getVacationRequests({ limit: 200 }),
      ]);

      if (departmentsRes.status === 'fulfilled') setDepartments(departmentsRes.value.data);
      if (positionsRes.status === 'fulfilled') setPositions(positionsRes.value.data);
      if (employeesRes.status === 'fulfilled') setEmployees(employeesRes.value.data);
      if (vacationsRes.status === 'fulfilled') setVacationRequests(vacationsRes.value.data);

      const failures = [departmentsRes, positionsRes, employeesRes, vacationsRes].filter(
        (result) => result.status === 'rejected',
      );
      if (failures.length > 0) {
        console.warn('RRHH data partially unavailable', failures);
      }
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar la información de RRHH');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const departmentById = useMemo(() => new Map(departments.map(department => [department.id, department])), [departments]);
  const positionById = useMemo(() => new Map(positions.map(position => [position.id, position])), [positions]);
  const employeeById = useMemo(() => new Map(employees.map(employee => [employee.id, employee])), [employees]);

  const positionsForSelectedDepartment = useMemo(
    () => positions.filter(position => position.department === employeeForm.department),
    [employeeForm.department, positions],
  );

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const department = departmentById.get(employee.department);
      const position = positionById.get(employee.position);
      const matchesSearch =
        searchQuery.trim() === '' ||
        getEmployeeName(employee).toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.employee_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.document_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        department?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        position?.name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDepartment = filterDepartment === 'all' || employee.department === filterDepartment;
      const matchesStatus = filterStatus === 'all' || employee.status === filterStatus;

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [departmentById, employees, filterDepartment, filterStatus, positionById, searchQuery]);

  const filteredVacationRequests = useMemo(() => {
    return vacationRequests.filter((request) => {
      const employee = employeeById.get(request.employee);
      const matchesSearch =
        searchQuery.trim() === '' ||
        employee?.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee?.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee?.employee_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.reason.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDepartment =
        filterDepartment === 'all' || (employee ? employee.department === filterDepartment : false);
      const matchesStatus = filterStatus === 'all' || request.status === filterStatus;
      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [employeeById, filterDepartment, filterStatus, searchQuery, vacationRequests]);

  const stats = useMemo(() => {
    return {
      totalEmployees: employees.length,
      activeEmployees: employees.filter(employee => employee.status === 'ACTIVE').length,
      leaveEmployees: employees.filter(employee => employee.status === 'LEAVE').length,
      pendingRequests: vacationRequests.filter(request => request.status === 'PENDING').length,
    };
  }, [employees, vacationRequests]);

  const openCreateModal = () => {
    setEditingEmployee(null);
    setEmployeeForm(EMPTY_EMPLOYEE_FORM);
    setShowEmployeeModal(true);
  };

  const openEditModal = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeForm({
      user: employee.user ?? '',
      employee_code: employee.employee_code,
      document_number: employee.document_number,
      first_name: employee.first_name,
      last_name: employee.last_name,
      email: employee.email,
      phone: employee.phone,
      address: employee.address,
      department: employee.department,
      position: employee.position,
      manager: employee.manager ?? '',
      hire_date: employee.hire_date,
      termination_date: employee.termination_date ?? '',
      status: employee.status,
    });
    setShowEmployeeModal(true);
  };

  const resetEmployeeModal = () => {
    setShowEmployeeModal(false);
    setEditingEmployee(null);
    setEmployeeForm(EMPTY_EMPLOYEE_FORM);
  };

  const handleEmployeeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingEmployee(true);

    const payload: EmployeePayload = {
      ...(employeeForm.user ? { user: employeeForm.user } : {}),
      employee_code: employeeForm.employee_code.trim(),
      document_number: employeeForm.document_number.trim(),
      first_name: employeeForm.first_name.trim(),
      last_name: employeeForm.last_name.trim(),
      email: employeeForm.email.trim().toLowerCase(),
      phone: employeeForm.phone.trim(),
      address: employeeForm.address.trim(),
      department: employeeForm.department,
      position: employeeForm.position,
      ...(employeeForm.manager ? { manager: employeeForm.manager } : {}),
      hire_date: employeeForm.hire_date,
      ...(employeeForm.termination_date ? { termination_date: employeeForm.termination_date } : { termination_date: null }),
      status: employeeForm.status,
    };

    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, payload);
        toast.success(`Empleado ${getEmployeeName(editingEmployee)} actualizado`);
      } else {
        await createEmployee(payload);
        toast.success(`Empleado ${payload.first_name} ${payload.last_name}`.trim() || 'Empleado creado');
      }

      await loadData();
      resetEmployeeModal();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo guardar el empleado');
    } finally {
      setSavingEmployee(false);
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!window.confirm(`¿Eliminar a ${getEmployeeName(employee)}?`)) {
      return;
    }

    setDeletingEmployeeId(employee.id);
    try {
      await deleteEmployee(employee.id);
      toast.info('Empleado eliminado');
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo eliminar el empleado');
    } finally {
      setDeletingEmployeeId(null);
    }
  };

  const handleVacationAction = async (request: VacationRequest, action: 'approve' | 'reject') => {
    setVacationActionId(request.id);
    try {
      if (action === 'approve') {
        await approveVacationRequest(request.id);
        toast.success('Solicitud aprobada');
      } else {
        await rejectVacationRequest(request.id);
        toast.info('Solicitud rechazada');
      }
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo procesar la solicitud');
    } finally {
      setVacationActionId(null);
    }
  };

  const activeEmployees = employees.filter(employee => employee.status === 'ACTIVE');
  const statusOptions = activeTab === 'vacations'
    ? [
        { value: 'all', label: 'Todos los estados' },
        { value: 'PENDING', label: 'Pendientes' },
        { value: 'APPROVED', label: 'Aprobadas' },
        { value: 'REJECTED', label: 'Rechazadas' },
      ]
    : [
        { value: 'all', label: 'Todos los estados' },
        { value: 'ACTIVE', label: 'Activos' },
        { value: 'LEAVE', label: 'En licencia' },
        { value: 'SUSPENDED', label: 'Suspendidos' },
        { value: 'TERMINATED', label: 'Retirados' },
      ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl mb-2">Recursos Humanos</h2>
          <p className="text-xs text-muted-foreground">
            Empleados, departamentos, cargos y solicitudes internas conectadas al backend.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background hover:bg-background hover:text-foreground border border-foreground transition-colors text-xs"
          >
            <UserPlus className="w-4 h-4" strokeWidth={1} />
            Nuevo empleado
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Empleados', value: stats.totalEmployees, icon: Users },
          { label: 'Activos', value: stats.activeEmployees, icon: BadgeCheck },
          { label: 'En licencia', value: stats.leaveEmployees, icon: CalendarClock },
          { label: 'Solicitudes', value: stats.pendingRequests, icon: Clock3 },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-secondary/30 border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1} />
                <div className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground">
                  {stat.label}
                </div>
              </div>
              <div className="text-2xl font-light">{stat.value}</div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex gap-2 border border-border p-1 overflow-x-auto">
          {[
            { id: 'employees', label: 'Empleados' },
            { id: 'catalog', label: 'Departamentos y cargos' },
            { id: 'vacations', label: 'Solicitudes' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as HRTab);
                setFilterStatus('all');
              }}
              className={`px-4 py-2 text-xs uppercase tracking-wider transition-colors ${
                activeTab === tab.id ? 'bg-foreground text-background' : 'hover:bg-secondary/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Buscar por nombre, código, cargo o solicitud..."
            className="flex-1 min-w-[280px]"
          />

          {(activeTab === 'employees' || activeTab === 'vacations') && (
            <select
              value={filterDepartment}
              onChange={(event) => setFilterDepartment(event.target.value)}
              className="px-4 py-2 border border-border bg-transparent text-xs focus:outline-none focus:border-foreground"
            >
              <option value="all">Todos los departamentos</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
            className="px-4 py-2 border border-border bg-transparent text-xs focus:outline-none focus:border-foreground"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="border border-border p-12 text-center text-muted-foreground">
          <div className="text-sm">Cargando información de RRHH...</div>
        </div>
      ) : (
        <>
          {activeTab === 'employees' && (
            <div className="border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left p-3 font-medium">Empleado</th>
                      <th className="text-left p-3 font-medium">Departamento</th>
                      <th className="text-left p-3 font-medium">Cargo</th>
                      <th className="text-left p-3 font-medium">Ingreso</th>
                      <th className="text-left p-3 font-medium">Estado</th>
                      <th className="text-center p-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((employee) => {
                      const department = departmentById.get(employee.department);
                      const position = positionById.get(employee.position);
                      return (
                        <tr key={employee.id} className="border-b border-border hover:bg-secondary/20 transition-colors">
                          <td className="p-3">
                            <div className="font-medium">{getEmployeeName(employee)}</div>
                            <div className="mt-1 text-muted-foreground space-y-1">
                              <div className="flex items-center gap-1">
                                <FileText className="w-3 h-3" strokeWidth={1} />
                                {employee.employee_code} · {employee.document_number}
                              </div>
                              <div className="flex items-center gap-1">
                                <Mail className="w-3 h-3" strokeWidth={1} />
                                {employee.email}
                              </div>
                              {employee.phone && (
                                <div className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" strokeWidth={1} />
                                  {employee.phone}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3">{department?.name ?? 'Sin departamento'}</td>
                          <td className="p-3">{position?.name ?? 'Sin cargo'}</td>
                          <td className="p-3">{parseDate(employee.hire_date)}</td>
                          <td className="p-3">
                            <span className={`inline-block px-2 py-1 border text-[10px] ${statusBadge(employee.status)}`}>
                              {statusLabel(employee.status)}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEditModal(employee)}
                                className="p-1.5 hover:bg-secondary/50 transition-colors"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" strokeWidth={1} />
                              </button>
                              <button
                                onClick={() => handleDeleteEmployee(employee)}
                                disabled={deletingEmployeeId === employee.id}
                                className="p-1.5 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredEmployees.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-20" strokeWidth={1} />
                  <div className="text-sm">No se encontraron empleados</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'catalog' && (
            <AdminStructure />
          )}

          {activeTab === 'vacations' && (
            <div className="border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left p-3 font-medium">Empleado</th>
                      <th className="text-left p-3 font-medium">Fechas</th>
                      <th className="text-left p-3 font-medium">Motivo</th>
                      <th className="text-left p-3 font-medium">Estado</th>
                      <th className="text-center p-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVacationRequests.map((request) => {
                      const employee = employeeById.get(request.employee);
                      return (
                        <tr key={request.id} className="border-b border-border hover:bg-secondary/20 transition-colors">
                          <td className="p-3">
                            <div className="font-medium">{employee ? getEmployeeName(employee) : request.employee}</div>
                            <div className="text-muted-foreground mt-1">
                              {employee?.employee_code ?? 'Sin código'}
                            </div>
                          </td>
                          <td className="p-3">
                            <div>{parseDate(request.start_date)} - {parseDate(request.end_date)}</div>
                            <div className="text-muted-foreground mt-1">
                              Registrada: {parseDate(request.created_at)}
                            </div>
                          </td>
                          <td className="p-3 max-w-sm">
                            <div className="line-clamp-3">{request.reason || 'Sin motivo'}</div>
                          </td>
                          <td className="p-3">
                            <span className={`inline-block px-2 py-1 border text-[10px] ${requestStatusBadge(request.status)}`}>
                              {requestStatusLabel(request.status)}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleVacationAction(request, 'approve')}
                                disabled={request.status !== 'PENDING' || vacationActionId === request.id}
                                className="px-3 py-1.5 border border-green-200 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
                              >
                                Aprobar
                              </button>
                              <button
                                onClick={() => handleVacationAction(request, 'reject')}
                                disabled={request.status !== 'PENDING' || vacationActionId === request.id}
                                className="px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
                              >
                                Rechazar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredVacationRequests.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-20" strokeWidth={1} />
                  <div className="text-sm">No hay solicitudes para mostrar</div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showEmployeeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background border border-border max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-8">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-2xl">
                    {editingEmployee ? 'Editar empleado' : 'Nuevo empleado'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-2">
                    Datos consistentes con `employees.Employee` del backend.
                  </p>
                </div>
                <button
                  onClick={resetEmployeeModal}
                  className="p-2 hover:bg-secondary/50 transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={1} />
                </button>
              </div>

              <form onSubmit={handleEmployeeSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-2">Código de empleado</label>
                    <input
                      type="text"
                      required
                      value={employeeForm.employee_code}
                      onChange={(event) => setEmployeeForm({ ...employeeForm, employee_code: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                      placeholder="EMP-001"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-2">Número de documento</label>
                    <input
                      type="text"
                      required
                      value={employeeForm.document_number}
                      onChange={(event) => setEmployeeForm({ ...employeeForm, document_number: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                      placeholder="123456789"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-2">Nombres</label>
                    <input
                      type="text"
                      required
                      value={employeeForm.first_name}
                      onChange={(event) => setEmployeeForm({ ...employeeForm, first_name: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                      placeholder="Ana María"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-2">Apellidos</label>
                    <input
                      type="text"
                      required
                      value={employeeForm.last_name}
                      onChange={(event) => setEmployeeForm({ ...employeeForm, last_name: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                      placeholder="García"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-2">Email</label>
                    <input
                      type="email"
                      required
                      value={employeeForm.email}
                      onChange={(event) => setEmployeeForm({ ...employeeForm, email: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                      placeholder="ana@juhniosrold.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-2">Teléfono</label>
                    <input
                      type="tel"
                      value={employeeForm.phone}
                      onChange={(event) => setEmployeeForm({ ...employeeForm, phone: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                      placeholder="+57 300 123 4567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs mb-2">Dirección</label>
                  <input
                    type="text"
                    value={employeeForm.address}
                    onChange={(event) => setEmployeeForm({ ...employeeForm, address: event.target.value })}
                    className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                    placeholder="Calle 123 #45-67"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-2">Departamento</label>
                    <select
                      required
                      value={employeeForm.department}
                      onChange={(event) => {
                        const nextDepartment = event.target.value;
                        const nextPosition = positions.find(position =>
                          position.department === nextDepartment && position.id === employeeForm.position,
                        )
                          ? employeeForm.position
                          : '';
                        setEmployeeForm({ ...employeeForm, department: nextDepartment, position: nextPosition });
                      }}
                      className="w-full px-4 py-2.5 border border-border bg-background focus:outline-none focus:border-foreground text-sm"
                    >
                      <option value="">Selecciona un departamento</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs mb-2">Cargo</label>
                    <select
                      required
                      value={employeeForm.position}
                      onChange={(event) => setEmployeeForm({ ...employeeForm, position: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-background focus:outline-none focus:border-foreground text-sm"
                    >
                      <option value="">Selecciona un cargo</option>
                      {positionsForSelectedDepartment.map((position) => (
                        <option key={position.id} value={position.id}>
                          {position.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-2">Jefe directo</label>
                    <select
                      value={employeeForm.manager}
                      onChange={(event) => setEmployeeForm({ ...employeeForm, manager: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-background focus:outline-none focus:border-foreground text-sm"
                    >
                      <option value="">Sin jefe asignado</option>
                      {activeEmployees
                        .filter((employee) => employee.id !== editingEmployee?.id)
                        .map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {getEmployeeName(employee)}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs mb-2">Estado</label>
                    <select
                      required
                      value={employeeForm.status}
                      onChange={(event) => setEmployeeForm({ ...employeeForm, status: event.target.value as EmployeeStatus })}
                      className="w-full px-4 py-2.5 border border-border bg-background focus:outline-none focus:border-foreground text-sm"
                    >
                      <option value="ACTIVE">Activo</option>
                      <option value="LEAVE">En licencia</option>
                      <option value="SUSPENDED">Suspendido</option>
                      <option value="TERMINATED">Retirado</option>
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-2">Fecha de ingreso</label>
                    <input
                      type="date"
                      required
                      value={employeeForm.hire_date}
                      onChange={(event) => setEmployeeForm({ ...employeeForm, hire_date: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-background focus:outline-none focus:border-foreground text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-2">Fecha de retiro</label>
                    <input
                      type="date"
                      value={employeeForm.termination_date}
                      onChange={(event) => setEmployeeForm({ ...employeeForm, termination_date: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-background focus:outline-none focus:border-foreground text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetEmployeeModal}
                    className="flex-1 px-6 py-3 border border-border hover:border-foreground transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEmployee}
                    className="flex-1 px-6 py-3 bg-foreground text-background hover:bg-background hover:text-foreground border border-foreground transition-colors text-sm disabled:opacity-50"
                  >
                    {savingEmployee ? 'Guardando...' : editingEmployee ? 'Actualizar' : 'Guardar'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Calculator,
  CheckCircle,
  Download,
  Edit2,
  FileText,
  Plus,
  Users,
  X,
} from 'lucide-react';
import { SearchBar } from './SearchBar';
import { useToast } from '../../contexts/ToastContext';
import { getDepartments, getEmployees, type Department, type Employee } from '../../services/employees.service';
import {
  createPayroll,
  getPayrolls,
  type Payroll,
  type PayrollPayload,
  type PayrollStatus,
  updatePayroll,
} from '../../services/human-resources.service';

interface PayrollFormState {
  employee: string;
  period_start: string;
  period_end: string;
  base_salary: string;
  bonuses: string;
  deductions: string;
  status: PayrollStatus;
}

const EMPTY_FORM: PayrollFormState = {
  employee: '',
  period_start: '',
  period_end: '',
  base_salary: '',
  bonuses: '0',
  deductions: '0',
  status: 'DRAFT',
};

function formatCurrency(amount: number | string): string {
  const parsed = typeof amount === 'number' ? amount : Number(amount);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Number.isFinite(parsed) ? parsed : 0);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('es-CO');
}

function payrollStatusLabel(status: PayrollStatus): string {
  const labels: Record<PayrollStatus, string> = {
    DRAFT: 'Borrador',
    APPROVED: 'Aprobada',
    PAID: 'Pagada',
  };
  return labels[status];
}

function payrollStatusBadge(status: PayrollStatus): string {
  const styles: Record<PayrollStatus, string> = {
    DRAFT: 'bg-slate-50 text-slate-700 border-slate-200',
    APPROVED: 'bg-amber-50 text-amber-700 border-amber-200',
    PAID: 'bg-green-50 text-green-700 border-green-200',
  };
  return styles[status];
}

function getEmployeeName(employee: Employee): string {
  return `${employee.first_name} ${employee.last_name}`.trim() || employee.employee_code;
}

export function AdminPayroll() {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [savingPayroll, setSavingPayroll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState<PayrollFormState>(EMPTY_FORM);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [payrollsRes, employeesRes, departmentsRes] = await Promise.allSettled([
        getPayrolls({ limit: 200 }),
        getEmployees({ limit: 200 }),
        getDepartments({ limit: 200 }),
      ]);

      if (payrollsRes.status === 'fulfilled') setPayrolls(payrollsRes.value.data);
      if (employeesRes.status === 'fulfilled') setEmployees(employeesRes.value.data);
      if (departmentsRes.status === 'fulfilled') setDepartments(departmentsRes.value.data);

      const failures = [payrollsRes, employeesRes, departmentsRes].filter(
        (result) => result.status === 'rejected',
      );
      if (failures.length > 0) {
        console.warn('Payroll data partially unavailable', failures);
      }
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar la nómina');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const employeeById = useMemo(() => new Map(employees.map(employee => [employee.id, employee])), [employees]);
  const departmentById = useMemo(() => new Map(departments.map(department => [department.id, department])), [departments]);

  const filteredPayrolls = useMemo(() => {
    return payrolls.filter((payroll) => {
      const employee = employeeById.get(payroll.employee);
      const department = employee ? departmentById.get(employee.department) : undefined;
      const matchesSearch =
        searchQuery.trim() === '' ||
        employee?.employee_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee?.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        employee?.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        department?.name.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesEmployee = filterEmployee === 'all' || payroll.employee === filterEmployee;
      const matchesStatus = filterStatus === 'all' || payroll.status === filterStatus;

      return matchesSearch && matchesEmployee && matchesStatus;
    });
  }, [departmentById, employeeById, filterEmployee, filterStatus, payrolls, searchQuery]);

  const stats = useMemo(() => {
    const netTotal = payrolls.reduce((sum, payroll) => sum + Number(payroll.net_salary || 0), 0);
    return {
      total: payrolls.length,
      draft: payrolls.filter(payroll => payroll.status === 'DRAFT').length,
      approved: payrolls.filter(payroll => payroll.status === 'APPROVED').length,
      paid: payrolls.filter(payroll => payroll.status === 'PAID').length,
      netTotal,
    };
  }, [payrolls]);

  const openCreateModal = () => {
    setEditingPayroll(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (payroll: Payroll) => {
    setEditingPayroll(payroll);
    setForm({
      employee: payroll.employee,
      period_start: payroll.period_start,
      period_end: payroll.period_end,
      base_salary: String(payroll.base_salary),
      bonuses: String(payroll.bonuses),
      deductions: String(payroll.deductions),
      status: payroll.status,
    });
    setShowModal(true);
  };

  const resetModal = () => {
    setShowModal(false);
    setEditingPayroll(null);
    setForm(EMPTY_FORM);
  };

  const calculatedNet = useMemo(() => {
    const base = Number(form.base_salary || 0);
    const bonuses = Number(form.bonuses || 0);
    const deductions = Number(form.deductions || 0);
    return base + bonuses - deductions;
  }, [form.base_salary, form.bonuses, form.deductions]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingPayroll(true);

    const payload: PayrollPayload = {
      employee: form.employee,
      period_start: form.period_start,
      period_end: form.period_end,
      base_salary: Number(form.base_salary || 0),
      bonuses: Number(form.bonuses || 0),
      deductions: Number(form.deductions || 0),
      net_salary: calculatedNet,
      status: form.status,
    };

    try {
      if (editingPayroll) {
        await updatePayroll(editingPayroll.id, payload);
        toast.success('Nómina actualizada');
      } else {
        await createPayroll(payload);
        toast.success('Nómina creada');
      }

      await loadData();
      resetModal();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo guardar la nómina');
    } finally {
      setSavingPayroll(false);
    }
  };

  const exportToCSV = () => {
    if (filteredPayrolls.length === 0) {
      toast.warning('No hay datos para exportar');
      return;
    }

    const headers = ['Empleado', 'Departamento', 'Periodo Inicio', 'Periodo Fin', 'Base', 'Bonos', 'Deducciones', 'Neto', 'Estado'];
    const csv = [
      headers.join(','),
      ...filteredPayrolls.map((payroll) => {
        const employee = employeeById.get(payroll.employee);
        const department = employee ? departmentById.get(employee.department) : undefined;
        return [
          employee ? getEmployeeName(employee) : payroll.employee,
          department?.name ?? '',
          payroll.period_start,
          payroll.period_end,
          Number(payroll.base_salary || 0).toFixed(2),
          Number(payroll.bonuses || 0).toFixed(2),
          Number(payroll.deductions || 0).toFixed(2),
          Number(payroll.net_salary || 0).toFixed(2),
          payroll.status,
        ].join(',');
      }),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nomina-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Nómina exportada');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl mb-2">Nómina</h2>
          <p className="text-xs text-muted-foreground">
            Gestión de registros salariales conectada a `human_resources.Payroll`.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 border border-border hover:border-foreground text-xs transition-colors"
          >
            <Download className="w-4 h-4" strokeWidth={1} />
            Exportar CSV
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-foreground text-background hover:bg-background hover:text-foreground border border-foreground transition-colors text-xs"
          >
            <Plus className="w-4 h-4" strokeWidth={1} />
            Nueva nómina
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Registros', value: stats.total, icon: FileText },
          { label: 'Borradores', value: stats.draft, icon: Clock3 },
          { label: 'Aprobadas', value: stats.approved, icon: CheckCircle },
          { label: 'Pagadas', value: stats.paid, icon: Users },
          { label: 'Neto total', value: formatCurrency(stats.netTotal), icon: Calculator },
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
              <div className="text-lg md:text-2xl font-light">{stat.value}</div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar por empleado, código o departamento..."
          className="flex-1"
        />

        <select
          value={filterEmployee}
          onChange={(event) => setFilterEmployee(event.target.value)}
          className="px-4 py-2 border border-border bg-transparent text-xs focus:outline-none focus:border-foreground"
        >
          <option value="all">Todos los empleados</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {getEmployeeName(employee)}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(event) => setFilterStatus(event.target.value)}
          className="px-4 py-2 border border-border bg-transparent text-xs focus:outline-none focus:border-foreground"
        >
          <option value="all">Todos los estados</option>
          <option value="DRAFT">Borrador</option>
          <option value="APPROVED">Aprobada</option>
          <option value="PAID">Pagada</option>
        </select>
      </div>

      {isLoading ? (
        <div className="border border-border p-12 text-center text-muted-foreground">
          <div className="text-sm">Cargando nómina...</div>
        </div>
      ) : (
        <div className="border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left p-3 font-medium">Empleado</th>
                  <th className="text-left p-3 font-medium">Periodo</th>
                  <th className="text-right p-3 font-medium">Base</th>
                  <th className="text-right p-3 font-medium">Bonos</th>
                  <th className="text-right p-3 font-medium">Deducciones</th>
                  <th className="text-right p-3 font-medium">Neto</th>
                  <th className="text-left p-3 font-medium">Estado</th>
                  <th className="text-center p-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayrolls.map((payroll) => {
                  const employee = employeeById.get(payroll.employee);
                  const department = employee ? departmentById.get(employee.department) : undefined;
                  return (
                    <tr key={payroll.id} className="border-b border-border hover:bg-secondary/20 transition-colors">
                      <td className="p-3">
                        <div className="font-medium">{employee ? getEmployeeName(employee) : payroll.employee}</div>
                        <div className="text-muted-foreground mt-1">
                          {employee?.employee_code ?? 'Sin código'}
                        </div>
                        <div className="text-muted-foreground mt-1">
                          {department?.name ?? 'Sin departamento'}
                        </div>
                      </td>
                      <td className="p-3">
                        <div>{formatDate(payroll.period_start)}</div>
                        <div className="text-muted-foreground mt-1">hasta {formatDate(payroll.period_end)}</div>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-2">
                          {payroll.items.length} conceptos
                        </div>
                      </td>
                      <td className="p-3 text-right">{formatCurrency(payroll.base_salary)}</td>
                      <td className="p-3 text-right text-green-600">{formatCurrency(payroll.bonuses)}</td>
                      <td className="p-3 text-right text-red-600">{formatCurrency(payroll.deductions)}</td>
                      <td className="p-3 text-right font-medium">{formatCurrency(payroll.net_salary)}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-1 border text-[10px] ${payrollStatusBadge(payroll.status)}`}>
                          {payrollStatusLabel(payroll.status)}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(payroll)}
                            className="p-1.5 hover:bg-secondary/50 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" strokeWidth={1} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredPayrolls.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <Calculator className="w-12 h-12 mx-auto mb-3 opacity-20" strokeWidth={1} />
              <div className="text-sm">No se encontraron registros de nómina</div>
            </div>
          )}
        </div>
      )}

      {showModal && (
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
                    {editingPayroll ? 'Editar nómina' : 'Nueva nómina'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-2">
                    Los valores se guardan en el modelo `Payroll` real del backend.
                  </p>
                </div>
                <button
                  onClick={resetModal}
                  className="p-2 hover:bg-secondary/50 transition-colors"
                >
                  <X className="w-4 h-4" strokeWidth={1} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-2">Empleado</label>
                    <select
                      required
                      value={form.employee}
                      onChange={(event) => setForm({ ...form, employee: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-background focus:outline-none focus:border-foreground text-sm"
                    >
                      <option value="">Selecciona un empleado</option>
                      {employees.map((employee) => (
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
                      value={form.status}
                      onChange={(event) => setForm({ ...form, status: event.target.value as PayrollStatus })}
                      className="w-full px-4 py-2.5 border border-border bg-background focus:outline-none focus:border-foreground text-sm"
                    >
                      <option value="DRAFT">Borrador</option>
                      <option value="APPROVED">Aprobada</option>
                      <option value="PAID">Pagada</option>
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-2">Periodo inicio</label>
                    <input
                      type="date"
                      required
                      value={form.period_start}
                      onChange={(event) => setForm({ ...form, period_start: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-background focus:outline-none focus:border-foreground text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-2">Periodo fin</label>
                    <input
                      type="date"
                      required
                      value={form.period_end}
                      onChange={(event) => setForm({ ...form, period_end: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-background focus:outline-none focus:border-foreground text-sm"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs mb-2">Salario base</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      required
                      value={form.base_salary}
                      onChange={(event) => setForm({ ...form, base_salary: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-2">Bonificaciones</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={form.bonuses}
                      onChange={(event) => setForm({ ...form, bonuses: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-2">Deducciones</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={form.deductions}
                      onChange={(event) => setForm({ ...form, deductions: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 border border-border bg-secondary/20">
                    <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-2">
                      Neto calculado
                    </div>
                    <div className="text-2xl font-medium">
                      {formatCurrency(calculatedNet)}
                    </div>
                  </div>
                  <div className="p-4 border border-border bg-secondary/20 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 mt-0.5 text-muted-foreground" strokeWidth={1} />
                    <div className="text-xs text-muted-foreground">
                      El backend calcula `net_salary` a partir de la combinación de salario base, bonificaciones y deducciones.
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={resetModal}
                    className="flex-1 px-6 py-3 border border-border hover:border-foreground transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingPayroll}
                    className="flex-1 px-6 py-3 bg-foreground text-background hover:bg-background hover:text-foreground border border-foreground transition-colors text-sm disabled:opacity-50"
                  >
                    {savingPayroll ? 'Guardando...' : editingPayroll ? 'Actualizar' : 'Crear'}
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

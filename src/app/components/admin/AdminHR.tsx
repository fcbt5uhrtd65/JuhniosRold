import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { Users, UserPlus, Search, Filter, Calendar, Mail, Phone, Briefcase, X, Edit2 } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { useToast } from '../../contexts/ToastContext';

interface Employee {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  cargo: string;
  departamento: string;
  fechaIngreso: string;
  estado: 'Activo' | 'Inactivo' | 'Vacaciones';
  salario: number;
}

export function AdminHR() {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartamento, setFilterDepartamento] = useState<string>('all');
  const [filterEstado, setFilterEstado] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([
    {
      id: '1',
      nombre: 'Ana María García',
      email: 'ana.garcia@juhniosrold.com',
      telefono: '+57 300 123 4567',
      cargo: 'Gerente de Ventas',
      departamento: 'Ventas',
      fechaIngreso: '2020-03-15',
      estado: 'Activo',
      salario: 4500000
    },
    {
      id: '2',
      nombre: 'Carlos Rodríguez',
      email: 'carlos.rodriguez@juhniosrold.com',
      telefono: '+57 310 234 5678',
      cargo: 'Contador Senior',
      departamento: 'Finanzas',
      fechaIngreso: '2019-08-20',
      estado: 'Activo',
      salario: 4200000
    },
    {
      id: '3',
      nombre: 'María Fernández',
      email: 'maria.fernandez@juhniosrold.com',
      telefono: '+57 320 345 6789',
      cargo: 'Jefe de Producción',
      departamento: 'Producción',
      fechaIngreso: '2021-01-10',
      estado: 'Vacaciones',
      salario: 3800000
    },
    {
      id: '4',
      nombre: 'Juan López',
      email: 'juan.lopez@juhniosrold.com',
      telefono: '+57 315 456 7890',
      cargo: 'Asistente de RRHH',
      departamento: 'Recursos Humanos',
      fechaIngreso: '2022-05-01',
      estado: 'Activo',
      salario: 2500000
    },
    {
      id: '5',
      nombre: 'Patricia Morales',
      email: 'patricia.morales@juhniosrold.com',
      telefono: '+57 301 567 8901',
      cargo: 'Contadora',
      departamento: 'Contabilidad',
      fechaIngreso: '2020-02-15',
      estado: 'Activo',
      salario: 4000000
    },
    {
      id: '6',
      nombre: 'Roberto Silva',
      email: 'roberto.silva@juhniosrold.com',
      telefono: '+57 312 678 9012',
      cargo: 'Abogado Corporativo',
      departamento: 'Legal',
      fechaIngreso: '2021-07-10',
      estado: 'Activo',
      salario: 5000000
    }
  ]);

  const [formData, setFormData] = useState<Partial<Employee>>({
    nombre: '',
    email: '',
    telefono: '',
    cargo: '',
    departamento: '',
    fechaIngreso: '',
    estado: 'Activo',
    salario: 0
  });

  const departamentos = ['Ventas', 'Finanzas', 'Producción', 'Recursos Humanos', 'Marketing', 'Logística', 'Legal', 'Contabilidad'];

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = searchQuery === '' ||
        emp.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.cargo.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDepartamento = filterDepartamento === 'all' || emp.departamento === filterDepartamento;
      const matchesEstado = filterEstado === 'all' || emp.estado === filterEstado;

      return matchesSearch && matchesDepartamento && matchesEstado;
    });
  }, [employees, searchQuery, filterDepartamento, filterEstado]);

  const stats = useMemo(() => {
    return {
      total: employees.length,
      activos: employees.filter(e => e.estado === 'Activo').length,
      vacaciones: employees.filter(e => e.estado === 'Vacaciones').length,
      inactivos: employees.filter(e => e.estado === 'Inactivo').length
    };
  }, [employees]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingEmployee) {
      setEmployees(employees.map(emp =>
        emp.id === editingEmployee.id ? { ...formData as Employee, id: emp.id } : emp
      ));
      toast.success(`Empleado ${formData.nombre} actualizado`);
    } else {
      const newEmployee: Employee = {
        ...formData as Employee,
        id: `emp-${Date.now()}`
      };
      setEmployees([...employees, newEmployee]);
      toast.success(`Empleado ${formData.nombre} agregado`);
    }

    setShowAddModal(false);
    setEditingEmployee(null);
    setFormData({
      nombre: '',
      email: '',
      telefono: '',
      cargo: '',
      departamento: '',
      fechaIngreso: '',
      estado: 'Activo',
      salario: 0
    });
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setFormData(employee);
    setShowAddModal(true);
  };

  const handleDelete = (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (confirm(`¿Eliminar a ${emp?.nombre}?`)) {
      setEmployees(employees.filter(e => e.id !== id));
      toast.info(`Empleado eliminado`);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getEstadoBadge = (estado: string) => {
    const styles = {
      'Activo': 'bg-green-50 text-green-700 border-green-200',
      'Inactivo': 'bg-red-50 text-red-700 border-red-200',
      'Vacaciones': 'bg-blue-50 text-blue-700 border-blue-200'
    };
    return styles[estado as keyof typeof styles] || '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl mb-2">Recursos Humanos</h2>
          <p className="text-xs text-muted-foreground">
            Gestión de empleados y registros de personal
          </p>
        </div>
        <button
          onClick={() => {
            setEditingEmployee(null);
            setFormData({
              nombre: '',
              email: '',
              telefono: '',
              cargo: '',
              departamento: '',
              fechaIngreso: '',
              estado: 'Activo',
              salario: 0
            });
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background hover:bg-background hover:text-foreground border border-foreground transition-colors text-xs"
        >
          <UserPlus className="w-4 h-4" strokeWidth={1} />
          Agregar Empleado
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Empleados', value: stats.total, icon: Users },
          { label: 'Activos', value: stats.activos, icon: Briefcase },
          { label: 'En Vacaciones', value: stats.vacaciones, icon: Calendar },
          { label: 'Inactivos', value: stats.inactivos, icon: X }
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
              <div className="text-2xl font-light">
                {stat.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar por nombre, email o cargo..."
          className="flex-1"
        />

        <select
          value={filterDepartamento}
          onChange={(e) => setFilterDepartamento(e.target.value)}
          className="px-4 py-2 border border-border bg-transparent text-xs focus:outline-none focus:border-foreground"
        >
          <option value="all">Todos los departamentos</option>
          {departamentos.map(dept => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>

        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          className="px-4 py-2 border border-border bg-transparent text-xs focus:outline-none focus:border-foreground"
        >
          <option value="all">Todos los estados</option>
          <option value="Activo">Activo</option>
          <option value="Vacaciones">Vacaciones</option>
          <option value="Inactivo">Inactivo</option>
        </select>
      </div>

      {/* Employees Table */}
      <div className="border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-3 font-medium">Empleado</th>
                <th className="text-left p-3 font-medium">Cargo</th>
                <th className="text-left p-3 font-medium">Departamento</th>
                <th className="text-left p-3 font-medium">Fecha Ingreso</th>
                <th className="text-left p-3 font-medium">Estado</th>
                <th className="text-right p-3 font-medium">Salario</th>
                <th className="text-center p-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="border-b border-border hover:bg-secondary/20 transition-colors">
                  <td className="p-3">
                    <div className="font-medium">{emp.nombre}</div>
                    <div className="text-muted-foreground flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" strokeWidth={1} />
                        {emp.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" strokeWidth={1} />
                        {emp.telefono}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">{emp.cargo}</td>
                  <td className="p-3">{emp.departamento}</td>
                  <td className="p-3">{new Date(emp.fechaIngreso).toLocaleDateString('es-CO')}</td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-1 border text-[10px] ${getEstadoBadge(emp.estado)}`}>
                      {emp.estado}
                    </span>
                  </td>
                  <td className="p-3 text-right">{formatCurrency(emp.salario)}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEdit(emp)}
                        className="p-1.5 hover:bg-secondary/50 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" strokeWidth={1} />
                      </button>
                      <button
                        onClick={() => handleDelete(emp.id)}
                        className="p-1.5 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Eliminar"
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={1} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-8">
              <h3 className="text-2xl mb-6">
                {editingEmployee ? 'Editar Empleado' : 'Agregar Empleado'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-2">Nombre completo</label>
                    <input
                      type="text"
                      required
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                      placeholder="Ej: María González"
                    />
                  </div>

                  <div>
                    <label className="block text-xs mb-2">Email</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                      placeholder="email@juhniosrold.com"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-2">Teléfono</label>
                    <input
                      type="tel"
                      required
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                      placeholder="+57 300 123 4567"
                    />
                  </div>

                  <div>
                    <label className="block text-xs mb-2">Cargo</label>
                    <input
                      type="text"
                      required
                      value={formData.cargo}
                      onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                      placeholder="Ej: Gerente de Ventas"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-2">Departamento</label>
                    <select
                      required
                      value={formData.departamento}
                      onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-background focus:outline-none focus:border-foreground text-sm"
                    >
                      <option value="">Selecciona un departamento</option>
                      {departamentos.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs mb-2">Fecha de ingreso</label>
                    <input
                      type="date"
                      required
                      value={formData.fechaIngreso}
                      onChange={(e) => setFormData({ ...formData, fechaIngreso: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-background focus:outline-none focus:border-foreground text-sm"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-2">Estado</label>
                    <select
                      required
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value as Employee['estado'] })}
                      className="w-full px-4 py-2.5 border border-border bg-background focus:outline-none focus:border-foreground text-sm"
                    >
                      <option value="Activo">Activo</option>
                      <option value="Vacaciones">Vacaciones</option>
                      <option value="Inactivo">Inactivo</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs mb-2">Salario mensual</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="1000"
                      value={formData.salario}
                      onChange={(e) => setFormData({ ...formData, salario: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingEmployee(null);
                    }}
                    className="flex-1 px-6 py-3 border border-border hover:border-foreground transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-foreground text-background hover:bg-background hover:text-foreground border border-foreground transition-colors text-sm"
                  >
                    {editingEmployee ? 'Actualizar' : 'Agregar'}
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

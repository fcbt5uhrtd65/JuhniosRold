import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarClock, CheckCircle2, Clock3, FileText, Send, UserRound } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import { useToast } from '../../contexts/ToastContext';
import { getEmployees, type Employee } from '../../services/employees.service';
import {
  createMyVacationRequest,
  getMyVacationRequests,
  type VacationRequest,
  type VacationRequestStatus,
} from '../../services/human-resources.service';

interface VacationFormState {
  start_date: string;
  end_date: string;
  reason: string;
}

const EMPTY_FORM: VacationFormState = {
  start_date: '',
  end_date: '',
  reason: '',
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('es-CO');
}

function getStatusLabel(status: VacationRequestStatus): string {
  const labels: Record<VacationRequestStatus, string> = {
    PENDING: 'Pendiente',
    APPROVED: 'Aprobada',
    REJECTED: 'Rechazada',
  };
  return labels[status];
}

function getStatusBadge(status: VacationRequestStatus): string {
  const styles: Record<VacationRequestStatus, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    APPROVED: 'bg-green-50 text-green-700 border-green-200',
    REJECTED: 'bg-red-50 text-red-700 border-red-200',
  };
  return styles[status];
}

function getEmployeeName(employee: Employee): string {
  return `${employee.first_name} ${employee.last_name}`.trim() || employee.employee_code;
}

export function AdminEmployeePortal() {
  const { currentUser } = useAdmin();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employeeProfile, setEmployeeProfile] = useState<Employee | null>(null);
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [form, setForm] = useState<VacationFormState>(EMPTY_FORM);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [employeesRes, requestsRes] = await Promise.allSettled([
        getEmployees({ limit: 200 }),
        getMyVacationRequests({ limit: 200 }),
      ]);

      if (employeesRes.status === 'fulfilled') {
        const found = employeesRes.value.data.find((employee) => employee.user === currentUser?.id) ?? null;
        setEmployeeProfile(found);
      }

      if (requestsRes.status === 'fulfilled') {
        setRequests(requestsRes.value.data);
      }
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar tu portal de solicitudes');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((request) => request.status === 'PENDING').length,
      approved: requests.filter((request) => request.status === 'APPROVED').length,
    };
  }, [requests]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!employeeProfile) {
      toast.error('Tu usuario no tiene un perfil de empleado asociado');
      return;
    }

    setSaving(true);
    try {
      await createMyVacationRequest({
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason,
      });
      toast.success('Solicitud enviada a RRHH');
      setForm(EMPTY_FORM);
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo crear la solicitud');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="border border-border p-12 text-center text-muted-foreground">
        Cargando tu portal interno...
      </div>
    );
  }

  if (!employeeProfile) {
    return (
      <div className="border border-border p-8 space-y-3">
        <div className="flex items-center gap-2">
          <UserRound className="w-4 h-4" strokeWidth={1} />
          <div className="text-xs tracking-[0.2em] uppercase">Portal interno</div>
        </div>
        <div className="text-sm">
          Tu usuario no tiene un perfil de empleado asociado. RRHH debe vincular tu cuenta a un registro en el módulo de empleados.
        </div>
        <div className="text-xs text-muted-foreground">
          Usuario actual: {currentUser?.email}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl mb-2">Portal interno</h2>
          <p className="text-xs text-muted-foreground">
            Solicitudes personales de vacaciones y novedades laborales.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: FileText },
          { label: 'Pendientes', value: stats.pending, icon: Clock3 },
          { label: 'Aprobadas', value: stats.approved, icon: CheckCircle2 },
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

      <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="w-4 h-4" strokeWidth={1} />
            <div className="text-xs tracking-[0.2em] uppercase">Crear solicitud</div>
          </div>

          <div className="mb-6 p-4 bg-secondary/20 border border-border text-sm">
            <div className="font-medium mb-1">{getEmployeeName(employeeProfile)}</div>
            <div className="text-xs text-muted-foreground">
              {employeeProfile.employee_code} · {employeeProfile.email}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-2">Fecha inicio</label>
                <input
                  type="date"
                  required
                  value={form.start_date}
                  onChange={(event) => setForm({ ...form, start_date: event.target.value })}
                  className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-xs mb-2">Fecha fin</label>
                <input
                  type="date"
                  required
                  value={form.end_date}
                  onChange={(event) => setForm({ ...form, end_date: event.target.value })}
                  className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs mb-2">Motivo</label>
              <textarea
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
                rows={4}
                className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm resize-none"
                placeholder="Describe brevemente tu solicitud"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-3 bg-foreground text-background hover:opacity-90 transition-opacity text-sm disabled:opacity-50"
              >
                <Send className="w-4 h-4" strokeWidth={1} />
                {saving ? 'Enviando...' : 'Enviar solicitud'}
              </button>
              <div className="text-xs text-muted-foreground">
                RRHH revisará y actualizará el estado desde su panel.
              </div>
            </div>
          </form>
        </div>

        <div className="border border-border p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4" strokeWidth={1} />
            <div className="text-xs tracking-[0.2em] uppercase">Mis solicitudes</div>
          </div>

          <div className="space-y-3">
            {requests.map((request) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-border p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">
                      {formatDate(request.start_date)} - {formatDate(request.end_date)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {request.reason || 'Sin motivo'}
                    </div>
                    <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mt-2">
                      Registrada {formatDate(request.created_at)}
                    </div>
                  </div>
                  <span className={`inline-block px-2 py-1 border text-[10px] ${getStatusBadge(request.status)}`}>
                    {getStatusLabel(request.status)}
                  </span>
                </div>
              </motion.div>
            ))}

            {requests.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No has enviado solicitudes todavía.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

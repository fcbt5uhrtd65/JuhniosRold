import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarClock, CheckCircle2, Clock3, FileText, Paperclip, Send, UserRound, X } from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import { useToast } from '../../contexts/ToastContext';
import { getEmployees, type Employee } from '../../services/employees.service';
import {
  createMyVacationRequest,
  getMyVacationRequests,
  type VacationRequest,
  type VacationRequestStatus,
  type VacationRequestType,
} from '../../services/human-resources.service';

type RequestPeriodMode = 'SINGLE_DAY' | 'DATE_RANGE';
type RequestTimeMode = 'FULL_DAY' | 'FROM_TIME' | 'TIME_RANGE';

interface VacationFormState {
  request_type: VacationRequestType;
  period_mode: RequestPeriodMode;
  time_mode: RequestTimeMode;
  single_date: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  reason: string;
  support_document: File | null;
}

const EMPTY_FORM: VacationFormState = {
  request_type: 'PERMISSION',
  period_mode: 'SINGLE_DAY',
  time_mode: 'FULL_DAY',
  single_date: '',
  start_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  reason: '',
  support_document: null,
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('es-CO');
}

function formatTime(value: string | null | undefined): string {
  if (!value) return 'Sin hora';
  const normalized = value.length === 5 ? `${value}:00` : value;
  const parsed = new Date(`1970-01-01T${normalized}`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
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

function getRequestTypeLabel(type: VacationRequestType): string {
  return type === 'PERMISSION' ? 'Permiso' : 'Vacaciones';
}

function isAllowedSupportDocument(file: File): boolean {
  const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
  const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg'];
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return allowedMimeTypes.includes(file.type) || allowedExtensions.includes(extension);
}

function getRequestScheduleLabel(request: VacationRequest): string {
  const dateLabel =
    request.start_date === request.end_date
      ? formatDate(request.start_date)
      : `${formatDate(request.start_date)} - ${formatDate(request.end_date)}`;

  if (request.is_full_day) {
    return `${dateLabel} · Jornada completa`;
  }

  if (request.start_time && request.end_time) {
    return `${dateLabel} · ${formatTime(request.start_time)} - ${formatTime(request.end_time)}`;
  }

  if (request.start_time) {
    return `${dateLabel} · Desde ${formatTime(request.start_time)} hasta fin del día`;
  }

  return `${dateLabel} · Horario parcial`;
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

    const start_date = form.period_mode === 'SINGLE_DAY' ? form.single_date : form.start_date;
    const end_date = form.period_mode === 'SINGLE_DAY' ? form.single_date : form.end_date;
    const is_full_day = form.time_mode === 'FULL_DAY';

    if (!start_date || !end_date) {
      toast.error('Debes indicar las fechas de la solicitud');
      return;
    }

    if (!is_full_day && !form.start_time) {
      toast.error('Debes indicar la hora de inicio');
      return;
    }

    if (form.time_mode === 'TIME_RANGE' && !form.end_time) {
      toast.error('Debes indicar la hora final');
      return;
    }

    if (form.support_document && !isAllowedSupportDocument(form.support_document)) {
      toast.error('El soporte debe ser PDF o una imagen PNG/JPG');
      return;
    }

    setSaving(true);
    try {
      await createMyVacationRequest({
        request_type: form.request_type,
        start_date,
        end_date,
        is_full_day,
        ...(is_full_day ? {} : { start_time: form.start_time, end_time: form.time_mode === 'TIME_RANGE' ? form.end_time : null }),
        reason: form.reason,
        support_document: form.support_document,
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
                <label className="block text-xs mb-2">Tipo de solicitud</label>
                <select
                  value={form.request_type}
                  onChange={(event) => setForm({ ...form, request_type: event.target.value as VacationRequestType })}
                  className="w-full px-4 py-2.5 border border-border bg-background focus:outline-none focus:border-foreground text-sm"
                >
                  <option value="PERMISSION">Permiso</option>
                  <option value="VACATION">Vacaciones</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-2">Duración</label>
                <select
                  value={form.period_mode}
                  onChange={(event) => setForm({ ...form, period_mode: event.target.value as RequestPeriodMode })}
                  className="w-full px-4 py-2.5 border border-border bg-background focus:outline-none focus:border-foreground text-sm"
                >
                  <option value="SINGLE_DAY">Un solo día</option>
                  <option value="DATE_RANGE">Varios días</option>
                </select>
              </div>
            </div>

            {form.period_mode === 'SINGLE_DAY' ? (
              <div>
                <label className="block text-xs mb-2">Fecha</label>
                <input
                  type="date"
                  required
                  value={form.single_date}
                  onChange={(event) => setForm({ ...form, single_date: event.target.value })}
                  className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                />
              </div>
            ) : (
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
            )}

            <div>
              <label className="block text-xs mb-2">Cobertura del horario</label>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { value: 'FULL_DAY', label: 'Jornada completa' },
                  { value: 'FROM_TIME', label: 'Desde una hora' },
                  { value: 'TIME_RANGE', label: 'Rango de horas' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-2 border px-3 py-2 text-xs cursor-pointer ${
                      form.time_mode === option.value
                        ? 'border-foreground bg-secondary/30'
                        : 'border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name="time_mode"
                      value={option.value}
                      checked={form.time_mode === option.value}
                      onChange={(event) => setForm({ ...form, time_mode: event.target.value as RequestTimeMode })}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {form.time_mode !== 'FULL_DAY' && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-2">Hora inicio</label>
                  <input
                    type="time"
                    required
                    value={form.start_time}
                    onChange={(event) => setForm({ ...form, start_time: event.target.value })}
                    className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {form.time_mode === 'FROM_TIME'
                      ? 'Se usará desde esta hora hasta el final del día.'
                      : 'Se repetirá este rango en todos los días del periodo.'}
                  </p>
                </div>

                {form.time_mode === 'TIME_RANGE' && (
                  <div>
                    <label className="block text-xs mb-2">Hora fin</label>
                    <input
                      type="time"
                      required
                      value={form.end_time}
                      onChange={(event) => setForm({ ...form, end_time: event.target.value })}
                      className="w-full px-4 py-2.5 border border-border bg-transparent focus:outline-none focus:border-foreground text-sm"
                    />
                  </div>
                )}
              </div>
            )}

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

            <div>
              <label className="block text-xs mb-2">Documento de soporte</label>
              <label className="flex items-center gap-3 w-full px-4 py-3 border border-dashed border-border bg-secondary/10 cursor-pointer hover:bg-secondary/20 transition-colors">
                <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1} />
                <div className="text-sm flex-1">
                  <div className="font-medium">
                    {form.support_document ? form.support_document.name : 'Subir PDF, PNG o JPG'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Adjunta soportes como cita médica, certificado o constancia.
                  </div>
                </div>
                {form.support_document && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setForm({ ...form, support_document: null });
                    }}
                    className="p-2 hover:bg-background border border-border transition-colors"
                    aria-label="Quitar documento de soporte"
                  >
                    <X className="w-4 h-4" strokeWidth={1} />
                  </button>
                )}
                <input
                  key={form.support_document?.name ?? 'empty'}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      support_document: event.target.files?.[0] ?? null,
                    })
                  }
                  className="hidden"
                />
              </label>
            </div>

            <div className="border border-border bg-secondary/20 p-4 text-xs text-muted-foreground space-y-1">
              <div className="font-medium text-foreground">Resumen</div>
              <div>Tipo: {getRequestTypeLabel(form.request_type)}</div>
              <div>
                {form.period_mode === 'SINGLE_DAY'
                  ? `Fecha: ${form.single_date || 'pendiente'}`
                  : `Fechas: ${form.start_date || 'pendiente'} - ${form.end_date || 'pendiente'}`}
              </div>
              <div>
                Horario:{' '}
                {form.time_mode === 'FULL_DAY'
                  ? 'Jornada completa'
                  : form.time_mode === 'FROM_TIME'
                    ? `Desde ${form.start_time || 'pendiente'} hasta fin del día`
                    : `De ${form.start_time || 'pendiente'} a ${form.end_time || 'pendiente'}`}
              </div>
              <div>Soporte: {form.support_document ? form.support_document.name : 'Sin adjuntar'}</div>
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
                    <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1">
                      {getRequestTypeLabel(request.request_type)}
                    </div>
                    <div className="font-medium">
                      {getRequestScheduleLabel(request)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {request.reason || 'Sin motivo'}
                    </div>
                    <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mt-2">
                      Soporte: {request.support_document ? 'Adjunto' : 'Sin adjuntar'}
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

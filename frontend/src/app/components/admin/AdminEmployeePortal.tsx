import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Card, KpiCard, Badge, type BadgeColor, LoadingState, EmptyState, inputCls, selectCls } from './AdminUI';

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

function getStatusColor(status: VacationRequestStatus): BadgeColor {
  const colors: Record<VacationRequestStatus, BadgeColor> = {
    PENDING: 'yellow',
    APPROVED: 'green',
    REJECTED: 'red',
  };
  return colors[status];
}

const REQUEST_TYPE_LABELS: Record<VacationRequestType, string> = {
  PERMISSION: 'Permiso',
  VACATION: 'Vacaciones',
  OVERTIME: 'Horas extras',
  INCAPACITY: 'Incapacidad',
  LEAVE: 'Licencia',
  OTHER: 'Otro',
};

function getRequestTypeLabel(type: VacationRequestType): string {
  return REQUEST_TYPE_LABELS[type] ?? type;
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
    return <LoadingState label="Cargando tu portal interno..." />;
  }

  if (!employeeProfile) {
    return (
      <Card className="p-8 space-y-3">
        <div className="flex items-center gap-2">
          <UserRound size={15} className="text-gray-400" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Portal interno</p>
        </div>
        <p className="text-sm text-gray-700">
          Tu usuario no tiene un perfil de empleado asociado. RRHH debe vincular tu cuenta a un registro en el módulo de empleados.
        </p>
        <p className="text-xs text-gray-400">Usuario actual: {currentUser?.email}</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Portal interno</h2>
          <p className="text-xs text-gray-500 mt-0.5">Solicitudes personales de vacaciones y novedades laborales.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total" value={String(stats.total)} icon={FileText} color="text-gray-600 bg-gray-100" />
        <KpiCard label="Pendientes" value={String(stats.pending)} icon={Clock3} color="text-amber-600 bg-amber-50" />
        <KpiCard label="Aprobadas" value={String(stats.approved)} icon={CheckCircle2} color="text-emerald-600 bg-emerald-50" />
      </div>

      <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock size={15} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Crear solicitud</h3>
          </div>

          <div className="mb-6 p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm">
            <p className="font-medium text-gray-900 mb-1">{getEmployeeName(employeeProfile)}</p>
            <p className="text-xs text-gray-400">{employeeProfile.employee_code} · {employeeProfile.email}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Tipo de solicitud</label>
                <select
                  value={form.request_type}
                  onChange={(event) => setForm({ ...form, request_type: event.target.value as VacationRequestType })}
                  className={selectCls}
                >
                  {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Duración</label>
                <select
                  value={form.period_mode}
                  onChange={(event) => setForm({ ...form, period_mode: event.target.value as RequestPeriodMode })}
                  className={selectCls}
                >
                  <option value="SINGLE_DAY">Un solo día</option>
                  <option value="DATE_RANGE">Varios días</option>
                </select>
              </div>
            </div>

            {form.period_mode === 'SINGLE_DAY' ? (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Fecha</label>
                <input
                  type="date"
                  required
                  value={form.single_date}
                  onChange={(event) => setForm({ ...form, single_date: event.target.value })}
                  className={inputCls}
                />
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Fecha inicio</label>
                  <input
                    type="date"
                    required
                    value={form.start_date}
                    onChange={(event) => setForm({ ...form, start_date: event.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Fecha fin</label>
                  <input
                    type="date"
                    required
                    value={form.end_date}
                    onChange={(event) => setForm({ ...form, end_date: event.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Cobertura del horario</label>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { value: 'FULL_DAY', label: 'Jornada completa' },
                  { value: 'FROM_TIME', label: 'Desde una hora' },
                  { value: 'TIME_RANGE', label: 'Rango de horas' },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs cursor-pointer transition-colors ${
                      form.time_mode === option.value
                        ? 'border-[#2a4038] bg-[#2a4038]/5 text-gray-900'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="time_mode"
                      value={option.value}
                      checked={form.time_mode === option.value}
                      onChange={(event) => setForm({ ...form, time_mode: event.target.value as RequestTimeMode })}
                      className="accent-[#2a4038]"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>

            {form.time_mode !== 'FULL_DAY' && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Hora inicio</label>
                  <input
                    type="time"
                    required
                    value={form.start_time}
                    onChange={(event) => setForm({ ...form, start_time: event.target.value })}
                    className={inputCls}
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    {form.time_mode === 'FROM_TIME'
                      ? 'Se usará desde esta hora hasta el final del día.'
                      : 'Se repetirá este rango en todos los días del periodo.'}
                  </p>
                </div>

                {form.time_mode === 'TIME_RANGE' && (
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Hora fin</label>
                    <input
                      type="time"
                      required
                      value={form.end_time}
                      onChange={(event) => setForm({ ...form, end_time: event.target.value })}
                      className={inputCls}
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Motivo</label>
              <textarea
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
                rows={4}
                className={inputCls + ' resize-none'}
                placeholder="Describe brevemente tu solicitud"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Documento de soporte</label>
              <label className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                <Paperclip size={15} className="text-gray-400 shrink-0" />
                <div className="text-sm flex-1">
                  <p className="font-medium text-gray-900">
                    {form.support_document ? form.support_document.name : 'Subir PDF, PNG o JPG'}
                  </p>
                  <p className="text-xs text-gray-400">Adjunta soportes como cita médica, certificado o constancia.</p>
                </div>
                {form.support_document && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setForm({ ...form, support_document: null });
                    }}
                    className="p-2 rounded-lg hover:bg-white border border-gray-200 transition-colors"
                    aria-label="Quitar documento de soporte"
                  >
                    <X size={14} />
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

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs text-gray-500 space-y-1">
              <p className="font-medium text-gray-900">Resumen</p>
              <p>Tipo: {REQUEST_TYPE_LABELS[form.request_type]}</p>
              <p>
                {form.period_mode === 'SINGLE_DAY'
                  ? `Fecha: ${form.single_date || 'pendiente'}`
                  : `Fechas: ${form.start_date || 'pendiente'} - ${form.end_date || 'pendiente'}`}
              </p>
              <p>
                Horario:{' '}
                {form.time_mode === 'FULL_DAY'
                  ? 'Jornada completa'
                  : form.time_mode === 'FROM_TIME'
                    ? `Desde ${form.start_time || 'pendiente'} hasta fin del día`
                    : `De ${form.start_time || 'pendiente'} a ${form.end_time || 'pendiente'}`}
              </p>
              <p>Soporte: {form.support_document ? form.support_document.name : 'Sin adjuntar'}</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] transition-colors disabled:opacity-50"
              >
                <Send size={14} />
                {saving ? 'Enviando...' : 'Enviar solicitud'}
              </button>
              <p className="text-xs text-gray-400">RRHH revisará y actualizará el estado desde su panel.</p>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText size={15} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Mis solicitudes</h3>
          </div>

          <div className="space-y-3">
            {requests.map((request) => (
              <Card key={request.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                      {getRequestTypeLabel(request.request_type)}
                    </p>
                    <p className="text-sm font-medium text-gray-900">{getRequestScheduleLabel(request)}</p>
                    <p className="text-xs text-gray-400 mt-1">{request.reason || 'Sin motivo'}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2">
                      Soporte: {request.support_document ? 'Adjunto' : 'Sin adjuntar'}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2">
                      Registrada {formatDate(request.created_at)}
                    </p>
                  </div>
                  <Badge label={getStatusLabel(request.status)} color={getStatusColor(request.status)} />
                </div>
              </Card>
            ))}

            {requests.length === 0 && (
              <EmptyState title="No has enviado solicitudes todavía." />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

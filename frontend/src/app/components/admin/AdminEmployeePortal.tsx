import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  FileText,
  HeartPulse,
  Paperclip,
  Plane,
  Save,
  Send,
  UserRound,
  X,
} from 'lucide-react';
import { useAdmin } from '../../contexts/AdminContext';
import { useToast } from '../../contexts/ToastContext';
import { getEmployees, exportMyEmployeeCertificatePdf, type Employee } from '../../services/employees.service';
import {
  createMyVacationRequest,
  getMyVacationRequests,
  type VacationRequest,
  type VacationRequestStatus,
  type VacationRequestType,
} from '../../services/human-resources.service';
import { Card, KpiCard, Badge, type BadgeColor, LoadingState, EmptyState, Modal, inputCls, selectCls } from './AdminUI';
import { Pagination } from './Pagination';
import { SearchBar } from './SearchBar';
import { SignaturePad } from './SignaturePad';

const REQUESTS_PAGE_SIZE_OPTIONS = [5, 10, 20, 50];
const REASON_TRUNCATE_LENGTH = 90;

const REQUEST_TYPE_ICONS: Record<VacationRequestType, React.ComponentType<{ size?: number; className?: string }>> = {
  PERMISSION: FileCheck2,
  VACATION: Plane,
  OVERTIME: Clock3,
  INCAPACITY: HeartPulse,
  LEAVE: Briefcase,
  OTHER: FileText,
};

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

function getMediaUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

function getDayCount(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
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
    IN_REVIEW: 'En revisión',
    PENDING_HR: 'Pendiente por RRHH',
    PENDING_ADMIN: 'Pendiente por Administrador',
    APPROVED: 'Aprobada',
    REJECTED: 'Rechazada',
    CANCELLED: 'Cancelada',
    FINALIZED: 'Finalizada',
    EXPIRED: 'Vencida',
  };
  return labels[status];
}

function getStatusColor(status: VacationRequestStatus): BadgeColor {
  const colors: Record<VacationRequestStatus, BadgeColor> = {
    PENDING: 'yellow',
    IN_REVIEW: 'purple',
    PENDING_HR: 'purple',
    PENDING_ADMIN: 'yellow',
    APPROVED: 'green',
    REJECTED: 'red',
    CANCELLED: 'gray',
    FINALIZED: 'blue',
    EXPIRED: 'red',
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
  const [requestsQuery, setRequestsQuery] = useState('');
  const [requestsPage, setRequestsPage] = useState(1);
  const [requestsPageSize, setRequestsPageSize] = useState(5);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
  const [downloadingCertificate, setDownloadingCertificate] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [certificateSignatureFile, setCertificateSignatureFile] = useState<File | null>(null);

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

  const filteredRequests = useMemo(() => {
    const query = requestsQuery.toLowerCase().trim();
    if (!query) return requests;
    return requests.filter((request) =>
      getRequestTypeLabel(request.request_type).toLowerCase().includes(query) ||
      (request.reason ?? '').toLowerCase().includes(query) ||
      getStatusLabel(request.status).toLowerCase().includes(query),
    );
  }, [requests, requestsQuery]);

  const requestsTotalPages = Math.max(1, Math.ceil(filteredRequests.length / requestsPageSize));

  const paginatedRequests = useMemo(() => {
    const start = (requestsPage - 1) * requestsPageSize;
    return filteredRequests.slice(start, start + requestsPageSize);
  }, [filteredRequests, requestsPage, requestsPageSize]);

  useEffect(() => {
    setRequestsPage(1);
  }, [requestsQuery, requestsPageSize]);

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

  const openCertificateModal = () => {
    setCertificateSignatureFile(null);
    setShowCertificateModal(true);
  };

  const closeCertificateModal = () => {
    setShowCertificateModal(false);
    setCertificateSignatureFile(null);
  };

  const handleDownloadCertificate = async () => {
    setDownloadingCertificate(true);
    try {
      await exportMyEmployeeCertificatePdf(employeeProfile?.employee_code, certificateSignatureFile);
      toast.success('Certificado laboral generado');
      closeCertificateModal();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo generar tu certificado laboral');
    } finally {
      setDownloadingCertificate(false);
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
        <button
          type="button"
          onClick={openCertificateModal}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white rounded-xl text-xs font-semibold hover:bg-[#3d5c4e] transition-colors"
        >
          <BadgeCheck size={14} />
          Descargar certificado laboral
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total" value={String(stats.total)} icon={FileText} color="text-gray-600 bg-gray-100" />
        <KpiCard label="Pendientes" value={String(stats.pending)} icon={Clock3} color="text-amber-600 bg-amber-50" />
        <KpiCard label="Aprobadas" value={String(stats.approved)} icon={CheckCircle2} color="text-emerald-600 bg-emerald-50" />
      </div>

      <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6 items-start">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock size={15} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Nueva solicitud</h3>
          </div>

          <div className="mb-6 flex items-center gap-3 p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <UserRound size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900 truncate">{getEmployeeName(employeeProfile)}</p>
              <p className="text-xs text-gray-400 truncate">{employeeProfile.employee_code} · {employeeProfile.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Tipo de solicitud</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.entries(REQUEST_TYPE_LABELS) as [VacationRequestType, string][]).map(([value, label]) => {
                  const Icon = REQUEST_TYPE_ICONS[value];
                  const active = form.request_type === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm({ ...form, request_type: value })}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors ${
                        active
                          ? 'border-[#2a4038] bg-[#2a4038]/5 text-[#2a4038]'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Icon size={14} className={active ? 'text-[#2a4038]' : 'text-gray-400'} />
                      {label}
                    </button>
                  );
                })}
              </div>
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
                    className="p-2.5 rounded-lg hover:bg-white border border-gray-200 transition-colors flex-shrink-0"
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

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => toast.info('Borrador guardado localmente (próximamente se sincronizará con tu cuenta).')}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <Save size={14} />
                Guardar borrador
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#2a4038] text-white rounded-xl text-xs font-semibold hover:bg-[#3d5c4e] transition-colors disabled:opacity-50"
              >
                <Send size={14} />
                {saving ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </form>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Resumen de la solicitud</h3>
            <dl className="space-y-3 text-xs">
              {[
                ['Tipo', REQUEST_TYPE_LABELS[form.request_type]],
                [
                  'Fecha',
                  form.period_mode === 'SINGLE_DAY'
                    ? form.single_date ? formatDate(form.single_date) : '—'
                    : form.start_date && form.end_date
                      ? `${formatDate(form.start_date)} – ${formatDate(form.end_date)}`
                      : '—',
                ],
                [
                  'Duración',
                  form.period_mode === 'SINGLE_DAY'
                    ? '1 día'
                    : form.start_date && form.end_date
                      ? `${getDayCount(form.start_date, form.end_date)} días`
                      : '—',
                ],
                [
                  'Cobertura',
                  form.time_mode === 'FULL_DAY'
                    ? 'Jornada completa'
                    : form.time_mode === 'FROM_TIME'
                      ? `Desde ${form.start_time || '—'}`
                      : `${form.start_time || '—'} a ${form.end_time || '—'}`,
                ],
                ['Motivo', form.reason.trim() || '—'],
                ['Documento', form.support_document ? form.support_document.name : '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4">
                  <dt className="text-gray-400 flex-shrink-0">{label}</dt>
                  <dd className="text-gray-900 font-medium text-right truncate max-w-[60%]" title={value}>{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Solicitudes recientes</h3>
            </div>
            {requests.length > 0 && (
              <span className="text-xs text-gray-400">
                <span className="text-gray-900 font-semibold">{filteredRequests.length}</span> {filteredRequests.length === 1 ? 'resultado' : 'resultados'}
              </span>
            )}
          </div>

          {requests.length > 0 && (
            <SearchBar value={requestsQuery} onChange={setRequestsQuery} placeholder="Buscar por tipo, motivo o estado..." className="mb-4" />
          )}

          <div className="space-y-3">
            {paginatedRequests.map((request) => {
              const Icon = REQUEST_TYPE_ICONS[request.request_type];
              const isLongReason = (request.reason ?? '').length > REASON_TRUNCATE_LENGTH;
              const isExpanded = expandedRequestId === request.id;
              const reasonText = request.reason || 'Sin motivo';
              return (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => setSelectedRequest(request)}
                  className="w-full text-left rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/60 transition-colors p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0">
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{getRequestTypeLabel(request.request_type)}</p>
                      <p className="text-xs text-gray-400 truncate">{getRequestScheduleLabel(request)}</p>
                    </div>
                    <div className="flex-shrink-0 whitespace-nowrap">
                      <Badge label={getStatusLabel(request.status)} color={getStatusColor(request.status)} />
                    </div>
                    <ChevronRight size={16} className="text-gray-300 flex-shrink-0 hidden sm:block" />
                  </div>
                  {reasonText !== 'Sin motivo' && (
                    <div className="mt-2 pl-12 text-xs text-gray-500">
                      <p className={isExpanded ? '' : 'line-clamp-2'}>{reasonText}</p>
                      {isLongReason && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedRequestId(isExpanded ? null : request.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              setExpandedRequestId(isExpanded ? null : request.id);
                            }
                          }}
                          className="inline-block mt-0.5 font-semibold text-[#2a4038] hover:underline"
                        >
                          {isExpanded ? 'Ver menos' : 'Ver más'}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}

            {requests.length === 0 && (
              <EmptyState title="No has enviado solicitudes todavía." />
            )}
            {requests.length > 0 && filteredRequests.length === 0 && (
              <EmptyState title="Ninguna solicitud coincide con tu búsqueda." />
            )}
          </div>

          {filteredRequests.length > 0 && (
            <div className="mt-4">
              <Pagination
                currentPage={requestsPage}
                totalPages={requestsTotalPages}
                totalItems={filteredRequests.length}
                itemsPerPage={requestsPageSize}
                itemsPerPageOptions={REQUESTS_PAGE_SIZE_OPTIONS}
                onPageChange={setRequestsPage}
                onItemsPerPageChange={setRequestsPageSize}
              />
            </div>
          )}
          </Card>
        </div>
      </div>

      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSelectedRequest(null)} />
          <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = REQUEST_TYPE_ICONS[selectedRequest.request_type];
                  return <Icon size={16} className="text-gray-400" />;
                })()}
                <h3 className="font-semibold text-gray-900">{getRequestTypeLabel(selectedRequest.request_type)}</h3>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="p-2.5 rounded-lg hover:bg-gray-200 flex-shrink-0"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <Badge label={getStatusLabel(selectedRequest.status)} color={getStatusColor(selectedRequest.status)} />
              <dl className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-xs text-gray-400 flex-shrink-0">Fechas</dt>
                  <dd className="text-gray-900 font-medium text-right">{getRequestScheduleLabel(selectedRequest)}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-xs text-gray-400 flex-shrink-0">Motivo</dt>
                  <dd className="text-gray-700 text-right whitespace-pre-wrap">{selectedRequest.reason || 'Sin motivo'}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-xs text-gray-400 flex-shrink-0">Registrada</dt>
                  <dd className="text-gray-900 font-medium text-right">{formatDate(selectedRequest.created_at)}</dd>
                </div>
              </dl>

              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Documentos adjuntos</p>
                <div className="space-y-1.5">
                  {selectedRequest.support_document && (
                    <a
                      href={getMediaUrl(selectedRequest.support_document)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-xs text-[#2a4038] underline underline-offset-2"
                    >
                      <Paperclip size={12} className="flex-shrink-0" />
                      Soporte principal
                    </a>
                  )}
                  {selectedRequest.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={getMediaUrl(attachment.file)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-xs text-[#2a4038] underline underline-offset-2"
                    >
                      <Paperclip size={12} className="flex-shrink-0" />
                      {attachment.name}
                    </a>
                  ))}
                  {!selectedRequest.support_document && selectedRequest.attachments.length === 0 && (
                    <p className="text-xs text-gray-400">Sin documentos adjuntos.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal title="Certificado laboral" open={showCertificateModal} onClose={closeCertificateModal}>
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Antes de generar tu certificado laboral, dibuja o sube tu firma. Se usará únicamente en este documento.
          </p>
          <SignaturePad
            label="Tu firma"
            helperText="Dibuja o sube tu firma para este certificado."
            onChange={setCertificateSignatureFile}
          />
          <div className="flex justify-end gap-2">
            <button onClick={closeCertificateModal} className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleDownloadCertificate}
              disabled={!certificateSignatureFile || downloadingCertificate}
              className="px-4 py-2 bg-[#2a4038] rounded-lg text-xs font-semibold text-white hover:bg-[#3d5c4e] transition-colors disabled:opacity-40"
            >
              {downloadingCertificate ? 'Generando...' : 'Firmar y generar certificado'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

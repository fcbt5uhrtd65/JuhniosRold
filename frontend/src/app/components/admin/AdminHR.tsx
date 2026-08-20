import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  Cake,
  CalendarCog,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Download,
  Edit2,
  FileCheck2,
  FileDown,
  FileText,
  FileUp,
  HandCoins,
  HeartPulse,
  History,
  KeyRound,
  Landmark,
  Loader2,
  MapPin,
  Network,
  Paperclip,
  Plane,
  Plus,
  Search,
  Save,
  ShieldCheck,
  Shirt,
  Eye,
  EyeOff,
  RefreshCcw,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  X,
  XCircle,
  ArrowDownAZ,
  ArrowUpAZ,
} from 'lucide-react';

import { SearchBar } from './SearchBar';
import { Pagination } from './Pagination';
import { SignaturePad } from './SignaturePad';
import { CalendarChip, CalendarMoreChip, CalendarMonthNav, MonthCalendar, getMonthGrid, toDateKey, type CalendarChipColor } from './HRCalendar';
import { OrgChart, buildOrgForest } from './OrgChart';
import { Badge, type BadgeColor, Card, Table, Th, Td, Modal, EmptyState, LoadingState, inputCls, selectCls, ActionsMenu, actionsCellCls } from './AdminUI';
import { ComboWithOtherInput } from './ComboWithOtherInput';
import { useToast } from '../../contexts/ToastContext';
import { useAdmin } from '../../contexts/AdminContext';
import { ApiError } from '../../services/api';
import { getRoleLabel } from '../../utils/permissions';
import {
  ARL_OPTIONS,
  ARL_RISK_LEVEL_OPTIONS,
  BANK_OPTIONS,
  COMPENSATION_FUND_OPTIONS,
  EPS_OPTIONS,
  PENSION_FUND_OPTIONS,
  SEVERANCE_FUND_OPTIONS,
} from '../../utils/socialSecurityCatalog';
import {
  assignEmployeeManagers,
  deleteEmployee,
  createBranch,
  deleteBranch,
  exportEmployeeAccessPdf,
  exportEmployeeProfilePdf,
  exportEmployeeCertificatePdf,
  exportBranchesPdf,
  getBranches,
  getDepartments,
  getEmployeeChangeLogs,
  getEmployeePositionHistory,
  getEmployeeSalaryHistory,
  getEmployees,
  getPositions,
  getWorkDays,
  createEmployee,
  regenerateEmployeeAccessPassword,
  updateBranch,
  updateEmployee,
  updateMyEmployeeProfile,
  type Branch,
  type Department,
  type Employee,
  type EmployeeChangeLog,
  type EmployeePayload,
  type EmployeePositionHistory,
  type EmployeeProfileStatus,
  type EmployeeSalaryHistory,
  type EmployeeStatus,
  type ContractType,
  type EmploymentType,
  type Position,
  type WorkDay,
} from '../../services/employees.service';
import type { UserRole } from '../../services/auth.service';
import {
  approveVacationRequest,
  correctVacationRequestSchedule,
  createPayslipDocument,
  createEmployeeDocument,
  deletePayslipDocument,
  updateEmployeeDocument,
  updatePayslipDocument,
  deleteEmployeeDocument,
  getPayslipDocuments,
  deleteVacationRequest,
  updateVacationRequest,
  exportRequestsXlsx,
  getEmployeeDocuments,
  getHRNotifications,
  getRequestsDashboard,
  getVacationRequestById,
  getVacationRequests,
  openVacationRequestPdf,
  openPayslipDocumentPdf,
  rejectVacationRequest,
  setRequestRemuneration,
  type EmployeeDocument,
  type EmployeeDocumentStatus,
  type EmployeeDocumentType,
  type HRNotification,
  type PayslipDocument,
  type PayslipDocumentStatus,
  type RequestRemunerationFilter,
  type RequestsDashboard,
  type VacationRequest,
  type VacationRequestHistory,
  type VacationRequestStatus,
  type VacationRequestType,
} from '../../services/human-resources.service';
import { AdminStructure } from './AdminStructure';
import { AdminCompanyDocuments } from './AdminCompanyDocuments';
import { LocationPicker } from '../ui/LocationPicker';
import { InteractiveLocationMap } from '../ui/InteractiveLocationMap';
import { geographyService } from '../../services/geography.service';
import { EMPTY_LOCATION, type LocationValue } from '../../services/geography.types';
import { reverseGeocode, searchAddress } from '../../services/nominatim.service';
import type { NominatimResult } from '../../services/nominatim.types';

const BRANCH_SEARCH_DEBOUNCE_MS = 400;

// Branch.latitude/longitude are DecimalField(max_digits=9, decimal_places=6) on the backend
function toBranchDecimalString(value: number | string): string {
  return Number(value).toFixed(6);
}

type HRTab = 'employees' | 'branches' | 'catalog' | 'vacations' | 'calendar' | 'orgchart' | 'documents' | 'payments';
type HRCalendarView = 'requests' | 'birthdays';
type UniformField = 'uniform_sweater' | 'uniform_pants' | 'uniform_shoes' | 'uniform_other';
type EmployeeDataQualityFilter =
  | 'all'
  | 'missing_age'
  | 'missing_document'
  | 'missing_email'
  | 'missing_phone'
  | 'missing_department'
  | 'missing_position'
  | 'missing_branch'
  | 'missing_manager'
  | 'missing_social_security'
  | 'missing_banking'
  | 'missing_emergency'
  | 'incomplete_profile'
  | 'pending_documents'
  | 'expired_documents';

const DEFAULT_PAGE_SIZE = 12;
const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];
const EMPLOYEE_STATUS_OPTIONS: Array<{ value: EmployeeStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Activos' },
  { value: 'INACTIVE', label: 'Inactivos' },
  { value: 'LEAVE', label: 'En licencia' },
  { value: 'SUSPENDED', label: 'Suspendidos' },
  { value: 'TERMINATED', label: 'Retirados' },
];
const EMPLOYEE_PROFILE_STATUS_OPTIONS: Array<{ value: EmployeeProfileStatus; label: string }> = [
  { value: 'DRAFT', label: 'Borrador' },
  { value: 'REGISTERED', label: 'Registrado' },
  { value: 'INCOMPLETE', label: 'Incompleto' },
  { value: 'COMPLETE', label: 'Completo' },
  { value: 'DOCUMENTED', label: 'Documentado' },
  { value: 'RETIRED', label: 'Retirado' },
];
const EMPLOYMENT_TYPE_OPTIONS: Array<{ value: EmploymentType; label: string }> = [
  { value: 'EMPLOYEE', label: 'Empleado' },
  { value: 'SENA_APPRENTICE', label: 'Aprendiz SENA' },
  { value: 'INTERN', label: 'Practicante' },
  { value: 'CONTRACTOR', label: 'Contratista' },
];
const CONTRACT_TYPE_OPTIONS: Array<{ value: ContractType; label: string }> = [
  { value: 'INDEFINITE', label: 'Indefinido' },
  { value: 'FIXED_TERM', label: 'Término fijo' },
  { value: 'SERVICES', label: 'Prestación de servicios' },
  { value: 'APPRENTICESHIP', label: 'Aprendizaje' },
  { value: 'INTERNSHIP', label: 'Práctica' },
  { value: 'OTHER', label: 'Otro' },
];
const EMPLOYEE_DATA_QUALITY_FILTER_OPTIONS: Array<{ value: EmployeeDataQualityFilter; label: string }> = [
  { value: 'all', label: 'Calidad de datos: todos' },
  { value: 'missing_age', label: 'Sin edad / fecha de nacimiento' },
  { value: 'missing_document', label: 'Sin documento' },
  { value: 'missing_email', label: 'Sin correo' },
  { value: 'missing_phone', label: 'Sin teléfono' },
  { value: 'missing_department', label: 'Sin área' },
  { value: 'missing_position', label: 'Sin cargo' },
  { value: 'missing_branch', label: 'Sin sede' },
  { value: 'missing_manager', label: 'Sin jefe inmediato' },
  { value: 'missing_social_security', label: 'Seguridad social incompleta' },
  { value: 'missing_banking', label: 'Datos bancarios incompletos' },
  { value: 'missing_emergency', label: 'Contacto de emergencia incompleto' },
  { value: 'incomplete_profile', label: 'Perfil incompleto' },
  { value: 'pending_documents', label: 'Con documentos pendientes' },
  { value: 'expired_documents', label: 'Con documentos vencidos' },
];
type EmployeeModalTab =
  | 'personal'
  | 'dotacion'
  | 'labor'
  | 'social'
  | 'banking'
  | 'payroll'
  | 'emergency'
  | 'documents'
  | 'payslips'
  | 'access'
  | 'history';

interface EmployeeFormState {
  user: string;
  user_role: UserRole | '';
  user_additional_roles: UserRole[];
  user_email: string;
  user_email_confirm: string;
  user_password: string;
  user_password_confirm: string;
  employee_code: string;
  profile_status: EmployeeProfileStatus;
  document_type: string;
  document_number: string;
  document_issue_date: string;
  document_issue_place: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  residence_department: string;
  photo: File | null;
  nationality: string;
  gender: string;
  marital_status: string;
  department: string;
  position: string;
  manager: string;
  immediate_managers: string[];
  employment_type: string;
  contract_type: string;
  hire_date: string;
  base_salary: string;
  termination_date: string;
  status: EmployeeStatus;
  branch: string;
  cost_center: string;
  work_modality: string;
  termination_reason: string;
  work_observations: string;
  uniform_sweater: string;
  uniform_pants: string;
  uniform_shoes: string;
  uniform_other: string;
  is_salesperson: boolean;
  eps: string;
  pension_fund: string;
  severance_fund: string;
  arl: string;
  arl_risk_level: string;
  compensation_fund: string;
  bank_name: string;
  bank_account_type: string;
  bank_account_number: string;
  bank_account_holder: string;
  bank_account_holder_document: string;
  salary_type: string;
  transport_allowance_applies: boolean;
  integral_salary: boolean;
  weekly_working_hours: string;
  working_days: string[];
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_mobile: string;
  emergency_contact_alternate_phone: string;
  emergency_contact_address: string;
}

interface PayslipFormState {
  employee: string;
  title: string;
  period_start: string;
  period_end: string;
  payment_date: string;
  status: PayslipDocumentStatus;
  notes: string;
  file: File | null;
}

interface DocumentFormState {
  document_type: EmployeeDocumentType | '';
  name: string;
  file: File | null;
  issued_at: string;
  expires_at: string;
  status: EmployeeDocumentStatus;
  observations: string;
}

interface BranchFormState {
  code: string;
  name: string;
  legal_name: string;
  nit: string;
  address: string;
  city: string;
  department: string;
  country: string;
  latitude: string | null;
  longitude: string | null;
  phone: string;
  email: string;
  responsible: string;
  status: 'ACTIVE' | 'INACTIVE';
  is_active: boolean;
}

const INTERNAL_EMPLOYEE_ROLES: UserRole[] = ['ADMIN', 'RRHH', 'EMPLEADO', 'PEDIDOS', 'SELLER', 'DISTRIBUTOR'];
// Roles que se pueden sumar como acceso EXTRA sobre el rol principal (ej. un
// Empleado que además debe ver Préstamos), sin reemplazarlo. Se excluye ADMIN a
// propósito: el acceso total no debe otorgarse como "extra" sobre otro rol.
const ADDITIONAL_ROLE_OPTIONS: UserRole[] = ['CONTABILIDAD', 'TESORERIA', 'RRHH', 'EMPLEADO', 'PEDIDOS'];
const ACCESS_EMAIL_DOMAIN = 'juhnios.com';

function randomFrom(chars: string, length: number): string {
  const bytes = new Uint32Array(length);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => chars[value % chars.length]).join('');
}

function generateAccessPassword(): string {
  return `JR-${randomFrom('0123456789', 4)}-${randomFrom('ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', 4)}`;
}

function normalizeAccessPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmailFormat(value: string): boolean {
  return EMAIL_FORMAT_REGEX.test(value.trim());
}

function generateAccessEmail(firstName: string, lastName: string, employees: Employee[], editingEmployeeId?: string): string {
  const first = normalizeAccessPart(firstName).split('.')[0] || 'empleado';
  const last = normalizeAccessPart(lastName).split('.')[0] || 'juhnios';
  const base = `${first}.${last}`;
  const used = new Set(
    employees
      .filter((employee) => employee.id !== editingEmployeeId)
      .flatMap((employee) => [employee.email, employee.user ? employee.email : ''])
      .map((email) => email.toLowerCase())
      .filter(Boolean),
  );

  let candidate = `${base}@${ACCESS_EMAIL_DOMAIN}`;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}${suffix}@${ACCESS_EMAIL_DOMAIN}`;
    suffix += 1;
  }
  return candidate;
}

const EMPTY_EMPLOYEE_FORM: EmployeeFormState = {
  user: '',
  user_role: '',
  user_additional_roles: [],
  user_email: '',
  user_email_confirm: '',
  user_password: '',
  user_password_confirm: '',
  employee_code: '',
  profile_status: 'DRAFT',
  document_type: 'CC',
  document_number: '',
  document_issue_date: '',
  document_issue_place: '',
  first_name: '',
  last_name: '',
  date_of_birth: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  residence_department: '',
  photo: null,
  nationality: 'Colombiana',
  gender: '',
  marital_status: '',
  department: '',
  position: '',
  manager: '',
  immediate_managers: [],
  employment_type: 'EMPLOYEE',
  contract_type: 'INDEFINITE',
  hire_date: '',
  base_salary: '',
  termination_date: '',
  status: 'ACTIVE',
  branch: '',
  cost_center: '',
  work_modality: '',
  termination_reason: '',
  work_observations: '',
  uniform_sweater: '',
  uniform_pants: '',
  uniform_shoes: '',
  uniform_other: '',
  is_salesperson: false,
  eps: '',
  pension_fund: '',
  severance_fund: '',
  arl: '',
  arl_risk_level: '',
  compensation_fund: '',
  bank_name: '',
  bank_account_type: '',
  bank_account_number: '',
  bank_account_holder: '',
  bank_account_holder_document: '',
  salary_type: 'FIXED',
  transport_allowance_applies: false,
  integral_salary: false,
  weekly_working_hours: '48',
  working_days: [],
  emergency_contact_name: '',
  emergency_contact_relationship: '',
  emergency_contact_mobile: '',
  emergency_contact_alternate_phone: '',
  emergency_contact_address: '',
};

const EMPTY_DOCUMENT_FORM: DocumentFormState = {
  document_type: '',
  name: '',
  file: null,
  issued_at: '',
  expires_at: '',
  status: 'PENDING',
  observations: '',
};

const EMPTY_BRANCH_FORM: BranchFormState = {
  code: '',
  name: '',
  legal_name: '',
  nit: '',
  address: '',
  city: '',
  department: '',
  country: 'Colombia',
  latitude: null,
  longitude: null,
  phone: '',
  email: '',
  responsible: '',
  status: 'ACTIVE',
  is_active: true,
};

const DOCUMENT_TYPE_OPTIONS: Array<{ value: EmployeeDocumentType; label: string }> = [
  { value: 'ID_COPY', label: 'Cédula de Ciudadanía' },
  { value: 'RESUME', label: 'Hoja de vida con soportes' },
  { value: 'SIGNED_CONTRACT', label: 'Contrato firmado' },
  { value: 'BANK_CERTIFICATE', label: 'Certificado bancario' },
  { value: 'EPS_CERTIFICATE', label: 'Certificado EPS' },
  { value: 'PENSION_CERTIFICATE', label: 'Certificado de pensión' },
  { value: 'SEVERANCE_CERTIFICATE', label: 'Certificado de cesantías' },
  { value: 'ARL_CERTIFICATE', label: 'Certificado ARL' },
  { value: 'COMPENSATION_CERTIFICATE', label: 'Certificado Caja de Compensación' },
  { value: 'WORK_CERTIFICATE', label: 'Certificados laborales' },
  { value: 'OTHER', label: 'Otros documentos' },
];

const PAYSLIP_STATUS_OPTIONS: Array<{ value: PayslipDocumentStatus; label: string }> = [
  { value: 'PUBLISHED', label: 'Publicado' },
  { value: 'DRAFT', label: 'Borrador' },
];

const REQUIRED_DOCUMENT_TYPES = new Set<EmployeeDocumentType>([
  'ID_COPY',
  'RESUME',
  'SIGNED_CONTRACT',
  'BANK_CERTIFICATE',
  'EPS_CERTIFICATE',
  'PENSION_CERTIFICATE',
  'SEVERANCE_CERTIFICATE',
  'ARL_CERTIFICATE',
  'COMPENSATION_CERTIFICATE',
]);

const EMPTY_PAYSLIP_FORM: PayslipFormState = {
  employee: '',
  title: '',
  period_start: '',
  period_end: '',
  payment_date: '',
  status: 'PUBLISHED',
  notes: '',
  file: null,
};

const MODAL_TABS: Array<{ id: EmployeeModalTab; label: string; icon: typeof Users }> = [
  { id: 'personal', label: 'Información Personal', icon: Users },
  { id: 'dotacion', label: 'Dotación', icon: Shirt },
  { id: 'labor', label: 'Información Laboral', icon: Briefcase },
  { id: 'social', label: 'Seguridad Social', icon: ShieldCheck },
  { id: 'banking', label: 'Datos Bancarios', icon: Landmark },
  { id: 'payroll', label: 'Nómina', icon: Wallet },
  { id: 'emergency', label: 'Emergencia', icon: HeartPulse },
  { id: 'documents', label: 'Documentos', icon: FileText },
  { id: 'payslips', label: 'Volante de pago', icon: Wallet },
  { id: 'access', label: 'Acceso', icon: KeyRound },
  { id: 'history', label: 'Historial', icon: History },
];

function parseDate(value: string | null | undefined): string {
  if (!value) return 'Sin fecha';
  // Un valor "solo fecha" (YYYY-MM-DD, sin hora) lo interpreta el motor JS como
  // medianoche UTC; al convertir a la hora local de Colombia (UTC-5) eso puede
  // mostrar el día anterior. Para fechas puras se arma la fecha en horario local
  // explícitamente en vez de dejar que Date la trate como UTC.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('es-CO');
  }
  return new Date(value).toLocaleDateString('es-CO');
}

function formatTime(value: string | null | undefined): string {
  if (!value) return 'Sin hora';
  const normalized = value.length === 5 ? `${value}:00` : value;
  const parsed = new Date(`1970-01-01T${normalized}`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function minutesBetween(start: string, end: string): number {
  if (!start || !end || end <= start) return 0;
  const [startHour, startMinute] = start.split(':').map(Number);
  const [endHour, endMinute] = end.split(':').map(Number);
  return Math.max((endHour * 60 + endMinute) - (startHour * 60 + startMinute), 0);
}

const SCHEDULE_CHANGE_DAILY_LUNCH_MINUTES = 60;

function requestScheduleWeeklyHours(request: VacationRequest): number {
  if (!request.requested_work_schedule_days?.length) return 0;
  const minutes = request.requested_work_schedule_days.reduce((total, day) => {
    if (day.is_working_day === false) return total;
    return total + Math.max(minutesBetween(day.expected_start_time, day.expected_end_time) - SCHEDULE_CHANGE_DAILY_LUNCH_MINUTES, 0);
  }, 0);
  return minutes / 60;
}

/** Rango de fechas de la solicitud, con la hora que digitó el empleado cuando la
 * solicitud no es de jornada completa (permisos parciales, horas extra). */
function getRequestScheduleLabel(request: VacationRequest): string {
  const dateLabel =
    request.start_date === request.end_date
      ? parseDate(request.start_date)
      : `${parseDate(request.start_date)} - ${parseDate(request.end_date)}`;

  if (request.request_type === 'LOAN') {
    return dateLabel;
  }

  if (request.request_type === 'LABOR_CERTIFICATE') {
    return `${dateLabel} · Disponible 5 días al aprobar`;
  }

  if (request.request_type === 'OVERTIME' && request.overtime_shifts?.length) {
    const sortedShifts = [...request.overtime_shifts].sort((left, right) => `${left.date} ${left.start_time}`.localeCompare(`${right.date} ${right.start_time}`));
    const shiftsLabel = sortedShifts
      .slice(0, 2)
      .map((shift) => {
        return `${parseDate(shift.date)} · ${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}`;
      })
      .join(' | ');
    const remaining = sortedShifts.length > 2 ? ` +${sortedShifts.length - 2} turno(s)` : '';
    return `${shiftsLabel}${remaining} · ${Number(request.hours_count ?? 0).toFixed(1)} h`;
  }

  if (request.request_type === 'SCHEDULE_CHANGE' || request.subtype === 'SCHEDULE_CHANGE') {
    const hours = requestScheduleWeeklyHours(request);
    return `${dateLabel} · ${hours ? `${hours.toFixed(1)} h/semana` : 'Horario solicitado'}`;
  }

  if (request.is_full_day) {
    return `${dateLabel} · Jornada completa`;
  }

  if (request.start_time && request.end_time) {
    return `${dateLabel} · ${formatTime(request.start_time)} - ${formatTime(request.end_time)}`;
  }

  if (request.start_time) {
    return `${dateLabel} · Desde ${formatTime(request.start_time)} hasta fin del día`;
  }

  return dateLabel;
}

function getDateRangeKeys(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const keys: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    keys.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function getRequestCalendarDateKeys(request: VacationRequest): string[] {
  if (request.request_type === 'OVERTIME') {
    const shiftDateKeys = new Set<string>();
    for (const shift of request.overtime_shifts ?? []) {
      const dateKey = shift.date?.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        shiftDateKeys.add(dateKey);
      }
    }
    if (shiftDateKeys.size > 0) return [...shiftDateKeys];
    const boundaryDateKeys = [request.start_date?.slice(0, 10), request.end_date?.slice(0, 10)].filter(
      (date): date is string => /^\d{4}-\d{2}-\d{2}$/.test(date),
    );
    return [...new Set(boundaryDateKeys)];
  }

  return getDateRangeKeys(request.start_date, request.end_date);
}

function formatCurrency(amount: number | string | null | undefined): string {
  const parsed = typeof amount === 'number' ? amount : Number(amount ?? 0);
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(Number.isFinite(parsed) ? parsed : 0);
}

function getEmployeeName(employee: Employee): string {
  return `${employee.first_name} ${employee.last_name}`.trim() || employee.employee_code || 'Empleado sin nombre';
}

const AVATAR_PALETTE = [
  { bg: 'bg-[#2a4038]/10', text: 'text-[#2a4038]' },
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
];

function getEmployeeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function getAvatarPalette(seed: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function EmployeeAvatar({ employee, name }: { employee: Employee | undefined; name: string }) {
  if (employee?.photo) {
    return (
      <img
        src={getMediaUrl(employee.photo)}
        alt={name}
        className="w-8 h-8 rounded-full object-cover border border-gray-100 flex-shrink-0"
      />
    );
  }
  const palette = getAvatarPalette(employee?.id ?? name);
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${palette.bg} ${palette.text}`}>
      {getEmployeeInitials(name)}
    </div>
  );
}

const REQUEST_TYPE_ICONS: Record<VacationRequestType, React.ComponentType<{ size?: number; className?: string }>> = {
  PERMISSION: FileCheck2,
  VACATION: Plane,
  OVERTIME: Clock3,
  INCAPACITY: HeartPulse,
  LEAVE: Briefcase,
  LOAN: HandCoins,
  SCHEDULE_CHANGE: CalendarCog,
  LABOR_CERTIFICATE: BadgeCheck,
  OTHER: FileText,
};

function getEmployeeManagerIds(employee: Employee): string[] {
  const ids = employee.immediate_managers?.length ? employee.immediate_managers : employee.manager ? [employee.manager] : [];
  return [...new Set(ids.filter(Boolean))];
}

function cleanIdList(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function getEmployeeManagerNames(employee: Employee, employeeById: Map<string, Employee>): string {
  const names = getEmployeeManagerIds(employee)
    .map((managerId) => {
      const manager = employeeById.get(managerId);
      return manager ? getEmployeeName(manager) : '';
    })
    .filter(Boolean);
  return names.length ? names.join(', ') : 'Sin jefe';
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function optionLabel<T extends string>(options: Array<{ value: T; label: string }>, value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function employmentTypeLabel(value: EmploymentType): string {
  return optionLabel(EMPLOYMENT_TYPE_OPTIONS, value);
}

function contractTypeLabel(value: ContractType): string {
  return optionLabel(CONTRACT_TYPE_OPTIONS, value);
}

function matchesEmployeeDataQuality(employee: Employee, filter: EmployeeDataQualityFilter): boolean {
  switch (filter) {
    case 'missing_age':
      return employee.age == null || !hasText(employee.date_of_birth);
    case 'missing_document':
      return !hasText(employee.document_type) || !hasText(employee.document_number);
    case 'missing_email':
      return !hasText(employee.email);
    case 'missing_phone':
      return !hasText(employee.phone);
    case 'missing_department':
      return !hasText(employee.department);
    case 'missing_position':
      return !hasText(employee.position);
    case 'missing_branch':
      return !hasText(employee.branch);
    case 'missing_manager':
      return getEmployeeManagerIds(employee).length === 0;
    case 'missing_social_security':
      return !hasText(employee.eps) || !hasText(employee.pension_fund) || !hasText(employee.severance_fund) || !hasText(employee.arl) || !hasText(employee.compensation_fund);
    case 'missing_banking':
      return !hasText(employee.bank_name) || !hasText(employee.bank_account_type) || !hasText(employee.bank_account_number) || !hasText(employee.bank_account_holder);
    case 'missing_emergency':
      return !hasText(employee.emergency_contact_name) || !hasText(employee.emergency_contact_relationship) || !hasText(employee.emergency_contact_mobile);
    case 'incomplete_profile':
      return employee.profile_completion_percentage < 100 || employee.profile_status === 'DRAFT' || employee.profile_status === 'INCOMPLETE';
    case 'pending_documents':
      return employee.pending_documents_count > 0;
    case 'expired_documents':
      return employee.expired_documents_count > 0;
    default:
      return true;
  }
}

function slugifyFilename(value: string): string {
  return normalizeSearchText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'empleados';
}

const EMPTY_UNIFORM_VALUE = 'Sin dato';

const UNIFORM_FIELDS: Array<{ field: UniformField; label: string }> = [
  { field: 'uniform_sweater', label: 'Suéter' },
  { field: 'uniform_pants', label: 'Pantalón' },
  { field: 'uniform_shoes', label: 'Zapato' },
  { field: 'uniform_other', label: 'Otro' },
];

function uniformValue(value: string | null | undefined): string {
  const trimmed = String(value ?? '').trim();
  return trimmed || EMPTY_UNIFORM_VALUE;
}

function getEmployeeUniformValue(employee: Employee, field: UniformField): string {
  return uniformValue(employee[field]);
}

function buildUniformGroups(employees: Employee[], field: UniformField): Array<{ value: string; employees: Employee[] }> {
  const groups = new Map<string, Employee[]>();
  employees.forEach((employee) => {
    const value = getEmployeeUniformValue(employee, field);
    const current = groups.get(value) ?? [];
    current.push(employee);
    groups.set(value, current);
  });
  return [...groups.entries()]
    .map(([value, groupedEmployees]) => ({
      value,
      employees: groupedEmployees.sort((left, right) => getEmployeeName(left).localeCompare(getEmployeeName(right), 'es')),
    }))
    .sort((left, right) => {
      if (right.employees.length !== left.employees.length) return right.employees.length - left.employees.length;
      if (left.value === EMPTY_UNIFORM_VALUE) return 1;
      if (right.value === EMPTY_UNIFORM_VALUE) return -1;
      return left.value.localeCompare(right.value, 'es', { numeric: true, sensitivity: 'base' });
    });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function worksheetRow(cells: Array<string | number>): string {
  return `<Row>${cells.map((cell) => {
    const isNumber = typeof cell === 'number' && Number.isFinite(cell);
    return `<Cell><Data ss:Type="${isNumber ? 'Number' : 'String'}">${escapeXml(String(cell))}</Data></Cell>`;
  }).join('')}</Row>`;
}

function worksheetXml(name: string, rows: Array<Array<string | number>>): string {
  const safeName = name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Hoja';
  return `<Worksheet ss:Name="${escapeXml(safeName)}"><Table>${rows.map(worksheetRow).join('')}</Table></Worksheet>`;
}

function downloadExcelXml(filename: string, sheets: Array<{ name: string; rows: Array<Array<string | number>> }>) {
  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheets.map((sheet) => worksheetXml(sheet.name, sheet.rows)).join('')}
</Workbook>`;
  const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportEmployeeUniformExcel({
  employees,
  filters,
  departmentById,
  positionById,
  branchById,
}: {
  employees: Employee[];
  filters: string[];
  departmentById: Map<string, Department>;
  positionById: Map<string, Position>;
  branchById: Map<string, Branch>;
}) {
  const employeeRows: Array<Array<string | number>> = [
    ['Nombre del empleado', 'Suéter', 'Pantalón', 'Zapato', 'Otro'],
    ...employees.map((employee) => [
      getEmployeeName(employee),
      getEmployeeUniformValue(employee, 'uniform_sweater'),
      getEmployeeUniformValue(employee, 'uniform_pants'),
      getEmployeeUniformValue(employee, 'uniform_shoes'),
      getEmployeeUniformValue(employee, 'uniform_other'),
    ]),
  ];

  const summaryRows: Array<Array<string | number>> = [
    ['Juhnios Rold - Dotación por talla'],
    ['Generado', new Date().toLocaleString('es-CO')],
    ['Empleados filtrados', employees.length],
    ['Filtros', filters.length ? filters.join(' | ') : 'Sin filtros'],
    [],
    ['Prenda / dato', 'Talla / valor', 'Cantidad', 'Empleados'],
  ];

  UNIFORM_FIELDS.forEach(({ field, label }) => {
    buildUniformGroups(employees, field).forEach(({ value, employees: groupedEmployees }) => {
      summaryRows.push([
        label,
        value,
        groupedEmployees.length,
        groupedEmployees.map(getEmployeeName).join(', '),
      ]);
    });
    summaryRows.push([]);
  });

  const detailRows: Array<Array<string | number>> = [
    ['Nombre del empleado', 'Código', 'Documento', 'Área', 'Cargo', 'Sede', 'Estado', 'Suéter', 'Pantalón', 'Zapato', 'Otro'],
    ...employees.map((employee) => [
      getEmployeeName(employee),
      employee.employee_code || '',
      employee.document_number || '',
      employee.department ? departmentById.get(employee.department)?.name ?? '' : '',
      employee.position ? positionById.get(employee.position)?.name ?? '' : '',
      employee.branch ? branchById.get(employee.branch)?.name ?? '' : '',
      statusLabel(employee.status),
      getEmployeeUniformValue(employee, 'uniform_sweater'),
      getEmployeeUniformValue(employee, 'uniform_pants'),
      getEmployeeUniformValue(employee, 'uniform_shoes'),
      getEmployeeUniformValue(employee, 'uniform_other'),
    ]),
  ];

  const filterRows: Array<Array<string | number>> = [
    ['Juhnios Rold - Exportación de dotación'],
    ['Generado', new Date().toLocaleString('es-CO')],
    ['Empleados incluidos', employees.length],
    [],
    ['Filtros aplicados'],
  ];
  if (filters.length === 0) {
    filterRows.push(['Sin filtros: todos los empleados disponibles']);
  } else {
    filters.forEach((filter) => filterRows.push([filter]));
  }

  downloadExcelXml(`dotacion-empleados-${new Date().toISOString().slice(0, 10)}.xls`, [
    { name: 'Dotación por empleado', rows: employeeRows },
    { name: 'Conteo por talla', rows: summaryRows },
    { name: 'Detalle empleados', rows: detailRows },
    { name: 'Filtros', rows: filterRows },
  ]);
}

async function exportFilteredEmployeesPdf({
  employees,
  filters,
  departmentById,
  positionById,
  branchById,
}: {
  employees: Employee[];
  filters: string[];
  departmentById: Map<string, Department>;
  positionById: Map<string, Position>;
  branchById: Map<string, Branch>;
}): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 12;
  const headerHeight = 18;
  const rowHeight = 8;
  const columns = [
    { label: 'Empleado', x: 12, width: 40 },
    { label: 'Documento', x: 54, width: 30 },
    { label: 'Area / Cargo', x: 86, width: 52 },
    { label: 'Sede', x: 140, width: 34 },
    { label: 'Estado', x: 176, width: 26 },
    { label: 'Perfil', x: 204, width: 28 },
    { label: 'Edad', x: 234, width: 14 },
    { label: 'Docs', x: 250, width: 34 },
  ];

  const drawHeader = (pageNumber: number) => {
    pdf.setFillColor(42, 64, 56);
    pdf.rect(0, 0, pageWidth, headerHeight, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.text('Juhnios Rold - Empleados', margin, 7);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text(`Registros exportados: ${employees.length}`, margin, 13);
    pdf.text(new Date().toLocaleString('es-CO'), pageWidth - margin, 7, { align: 'right' });
    pdf.text(`Pagina ${pageNumber}`, pageWidth - margin, 13, { align: 'right' });
  };

  const drawTableHead = (y: number) => {
    pdf.setFillColor(245, 247, 246);
    pdf.rect(margin, y - 4, pageWidth - margin * 2, 7, 'F');
    pdf.setTextColor(55, 65, 81);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    columns.forEach((column) => pdf.text(column.label, column.x, y));
  };

  let page = 1;
  let y = headerHeight + 10;
  drawHeader(page);

  pdf.setTextColor(75, 85, 99);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('Filtros aplicados', margin, y);
  y += 5;
  pdf.setFont('helvetica', 'normal');
  const filterText = filters.length ? filters.join(' | ') : 'Sin filtros: todos los empleados disponibles';
  const filterLines = pdf.splitTextToSize(filterText, pageWidth - margin * 2);
  pdf.text(filterLines, margin, y);
  y += filterLines.length * 4 + 6;
  drawTableHead(y);
  y += 6;

  employees.forEach((employee) => {
    if (y > pageHeight - margin) {
      pdf.addPage();
      page += 1;
      y = headerHeight + 10;
      drawHeader(page);
      drawTableHead(y);
      y += 6;
    }

    const department = employee.department ? departmentById.get(employee.department)?.name : null;
    const position = employee.position ? positionById.get(employee.position)?.name : null;
    const branch = employee.branch ? branchById.get(employee.branch)?.name : null;
    const row = [
      getEmployeeName(employee),
      employee.document_number || 'Sin documento',
      `${department ?? 'Sin area'} / ${position ?? 'Sin cargo'}`,
      branch ?? 'Sin sede',
      statusLabel(employee.status),
      `${profileStatusLabel(employee.profile_status)} ${employee.profile_completion_percentage}%`,
      employee.age == null ? 'N/D' : String(employee.age),
      `Pend: ${employee.pending_documents_count} / Venc: ${employee.expired_documents_count}`,
    ];

    pdf.setTextColor(31, 41, 55);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    row.forEach((value, index) => {
      const column = columns[index];
      const lines = pdf.splitTextToSize(value, column.width);
      pdf.text(lines.slice(0, 2), column.x, y);
    });
    y += rowHeight;
  });

  pdf.save(`${slugifyFilename(`empleados-${filters.join('-') || 'todos'}`)}.pdf`);
}

type CalendarRequestEvent = { request: VacationRequest; employee: Employee | undefined };
type PdfRgb = [number, number, number];

const REQUEST_TYPE_PDF_COLORS: Record<VacationRequestType, { fill: PdfRgb; stroke: PdfRgb; text: PdfRgb }> = {
  PERMISSION: { fill: [255, 247, 199], stroke: [245, 158, 11], text: [120, 53, 15] },
  OVERTIME: { fill: [219, 234, 254], stroke: [37, 99, 235], text: [30, 64, 175] },
  VACATION: { fill: [209, 250, 229], stroke: [16, 185, 129], text: [6, 95, 70] },
  LEAVE: { fill: [237, 233, 254], stroke: [124, 58, 237], text: [91, 33, 182] },
  INCAPACITY: { fill: [254, 226, 226], stroke: [239, 68, 68], text: [153, 27, 27] },
  LOAN: { fill: [252, 231, 243], stroke: [219, 39, 119], text: [157, 23, 77] },
  SCHEDULE_CHANGE: { fill: [220, 252, 231], stroke: [34, 197, 94], text: [22, 101, 52] },
  LABOR_CERTIFICATE: { fill: [204, 251, 241], stroke: [20, 184, 166], text: [15, 118, 110] },
  OTHER: { fill: [243, 244, 246], stroke: [107, 114, 128], text: [55, 65, 81] },
};

function getCalendarPdfEventLabel(event: CalendarRequestEvent, dateKey: string): string {
  const { request, employee } = event;
  const employeeName = employee ? getEmployeeName(employee) : 'Empleado';
  const typeLabel = getRequestTypeLabel(request.request_type, request.subtype);

  if (request.request_type === 'OVERTIME') {
    const shifts = request.overtime_shifts?.filter((item) => item.date === dateKey) ?? [];
    if (shifts.length > 0) {
      const shiftsLabel = shifts
        .map((shift) => `${formatTime(shift.start_time)} a ${formatTime(shift.end_time)} (${Number(shift.hours_count ?? 0).toFixed(1)} h)`)
        .join(' | ');
      return `${employeeName} - ${typeLabel}: ${shiftsLabel}`;
    }
    return `${employeeName} - ${typeLabel}: ${Number(request.hours_count ?? 0).toFixed(1)} h`;
  }

  if (!request.is_full_day && (request.start_time || request.end_time)) {
    return `${employeeName} - ${typeLabel}: ${formatTime(request.start_time)} a ${formatTime(request.end_time)}`;
  }

  if (request.is_full_day) {
    return `${employeeName} - ${typeLabel}: jornada completa`;
  }

  return `${employeeName} - ${typeLabel}`;
}

function getCalendarPdfDetailLines(event: CalendarRequestEvent, dateKey: string): string[] {
  const { request, employee } = event;
  const lines = [
    getCalendarPdfEventLabel(event, dateKey),
    `Estado: ${requestStatusLabel(request.status)}${request.request_number ? ` | No. ${request.request_number}` : ''}`,
  ];
  const subtype = request.subtype ? getRequestSubtypeLabel(request.subtype) : '';
  if (subtype) lines.push(`Subtipo: ${subtype}`);
  if (request.reason) lines.push(`Motivo: ${request.reason}`);
  if (request.description) lines.push(`Descripcion: ${request.description}`);
  if (request.observations) lines.push(`Observaciones: ${request.observations}`);
  if (employee) lines.push(`Empleado ID: ${employee.employee_code || employee.document_number || employee.id}`);
  return lines;
}

function getCalendarPdfEventShortLabel(event: CalendarRequestEvent): string {
  const { request, employee } = event;
  const employeeName = employee ? getEmployeeName(employee) : 'Empleado';
  const typeLabel = getRequestTypeLabel(request.request_type, request.subtype);
  return `${employeeName} - ${typeLabel}`;
}

async function exportRequestsCalendarPdf({
  month,
  eventsByDay,
  typeFilterLabel,
  departmentFilterLabel,
}: {
  month: Date;
  eventsByDay: Map<string, CalendarRequestEvent[]>;
  typeFilterLabel: string;
  departmentFilterLabel: string;
}): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 8;
  const headerHeight = 16;
  const metaY = headerHeight + 5;
  const legendY = headerHeight + 8.5;
  const weekHeaderY = headerHeight + 14.5;
  const gridTop = weekHeaderY + 5;
  const cellWidth = (pageWidth - margin * 2) / 7;
  const cellHeight = (pageHeight - gridTop - margin) / 6;
  const weekdays = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
  const days = getMonthGrid(month);
  const monthLabel = month.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  const totalEvents = [...eventsByDay.values()].reduce((sum, dayEvents) => sum + dayEvents.length, 0);

  const drawHeader = (title: string, pageNumber: number) => {
    pdf.setFillColor(42, 64, 56);
    pdf.rect(0, 0, pageWidth, headerHeight, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text(title, margin, 7);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.text(new Date().toLocaleString('es-CO'), pageWidth - margin, 6, { align: 'right' });
    pdf.text(`Pagina ${pageNumber}`, pageWidth - margin, 11, { align: 'right' });
  };

  const drawLegend = () => {
    pdf.setTextColor(75, 85, 99);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text(`Filtros: ${typeFilterLabel} | ${departmentFilterLabel} | Eventos: ${totalEvents}`, margin, metaY);

    const legendItems: VacationRequestType[] = ['PERMISSION', 'OVERTIME', 'VACATION', 'LEAVE', 'INCAPACITY', 'LOAN', 'SCHEDULE_CHANGE', 'LABOR_CERTIFICATE', 'OTHER'];
    let legendX = margin;
    for (const type of legendItems) {
      const colors = REQUEST_TYPE_PDF_COLORS[type];
      pdf.setFillColor(...colors.fill);
      pdf.setDrawColor(...colors.stroke);
      pdf.rect(legendX, legendY, 3.2, 2.6, 'FD');
      pdf.setTextColor(...colors.text);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6.2);
      pdf.text(getRequestTypeLabel(type), legendX + 4.4, legendY + 2.1);
      legendX += Math.max(19, pdf.getTextWidth(getRequestTypeLabel(type)) + 9);
    }
  };

  const drawMonthChrome = (pageTitle: string, pageNumber: number) => {
    drawHeader(pageTitle, pageNumber);
    drawLegend();
    weekdays.forEach((label, index) => {
      const x = margin + index * cellWidth;
      pdf.setFillColor(245, 247, 246);
      pdf.setDrawColor(229, 231, 235);
      pdf.rect(x, weekHeaderY, cellWidth, 5, 'FD');
      pdf.setTextColor(75, 85, 99);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.5);
      pdf.text(label, x + cellWidth / 2, weekHeaderY + 3.5, { align: 'center' });
    });

    days.forEach((date, index) => {
      const row = Math.floor(index / 7);
      const col = index % 7;
      const x = margin + col * cellWidth;
      const y = gridTop + row * cellHeight;
      const inMonth = date.getMonth() === month.getMonth();
      pdf.setFillColor(inMonth ? 255 : 249, inMonth ? 255 : 250, inMonth ? 255 : 251);
      pdf.setDrawColor(229, 231, 235);
      pdf.rect(x, y, cellWidth, cellHeight, 'FD');
      pdf.setTextColor(inMonth ? 31 : 180, inMonth ? 41 : 188, inMonth ? 55 : 197);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6.2);
      pdf.text(`${date.getDate()}`, x + 1.3, y + 3.5);
    });
  };

  // Toda la grilla del mes se dibuja en UNA sola pagina; si algun dia no
  // alcanza a mostrar todos sus eventos, se agrega "+N mas" y el detalle
  // completo de esos desbordes se imprime en paginas adicionales de lista.
  const overflowByDay = new Map<string, CalendarRequestEvent[]>();

  drawMonthChrome(`Calendario RRHH - ${monthLabel}`, 1);

  if (totalEvents === 0) {
    pdf.setTextColor(75, 85, 99);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text('No hay novedades para los filtros seleccionados.', margin, gridTop + 10);
  } else {
    const lineHeight = 1.9;
    const chipGap = 0.5;
    const dateLabelHeight = 4.2;

    days.forEach((date, dayIndex) => {
      const row = Math.floor(dayIndex / 7);
      const col = dayIndex % 7;
      const key = toDateKey(date);
      const events = eventsByDay.get(key) ?? [];
      if (events.length === 0) return;

      const x = margin + col * cellWidth;
      const y = gridTop + row * cellHeight;
      const maxY = y + cellHeight - 1.2;
      let eventY = y + dateLabelHeight;

      for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
        const remaining = events.length - eventIndex;
        const isLastSlot = eventY + lineHeight > maxY - (remaining > 1 ? lineHeight : 0);
        if (isLastSlot && remaining > 1) {
          const overflowEvents = events.slice(eventIndex);
          overflowByDay.set(key, overflowEvents);
          pdf.setTextColor(55, 65, 81);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(4.8);
          pdf.text(`+${overflowEvents.length} mas`, x + 1.3, eventY);
          break;
        }

        const event = events[eventIndex];
        const colors = REQUEST_TYPE_PDF_COLORS[event.request.request_type];
        const label = getCalendarPdfEventShortLabel(event);
        const line = pdf.getTextWidth(label) > cellWidth - 3
          ? (pdf.splitTextToSize(label, cellWidth - 3) as string[])[0]
          : label;

        pdf.setFillColor(...colors.fill);
        pdf.setDrawColor(...colors.stroke);
        pdf.rect(x + 0.8, eventY - 1.7, 1.3, lineHeight, 'F');
        pdf.setTextColor(...colors.text);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(4.6);
        pdf.text(line, x + 2.6, eventY - 0.4);
        eventY += lineHeight + chipGap;

        if (eventY > maxY && eventIndex + 1 < events.length) {
          const overflowEvents = events.slice(eventIndex + 1);
          overflowByDay.set(key, overflowEvents);
          break;
        }
      }
    });
  }

  if (overflowByDay.size > 0) {
    const detailLineHeight = 4.2;
    const linesPerPage = Math.floor((pageHeight - gridTop - margin) / detailLineHeight);
    const detailEntries: { key: string; event: CalendarRequestEvent }[] = [];
    for (const [key, events] of overflowByDay.entries()) {
      for (const event of events) detailEntries.push({ key, event });
    }

    let entryIndex = 0;
    let detailPage = 0;
    while (entryIndex < detailEntries.length) {
      pdf.addPage();
      detailPage += 1;
      drawHeader(`Calendario RRHH - ${monthLabel} - detalle adicional ${detailPage}`, 1 + detailPage);
      let y = gridTop;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      for (let count = 0; count < linesPerPage && entryIndex < detailEntries.length; count += 1, entryIndex += 1) {
        const { key, event } = detailEntries[entryIndex];
        const colors = REQUEST_TYPE_PDF_COLORS[event.request.request_type];
        const dateLabel = new Date(`${key}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
        pdf.setFillColor(...colors.fill);
        pdf.setDrawColor(...colors.stroke);
        pdf.rect(margin, y - 3, 2.6, 3.4, 'FD');
        pdf.setTextColor(31, 41, 55);
        pdf.text(`${dateLabel}  ${getCalendarPdfEventLabel(event, key)}`, margin + 5, y);
        y += detailLineHeight;
      }
    }
  }

  pdf.save(`${slugifyFilename(`calendario-rrhh-${monthLabel}`)}.pdf`);
}

function statusLabel(status: EmployeeStatus): string {
  const labels: Record<EmployeeStatus, string> = {
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
    LEAVE: 'En licencia',
    SUSPENDED: 'Suspendido',
    TERMINATED: 'Retirado',
  };
  return labels[status];
}

function profileStatusLabel(status: EmployeeProfileStatus): string {
  const labels: Record<EmployeeProfileStatus, string> = {
    DRAFT: 'Borrador',
    REGISTERED: 'Registrado',
    INCOMPLETE: 'Incompleto',
    COMPLETE: 'Completo',
    DOCUMENTED: 'Documentado',
    RETIRED: 'Retirado',
  };
  return labels[status];
}

function statusBadge(status: EmployeeStatus | EmployeeProfileStatus | EmployeeDocumentStatus | VacationRequestStatus): BadgeColor {
  const styles: Record<string, BadgeColor> = {
    ACTIVE: 'green',
    COMPLETE: 'green',
    DOCUMENTED: 'green',
    LOADED: 'green',
    APPROVED: 'green',
    REGISTERED: 'blue',
    LEAVE: 'blue',
    DRAFT: 'gray',
    INCOMPLETE: 'yellow',
    PENDING: 'yellow',
    IN_REVIEW: 'purple',
    PENDING_HR: 'purple',
    PENDING_ADMIN: 'yellow',
    CANCELLED: 'gray',
    FINALIZED: 'blue',
    INACTIVE: 'gray',
    NOT_APPLICABLE: 'gray',
    SUSPENDED: 'yellow',
    TERMINATED: 'red',
    RETIRED: 'red',
    EXPIRED: 'red',
    REJECTED: 'red',
  };
  return styles[status] ?? 'gray';
}

function requestStatusLabel(status: VacationRequestStatus): string {
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

function documentStatusLabel(status: EmployeeDocumentStatus): string {
  const labels: Record<EmployeeDocumentStatus, string> = {
    PENDING: 'Pendiente',
    LOADED: 'Cargado',
    REJECTED: 'Rechazado',
    EXPIRED: 'Vencido',
    NOT_APPLICABLE: 'No aplica',
  };
  return labels[status];
}

function payslipStatusLabel(status: PayslipDocumentStatus): string {
  return status === 'PUBLISHED' ? 'Publicado' : 'Borrador';
}

function payslipStatusBadge(status: PayslipDocumentStatus): BadgeColor {
  return status === 'PUBLISHED' ? 'green' : 'yellow';
}

function getRequestTypeLabel(type: string, subtype?: string): string {
  if (type === 'LABOR_CERTIFICATE') return 'Certificado laboral';
  if (type === 'SCHEDULE_CHANGE' || subtype === 'SCHEDULE_CHANGE') return 'Cambio de horario empleado';
  const labels: Record<string, string> = {
    PERMISSION: 'Permiso',
    OVERTIME: 'Horas extras',
    LEAVE: 'Licencia',
    INCAPACITY: 'Incapacidad',
    VACATION: 'Vacaciones',
    LOAN: 'Préstamo',
    SCHEDULE_CHANGE: 'Cambio de horario empleado',
    LABOR_CERTIFICATE: 'Certificado laboral',
    OTHER: 'Otro',
  };
  return labels[type] ?? type;
}

const REQUEST_TYPE_FILTER_OPTIONS: VacationRequestType[] = ['PERMISSION', 'OVERTIME', 'LEAVE', 'INCAPACITY', 'VACATION', 'LOAN', 'SCHEDULE_CHANGE', 'LABOR_CERTIFICATE', 'OTHER'];
const REMUNERATION_FILTER_OPTIONS: Array<{ value: RequestRemunerationFilter; label: string }> = [
  { value: 'REMUNERATED', label: 'Remuneradas' },
  { value: 'NOT_REMUNERATED', label: 'No remuneradas' },
  { value: 'PENDING', label: 'Pendientes por definir' },
];

const HISTORY_ACTION_LABELS: Record<VacationRequestHistory['action'], string> = {
  CREATED: 'Creación',
  UPDATED: 'Cambio',
  APPROVED: 'Aprobación',
  REJECTED: 'Rechazo',
  COMMENTED: 'Comentario',
};

/** El comentario del backend ya trae el detalle legible (ej. "Permiso editado
 * por RRHH: ..."), así que el título de la tarjeta solo necesita distinguir
 * el tipo de evento a simple vista; el detalle vive en el comentario mismo. */
function getHistoryActionLabel(item: VacationRequestHistory): string {
  return HISTORY_ACTION_LABELS[item.action] ?? item.action;
}

function getRequestSubtypeLabel(subtype: string): string {
  const labels: Record<string, string> = {
    PERSONAL: 'Personal',
    MEDICAL: 'Médico',
    ACADEMIC: 'Académico',
    FAMILY: 'Familiar',
    DAYTIME: 'Diurnas',
    NIGHT: 'Nocturnas',
    SUNDAY: 'Dominicales',
    HOLIDAY: 'Festivas',
    MATERNITY: 'Maternidad',
    PATERNITY: 'Paternidad',
    BEREAVEMENT: 'Luto',
    MARRIAGE: 'Matrimonio',
    DOMESTIC_CALAMITY: 'Calamidad doméstica',
    UNPAID: 'No remunerada',
    GENERAL_ILLNESS: 'Enfermedad general',
    WORK_ACCIDENT: 'Accidente laboral',
    COMMON_ACCIDENT: 'Accidente común',
    OCCUPATIONAL_DISEASE: 'Enfermedad laboral',
    INDIVIDUAL: 'Individuales',
    COLLECTIVE: 'Colectivas',
    SHIFT_CHANGE: 'Cambio de turno',
    SCHEDULE_CHANGE: 'Cambio de horario',
    ADMINISTRATIVE: 'Solicitud administrativa',
    OTHER: 'Otro',
  };
  return labels[subtype] ?? (subtype || 'Sin subtipo');
}

function getRequestRemunerationLabel(request: VacationRequest): string {
  if (request.request_type === 'OVERTIME') return 'Sí';
  if (request.is_remunerated === null) return 'Pendiente';
  return request.is_remunerated ? 'Sí' : 'No';
}

function getRequestRemunerationBadgeColor(request: VacationRequest): BadgeColor {
  if (request.request_type === 'OVERTIME' || request.is_remunerated === true) return 'green';
  if (request.is_remunerated === false) return 'red';
  return 'gray';
}

function approvalStepLabel(step: string): string {
  const labels: Record<string, string> = {
    REQUESTER: 'Solicitante',
    MANAGER: 'Jefe inmediato',
    HR: 'RRHH',
    FINAL: 'Aprobación final',
  };
  return labels[step] ?? step;
}

function getSupportDocumentName(url: string): string {
  const cleanUrl = url.split('?')[0];
  return decodeURIComponent(cleanUrl.split('/').pop() ?? 'soporte');
}

function getMediaUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

function fieldValue(value: string | null | undefined): string {
  return value ?? '';
}

function mapEmployeeToForm(employee: Employee): EmployeeFormState {
  return {
    ...EMPTY_EMPLOYEE_FORM,
    user: employee.user ?? '',
    user_role: employee.user_role_code ?? '',
    user_additional_roles: employee.user_additional_role_codes ?? [],
    user_email: employee.email,
    user_email_confirm: employee.email,
    employee_code: employee.employee_code,
    profile_status: employee.profile_status,
    document_type: employee.document_type || 'CC',
    document_number: fieldValue(employee.document_number),
    document_issue_date: fieldValue(employee.document_issue_date),
    document_issue_place: employee.document_issue_place,
    first_name: employee.first_name,
    last_name: employee.last_name,
    date_of_birth: fieldValue(employee.date_of_birth),
    email: employee.email,
    phone: employee.phone,
    address: employee.address,
    city: employee.city,
    residence_department: employee.residence_department,
    photo: null,
    nationality: employee.nationality || 'Colombiana',
    gender: employee.gender,
    marital_status: employee.marital_status,
    department: employee.department ?? '',
    position: employee.position ?? '',
    manager: employee.manager ?? '',
    immediate_managers: employee.immediate_managers?.length ? employee.immediate_managers : employee.manager ? [employee.manager] : [],
    employment_type: employee.employment_type,
    contract_type: employee.contract_type,
    hire_date: fieldValue(employee.hire_date),
    base_salary: employee.base_salary ? String(Number(employee.base_salary)) : '',
    termination_date: fieldValue(employee.termination_date),
    status: employee.status,
    branch: employee.branch ?? '',
    cost_center: employee.cost_center,
    work_modality: employee.work_modality,
    termination_reason: employee.termination_reason,
    work_observations: employee.work_observations,
    uniform_sweater: employee.uniform_sweater,
    uniform_pants: employee.uniform_pants,
    uniform_shoes: employee.uniform_shoes,
    uniform_other: employee.uniform_other,
    is_salesperson: employee.is_salesperson,
    eps: employee.eps,
    pension_fund: employee.pension_fund,
    severance_fund: employee.severance_fund,
    arl: employee.arl,
    arl_risk_level: employee.arl_risk_level,
    compensation_fund: employee.compensation_fund,
    bank_name: employee.bank_name,
    bank_account_type: employee.bank_account_type,
    bank_account_number: employee.bank_account_number,
    bank_account_holder: employee.bank_account_holder,
    bank_account_holder_document: employee.bank_account_holder_document,
    salary_type: employee.salary_type,
    transport_allowance_applies: employee.transport_allowance_applies,
    integral_salary: employee.integral_salary,
    weekly_working_hours: employee.weekly_working_hours ? String(Number(employee.weekly_working_hours)) : '',
    working_days: employee.working_days ?? [],
    emergency_contact_name: employee.emergency_contact_name,
    emergency_contact_relationship: employee.emergency_contact_relationship,
    emergency_contact_mobile: employee.emergency_contact_mobile,
    emergency_contact_alternate_phone: employee.emergency_contact_alternate_phone,
    emergency_contact_address: employee.emergency_contact_address,
  };
}

function cleanNullable(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

function buildEmployeePayload(form: EmployeeFormState): EmployeePayload {
  const managerIds = cleanIdList(form.immediate_managers);
  const fallbackManager = cleanNullable(form.manager);
  return {
    ...(form.user ? { user: form.user } : {}),
    ...(form.user_role ? { user_role: form.user_role } : {}),
    // Se envía siempre (incluso vacío) para poder quitar roles adicionales ya
    // asignados; a diferencia de los campos string, [] no debe tratarse como "sin cambios".
    user_additional_roles: form.user_additional_roles,
    ...(form.user_email ? { user_email: form.user_email.trim().toLowerCase() } : {}),
    ...(form.user_email_confirm ? { user_email_confirm: form.user_email_confirm.trim().toLowerCase() } : {}),
    ...(form.user_password ? { user_password: form.user_password } : {}),
    ...(form.user_password_confirm ? { user_password_confirm: form.user_password_confirm } : {}),
    employee_code: form.employee_code.trim(),
    profile_status: form.profile_status,
    document_type: form.document_type as EmployeePayload['document_type'],
    document_number: cleanNullable(form.document_number),
    document_issue_date: cleanNullable(form.document_issue_date),
    document_issue_place: form.document_issue_place.trim(),
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    date_of_birth: cleanNullable(form.date_of_birth),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    city: form.city.trim(),
    residence_department: form.residence_department.trim(),
    ...(form.photo ? { photo: form.photo } : {}),
    nationality: form.nationality.trim(),
    gender: form.gender as EmployeePayload['gender'],
    marital_status: form.marital_status as EmployeePayload['marital_status'],
    department: cleanNullable(form.department),
    position: cleanNullable(form.position),
    manager: managerIds[0] ?? fallbackManager,
    immediate_managers: managerIds.length ? managerIds : fallbackManager ? [fallbackManager] : [],
    employment_type: form.employment_type as EmployeePayload['employment_type'],
    contract_type: form.contract_type as EmployeePayload['contract_type'],
    hire_date: cleanNullable(form.hire_date),
    ...(form.base_salary ? { base_salary: form.base_salary } : {}),
    termination_date: cleanNullable(form.termination_date),
    status: form.status,
    branch: cleanNullable(form.branch),
    cost_center: form.cost_center.trim(),
    work_modality: form.work_modality as EmployeePayload['work_modality'],
    termination_reason: form.termination_reason.trim(),
    work_observations: form.work_observations.trim(),
    uniform_sweater: form.uniform_sweater.trim(),
    uniform_pants: form.uniform_pants.trim(),
    uniform_shoes: form.uniform_shoes.trim(),
    uniform_other: form.uniform_other.trim(),
    is_salesperson: form.is_salesperson,
    eps: form.eps.trim(),
    pension_fund: form.pension_fund.trim(),
    severance_fund: form.severance_fund.trim(),
    arl: form.arl.trim(),
    arl_risk_level: form.arl_risk_level.trim(),
    compensation_fund: form.compensation_fund.trim(),
    bank_name: form.bank_name.trim(),
    bank_account_type: form.bank_account_type as EmployeePayload['bank_account_type'],
    bank_account_number: form.bank_account_number.trim(),
    bank_account_holder: form.bank_account_holder.trim(),
    bank_account_holder_document: form.bank_account_holder_document.trim(),
    salary_type: form.salary_type as EmployeePayload['salary_type'],
    transport_allowance_applies: form.transport_allowance_applies,
    integral_salary: form.integral_salary,
    weekly_working_hours: cleanNullable(form.weekly_working_hours),
    working_days: form.working_days,
    emergency_contact_name: form.emergency_contact_name.trim(),
    emergency_contact_relationship: form.emergency_contact_relationship.trim(),
    emergency_contact_mobile: form.emergency_contact_mobile.trim(),
    emergency_contact_alternate_phone: form.emergency_contact_alternate_phone.trim(),
    emergency_contact_address: form.emergency_contact_address.trim(),
  };
}

export function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  placeholder = '',
  disabled = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{label}{required && <span className="text-red-500 ml-1">*</span>}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={error ? `${inputCls} border-red-400 focus:border-red-500 focus:ring-red-200` : inputCls}
        placeholder={placeholder}
        disabled={disabled}
      />
      {error && <span className="block text-[11px] text-red-500 mt-1">{error}</span>}
    </label>
  );
}

export function SelectInput({
  label,
  value,
  onChange,
  options,
  required = false,
  emptyLabel = 'Selecciona una opción',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{label}{required && <span className="text-red-500 ml-1">*</span>}</span>
      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectCls}
        disabled={disabled}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchableSelectInput({
  label,
  value,
  onChange,
  options,
  required = false,
  emptyLabel = 'Selecciona una opción',
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? '';

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const filteredOptions = query
    ? options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  return (
    <div className="block relative" ref={containerRef}>
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{label}{required && <span className="text-red-500 ml-1">*</span>}</span>
      <div className="relative">
        <input
          type="text"
          value={open ? query : selectedLabel}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          placeholder={selectedLabel ? undefined : emptyLabel}
          className={inputCls}
          disabled={disabled}
          required={required && !value}
        />
        {value && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(event) => {
              event.preventDefault();
              onChange('');
              setQuery('');
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-xs"
          >
            ✕
          </button>
        )}
      </div>
      {open && !disabled && (
        <ul className="absolute z-20 w-full bg-white border border-gray-100 rounded-lg shadow-lg max-h-56 overflow-y-auto mt-1">
          <li
            onMouseDown={() => {
              onChange('');
              setOpen(false);
              setQuery('');
            }}
            className="px-3 py-2 text-sm text-gray-400 cursor-pointer hover:bg-gray-50"
          >
            {emptyLabel}
          </li>
          {filteredOptions.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-300">Sin resultados</li>
          )}
          {filteredOptions.map((option) => (
            <li
              key={option.value}
              onMouseDown={() => {
                onChange(option.value);
                setOpen(false);
                setQuery('');
              }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${option.value === value ? 'bg-gray-50 font-medium' : ''}`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MultiSearchableSelectInput({
  label,
  values,
  onChange,
  options,
  emptyLabel = 'Buscar y agregar',
  disabled = false,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: Array<{ value: string; label: string }>;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedValues = [...new Set(values.filter(Boolean))];
  const selectedValueSet = new Set(selectedValues);
  const selectedOptions = selectedValues.map((value) => options.find((option) => option.value === value) ?? { value, label: 'Jefe no encontrado' });
  const filteredOptions = options
    .filter((option) => !selectedValueSet.has(option.value))
    .filter((option) => !query || option.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const addValue = (value: string) => {
    onChange(cleanIdList([...selectedValues, value]));
    setQuery('');
    setOpen(false);
  };

  const removeValue = (value: string) => {
    onChange(cleanIdList(selectedValues.filter((current) => current !== value)));
  };

  return (
    <div className="block relative" ref={containerRef}>
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{label}</span>
      <div
        className={`min-h-[42px] w-full rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-sm shadow-sm transition-colors focus-within:border-[#2a4038] focus-within:ring-2 focus-within:ring-[#2a4038]/10 ${disabled ? 'opacity-60' : ''}`}
        onMouseDown={() => {
          if (!disabled) setOpen(true);
        }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedOptions.map((option, index) => (
            <span key={option.value} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#2a4038]/15 bg-[#eef4f1] px-2 py-1 text-xs font-semibold text-[#2a4038]">
              <span className="truncate">{option.label}</span>
              {index === 0 && <span className="rounded bg-white/80 px-1 text-[9px] uppercase tracking-wide text-[#2a4038]/70">Principal</span>}
              {!disabled && (
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    removeValue(option.value);
                  }}
                  className="rounded p-0.5 text-[#2a4038]/55 hover:bg-white hover:text-[#2a4038]"
                  aria-label={`Quitar ${option.label}`}
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
          {!disabled && (
            <input
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={selectedOptions.length ? 'Agregar otro jefe' : emptyLabel}
              className="min-w-[160px] flex-1 border-0 bg-transparent px-1 py-1 text-sm text-gray-700 placeholder:text-gray-300 focus:outline-none"
            />
          )}
        </div>
      </div>
      {open && !disabled && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-100 bg-white shadow-lg">
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-300">Sin resultados</li>
          ) : filteredOptions.map((option) => (
            <li
              key={option.value}
              onMouseDown={() => addValue(option.value)}
              className="cursor-pointer px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TextareaInput({
  label,
  value,
  onChange,
  disabled = false,
  placeholder = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className={`${inputCls} resize-none`}
        disabled={disabled}
        placeholder={placeholder}
      />
    </label>
  );
}

export function ToggleInput({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-[#2a4038]" disabled={disabled} />
      {label}
    </label>
  );
}

function SortableTh<T extends string>({ label, sortKey, active, onSort }: { label: string; sortKey: T; active: T; onSort: (key: T) => void }) {
  const isActive = active === sortKey;
  return (
    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-50 border-b border-gray-100 whitespace-nowrap sticky top-0 z-10">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 transition-colors ${isActive ? 'text-[#2a4038]' : 'hover:text-gray-600'}`}
      >
        {label}
        {isActive ? <ArrowDownAZ size={11} /> : <ArrowUpAZ size={11} className="opacity-30" />}
      </button>
    </th>
  );
}

function ResultsCount({ count, label }: { count: number; label: string }) {
  return (
    <p className="text-xs text-gray-500">
      <span className="text-gray-900 font-semibold">{count}</span> {label}
    </p>
  );
}

export function AdminHR() {
  const toast = useToast();
  const { currentUser } = useAdmin();
  const isAdmin = currentUser?.rol === 'ADMIN';
  const canManageAccessCredentials = currentUser?.rol === 'ADMIN' || currentUser?.rol === 'RRHH';
  // RRHH tiene el mismo permiso que Administrador para eliminar cualquier solicitud
  // (incluidas las de préstamo) — ver VacationRequestViewSet.destroy() en el backend.
  // No amplía nada más de isAdmin (aprobar/rechazar/decidir remuneración siguen igual).
  const canDeleteRequest = isAdmin || currentUser?.rol === 'RRHH';
  const canManageLoans = Boolean(currentUser?.canManageLoans);
  const [activeTab, setActiveTab] = useState<HRTab>('employees');
  const [employeeModalTab, setEmployeeModalTab] = useState<EmployeeModalTab>('personal');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPosition, setFilterPosition] = useState<string>('all');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [filterProfileStatus, setFilterProfileStatus] = useState<string>('all');
  const [filterEmploymentType, setFilterEmploymentType] = useState<string>('all');
  const [filterContractType, setFilterContractType] = useState<string>('all');
  const [filterDataQuality, setFilterDataQuality] = useState<EmployeeDataQualityFilter>('all');
  const [showUniformColumns, setShowUniformColumns] = useState(false);
  const [calendarView, setCalendarView] = useState<HRCalendarView>('requests');
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarTypeFilter, setCalendarTypeFilter] = useState<VacationRequestType | 'all'>('all');
  const [calendarDepartmentFilter, setCalendarDepartmentFilter] = useState<string>('all');
  const [calendarDayDetail, setCalendarDayDetail] = useState<Date | null>(null);
  const [branchSort, setBranchSort] = useState<'name' | 'code' | 'city' | 'status'>('name');
  const [branchPage, setBranchPage] = useState(1);
  const [branchPageSize, setBranchPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [employeePage, setEmployeePage] = useState(1);
  const [employeePageSize, setEmployeePageSize] = useState(DEFAULT_PAGE_SIZE);
  const [vacationPage, setVacationPage] = useState(1);
  const [vacationPageSize, setVacationPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [vacationSearch, setVacationSearch] = useState('');
  const [vacationFilterDepartment, setVacationFilterDepartment] = useState<string>('all');
  const [vacationFilterBranch, setVacationFilterBranch] = useState<string>('all');
  const [vacationFilterStatus, setVacationFilterStatus] = useState<string>('all');
  const [vacationFilterEmployee, setVacationFilterEmployee] = useState<string>('all');
  const [vacationFilterType, setVacationFilterType] = useState<string>('all');
  const [vacationFilterRemuneration, setVacationFilterRemuneration] = useState<string>('all');
  const [vacationFilterStartFrom, setVacationFilterStartFrom] = useState('');
  const [vacationFilterStartTo, setVacationFilterStartTo] = useState('');
  const [vacationSort, setVacationSort] = useState<'created_at' | 'request_type' | 'start_date'>('created_at');
  const [showVacationCharts, setShowVacationCharts] = useState(false);
  const [exportingVacationXlsx, setExportingVacationXlsx] = useState(false);
  const [vacationTotal, setVacationTotal] = useState(0);
  const [vacationLoading, setVacationLoading] = useState(false);
  const [deletingVacationId, setDeletingVacationId] = useState<string | null>(null);
  const [payslips, setPayslips] = useState<PayslipDocument[]>([]);
  const [payslipTotal, setPayslipTotal] = useState(0);
  const [payslipPage, setPayslipPage] = useState(1);
  const [payslipPageSize, setPayslipPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [payslipSearch, setPayslipSearch] = useState('');
  const [payslipFilterEmployee, setPayslipFilterEmployee] = useState<string>('all');
  const [payslipFilterStatus, setPayslipFilterStatus] = useState<'all' | PayslipDocumentStatus>('all');
  const [payslipPeriodFrom, setPayslipPeriodFrom] = useState('');
  const [payslipPeriodTo, setPayslipPeriodTo] = useState('');
  const [payslipLoading, setPayslipLoading] = useState(false);
  const [savingPayslip, setSavingPayslip] = useState(false);
  const [editingPayslipId, setEditingPayslipId] = useState<string | null>(null);
  const [deletingPayslipId, setDeletingPayslipId] = useState<string | null>(null);
  const [downloadingPayslipId, setDownloadingPayslipId] = useState<string | null>(null);
  const [orgChartSearch, setOrgChartSearch] = useState('');
  const [employeeSort, setEmployeeSort] = useState<'name' | 'department' | 'status' | 'profile'>('name');
  const [isLoading, setIsLoading] = useState(true);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [exportingCalendarPdf, setExportingCalendarPdf] = useState(false);
  const [exportingEmployeesPdf, setExportingEmployeesPdf] = useState(false);
  const [exportingUniformExcel, setExportingUniformExcel] = useState(false);
  const [exportingBranchesPdf, setExportingBranchesPdf] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
  const [exportingProfileId, setExportingProfileId] = useState<string | null>(null);
  const [exportingCertificateId, setExportingCertificateId] = useState<string | null>(null);
  const [exportingAccessId, setExportingAccessId] = useState<string | null>(null);
  const [regeneratingAccessId, setRegeneratingAccessId] = useState<string | null>(null);
  const [showAccessPassword, setShowAccessPassword] = useState(false);
  const [showAccessReminderModal, setShowAccessReminderModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [certificateEmployee, setCertificateEmployee] = useState<Employee | null>(null);
  const [certificateNeedsSignature, setCertificateNeedsSignature] = useState(false);
  const [certificateSignatureFile, setCertificateSignatureFile] = useState<File | null>(null);
  const [savingCertificateSignature, setSavingCertificateSignature] = useState(false);
  const [deletingBranchId, setDeletingBranchId] = useState<string | null>(null);
  const [vacationActionId, setVacationActionId] = useState<string | null>(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showEmployeeDetailModal, setShowEmployeeDetailModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showBranchDetailModal, setShowBranchDetailModal] = useState(false);
  const [showRequestDetailModal, setShowRequestDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingRequest, setRejectingRequest] = useState<VacationRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approvingRequest, setApprovingRequest] = useState<VacationRequest | null>(null);
  const [approveComment, setApproveComment] = useState('');
  const [decisionSignatureFile, setDecisionSignatureFile] = useState<File | null>(null);
  const [approveIsRemunerated, setApproveIsRemunerated] = useState(true);
  const [remunerationRequest, setRemunerationRequest] = useState<VacationRequest | null>(null);
  const [remunerationValue, setRemunerationValue] = useState(true);
  const [savingRemuneration, setSavingRemuneration] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [viewingBranch, setViewingBranch] = useState<Branch | null>(null);
  const [viewingRequest, setViewingRequest] = useState<VacationRequest | null>(null);
  const [correctingRequest, setCorrectingRequest] = useState<VacationRequest | null>(null);
  const [correctingSchedule, setCorrectingSchedule] = useState({
    period_mode: 'SINGLE_DAY' as 'SINGLE_DAY' | 'DATE_RANGE',
    single_date: '',
    start_date: '',
    end_date: '',
    is_full_day: true,
    start_time: '',
    end_time: '',
  });
  const [correctingShifts, setCorrectingShifts] = useState<{ date: string; start_time: string; end_time: string; notes: string }[]>([]);
  const [correctingScheduleComment, setCorrectingScheduleComment] = useState('');
  const [savingScheduleCorrection, setSavingScheduleCorrection] = useState(false);
  const [editingRequest, setEditingRequest] = useState<VacationRequest | null>(null);
  const [editingRequestForm, setEditingRequestForm] = useState({ reason: '', description: '', observations: '' });
  const [editingRequestComment, setEditingRequestComment] = useState('');
  const [savingRequestEdit, setSavingRequestEdit] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const generateBranchCode = (existingBranches: Branch[]): string => {
    const used = new Set(existingBranches.map(b => b.code.toUpperCase()));
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < 36 * 36 * 36; i++) {
      const a = chars[Math.floor(i / (36 * 36)) % 36];
      const b = chars[Math.floor(i / 36) % 36];
      const c = chars[i % 36];
      const code = `SD-${a}${b}${c}`;
      if (!used.has(code)) return code;
    }
    return `SD-${Date.now().toString(36).toUpperCase().slice(-3)}`;
  };
  const [workDays, setWorkDays] = useState<WorkDay[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [notifications, setNotifications] = useState<HRNotification[]>([]);
  const [employeeDocuments, setEmployeeDocuments] = useState<EmployeeDocument[]>([]);
  const [employeePayslips, setEmployeePayslips] = useState<PayslipDocument[]>([]);
  const [changeLogs, setChangeLogs] = useState<EmployeeChangeLog[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<EmployeeSalaryHistory[]>([]);
  const [positionHistory, setPositionHistory] = useState<EmployeePositionHistory[]>([]);
  const [requestsDashboard, setRequestsDashboard] = useState<RequestsDashboard | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(EMPTY_EMPLOYEE_FORM);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [documentForm, setDocumentForm] = useState<DocumentFormState>(EMPTY_DOCUMENT_FORM);
  const [payslipForm, setPayslipForm] = useState<PayslipFormState>(EMPTY_PAYSLIP_FORM);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [branchForm, setBranchForm] = useState<BranchFormState>(EMPTY_BRANCH_FORM);
  const [employeeLocation, setEmployeeLocation] = useState<LocationValue>(EMPTY_LOCATION);
  const [branchLocation, setBranchLocation] = useState<LocationValue>(EMPTY_LOCATION);
  const [branchQuery, setBranchQuery] = useState('');
  const [branchSuggestions, setBranchSuggestions] = useState<NominatimResult[]>([]);
  const [branchSearching, setBranchSearching] = useState(false);
  const [branchSuggestionsOpen, setBranchSuggestionsOpen] = useState(false);
  const [branchReverseLoading, setBranchReverseLoading] = useState(false);
  const [showManagerAssignmentModal, setShowManagerAssignmentModal] = useState(false);
  const [managerAssignmentBranch, setManagerAssignmentBranch] = useState('all');
  const [managerAssignmentEmployeeIds, setManagerAssignmentEmployeeIds] = useState<string[]>([]);
  const [managerAssignmentManagerIds, setManagerAssignmentManagerIds] = useState<string[]>([]);
  const [managerAssignmentSearch, setManagerAssignmentSearch] = useState('');
  const [savingManagerAssignments, setSavingManagerAssignments] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [departmentsRes, positionsRes, branchesRes, workDaysRes, employeesRes, vacationsRes, notificationsRes] = await Promise.allSettled([
        getDepartments({ limit: 200 }),
        getPositions({ limit: 300 }),
        getBranches({ limit: 200 }),
        getWorkDays({ limit: 20 }),
        getEmployees({ limit: 200 }),
        getVacationRequests({ limit: 500 }),
        getHRNotifications({ limit: 200, status: 'UNREAD' }),
      ]);

      if (departmentsRes.status === 'fulfilled') setDepartments(departmentsRes.value.data);
      if (positionsRes.status === 'fulfilled') setPositions(positionsRes.value.data);
      if (branchesRes.status === 'fulfilled') setBranches(branchesRes.value.data);
      if (workDaysRes.status === 'fulfilled') setWorkDays(workDaysRes.value.data);
      if (employeesRes.status === 'fulfilled') setEmployees(employeesRes.value.data);
      if (vacationsRes.status === 'fulfilled') setVacationRequests(vacationsRes.value.data);
      if (notificationsRes.status === 'fulfilled') setNotifications(notificationsRes.value.data);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar la información de RRHH');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const loadRequestsDashboard = useCallback(async () => {
    try {
      const dashboard = await getRequestsDashboard({
        search: vacationSearch.trim() || undefined,
        department: vacationFilterDepartment === 'all' ? undefined : vacationFilterDepartment,
        branch: vacationFilterBranch === 'all' ? undefined : vacationFilterBranch,
        status: vacationFilterStatus === 'all' ? undefined : (vacationFilterStatus as VacationRequestStatus),
        employee: vacationFilterEmployee === 'all' ? undefined : vacationFilterEmployee,
        request_type: vacationFilterType === 'all' ? undefined : (vacationFilterType as VacationRequestType),
        remuneration: vacationFilterRemuneration === 'all' ? undefined : (vacationFilterRemuneration as RequestRemunerationFilter),
        start_date_from: vacationFilterStartFrom || undefined,
        start_date_to: vacationFilterStartTo || undefined,
      });
      setRequestsDashboard(dashboard);
    } catch (error) {
      console.error(error);
    }
  }, [vacationSearch, vacationFilterDepartment, vacationFilterBranch, vacationFilterStatus, vacationFilterEmployee, vacationFilterType, vacationFilterRemuneration, vacationFilterStartFrom, vacationFilterStartTo]);

  const loadPayslips = useCallback(async () => {
    setPayslipLoading(true);
    try {
      const response = await getPayslipDocuments({
        page: payslipPage,
        limit: payslipPageSize,
        employee: payslipFilterEmployee === 'all' ? undefined : payslipFilterEmployee,
        status: payslipFilterStatus === 'all' ? undefined : payslipFilterStatus,
        period_from: payslipPeriodFrom || undefined,
        period_to: payslipPeriodTo || undefined,
        search: payslipSearch.trim() || undefined,
        ordering: '-period_end',
      });
      setPayslips(response.data);
      setPayslipTotal(response.total);
    } catch (error) {
      console.error(error);
      toast.error('No se pudieron cargar los volantes de pago');
    } finally {
      setPayslipLoading(false);
    }
  }, [payslipPage, payslipPageSize, payslipFilterEmployee, payslipFilterStatus, payslipPeriodFrom, payslipPeriodTo, payslipSearch, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab !== 'vacations') return;
    const handle = setTimeout(() => { void loadRequestsDashboard(); }, vacationSearch ? 350 : 0);
    return () => clearTimeout(handle);
  }, [activeTab, loadRequestsDashboard, vacationSearch]);

  useEffect(() => {
    if (activeTab !== 'payments') return;
    const handle = setTimeout(() => { void loadPayslips(); }, payslipSearch ? 350 : 0);
    return () => clearTimeout(handle);
  }, [activeTab, loadPayslips, payslipSearch]);

  useEffect(() => {
    setBranchPage(1);
  }, [searchQuery, filterStatus]);

  useEffect(() => {
    setPayslipPage(1);
  }, [payslipSearch, payslipFilterEmployee, payslipFilterStatus, payslipPeriodFrom, payslipPeriodTo, payslipPageSize]);

  const departmentById = useMemo(() => new Map(departments.map((department) => [department.id, department])), [departments]);
  const positionById = useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions]);
  const branchById = useMemo(() => new Map(branches.map((branch) => [branch.id, branch])), [branches]);
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const orgForest = useMemo(() => buildOrgForest(employees), [employees]);

  const positionsForSelectedDepartment = useMemo(
    () => positions.filter((position) => position.department === employeeForm.department),
    [employeeForm.department, positions],
  );
  const employeeFilterPositions = useMemo(
    () => filterDepartment === 'all' ? positions : positions.filter((position) => position.department === filterDepartment),
    [filterDepartment, positions],
  );
  const filteredEmployees = useMemo(() => {
    const query = normalizeSearchText(searchQuery);
    return employees.filter((employee) => {
      const department = employee.department ? departmentById.get(employee.department) : null;
      const position = employee.position ? positionById.get(employee.position) : null;
      const branch = employee.branch ? branchById.get(employee.branch) : null;
      const matchesSearch =
        !query ||
        normalizeSearchText(getEmployeeName(employee)).includes(query) ||
        normalizeSearchText(employee.employee_code).includes(query) ||
        normalizeSearchText(employee.document_number ?? '').includes(query) ||
        normalizeSearchText(employee.email).includes(query) ||
        normalizeSearchText(employee.phone ?? '').includes(query) ||
        (department?.name ? normalizeSearchText(department.name).includes(query) : false) ||
        (position?.name ? normalizeSearchText(position.name).includes(query) : false) ||
        (branch?.name ? normalizeSearchText(branch.name).includes(query) : false);
      const matchesDepartment = filterDepartment === 'all' || employee.department === filterDepartment;
      const matchesPosition = filterPosition === 'all' || employee.position === filterPosition;
      const matchesBranch = filterBranch === 'all' || employee.branch === filterBranch;
      const matchesStatus = filterStatus === 'all' || employee.status === filterStatus;
      const matchesProfileStatus = filterProfileStatus === 'all' || employee.profile_status === filterProfileStatus;
      const matchesEmploymentType = filterEmploymentType === 'all' || employee.employment_type === filterEmploymentType;
      const matchesContractType = filterContractType === 'all' || employee.contract_type === filterContractType;
      const matchesDataQuality = matchesEmployeeDataQuality(employee, filterDataQuality);
      return matchesSearch && matchesDepartment && matchesPosition && matchesBranch && matchesStatus && matchesProfileStatus && matchesEmploymentType && matchesContractType && matchesDataQuality;
    });
  }, [branchById, departmentById, employees, filterBranch, filterContractType, filterDataQuality, filterDepartment, filterEmploymentType, filterPosition, filterProfileStatus, filterStatus, positionById, searchQuery]);

  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((left, right) => {
      const key = (employee: Employee): string => {
        switch (employeeSort) {
          case 'department':
            return (employee.department ? departmentById.get(employee.department)?.name : '') ?? '';
          case 'status':
            return employee.status;
          case 'profile':
            return employee.profile_status;
          default:
            return getEmployeeName(employee);
        }
      };
      return key(left).toLowerCase().localeCompare(key(right).toLowerCase(), 'es');
    });
  }, [departmentById, employeeSort, filteredEmployees]);

  const employeeTotalPages = Math.max(1, Math.ceil(sortedEmployees.length / employeePageSize));

  const paginatedEmployees = useMemo(() => {
    const start = (employeePage - 1) * employeePageSize;
    return sortedEmployees.slice(start, start + employeePageSize);
  }, [employeePage, employeePageSize, sortedEmployees]);

  const activeEmployeeFilterLabels = useMemo(() => {
    const labels: string[] = [];
    const trimmedSearch = searchQuery.trim();
    if (trimmedSearch) labels.push(`Busqueda: "${trimmedSearch}"`);
    if (filterDepartment !== 'all') labels.push(`Area: ${departmentById.get(filterDepartment)?.name ?? filterDepartment}`);
    if (filterPosition !== 'all') labels.push(`Cargo: ${positionById.get(filterPosition)?.name ?? filterPosition}`);
    if (filterBranch !== 'all') labels.push(`Sede: ${branchById.get(filterBranch)?.name ?? filterBranch}`);
    if (filterStatus !== 'all') labels.push(`Estado laboral: ${statusLabel(filterStatus as EmployeeStatus)}`);
    if (filterProfileStatus !== 'all') labels.push(`Expediente: ${profileStatusLabel(filterProfileStatus as EmployeeProfileStatus)}`);
    if (filterEmploymentType !== 'all') labels.push(`Vinculacion: ${employmentTypeLabel(filterEmploymentType as EmploymentType)}`);
    if (filterContractType !== 'all') labels.push(`Contrato: ${contractTypeLabel(filterContractType as ContractType)}`);
    if (filterDataQuality !== 'all') labels.push(optionLabel(EMPLOYEE_DATA_QUALITY_FILTER_OPTIONS, filterDataQuality));
    if (showUniformColumns) labels.push('Dotación visible');
    return labels;
  }, [branchById, departmentById, filterBranch, filterContractType, filterDataQuality, filterDepartment, filterEmploymentType, filterPosition, filterProfileStatus, filterStatus, positionById, searchQuery, showUniformColumns]);

  const hasActiveEmployeeFilters = activeEmployeeFilterLabels.length > 0;

  useEffect(() => {
    setEmployeePage(1);
  }, [searchQuery, filterDepartment, filterPosition, filterBranch, filterStatus, filterProfileStatus, filterEmploymentType, filterContractType, filterDataQuality, employeePageSize]);

  useEffect(() => {
    if (filterDepartment !== 'all' && filterPosition !== 'all') {
      const selectedPosition = positions.find((position) => position.id === filterPosition);
      if (selectedPosition && selectedPosition.department !== filterDepartment) {
        setFilterPosition('all');
      }
    }
  }, [filterDepartment, filterPosition, positions]);

  const filteredBranches = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return branches.filter((branch) => {
      const matchesSearch =
        !query ||
        branch.name.toLowerCase().includes(query) ||
        branch.code.toLowerCase().includes(query) ||
        branch.city.toLowerCase().includes(query) ||
        branch.department.toLowerCase().includes(query) ||
        branch.country.toLowerCase().includes(query) ||
        branch.responsible_name.toLowerCase().includes(query);
      const matchesStatus = filterStatus === 'all' || branch.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [branches, filterStatus, searchQuery]);

  const sortedBranches = useMemo(() => {
    return [...filteredBranches].sort((left, right) => {
      const leftValue = String(left[branchSort] ?? '').toLowerCase();
      const rightValue = String(right[branchSort] ?? '').toLowerCase();
      return leftValue.localeCompare(rightValue, 'es');
    });
  }, [branchSort, filteredBranches]);

  const paginatedBranches = useMemo(() => {
    const start = (branchPage - 1) * branchPageSize;
    return sortedBranches.slice(start, start + branchPageSize);
  }, [branchPage, branchPageSize, sortedBranches]);

  const branchTotalPages = Math.max(1, Math.ceil(sortedBranches.length / branchPageSize));

  useEffect(() => {
    setBranchPage(1);
  }, [branchPageSize]);

  useEffect(() => {
    if (!employeeForm.photo) {
      setPhotoPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(employeeForm.photo);
    setPhotoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [employeeForm.photo]);

  const [vacationRows, setVacationRows] = useState<VacationRequest[]>([]);

  const vacationTotalPages = Math.max(1, Math.ceil(vacationTotal / vacationPageSize));

  const loadVacationRows = useCallback(async () => {
    setVacationLoading(true);
    try {
      const orderingMap = { created_at: '-created_at', request_type: 'request_type', start_date: '-start_date' } as const;
      const res = await getVacationRequests({
        page: vacationPage,
        limit: vacationPageSize,
        search: vacationSearch.trim() || undefined,
        department: vacationFilterDepartment === 'all' ? undefined : vacationFilterDepartment,
        branch: vacationFilterBranch === 'all' ? undefined : vacationFilterBranch,
        status: vacationFilterStatus === 'all' ? undefined : (vacationFilterStatus as VacationRequestStatus),
        employee: vacationFilterEmployee === 'all' ? undefined : vacationFilterEmployee,
        request_type: vacationFilterType === 'all' ? undefined : (vacationFilterType as VacationRequestType),
        remuneration: vacationFilterRemuneration === 'all' ? undefined : (vacationFilterRemuneration as RequestRemunerationFilter),
        ordering: orderingMap[vacationSort],
        start_date_from: vacationFilterStartFrom || undefined,
        start_date_to: vacationFilterStartTo || undefined,
      });
      setVacationRows(res.data);
      setVacationTotal(res.total);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar el listado de solicitudes');
    } finally {
      setVacationLoading(false);
    }
  }, [vacationPage, vacationPageSize, vacationSearch, vacationFilterDepartment, vacationFilterBranch, vacationFilterStatus, vacationFilterEmployee, vacationFilterType, vacationFilterRemuneration, vacationSort, vacationFilterStartFrom, vacationFilterStartTo, toast]);

  useEffect(() => {
    if (activeTab !== 'vacations') return;
    const handle = setTimeout(() => { void loadVacationRows(); }, vacationSearch ? 350 : 0);
    return () => clearTimeout(handle);
  }, [activeTab, loadVacationRows, vacationSearch]);

  useEffect(() => {
    setVacationPage(1);
  }, [vacationSearch, vacationFilterDepartment, vacationFilterBranch, vacationFilterStatus, vacationFilterEmployee, vacationFilterType, vacationFilterRemuneration, vacationSort, vacationFilterStartFrom, vacationFilterStartTo, vacationPageSize]);

  const paginatedVacationRequests = vacationRows;
  const filteredVacationRequestsCount = vacationTotal;

  const REQUEST_TYPE_CALENDAR_COLOR: Record<VacationRequestType, CalendarChipColor> = {
    VACATION: 'green',
    PERMISSION: 'amber',
    OVERTIME: 'blue',
    LEAVE: 'purple',
    INCAPACITY: 'red',
    LOAN: 'pink',
    SCHEDULE_CHANGE: 'green',
    LABOR_CERTIFICATE: 'blue',
    OTHER: 'pink',
  };

  const calendarEventsByDay = useMemo(() => {
    const map = new Map<string, Array<{ request: VacationRequest; employee: Employee | undefined }>>();
    const nonCancelled = vacationRequests.filter((request) => request.status !== 'CANCELLED' && request.status !== 'REJECTED');
    for (const request of nonCancelled) {
      const employee = employeeById.get(request.employee);
      if (calendarTypeFilter !== 'all' && request.request_type !== calendarTypeFilter) continue;
      if (calendarDepartmentFilter !== 'all' && employee?.department !== calendarDepartmentFilter) continue;

      const calendarDateKeys = getRequestCalendarDateKeys(request);
      for (const key of calendarDateKeys) {
        const existing = map.get(key) ?? [];
        existing.push({ request, employee });
        map.set(key, existing);
      }
    }
    return map;
  }, [vacationRequests, employeeById, calendarTypeFilter, calendarDepartmentFilter]);

  const birthdaysByDay = useMemo(() => {
    const map = new Map<string, Employee[]>();
    for (const employee of employees) {
      if (employee.status !== 'ACTIVE' || !employee.date_of_birth) continue;
      const birth = new Date(`${employee.date_of_birth}T00:00:00`);
      if (Number.isNaN(birth.getTime())) continue;
      const key = `${birth.getMonth()}-${birth.getDate()}`;
      const existing = map.get(key) ?? [];
      existing.push(employee);
      map.set(key, existing);
    }
    return map;
  }, [employees]);

  const upcomingBirthdays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const withNextDate = employees
      .filter((employee) => employee.status === 'ACTIVE' && employee.date_of_birth)
      .map((employee) => {
        const birth = new Date(`${employee.date_of_birth}T00:00:00`);
        let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
        if (next.getTime() < today.getTime()) {
          next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
        }
        const daysUntil = Math.round((next.getTime() - today.getTime()) / 86_400_000);
        const turningAge = next.getFullYear() - birth.getFullYear();
        return { employee, next, daysUntil, turningAge };
      })
      .filter((item) => item.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil);
    return withNextDate;
  }, [employees]);

  const stats = useMemo(() => ({
    profileCompletion: employees.length
      ? Math.round(employees.reduce((sum, employee) => sum + employee.profile_completion_percentage, 0) / employees.length)
      : 0,
    pending: employees.reduce((sum, employee) => sum + employee.pending_documents_count, 0),
    expiredDocuments: employees.reduce((sum, employee) => sum + employee.expired_documents_count, 0),
    contractRemaining: (() => {
      const finiteContracts = employees
        .map((employee) => employee.remaining_contract_days)
        .filter((value): value is number => typeof value === 'number');
      if (finiteContracts.length === 0) return 'Contrato indefinido';
      return `${Math.min(...finiteContracts)} días`;
    })(),
  }), [employees]);

  const setFormField = <K extends keyof EmployeeFormState>(key: K, value: EmployeeFormState[K]) => {
    setEmployeeForm((current) => ({ ...current, [key]: value }));
  };

  const loadEmployeeExtras = async (employeeId: string) => {
    const [documentsRes, payslipsRes, changesRes, salariesRes, positionsRes] = await Promise.allSettled([
      getEmployeeDocuments({ employee: employeeId, limit: 200 }),
      getPayslipDocuments({ employee: employeeId, limit: 200, ordering: '-period_end' }),
      getEmployeeChangeLogs(employeeId),
      getEmployeeSalaryHistory(employeeId),
      getEmployeePositionHistory(employeeId),
    ]);
    setEmployeeDocuments(documentsRes.status === 'fulfilled' ? documentsRes.value.data : []);
    setEmployeePayslips(payslipsRes.status === 'fulfilled' ? payslipsRes.value.data : []);
    setChangeLogs(changesRes.status === 'fulfilled' ? changesRes.value.data : []);
    setSalaryHistory(salariesRes.status === 'fulfilled' ? salariesRes.value.data : []);
    setPositionHistory(positionsRes.status === 'fulfilled' ? positionsRes.value.data : []);
  };

  const openCreateModal = () => {
    setEditingEmployee(null);
    setEmployeeForm(EMPTY_EMPLOYEE_FORM);
    setEmployeeLocation(EMPTY_LOCATION);
    setDocumentForm(EMPTY_DOCUMENT_FORM);
    setEmployeeDocuments([]);
    setEmployeePayslips([]);
    setChangeLogs([]);
    setSalaryHistory([]);
    setPositionHistory([]);
    setEmployeeModalTab('personal');
    setShowAccessPassword(false);
    setShowEmployeeModal(true);
  };

  const openEditModal = (employee: Employee) => {
    setEditingEmployee(employee);
    setEmployeeForm(mapEmployeeToForm(employee));
    setEmployeeLocation({
      countryId: null,
      countryName: 'Colombia',
      stateId: null,
      stateName: employee.residence_department ?? '',
      cityId: null,
      cityName: employee.city ?? '',
    });
    setDocumentForm(EMPTY_DOCUMENT_FORM);
    setEmployeeModalTab('personal');
    setShowAccessPassword(false);
    setShowEmployeeModal(true);
    void loadEmployeeExtras(employee.id);
  };

  const openEmployeeDetailModal = (employee: Employee) => {
    setViewingEmployee(employee);
    setEmployeeModalTab('personal');
    setShowEmployeeDetailModal(true);
    void loadEmployeeExtras(employee.id);
  };

  const branchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const branchSearchContainerRef = useRef<HTMLDivElement>(null);

  // Close branch address suggestions dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (branchSearchContainerRef.current && !branchSearchContainerRef.current.contains(e.target as Node)) {
        setBranchSuggestionsOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Debounced branch address search — scoped strictly to the selected país/departamento above
  useEffect(() => {
    if (branchDebounceRef.current) clearTimeout(branchDebounceRef.current);
    if (!branchQuery.trim()) {
      setBranchSuggestions([]);
      return;
    }
    branchDebounceRef.current = setTimeout(async () => {
      setBranchSearching(true);
      const results = await searchAddress(branchQuery, {
        country: branchLocation.countryName || 'Colombia',
        state: branchLocation.stateName,
        strictScope: true,
      });
      setBranchSearching(false);
      setBranchSuggestions(results);
    }, BRANCH_SEARCH_DEBOUNCE_MS);
    return () => {
      if (branchDebounceRef.current) clearTimeout(branchDebounceRef.current);
    };
  }, [branchQuery, branchLocation.countryName, branchLocation.stateName]);

  const handleSelectBranchSuggestion = async (result: NominatimResult) => {
    const resolvedLocation = await geographyService.resolveLocationFromGeocode(result);
    setBranchLocation(resolvedLocation);
    setBranchForm((current) => ({
      ...current,
      address: result.display_name,
      city: resolvedLocation.cityName || current.city,
      department: resolvedLocation.stateName || current.department,
      latitude: toBranchDecimalString(result.lat),
      longitude: toBranchDecimalString(result.lon),
    }));
    setBranchQuery('');
    setBranchSuggestions([]);
    setBranchSuggestionsOpen(false);
  };

  const handleBranchMarkerMove = (lat: number, lng: number) => {
    setBranchForm((current) => ({ ...current, latitude: toBranchDecimalString(lat), longitude: toBranchDecimalString(lng) }));
    setBranchReverseLoading(true);
    reverseGeocode(lat, lng).then(async (result) => {
      if (!result) {
        setBranchReverseLoading(false);
        return;
      }
      const resolvedLocation = await geographyService.resolveLocationFromGeocode(result);
      setBranchReverseLoading(false);
      setBranchLocation(resolvedLocation);
      setBranchForm((current) => ({
        ...current,
        address: result.display_name,
        city: resolvedLocation.cityName || current.city,
        department: resolvedLocation.stateName || current.department,
      }));
    });
  };

  const openCreateBranchModal = () => {
    setEditingBranch(null);
    setBranchForm(EMPTY_BRANCH_FORM);
    setBranchLocation(EMPTY_LOCATION);
    setShowBranchModal(true);
  };

  const openEditBranchModal = (branch: Branch) => {
    setEditingBranch(branch);
    setBranchForm({
      code: branch.code,
      name: branch.name,
      legal_name: branch.legal_name ?? '',
      nit: branch.nit ?? '',
      address: branch.address,
      city: branch.city,
      department: branch.department,
      country: branch.country || 'Colombia',
      latitude: branch.latitude,
      longitude: branch.longitude,
      phone: branch.phone,
      email: branch.email,
      responsible: branch.responsible ?? '',
      status: branch.status,
      is_active: branch.is_active,
    });
    setBranchLocation({
      countryId: null,
      countryName: branch.country || 'Colombia',
      stateId: null,
      stateName: branch.department ?? '',
      cityId: null,
      cityName: branch.city ?? '',
    });
    geographyService
      .resolveLocationByNames({ country: branch.country || 'Colombia', state: branch.department, city: branch.city })
      .then(setBranchLocation);
    setShowBranchModal(true);
  };

  const openBranchDetailModal = (branch: Branch) => {
    setViewingBranch(branch);
    setShowBranchDetailModal(true);
  };

  const openRequestDetailModal = (request: VacationRequest) => {
    setViewingRequest(request);
    setShowRequestDetailModal(true);
    void getVacationRequestById(request.id)
      .then(setViewingRequest)
      .catch((error) => {
        console.error(error);
        toast.error('No se pudo cargar el detalle completo de la solicitud');
      });
  };

  const resetEmployeeModal = () => {
    setShowEmployeeModal(false);
    setEditingEmployee(null);
    setEmployeeForm(EMPTY_EMPLOYEE_FORM);
    setEmployeeLocation(EMPTY_LOCATION);
    setDocumentForm(EMPTY_DOCUMENT_FORM);
    setEditingDocumentId(null);
    setShowAccessPassword(false);
  };

  const resetBranchModal = () => {
    setShowBranchModal(false);
    setEditingBranch(null);
    setBranchForm(EMPTY_BRANCH_FORM);
    setBranchLocation(EMPTY_LOCATION);
    setBranchQuery('');
    setBranchSuggestions([]);
  };

  const resetDocumentForm = () => {
    setDocumentForm(EMPTY_DOCUMENT_FORM);
    setEditingDocumentId(null);
  };

  const resetPayslipForm = () => {
    setPayslipForm(EMPTY_PAYSLIP_FORM);
    setEditingPayslipId(null);
  };

  const handleEditPayslip = (payslip: PayslipDocument) => {
    setEditingPayslipId(payslip.id);
    setPayslipForm({
      employee: payslip.employee,
      title: payslip.title,
      period_start: payslip.period_start,
      period_end: payslip.period_end,
      payment_date: payslip.payment_date ?? '',
      status: payslip.status,
      notes: payslip.notes ?? '',
      file: null,
    });
  };

  const handlePayslipSubmit = async () => {
    if (!payslipForm.employee) {
      toast.error('Selecciona el empleado');
      return;
    }
    if (!payslipForm.period_start || !payslipForm.period_end) {
      toast.error('Indica el periodo del volante');
      return;
    }
    if (payslipForm.period_end < payslipForm.period_start) {
      toast.error('La fecha final del periodo no puede ser anterior a la inicial');
      return;
    }
    if (!editingPayslipId && !payslipForm.file) {
      toast.error('Adjunta el PDF del volante');
      return;
    }

    setSavingPayslip(true);
    try {
      const employee = employeeById.get(payslipForm.employee);
      const title = payslipForm.title.trim() || `Volante de pago ${parseDate(payslipForm.period_start)} - ${parseDate(payslipForm.period_end)}`;
      const payload = {
        employee: payslipForm.employee,
        title,
        period_start: payslipForm.period_start,
        period_end: payslipForm.period_end,
        payment_date: cleanNullable(payslipForm.payment_date),
        status: payslipForm.status,
        notes: payslipForm.notes.trim(),
        file: payslipForm.file,
      };
      if (editingPayslipId) {
        await updatePayslipDocument(editingPayslipId, payload);
        toast.success(`Volante actualizado${employee ? ` para ${getEmployeeName(employee)}` : ''}`);
      } else {
        await createPayslipDocument(payload);
        toast.success(`Volante adjuntado${employee ? ` a ${getEmployeeName(employee)}` : ''}`);
      }
      resetPayslipForm();
      await loadPayslips();
      const openEmployeeId = editingEmployee?.id ?? viewingEmployee?.id;
      if (openEmployeeId && openEmployeeId === payslipForm.employee) {
        await loadEmployeeExtras(openEmployeeId);
      }
    } catch (error) {
      console.error(error);
      toast.error('No se pudo guardar el volante de pago');
    } finally {
      setSavingPayslip(false);
    }
  };

  const handlePayslipDownload = async (payslip: PayslipDocument) => {
    setDownloadingPayslipId(payslip.id);
    try {
      await openPayslipDocumentPdf(payslip.id, payslip.file_name || `${payslip.title}.pdf`);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo descargar el volante de pago');
    } finally {
      setDownloadingPayslipId(null);
    }
  };

  const handleDeletePayslip = async (payslip: PayslipDocument) => {
    if (!window.confirm(`¿Eliminar el volante "${payslip.title}"?`)) return;
    setDeletingPayslipId(payslip.id);
    try {
      await deletePayslipDocument(payslip.id);
      toast.info('Volante eliminado');
      if (editingPayslipId === payslip.id) resetPayslipForm();
      await loadPayslips();
      const openEmployeeId = editingEmployee?.id ?? viewingEmployee?.id;
      if (openEmployeeId && openEmployeeId === payslip.employee) {
        await loadEmployeeExtras(openEmployeeId);
      }
    } catch (error) {
      console.error(error);
      toast.error('No se pudo eliminar el volante de pago');
    } finally {
      setDeletingPayslipId(null);
    }
  };

  const handleEditDocument = (document: EmployeeDocument) => {
    setEditingDocumentId(document.id);
    setDocumentForm({
      document_type: document.document_type,
      name: document.name,
      file: null,
      issued_at: document.issued_at ?? '',
      expires_at: document.expires_at ?? '',
      status: document.status,
      observations: document.observations ?? '',
    });
  };

  const handleDeleteDocument = async (employeeId: string, document: EmployeeDocument) => {
    if (!window.confirm(`¿Eliminar el documento "${document.name}"?`)) return;
    setDeletingDocumentId(document.id);
    try {
      await deleteEmployeeDocument(document.id);
      toast.info('Documento eliminado');
      if (editingDocumentId === document.id) resetDocumentForm();
      await loadEmployeeExtras(employeeId);
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo eliminar el documento');
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const handleDocumentUpload = async (employeeId: string) => {
    if (!documentForm.document_type) return;
    setSavingDocument(true);
    try {
      const name = documentForm.name || optionLabel(DOCUMENT_TYPE_OPTIONS, documentForm.document_type);
      if (editingDocumentId) {
        await updateEmployeeDocument(editingDocumentId, {
          document_type: documentForm.document_type,
          name,
          file: documentForm.file,
          issued_at: cleanNullable(documentForm.issued_at),
          expires_at: cleanNullable(documentForm.expires_at),
          status: documentForm.status,
          observations: documentForm.observations,
        });
        toast.success('Documento actualizado');
      } else {
        await createEmployeeDocument({
          employee: employeeId,
          document_type: documentForm.document_type,
          name,
          file: documentForm.file,
          issued_at: cleanNullable(documentForm.issued_at),
          expires_at: cleanNullable(documentForm.expires_at),
          status: documentForm.status,
          observations: documentForm.observations,
        });
        toast.success('Documento registrado');
      }
      resetDocumentForm();
      await loadEmployeeExtras(employeeId);
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(editingDocumentId ? 'No se pudo actualizar el documento' : 'No se pudo registrar el documento');
    } finally {
      setSavingDocument(false);
    }
  };

  const saveEmployeeNow = async () => {
    setSavingEmployee(true);
    try {
      const formWithLocation = {
        ...employeeForm,
        city: employeeLocation.cityName || employeeForm.city,
        residence_department: employeeLocation.stateName || employeeForm.residence_department,
      };
      const payload = buildEmployeePayload(formWithLocation);
      const savedEmployee = editingEmployee
        ? await updateEmployee(editingEmployee.id, payload)
        : await createEmployee(payload);

      if (documentForm.file || documentForm.status !== 'PENDING' || documentForm.observations.trim()) {
        await handleDocumentUpload(savedEmployee.id);
      }

      toast.success(editingEmployee ? 'Empleado actualizado' : 'Empleado registrado');
      await loadData();
      resetEmployeeModal();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof ApiError
          ? error.errors?.join(' ') || error.message
          : 'No se pudo guardar el empleado. Revisa duplicados, correo y salario.';
      toast.error(message);
    } finally {
      setSavingEmployee(false);
    }
  };

  const getEmployeeModalTabError = (tab: EmployeeModalTab): string | null => {
    if (tab === 'personal' && employeeForm.email && !isValidEmailFormat(employeeForm.email)) {
      return 'Corrige el correo electrónico antes de continuar.';
    }
    if (tab === 'access' && employeeForm.user_email && !isValidEmailFormat(employeeForm.user_email)) {
      return 'Corrige el usuario / correo de acceso antes de continuar.';
    }
    return null;
  };

  const handleEmployeeModalTabChange = (tab: EmployeeModalTab) => {
    const error = getEmployeeModalTabError(employeeModalTab);
    if (error) {
      toast.error(error);
      return;
    }
    setEmployeeModalTab(tab);
  };

  const handleEmployeeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const activeTabError = getEmployeeModalTabError(employeeModalTab);
    if (activeTabError) {
      toast.error(activeTabError);
      return;
    }
    const hasAccessCredentials = Boolean(employeeForm.user_role) || Boolean(employeeForm.user_password.trim());
    if (!editingEmployee && !hasAccessCredentials) {
      setShowAccessReminderModal(true);
      return;
    }
    await saveEmployeeNow();
  };

  const handleAccessReminderSetupNow = () => {
    setShowAccessReminderModal(false);
    setEmployeeModalTab('access');
  };

  const handleAccessReminderLater = () => {
    setShowAccessReminderModal(false);
    void saveEmployeeNow();
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!window.confirm(`¿Eliminar a ${getEmployeeName(employee)}?`)) return;
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

  const handleEmployeesPdfExport = async () => {
    if (sortedEmployees.length === 0) {
      toast.error('No hay empleados para exportar con los filtros actuales');
      return;
    }
    setExportingEmployeesPdf(true);
    try {
      await exportFilteredEmployeesPdf({
        employees: sortedEmployees,
        filters: activeEmployeeFilterLabels,
        departmentById,
        positionById,
        branchById,
      });
      toast.success(`PDF generado con ${sortedEmployees.length} empleado${sortedEmployees.length === 1 ? '' : 's'}`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar el PDF de empleados');
    } finally {
      setExportingEmployeesPdf(false);
    }
  };

  const handleUniformExcelExport = async () => {
    if (sortedEmployees.length === 0) {
      toast.error('No hay empleados para exportar con los filtros actuales');
      return;
    }
    setExportingUniformExcel(true);
    try {
      exportEmployeeUniformExcel({
        employees: sortedEmployees,
        filters: activeEmployeeFilterLabels,
        departmentById,
        positionById,
        branchById,
      });
      toast.success(`Excel de dotación generado con ${sortedEmployees.length} empleado${sortedEmployees.length === 1 ? '' : 's'}`);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar el Excel de dotación');
    } finally {
      setExportingUniformExcel(false);
    }
  };

  const handleCalendarPdfExport = async () => {
    const typeFilterLabel = calendarTypeFilter === 'all'
      ? 'Todos los tipos'
      : getRequestTypeLabel(calendarTypeFilter);
    const departmentFilterLabel = calendarDepartmentFilter === 'all'
      ? 'Todos los departamentos'
      : departmentById.get(calendarDepartmentFilter)?.name ?? 'Departamento seleccionado';

    setExportingCalendarPdf(true);
    try {
      await exportRequestsCalendarPdf({
        month: calendarMonth,
        eventsByDay: calendarEventsByDay,
        typeFilterLabel,
        departmentFilterLabel,
      });
      toast.success('PDF del calendario generado');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo generar el PDF del calendario');
    } finally {
      setExportingCalendarPdf(false);
    }
  };

  const handleEmployeeProfilePdfExport = async (employee: Employee) => {
    setExportingProfileId(employee.id);
    try {
      await exportEmployeeProfilePdf(employee.id, employee.employee_code);
      toast.success('PDF de perfil generado');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar el PDF del perfil');
    } finally {
      setExportingProfileId(null);
    }
  };

  const handleGenerateAccessCredentials = () => {
    if (!canManageAccessCredentials) return;
    const email = employeeForm.user_email.trim()
      || generateAccessEmail(employeeForm.first_name, employeeForm.last_name, employees, editingEmployee?.id);
    const password = generateAccessPassword();
    setEmployeeForm((current) => ({
      ...current,
      user_role: current.user_role || 'EMPLEADO',
      user_email: email,
      user_email_confirm: email,
      user_password: password,
      user_password_confirm: password,
    }));
    setShowAccessPassword(true);
    toast.success('Credenciales generadas');
  };

  const handleCopyAccessPassword = async (password: string) => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      toast.success('Clave copiada');
    } catch (error) {
      console.error(error);
      toast.error('No se pudo copiar la clave');
    }
  };

  const handleRegenerateAccessPassword = async () => {
    if (!editingEmployee || !canManageAccessCredentials) return;
    setRegeneratingAccessId(editingEmployee.id);
    try {
      const updated = await regenerateEmployeeAccessPassword(editingEmployee.id);
      setEditingEmployee(updated);
      setEmployeeForm(mapEmployeeToForm(updated));
      setShowAccessPassword(true);
      await loadData();
      toast.success('Clave regenerada');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo regenerar la clave');
    } finally {
      setRegeneratingAccessId(null);
    }
  };

  const handleEmployeeAccessPdfExport = async (employee: Employee) => {
    setExportingAccessId(employee.id);
    try {
      await exportEmployeeAccessPdf(employee.id, employee.employee_code);
      toast.success('PDF de credenciales generado');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar el PDF de credenciales');
    } finally {
      setExportingAccessId(null);
    }
  };

  const openCertificateModal = (employee: Employee) => {
    setCertificateEmployee(employee);
    setShowCertificateModal(true);
  };

  const closeCertificateModal = () => {
    setShowCertificateModal(false);
    setCertificateEmployee(null);
    setCertificateNeedsSignature(false);
    setCertificateSignatureFile(null);
  };

  const handleEmployeeCertificatePdfExport = async () => {
    if (!certificateEmployee) return;
    setExportingCertificateId(certificateEmployee.id);
    try {
      await exportEmployeeCertificatePdf(certificateEmployee.id, certificateEmployee.employee_code);
      toast.success('Certificado laboral generado');
      closeCertificateModal();
    } catch (error) {
      console.error(error);
      const status = (error as { status?: number })?.status;
      if (status === 409) {
        setCertificateNeedsSignature(true);
      }
      toast.error(error instanceof Error ? error.message : 'No se pudo generar el certificado laboral');
    } finally {
      setExportingCertificateId(null);
    }
  };

  const handleSaveCertificateSignature = async () => {
    if (!certificateSignatureFile) {
      toast.error('Dibuja o sube tu firma primero');
      return;
    }
    setSavingCertificateSignature(true);
    try {
      await updateMyEmployeeProfile({ signature: certificateSignatureFile });
      toast.success('Firma guardada. Ya puedes generar el certificado.');
      setCertificateNeedsSignature(false);
      setCertificateSignatureFile(null);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar tu firma');
    } finally {
      setSavingCertificateSignature(false);
    }
  };

  const handleBranchesPdfExport = async () => {
    setExportingBranchesPdf(true);
    try {
      await exportBranchesPdf();
      toast.success('PDF de sedes generado');
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar el PDF de sedes');
    } finally {
      setExportingBranchesPdf(false);
    }
  };

  const handleBranchSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingBranch(true);
    try {
      const payload = {
        code: editingBranch ? branchForm.code.trim() : generateBranchCode(branches),
        name: branchForm.name.trim(),
        legal_name: branchForm.legal_name.trim(),
        nit: branchForm.nit.trim(),
        address: branchForm.address.trim(),
        city: (branchLocation.cityName || branchForm.city).trim(),
        department: (branchLocation.stateName || branchForm.department).trim(),
        country: (branchLocation.countryName || branchForm.country).trim(),
        latitude: branchForm.latitude ? toBranchDecimalString(branchForm.latitude) : null,
        longitude: branchForm.longitude ? toBranchDecimalString(branchForm.longitude) : null,
        phone: branchForm.phone.trim(),
        email: branchForm.email.trim().toLowerCase(),
        responsible: cleanNullable(branchForm.responsible),
        status: branchForm.status,
        is_active: branchForm.is_active,
      };
      if (editingBranch) {
        await updateBranch(editingBranch.id, payload);
        toast.success('Sede actualizada');
      } else {
        await createBranch(payload);
        toast.success('Sede creada');
      }
      await loadData();
      resetBranchModal();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo guardar la sede');
    } finally {
      setSavingBranch(false);
    }
  };

  const handleDeleteBranch = async (branch: Branch) => {
    if (!window.confirm(`¿Eliminar la sede ${branch.name}?`)) return;
    setDeletingBranchId(branch.id);
    try {
      await deleteBranch(branch.id);
      toast.info('Sede eliminada');
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo eliminar la sede');
    } finally {
      setDeletingBranchId(null);
    }
  };

  const handleVacationAction = (request: VacationRequest, action: 'approve' | 'reject') => {
    if (request.request_type === 'LOAN' && !canManageLoans) {
      toast.error('Solo Tesorería o el Administrador pueden gestionar préstamos.');
      return;
    }
    setDecisionSignatureFile(null);
    if (action === 'reject') {
      setRejectingRequest(request);
      setRejectReason('');
      setShowRejectModal(true);
      return;
    }
    setApprovingRequest(request);
    setApproveComment('');
    setApproveIsRemunerated(request.is_remunerated ?? request.request_type === 'OVERTIME');
    setShowApproveModal(true);
  };

  const handleDeleteVacationRequest = async (request: VacationRequest) => {
    const employee = employeeById.get(request.employee);
    const label = employee ? getEmployeeName(employee) : request.employee;
    if (!window.confirm(`¿Eliminar la solicitud de ${label} (${getRequestTypeLabel(request.request_type, request.subtype)})? Esta acción no se puede deshacer.`)) return;
    setDeletingVacationId(request.id);
    try {
      await deleteVacationRequest(request.id);
      toast.info('Solicitud eliminada');
      await Promise.all([loadVacationRows(), loadRequestsDashboard(), loadData()]);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la solicitud');
    } finally {
      setDeletingVacationId(null);
    }
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setRejectingRequest(null);
    setRejectReason('');
    setDecisionSignatureFile(null);
  };

  const closeApproveModal = () => {
    setShowApproveModal(false);
    setApprovingRequest(null);
    setApproveComment('');
    setDecisionSignatureFile(null);
  };

  const isRRHH = currentUser?.rol === 'RRHH';

  const confirmApproveVacation = async () => {
    if (!approvingRequest) return;
    setVacationActionId(approvingRequest.id);
    // "Remunerado" es exclusivo de Admin, y solo se puede definir mientras
    // sigue sin decidir (is_remunerated === null) — una vez guardada queda
    // bloqueada permanentemente, sin importar el estado de la solicitud.
    const canDecideRemuneration = isAdmin && !['LOAN', 'OVERTIME', 'SCHEDULE_CHANGE'].includes(approvingRequest.request_type) && approvingRequest.is_remunerated === null;
    try {
      await approveVacationRequest(
        approvingRequest.id,
        approveComment.trim(),
        decisionSignatureFile,
        canDecideRemuneration ? approveIsRemunerated : null,
      );
      toast.success('Solicitud aprobada');
      await Promise.all([loadVacationRows(), loadRequestsDashboard(), loadData()]);
      closeApproveModal();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo procesar la solicitud');
    } finally {
      setVacationActionId(null);
    }
  };

  const openRemunerationModal = (request: VacationRequest) => {
    setRemunerationValue(true);
    setRemunerationRequest(request);
  };

  const closeRemunerationModal = () => {
    setRemunerationRequest(null);
  };

  const confirmSetRemuneration = async () => {
    if (!remunerationRequest) return;
    setSavingRemuneration(true);
    try {
      await setRequestRemuneration(remunerationRequest.id, remunerationValue);
      toast.success('Remuneración definida. Este dato queda bloqueado y no se puede volver a cambiar.');
      closeRemunerationModal();
      await Promise.all([loadVacationRows(), loadRequestsDashboard()]);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo definir la remuneración');
    } finally {
      setSavingRemuneration(false);
    }
  };

  const confirmRejectVacation = async () => {
    if (!rejectingRequest) return;
    if (!rejectReason.trim()) {
      toast.error('Debes indicar el motivo del rechazo');
      return;
    }
    setVacationActionId(rejectingRequest.id);
    try {
      await rejectVacationRequest(rejectingRequest.id, rejectReason.trim(), decisionSignatureFile);
      toast.info('Solicitud rechazada');
      await Promise.all([loadVacationRows(), loadRequestsDashboard(), loadData()]);
      closeRejectModal();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo procesar la solicitud');
    } finally {
      setVacationActionId(null);
    }
  };

  const handleVacationPdf = async (request: VacationRequest) => {
    try {
      await openVacationRequestPdf(request.id);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo abrir el documento de la solicitud');
    }
  };

  const handleExportVacationXlsx = async () => {
    setExportingVacationXlsx(true);
    try {
      const orderingMap = { created_at: 'created_at', request_type: 'request_type', start_date: 'start_date' } as const;
      await exportRequestsXlsx({
        search: vacationSearch.trim() || undefined,
        employee__department: vacationFilterDepartment === 'all' ? undefined : vacationFilterDepartment,
        employee__branch: vacationFilterBranch === 'all' ? undefined : vacationFilterBranch,
        status: vacationFilterStatus === 'all' ? undefined : (vacationFilterStatus as VacationRequestStatus),
        employee: vacationFilterEmployee === 'all' ? undefined : vacationFilterEmployee,
        request_type: vacationFilterType === 'all' ? undefined : (vacationFilterType as VacationRequestType),
        remuneration: vacationFilterRemuneration === 'all' ? undefined : (vacationFilterRemuneration as RequestRemunerationFilter),
        order_by: orderingMap[vacationSort],
        start_date_from: vacationFilterStartFrom || undefined,
        start_date_to: vacationFilterStartTo || undefined,
      });
      toast.success('Excel de solicitudes generado');
    } catch (error) {
      console.error(error);
      toast.error('No se pudo generar el Excel de solicitudes');
    } finally {
      setExportingVacationXlsx(false);
    }
  };

  const CORRECTABLE_STATUSES = ['PENDING', 'IN_REVIEW', 'PENDING_HR', 'PENDING_ADMIN', 'APPROVED'];

  const openCorrectScheduleModal = (request: VacationRequest) => {
    const sameDay = request.start_date === request.end_date;
    setCorrectingRequest(request);
    setCorrectingSchedule({
      period_mode: sameDay ? 'SINGLE_DAY' : 'DATE_RANGE',
      single_date: sameDay ? request.start_date : '',
      start_date: request.start_date,
      end_date: request.end_date,
      is_full_day: request.is_full_day,
      start_time: request.start_time ?? '',
      end_time: request.end_time ?? '',
    });
    setCorrectingShifts(
      request.request_type === 'OVERTIME'
        ? (request.overtime_shifts ?? []).map((shift) => ({
            date: shift.date,
            start_time: shift.start_time.slice(0, 5),
            end_time: shift.end_time.slice(0, 5),
            notes: shift.notes ?? '',
          }))
        : [],
    );
    setCorrectingScheduleComment('');
  };

  const closeCorrectScheduleModal = () => {
    setCorrectingRequest(null);
    setCorrectingScheduleComment('');
  };

  const handleSaveScheduleCorrection = async () => {
    if (!correctingRequest) return;

    if (correctingRequest.request_type === 'OVERTIME') {
      if (correctingShifts.length === 0) {
        toast.error('Agrega al menos un turno de horas extra');
        return;
      }
      for (const shift of correctingShifts) {
        if (!shift.date || !shift.start_time || !shift.end_time) {
          toast.error('Completa fecha, hora inicio y hora fin de cada turno');
          return;
        }
        if (shift.end_time <= shift.start_time) {
          toast.error(`La hora final debe ser posterior a la inicial (${shift.date})`);
          return;
        }
      }
      setSavingScheduleCorrection(true);
      try {
        await correctVacationRequestSchedule(correctingRequest.id, { overtime_shifts: correctingShifts, comment: correctingScheduleComment.trim() });
        toast.success('Turnos de horas extra corregidos');
        closeCorrectScheduleModal();
        await loadVacationRows();
      } catch (error) {
        console.error(error);
        toast.error(error instanceof Error ? error.message : 'No se pudo corregir la solicitud');
      } finally {
        setSavingScheduleCorrection(false);
      }
      return;
    }

    const start_date = correctingSchedule.period_mode === 'SINGLE_DAY' ? correctingSchedule.single_date : correctingSchedule.start_date;
    const end_date = correctingSchedule.period_mode === 'SINGLE_DAY' ? correctingSchedule.single_date : correctingSchedule.end_date;
    if (!start_date || !end_date) {
      toast.error('Indica la(s) fecha(s) del permiso');
      return;
    }
    if (!correctingSchedule.is_full_day && !correctingSchedule.start_time) {
      toast.error('Indica la hora de inicio');
      return;
    }
    setSavingScheduleCorrection(true);
    try {
      await correctVacationRequestSchedule(correctingRequest.id, {
        start_date,
        end_date,
        is_full_day: correctingSchedule.is_full_day,
        start_time: correctingSchedule.is_full_day ? null : correctingSchedule.start_time,
        end_time: correctingSchedule.is_full_day ? null : (correctingSchedule.end_time || null),
        comment: correctingScheduleComment.trim(),
      });
      toast.success('Fecha/hora corregida');
      closeCorrectScheduleModal();
      await loadVacationRows();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo corregir la solicitud');
    } finally {
      setSavingScheduleCorrection(false);
    }
  };

  const openEditRequestModal = (request: VacationRequest) => {
    if (request.request_type === 'LOAN' && !canManageLoans) {
      toast.error('Solo Tesorería o el Administrador pueden editar préstamos.');
      return;
    }
    setEditingRequest(request);
    setEditingRequestForm({
      reason: request.reason ?? '',
      description: request.description ?? '',
      observations: request.observations ?? '',
    });
    setEditingRequestComment('');
  };

  const closeEditRequestModal = () => {
    setEditingRequest(null);
    setEditingRequestComment('');
  };

  const handleSaveRequestEdit = async () => {
    if (!editingRequest) return;
    setSavingRequestEdit(true);
    try {
      await updateVacationRequest(
        editingRequest.id,
        {
          reason: editingRequestForm.reason,
          description: editingRequestForm.description,
          observations: editingRequestForm.observations,
        },
        editingRequestComment.trim(),
      );
      toast.success('Solicitud actualizada');
      closeEditRequestModal();
      await loadVacationRows();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la solicitud');
    } finally {
      setSavingRequestEdit(false);
    }
  };

  const clearEmployeeFilters = () => {
    setSearchQuery('');
    setFilterDepartment('all');
    setFilterPosition('all');
    setFilterBranch('all');
    setFilterStatus('all');
    setFilterProfileStatus('all');
    setFilterEmploymentType('all');
    setFilterContractType('all');
    setFilterDataQuality('all');
    setShowUniformColumns(false);
  };

  const openManagerAssignmentModal = () => {
    setManagerAssignmentBranch(filterBranch !== 'all' ? filterBranch : 'all');
    setManagerAssignmentEmployeeIds([]);
    setManagerAssignmentManagerIds([]);
    setManagerAssignmentSearch('');
    setShowManagerAssignmentModal(true);
  };

  const toggleManagerAssignmentEmployee = (employeeId: string) => {
    setManagerAssignmentEmployeeIds((current) =>
      current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId],
    );
  };

  const toggleManagerAssignmentManager = (employeeId: string) => {
    setManagerAssignmentManagerIds((current) =>
      current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId],
    );
  };

  const toggleAllManagerAssignmentEmployees = () => {
    const visibleIds = managerAssignmentEmployees
      .filter((employee) => !managerAssignmentManagerIdSet.has(employee.id))
      .map((employee) => employee.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => managerAssignmentEmployeeIdSet.has(id));
    setManagerAssignmentEmployeeIds((current) => {
      if (allSelected) return current.filter((id) => !visibleIds.includes(id));
      return [...new Set([...current, ...visibleIds])];
    });
  };

  const handleSaveManagerAssignments = async () => {
    const employeeIds = managerAssignmentEmployeeIds.filter((id) => !managerAssignmentManagerIdSet.has(id));
    if (employeeIds.length === 0) {
      toast.error('Selecciona al menos un empleado para asignar.');
      return;
    }
    if (managerAssignmentManagerIds.length === 0) {
      toast.error('Selecciona al menos un jefe inmediato.');
      return;
    }
    setSavingManagerAssignments(true);
    try {
      const managerIds = cleanIdList(managerAssignmentManagerIds);
      const response = await assignEmployeeManagers({
        branch: managerAssignmentBranch === 'all' ? null : managerAssignmentBranch,
        employee_ids: employeeIds,
        manager_ids: managerIds,
      });
      setEmployees((current) => {
        const updatedById = new Map(response.employees.map((employee) => [employee.id, employee]));
        return current.map((employee) => updatedById.get(employee.id) ?? employee);
      });
      await loadData();
      toast.success(`${response.updated} empleado(s) actualizado(s)`);
      setShowManagerAssignmentModal(false);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'No se pudieron asignar los jefes inmediatos');
    } finally {
      setSavingManagerAssignments(false);
    }
  };

  const activeEmployees = employees.filter((employee) => employee.status === 'ACTIVE');
  const managerAssignmentEmployees = useMemo(() => {
    const query = normalizeSearchText(managerAssignmentSearch);
    return activeEmployees
      .filter((employee) => managerAssignmentBranch === 'all' || employee.branch === managerAssignmentBranch)
      .filter((employee) => {
        if (!query) return true;
        const branch = employee.branch ? branchById.get(employee.branch) : null;
        const department = employee.department ? departmentById.get(employee.department) : null;
        const position = employee.position ? positionById.get(employee.position) : null;
        return (
          normalizeSearchText(getEmployeeName(employee)).includes(query) ||
          normalizeSearchText(employee.employee_code).includes(query) ||
          normalizeSearchText(employee.document_number ?? '').includes(query) ||
          normalizeSearchText(branch?.name ?? '').includes(query) ||
          normalizeSearchText(department?.name ?? '').includes(query) ||
          normalizeSearchText(position?.name ?? '').includes(query)
        );
      })
      .sort((left, right) => getEmployeeName(left).localeCompare(getEmployeeName(right), 'es'));
  }, [activeEmployees, branchById, departmentById, managerAssignmentBranch, managerAssignmentSearch, positionById]);
  const managerAssignmentEmployeeIdSet = useMemo(() => new Set(managerAssignmentEmployeeIds), [managerAssignmentEmployeeIds]);
  const managerAssignmentManagerIdSet = useMemo(() => new Set(managerAssignmentManagerIds), [managerAssignmentManagerIds]);
  const managerAssignmentSelectedEmployees = useMemo(
    () => employees.filter((employee) => managerAssignmentEmployeeIdSet.has(employee.id)),
    [employees, managerAssignmentEmployeeIdSet],
  );
  const managerAssignmentSelectedManagers = useMemo(
    () => employees.filter((employee) => managerAssignmentManagerIdSet.has(employee.id)),
    [employees, managerAssignmentManagerIdSet],
  );
  const statusOptions = activeTab === 'vacations'
    ? [
        { value: 'all', label: 'Todos los estados' },
        { value: 'PENDING', label: 'Pendientes' },
        { value: 'IN_REVIEW', label: 'En revisión' },
        { value: 'PENDING_HR', label: 'Pendiente por RRHH' },
        { value: 'PENDING_ADMIN', label: 'Pendiente por Administrador' },
        { value: 'APPROVED', label: 'Aprobadas' },
        { value: 'REJECTED', label: 'Rechazadas' },
        { value: 'CANCELLED', label: 'Canceladas' },
        { value: 'FINALIZED', label: 'Finalizadas' },
        { value: 'EXPIRED', label: 'Vencidas' },
      ]
    : activeTab === 'branches'
      ? [
          { value: 'all', label: 'Todos los estados' },
          { value: 'ACTIVE', label: 'Activas' },
          { value: 'INACTIVE', label: 'Inactivas' },
        ]
    : [
        { value: 'all', label: 'Todos los estados' },
        ...EMPLOYEE_STATUS_OPTIONS,
      ];

  const renderPersonalTab = () => (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SelectInput label="Tipo de documento" value={employeeForm.document_type} onChange={(value) => setFormField('document_type', value)} options={[
          { value: 'CC', label: 'Cédula de ciudadanía' },
          { value: 'CE', label: 'Cédula de extranjería' },
          { value: 'PASSPORT', label: 'Pasaporte' },
          { value: 'NIT', label: 'NIT' },
          { value: 'OTHER', label: 'Otro' },
        ]} />
        <TextInput label="Número de documento" value={employeeForm.document_number} onChange={(value) => setFormField('document_number', value)} placeholder="123456789" />
        <TextInput label="Fecha de expedición" type="date" value={employeeForm.document_issue_date} onChange={(value) => setFormField('document_issue_date', value)} />
        <TextInput label="Lugar de expedición" value={employeeForm.document_issue_place} onChange={(value) => setFormField('document_issue_place', value)} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <TextInput label="Nombres" value={employeeForm.first_name} onChange={(value) => setFormField('first_name', value)} />
        <TextInput label="Apellidos" value={employeeForm.last_name} onChange={(value) => setFormField('last_name', value)} />
        <TextInput label="Fecha de nacimiento" type="date" value={employeeForm.date_of_birth} onChange={(value) => setFormField('date_of_birth', value)} />
        <TextInput label="Celular" type="tel" value={employeeForm.phone} onChange={(value) => setFormField('phone', value)} />
        <TextInput
          label="Correo electrónico"
          type="email"
          value={employeeForm.email}
          error={employeeForm.email && !isValidEmailFormat(employeeForm.email) ? 'Ingresa un correo válido (ej. nombre@dominio.com)' : undefined}
          onChange={(value) => {
            setEmployeeForm((current) => {
              const wasMirroringAccessEmail = !current.user_email || current.user_email === current.email;
              return {
                ...current,
                email: value,
                user_email: wasMirroringAccessEmail ? value : current.user_email,
                user_email_confirm: wasMirroringAccessEmail ? value : current.user_email_confirm,
              };
            });
          }}
        />
        <TextInput label="Nacionalidad" value={employeeForm.nationality} onChange={(value) => setFormField('nationality', value)} />
        <div className="sm:col-span-2 lg:col-span-2">
          <LocationPicker
            value={employeeLocation}
            onChange={setEmployeeLocation}
          />
        </div>
        <SelectInput label="Sexo / Género" value={employeeForm.gender} onChange={(value) => setFormField('gender', value)} options={[
          { value: 'FEMALE', label: 'Femenino' },
          { value: 'MALE', label: 'Masculino' },
          { value: 'NON_BINARY', label: 'No binario' },
          { value: 'OTHER', label: 'Otro' },
          { value: 'NOT_SPECIFIED', label: 'Prefiere no decir' },
        ]} />
        <SelectInput label="Estado civil" value={employeeForm.marital_status} onChange={(value) => setFormField('marital_status', value)} options={[
          { value: 'SINGLE', label: 'Soltero/a' },
          { value: 'MARRIED', label: 'Casado/a' },
          { value: 'FREE_UNION', label: 'Unión libre' },
          { value: 'DIVORCED', label: 'Divorciado/a' },
          { value: 'WIDOWED', label: 'Viudo/a' },
          { value: 'OTHER', label: 'Otro' },
        ]} />
        <label className="block">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Foto del empleado</span>
          <div className="flex items-center gap-3">
            {(photoPreviewUrl || editingEmployee?.photo) ? (
              <img
                src={photoPreviewUrl || getMediaUrl(editingEmployee!.photo)}
                alt="Vista previa de la foto"
                className="w-14 h-14 rounded-xl object-cover border border-gray-200 flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-gray-300 flex-shrink-0">
                <Users size={20} />
              </div>
            )}
            <input type="file" accept="image/*" onChange={(event) => setFormField('photo', event.target.files?.[0] ?? null)} className={inputCls} />
          </div>
        </label>
      </div>
      <TextareaInput label="Dirección de residencia" value={employeeForm.address} onChange={(value) => setFormField('address', value)} />
    </div>
  );

  const renderDotacionTab = () => {
    const displayName = `${employeeForm.first_name} ${employeeForm.last_name}`.trim() || editingEmployee?.employee_code || 'Empleado sin nombre';
    const departmentName = employeeForm.department ? departmentById.get(employeeForm.department)?.name : '';
    const positionName = employeeForm.position ? positionById.get(employeeForm.position)?.name : '';

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[#2a4038]/15 bg-[#eef4f1] px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">{displayName}</p>
          <p className="mt-1 text-xs text-[#2a4038]/75">
            {[departmentName || 'Sin área', positionName || 'Sin cargo'].join(' · ')}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <TextInput label="Suéter" value={employeeForm.uniform_sweater} onChange={(value) => setFormField('uniform_sweater', value)} />
          <TextInput label="Pantalón" value={employeeForm.uniform_pants} onChange={(value) => setFormField('uniform_pants', value)} />
          <TextInput label="Zapato" value={employeeForm.uniform_shoes} onChange={(value) => setFormField('uniform_shoes', value)} />
        </div>
        <TextareaInput label="Otro" value={employeeForm.uniform_other} onChange={(value) => setFormField('uniform_other', value)} />
        <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
          <input
            type="checkbox"
            checked={employeeForm.is_salesperson}
            onChange={(event) => setFormField('is_salesperson', event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-[#2a4038] focus:ring-[#2a4038]"
          />
          <span>
            <span className="block text-sm font-semibold text-gray-900">Marcar como vendedor</span>
            <span className="block text-xs text-gray-500">Disponible para generar codigos de descuento por vendedor.</span>
          </span>
        </label>
      </div>
    );
  };

  const renderLaborTab = () => (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TextInput label="Código interno" value={employeeForm.employee_code} onChange={(value) => setFormField('employee_code', value)} placeholder="Autogenerado si queda vacío" />
        <SelectInput label="Estado del expediente" value={employeeForm.profile_status} onChange={(value) => setFormField('profile_status', value as EmployeeProfileStatus)} options={[
          ...EMPLOYEE_PROFILE_STATUS_OPTIONS,
        ]} emptyLabel="Estado" />
        <SelectInput label="Área o dependencia" value={employeeForm.department} onChange={(value) => {
          const keepPosition = positions.some((position) => position.department === value && position.id === employeeForm.position);
          setEmployeeForm((current) => ({ ...current, department: value, position: keepPosition ? current.position : '' }));
        }} options={departments.map((department) => ({ value: department.id, label: department.name }))} />
        <SelectInput label="Cargo" value={employeeForm.position} onChange={(value) => setFormField('position', value)} options={positionsForSelectedDepartment.map((position) => ({ value: position.id, label: position.name }))} />
        <SelectInput label="Tipo de vinculación" value={employeeForm.employment_type} onChange={(value) => setFormField('employment_type', value)} options={[
          ...EMPLOYMENT_TYPE_OPTIONS,
        ]} emptyLabel="Tipo" />
        <SelectInput label="Tipo de contrato" value={employeeForm.contract_type} onChange={(value) => setFormField('contract_type', value)} options={[
          ...CONTRACT_TYPE_OPTIONS,
        ]} emptyLabel="Contrato" />
        <TextInput label="Fecha de ingreso" type="date" value={employeeForm.hire_date} onChange={(value) => setFormField('hire_date', value)} />
        <TextInput label="Salario básico" type="number" value={employeeForm.base_salary} onChange={(value) => setFormField('base_salary', value)} />
        <SelectInput label="Estado laboral" value={employeeForm.status} onChange={(value) => setFormField('status', value as EmployeeStatus)} options={[
          { value: 'ACTIVE', label: 'Activo' },
          { value: 'INACTIVE', label: 'Inactivo' },
          { value: 'SUSPENDED', label: 'Suspendido' },
          { value: 'TERMINATED', label: 'Retirado' },
        ]} emptyLabel="Estado" />
        <SelectInput label="Sede o sucursal" value={employeeForm.branch} onChange={(value) => setFormField('branch', value)} options={branches.map((branch) => ({ value: branch.id, label: `${branch.name} · ${branch.city || 'Sin ciudad'}` }))} />
        <div className="lg:col-span-2">
          <MultiSearchableSelectInput
            label="Jefes inmediatos"
            values={employeeForm.immediate_managers}
            onChange={(values) => {
              const managerIds = cleanIdList(values);
              setEmployeeForm((current) => ({ ...current, manager: managerIds[0] ?? '', immediate_managers: managerIds }));
            }}
            options={employees.filter((employee) => employee.id !== editingEmployee?.id).map((employee) => ({ value: employee.id, label: getEmployeeName(employee) }))}
            emptyLabel="Sin jefe asignado"
          />
        </div>
        <TextInput label="Centro de costos" value={employeeForm.cost_center} onChange={(value) => setFormField('cost_center', value)} />
        <SelectInput label="Modalidad de trabajo" value={employeeForm.work_modality} onChange={(value) => setFormField('work_modality', value)} options={[
          { value: 'ONSITE', label: 'Presencial' },
          { value: 'REMOTE', label: 'Remoto' },
          { value: 'HYBRID', label: 'Híbrido' },
        ]} />
        <TextInput label="Fecha de terminación" type="date" value={employeeForm.termination_date} onChange={(value) => setFormField('termination_date', value)} />
      </div>
      <TextareaInput label="Motivo de retiro" value={employeeForm.termination_reason} onChange={(value) => setFormField('termination_reason', value)} />
      <TextareaInput label="Observaciones laborales" value={employeeForm.work_observations} onChange={(value) => setFormField('work_observations', value)} />
    </div>
  );

  const renderSocialTab = () => (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <ComboWithOtherInput label="EPS" value={employeeForm.eps} onChange={(value) => setFormField('eps', value)} options={EPS_OPTIONS} />
      <ComboWithOtherInput label="Fondo de pensiones" value={employeeForm.pension_fund} onChange={(value) => setFormField('pension_fund', value)} options={PENSION_FUND_OPTIONS} />
      <ComboWithOtherInput label="Fondo de cesantías" value={employeeForm.severance_fund} onChange={(value) => setFormField('severance_fund', value)} options={SEVERANCE_FUND_OPTIONS} />
      <ComboWithOtherInput label="ARL" value={employeeForm.arl} onChange={(value) => setFormField('arl', value)} options={ARL_OPTIONS} />
      <SelectInput label="Nivel de riesgo ARL" value={employeeForm.arl_risk_level} onChange={(value) => setFormField('arl_risk_level', value)} options={ARL_RISK_LEVEL_OPTIONS} emptyLabel="Nivel de riesgo" />
      <ComboWithOtherInput label="Caja de compensación" value={employeeForm.compensation_fund} onChange={(value) => setFormField('compensation_fund', value)} options={COMPENSATION_FUND_OPTIONS} />
    </div>
  );

  const renderBankingTab = () => (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <ComboWithOtherInput label="Banco" value={employeeForm.bank_name} onChange={(value) => setFormField('bank_name', value)} options={BANK_OPTIONS} />
      <SelectInput label="Tipo de cuenta" value={employeeForm.bank_account_type} onChange={(value) => setFormField('bank_account_type', value)} options={[
        { value: 'SAVINGS', label: 'Ahorros' },
        { value: 'CHECKING', label: 'Corriente' },
      ]} />
      <TextInput label="Número de cuenta" value={employeeForm.bank_account_number} onChange={(value) => setFormField('bank_account_number', value)} />
      <TextInput label="Titular de la cuenta" value={employeeForm.bank_account_holder} onChange={(value) => setFormField('bank_account_holder', value)} />
      <TextInput label="Documento del titular" value={employeeForm.bank_account_holder_document} onChange={(value) => setFormField('bank_account_holder_document', value)} />
    </div>
  );

  const renderPayrollTab = () => (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SelectInput label="Tipo de salario" value={employeeForm.salary_type} onChange={(value) => setFormField('salary_type', value)} options={[
          { value: 'FIXED', label: 'Fijo' },
          { value: 'VARIABLE', label: 'Variable' },
          { value: 'INTEGRAL', label: 'Integral' },
        ]} emptyLabel="Tipo" />
        <TextInput label="Salario básico" type="number" value={employeeForm.base_salary} onChange={(value) => setFormField('base_salary', value)} />
        <TextInput label="Horas laborales semanales" type="number" value={employeeForm.weekly_working_hours} onChange={(value) => setFormField('weekly_working_hours', value)} />
        <div className="space-y-2">
          <ToggleInput label="Auxilio de transporte aplica" checked={employeeForm.transport_allowance_applies} onChange={(value) => setFormField('transport_allowance_applies', value)} />
          <ToggleInput label="Salario integral" checked={employeeForm.integral_salary} onChange={(value) => setFormField('integral_salary', value)} />
        </div>
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Días laborables</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {workDays.length === 0 ? (
            <div className="text-xs text-gray-400 border border-gray-200 rounded-lg p-3">Configura días laborales desde administración.</div>
          ) : workDays.map((day) => (
            <label key={day.id} className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={employeeForm.working_days.includes(day.id)}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...employeeForm.working_days, day.id]
                    : employeeForm.working_days.filter((id) => id !== day.id);
                  setFormField('working_days', next);
                }}
                className="accent-[#2a4038]"
              />
              {day.name}
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  const renderEmergencyTab = () => (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TextInput label="Nombre completo" value={employeeForm.emergency_contact_name} onChange={(value) => setFormField('emergency_contact_name', value)} />
        <TextInput label="Parentesco" value={employeeForm.emergency_contact_relationship} onChange={(value) => setFormField('emergency_contact_relationship', value)} />
        <TextInput label="Celular" value={employeeForm.emergency_contact_mobile} onChange={(value) => setFormField('emergency_contact_mobile', value)} />
        <TextInput label="Teléfono alternativo" value={employeeForm.emergency_contact_alternate_phone} onChange={(value) => setFormField('emergency_contact_alternate_phone', value)} />
      </div>
      <TextareaInput label="Dirección" value={employeeForm.emergency_contact_address} onChange={(value) => setFormField('emergency_contact_address', value)} />
    </div>
  );

  const renderDocumentsTab = () => (
    <div className="space-y-5">
      <div className="grid md:grid-cols-3 gap-3">
        {DOCUMENT_TYPE_OPTIONS.map((docType) => {
          const docs = employeeDocuments.filter((document) => document.document_type === docType.value);
          const latest = docs[0];
          return (
            <button
              type="button"
              key={docType.value}
              onClick={() => setDocumentForm((current) => ({ ...current, document_type: docType.value, name: current.name || docType.label }))}
              className="text-left border border-gray-200 rounded-xl p-3 hover:border-[#2a4038] transition-colors"
            >
              <div className="text-xs font-medium text-gray-900 mb-1.5">
                {docType.label}
                {REQUIRED_DOCUMENT_TYPES.has(docType.value) && (
                  <span className="text-red-500 ml-0.5" title="Documento obligatorio" aria-label="Documento obligatorio">*</span>
                )}
              </div>
              <Badge label={latest ? documentStatusLabel(latest.status) : 'Pendiente'} color={statusBadge(latest?.status ?? 'PENDING')} />
              {docs.length > 1 && <div className="text-[10px] text-gray-400 mt-2">{docs.length} adjuntos</div>}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-400">
        <span className="text-red-500">*</span> Documento obligatorio para completar el expediente.
      </p>

      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <FileUp size={16} />
          Registrar adjunto documental
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SelectInput
            label="Tipo de documento"
            value={documentForm.document_type}
            onChange={(value) => {
              const docType = value as EmployeeDocumentType;
              setDocumentForm((current) => ({
                ...current,
                document_type: docType,
                name: optionLabel(DOCUMENT_TYPE_OPTIONS, docType),
              }));
            }}
            options={DOCUMENT_TYPE_OPTIONS}
            emptyLabel="Documento"
          />
          <TextInput label="Nombre" value={documentForm.name} onChange={(value) => setDocumentForm((current) => ({ ...current, name: value }))} placeholder={documentForm.document_type ? optionLabel(DOCUMENT_TYPE_OPTIONS, documentForm.document_type) : 'Nombre del documento'} />
          <TextInput label={documentForm.document_type === 'ID_COPY' ? 'Fecha de expedición' : 'Fecha del documento'} type="date" value={documentForm.issued_at} onChange={(value) => setDocumentForm((current) => ({ ...current, issued_at: value }))} />
          <TextInput label="Fecha de vencimiento" type="date" value={documentForm.expires_at} onChange={(value) => setDocumentForm((current) => ({ ...current, expires_at: value }))} />
          <SelectInput label="Estado" value={documentForm.status} onChange={(value) => setDocumentForm((current) => ({ ...current, status: value as EmployeeDocumentStatus }))} options={[
            { value: 'PENDING', label: 'Pendiente' },
            { value: 'LOADED', label: 'Cargado' },
            { value: 'REJECTED', label: 'Rechazado' },
            { value: 'EXPIRED', label: 'Vencido' },
            { value: 'NOT_APPLICABLE', label: 'No aplica' },
          ]} emptyLabel="Estado" />
          <label className="block lg:col-span-3">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Archivo</span>
            <input type="file" onChange={(event) => setDocumentForm((current) => ({ ...current, file: event.target.files?.[0] ?? null, status: event.target.files?.[0] ? 'LOADED' : current.status }))} className={inputCls} />
          </label>
        </div>
        <TextareaInput label="Observaciones" value={documentForm.observations} onChange={(value) => setDocumentForm((current) => ({ ...current, observations: value }))} />
        {!documentForm.document_type && (
          <p className="text-xs text-amber-600">Selecciona primero el tipo de documento; no todos los adjuntos son una cédula.</p>
        )}
        {editingEmployee && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleDocumentUpload(editingEmployee.id)}
              disabled={savingDocument || !documentForm.document_type}
              className="px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors disabled:opacity-50"
            >
              {editingDocumentId ? (savingDocument ? 'Actualizando...' : 'Actualizar documento') : (savingDocument ? 'Subiendo...' : 'Guardar documento')}
            </button>
            {editingDocumentId && (
              <button
                type="button"
                onClick={resetDocumentForm}
                disabled={savingDocument}
                className="px-4 py-2.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar edición
              </button>
            )}
          </div>
        )}
        {!editingEmployee && (
          <p className="text-xs text-gray-400">El documento se adjuntará automáticamente después de crear el empleado.</p>
        )}
      </Card>

      <Table>
        <thead>
          <tr>
            <Th>Documento</Th>
            <Th>Estado</Th>
            <Th>Vence</Th>
            <Th>Archivo</Th>
            <Th>Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {employeeDocuments.map((document) => (
            <tr key={document.id} className="hover:bg-gray-50/50">
              <Td>
                <div className="font-medium text-gray-900">{document.name}</div>
                <div className="text-gray-400 text-[11px]">{optionLabel(DOCUMENT_TYPE_OPTIONS, document.document_type)}</div>
              </Td>
              <Td>
                <Badge label={documentStatusLabel(document.status)} color={statusBadge(document.status)} />
              </Td>
              <Td>{parseDate(document.expires_at)}</Td>
              <Td>
                {document.file ? (
                  <a href={getMediaUrl(document.file)} target="_blank" rel="noreferrer" className="text-[#2a4038] underline underline-offset-4">Ver archivo</a>
                ) : 'Sin archivo'}
              </Td>
              <Td>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditDocument(document)}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                    title="Editar documento"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => editingEmployee && void handleDeleteDocument(editingEmployee.id, document)}
                    disabled={deletingDocumentId === document.id}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                    title="Eliminar documento"
                  >
                    {deletingDocumentId === document.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      {employeeDocuments.length === 0 && <EmptyState title="Sin documentos cargados todavía." />}
    </div>
  );

  const renderPaymentsTab = () => {
    const publishedCount = payslips.filter((payslip) => payslip.status === 'PUBLISHED').length;
    const draftCount = payslips.filter((payslip) => payslip.status === 'DRAFT').length;
    const selectedEmployee = payslipFilterEmployee === 'all' ? null : employeeById.get(payslipFilterEmployee);
    const totalPages = Math.ceil(payslipTotal / payslipPageSize);

    const payslipActions = (payslip: PayslipDocument): Array<{
      label: string;
      icon: React.ComponentType<{ size?: number; className?: string }>;
      onClick: () => void;
      disabled?: boolean;
      danger?: boolean;
    }> => [
      {
        label: 'Descargar',
        icon: Download,
        onClick: () => void handlePayslipDownload(payslip),
        disabled: downloadingPayslipId === payslip.id,
      },
      {
        label: 'Editar',
        icon: Edit2,
        onClick: () => handleEditPayslip(payslip),
      },
      {
        label: 'Eliminar',
        icon: Trash2,
        onClick: () => void handleDeletePayslip(payslip),
        disabled: deletingPayslipId === payslip.id,
        danger: true,
      },
    ];

    return (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Volantes</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">{payslipTotal}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Publicados en vista</div>
            <div className="mt-1 text-2xl font-bold text-emerald-700">{publishedCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Borradores en vista</div>
            <div className="mt-1 text-2xl font-bold text-amber-700">{draftCount}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Filtro empleado</div>
            <div className="mt-1 text-sm font-semibold text-gray-900 truncate">{selectedEmployee ? getEmployeeName(selectedEmployee) : 'Todos'}</div>
          </Card>
        </div>

        <div className="grid xl:grid-cols-[minmax(320px,420px),1fr] gap-4 items-start">
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{editingPayslipId ? 'Editar volante' : 'Adjuntar volante de pago'}</h3>
                <p className="text-xs text-gray-500 mt-0.5">PDF individual por empleado y periodo.</p>
              </div>
              {editingPayslipId && (
                <button type="button" onClick={resetPayslipForm} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" title="Cancelar edición">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Empleado</span>
                <select value={payslipForm.employee} onChange={(event) => setPayslipForm((current) => ({ ...current, employee: event.target.value }))} className={selectCls}>
                  <option value="">Selecciona empleado</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{getEmployeeName(employee)} · {employee.employee_code}</option>
                  ))}
                </select>
              </label>
              <TextInput label="Nombre del volante" value={payslipForm.title} onChange={(value) => setPayslipForm((current) => ({ ...current, title: value }))} placeholder="Ej. Volante de pago primera quincena agosto" />
              <div className="grid sm:grid-cols-2 gap-3">
                <TextInput label="Periodo desde" type="date" value={payslipForm.period_start} onChange={(value) => setPayslipForm((current) => ({ ...current, period_start: value }))} />
                <TextInput label="Periodo hasta" type="date" value={payslipForm.period_end} onChange={(value) => setPayslipForm((current) => ({ ...current, period_end: value }))} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <TextInput label="Fecha de pago" type="date" value={payslipForm.payment_date} onChange={(value) => setPayslipForm((current) => ({ ...current, payment_date: value }))} />
                <label className="block">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Estado</span>
                  <select value={payslipForm.status} onChange={(event) => setPayslipForm((current) => ({ ...current, status: event.target.value as PayslipDocumentStatus }))} className={selectCls}>
                    {PAYSLIP_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">PDF</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(event) => setPayslipForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white"
                />
                {editingPayslipId && <p className="mt-1 text-[11px] text-gray-400">Déjalo vacío para conservar el PDF actual.</p>}
              </label>
              <TextareaInput label="Notas internas" value={payslipForm.notes} onChange={(value) => setPayslipForm((current) => ({ ...current, notes: value }))} placeholder="Opcional" />
            </div>

            <button
              type="button"
              onClick={() => void handlePayslipSubmit()}
              disabled={savingPayslip}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] disabled:opacity-50"
            >
              {savingPayslip ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
              {editingPayslipId ? 'Guardar volante' : 'Adjuntar PDF'}
            </button>
          </Card>

          <div className="space-y-3 min-w-0">
            <Card className="p-3 space-y-3">
              <SearchBar value={payslipSearch} onChange={setPayslipSearch} placeholder="Buscar por empleado, código, título o nota..." className="w-full" />
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                <select value={payslipFilterEmployee} onChange={(event) => setPayslipFilterEmployee(event.target.value)} className={selectCls}>
                  <option value="all">Todos los empleados</option>
                  {employees.map((employee) => <option key={employee.id} value={employee.id}>{getEmployeeName(employee)}</option>)}
                </select>
                <select value={payslipFilterStatus} onChange={(event) => setPayslipFilterStatus(event.target.value as 'all' | PayslipDocumentStatus)} className={selectCls}>
                  <option value="all">Todos los estados</option>
                  {PAYSLIP_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <input type="date" value={payslipPeriodFrom} onChange={(event) => setPayslipPeriodFrom(event.target.value)} className={inputCls} aria-label="Periodo desde" />
                <input type="date" value={payslipPeriodTo} onChange={(event) => setPayslipPeriodTo(event.target.value)} className={inputCls} aria-label="Periodo hasta" />
              </div>
            </Card>

            {payslipLoading ? (
              <LoadingState label="Cargando volantes..." />
            ) : payslips.length === 0 ? (
              <EmptyState title="Sin volantes de pago con estos filtros." />
            ) : (
              <>
                <div className="md:hidden space-y-2">
                  {payslips.map((payslip) => {
                    const employee = employeeById.get(payslip.employee);
                    return (
                      <Card key={payslip.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 truncate">{payslip.title}</div>
                            <div className="text-xs text-gray-500">{employee ? getEmployeeName(employee) : payslip.employee_name}</div>
                          </div>
                          <Badge label={payslipStatusLabel(payslip.status)} color={payslipStatusBadge(payslip.status)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-gray-400">Periodo</span><div className="font-medium text-gray-700">{parseDate(payslip.period_start)} - {parseDate(payslip.period_end)}</div></div>
                          <div><span className="text-gray-400">Pago</span><div className="font-medium text-gray-700">{parseDate(payslip.payment_date)}</div></div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {payslipActions(payslip).map((action) => {
                            const Icon = action.icon;
                            return (
                              <button key={action.label} type="button" onClick={action.onClick} disabled={action.disabled} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold disabled:opacity-50 ${action.danger ? 'border-red-100 text-red-600 hover:bg-red-50' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                <Icon size={13} />
                                {action.label}
                              </button>
                            );
                          })}
                        </div>
                      </Card>
                    );
                  })}
                </div>

                <div className="hidden md:block">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Empleado</Th>
                        <Th>Volante</Th>
                        <Th>Periodo</Th>
                        <Th>Pago</Th>
                        <Th>Estado</Th>
                        <Th>Acciones</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {payslips.map((payslip) => {
                        const employee = employeeById.get(payslip.employee);
                        return (
                          <tr key={payslip.id} className="hover:bg-gray-50/50">
                            <Td>
                              <div className="flex items-center gap-2 min-w-[180px]">
                                <EmployeeAvatar employee={employee} name={employee ? getEmployeeName(employee) : payslip.employee_name || 'Empleado'} />
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-900 truncate">{employee ? getEmployeeName(employee) : payslip.employee_name}</div>
                                  <div className="text-[11px] text-gray-400">{employee?.employee_code ?? ''}</div>
                                </div>
                              </div>
                            </Td>
                            <Td>
                              <div className="font-medium text-gray-900">{payslip.title}</div>
                              <div className="text-[11px] text-gray-400 truncate max-w-xs">{payslip.file_name || 'PDF adjunto'}</div>
                            </Td>
                            <Td>{parseDate(payslip.period_start)} - {parseDate(payslip.period_end)}</Td>
                            <Td>{parseDate(payslip.payment_date)}</Td>
                            <Td><Badge label={payslipStatusLabel(payslip.status)} color={payslipStatusBadge(payslip.status)} /></Td>
                            <Td className={actionsCellCls}>
                              <ActionsMenu items={payslipActions(payslip)} />
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              </>
            )}

            <Pagination
              currentPage={payslipPage}
              totalPages={totalPages}
              totalItems={payslipTotal}
              itemsPerPage={payslipPageSize}
              itemsPerPageOptions={PAGE_SIZE_OPTIONS}
              onPageChange={setPayslipPage}
              onItemsPerPageChange={setPayslipPageSize}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderAccessTab = () => {
    const visibleAccessPassword = employeeForm.user_password || editingEmployee?.access_password || '';
    const hasSavedCredentials = Boolean(editingEmployee?.user && editingEmployee?.access_password);

    return (
      <div className="space-y-4">
        {!canManageAccessCredentials && (
          <div className="p-4 border border-gray-200 bg-gray-50 rounded-xl text-xs text-gray-600">
            Solo Admin y RRHH pueden ver o generar credenciales de acceso.
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 border border-[#d9e5df] bg-[#f5faf7] rounded-xl">
          <div>
            <div className="text-sm font-semibold text-gray-900">Credenciales empresariales</div>
            <div className="text-xs text-gray-500 mt-1">Usuario tipo correo corporativo, clave visible para Admin/RRHH y PDF de entrega.</div>
          </div>
          <button
            type="button"
            onClick={handleGenerateAccessCredentials}
            disabled={!canManageAccessCredentials}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#2a4038] text-white text-xs font-semibold hover:bg-[#3d5c4e] disabled:opacity-50"
          >
            <KeyRound size={14} />
            Generar credenciales
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <SelectInput label="Rol dentro del sistema" value={employeeForm.user_role} onChange={(value) => setFormField('user_role', value as UserRole | '')} options={INTERNAL_EMPLOYEE_ROLES.map((role) => ({ value: role, label: getRoleLabel(role) }))} emptyLabel="Sin acceso al sistema" disabled={!canManageAccessCredentials} />
          <div className="sm:col-span-2">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Roles adicionales</span>
            <p className="text-[11px] text-gray-400 mb-2">
              Acceso extra a otros módulos sin cambiar el rol principal (ej. que un Empleado también vea Préstamos).
            </p>
            <div className="flex flex-wrap gap-2">
              {ADDITIONAL_ROLE_OPTIONS.filter((role) => role !== employeeForm.user_role).map((role) => {
                const active = employeeForm.user_additional_roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    disabled={!canManageAccessCredentials}
                    onClick={() => {
                      setEmployeeForm((current) => ({
                        ...current,
                        user_additional_roles: active
                          ? current.user_additional_roles.filter((code) => code !== role)
                          : [...current.user_additional_roles, role],
                      }));
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 ${
                      active
                        ? 'border-[#2a4038] bg-[#2a4038]/10 text-[#2a4038]'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {getRoleLabel(role)}
                  </button>
                );
              })}
            </div>
          </div>
          <TextInput
            label="Usuario / correo"
            type="email"
            value={employeeForm.user_email}
            error={employeeForm.user_email && !isValidEmailFormat(employeeForm.user_email) ? 'Ingresa un correo válido (ej. nombre@dominio.com)' : undefined}
            onChange={(value) => {
              const email = value.trim().toLowerCase();
              setEmployeeForm((current) => ({ ...current, user_email: email, user_email_confirm: email }));
            }}
            disabled={!canManageAccessCredentials}
          />
          <label className="block sm:col-span-2">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Clave</span>
            <div className="flex gap-2">
              <input
                type={showAccessPassword ? 'text' : 'password'}
                value={visibleAccessPassword}
                onChange={(event) => {
                  const password = event.target.value;
                  setEmployeeForm((current) => ({ ...current, user_password: password, user_password_confirm: password }));
                }}
                className={inputCls}
                placeholder={editingEmployee?.user ? 'Conserva la clave actual si queda vacía' : 'Genera una clave segura'}
                disabled={!canManageAccessCredentials}
              />
              <button
                type="button"
                onClick={() => setShowAccessPassword((current) => !current)}
                disabled={!visibleAccessPassword}
                className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 inline-flex items-center justify-center"
                title={showAccessPassword ? 'Ocultar clave' : 'Ver clave'}
              >
                {showAccessPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                onClick={() => void handleCopyAccessPassword(visibleAccessPassword)}
                disabled={!visibleAccessPassword}
                className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 inline-flex items-center justify-center"
                title="Copiar clave"
              >
                <Copy size={16} />
              </button>
            </div>
          </label>
        </div>

        {editingEmployee && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => void handleRegenerateAccessPassword()}
              disabled={!canManageAccessCredentials || !editingEmployee.user || regeneratingAccessId === editingEmployee.id}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {regeneratingAccessId === editingEmployee.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
              Regenerar clave
            </button>
            <button
              type="button"
              onClick={() => void handleEmployeeAccessPdfExport(editingEmployee)}
              disabled={!hasSavedCredentials || exportingAccessId === editingEmployee.id}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {exportingAccessId === editingEmployee.id ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              Descargar PDF de credenciales
            </button>
          </div>
        )}

        <div className="p-4 border border-amber-200 bg-amber-50 rounded-xl text-xs text-amber-800">
          Guarda el empleado despues de generar credenciales nuevas. El PDF se habilita cuando el empleado ya tiene usuario y clave guardados.
        </div>
      </div>
    );
  };

  const renderHistoryTab = () => (
    <div className="space-y-5">
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Creación</div>
          <div className="text-sm text-gray-700">{parseDate(editingEmployee?.created_at)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Última modificación</div>
          <div className="text-sm text-gray-700">{parseDate(editingEmployee?.updated_at)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Edad</div>
          <div className="text-sm text-gray-700">{editingEmployee?.age ?? 'Pendiente'}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Antigüedad</div>
          <div className="text-sm text-gray-700">{editingEmployee?.seniority_days ?? 0} días</div>
        </Card>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">Historial de cambios</div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {changeLogs.map((log) => (
              <div key={log.id} className="text-xs border-b border-gray-100 pb-2">
                <div className="font-medium text-gray-900">{log.field_name}</div>
                <div className="text-gray-400">{log.old_value || 'Vacío'} → {log.new_value || 'Vacío'}</div>
                <div className="text-[10px] text-gray-400">{parseDate(log.created_at)}</div>
              </div>
            ))}
            {changeLogs.length === 0 && <div className="text-xs text-gray-400">Sin cambios registrados.</div>}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">Historial salarial</div>
          <div className="space-y-2">
            {salaryHistory.map((item) => (
              <div key={item.id} className="text-xs border-b border-gray-100 pb-2">
                <div className="text-gray-700">{formatCurrency(item.previous_salary)} → {formatCurrency(item.new_salary)}</div>
                <div className="text-gray-400">{parseDate(item.start_date)} · {item.reason || 'Sin motivo'}</div>
              </div>
            ))}
            {salaryHistory.length === 0 && <div className="text-xs text-gray-400">Sin historial salarial.</div>}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">Historial de cargos</div>
          <div className="space-y-2">
            {positionHistory.map((item) => (
              <div key={item.id} className="text-xs border-b border-gray-100 pb-2">
                <div className="text-gray-700">{item.previous_position ? positionById.get(item.previous_position)?.name : 'Inicio'} → {positionById.get(item.new_position)?.name ?? item.new_position}</div>
                <div className="text-gray-400">{parseDate(item.start_date)} · {item.reason || 'Sin motivo'}</div>
              </div>
            ))}
            {positionHistory.length === 0 && <div className="text-xs text-gray-400">Sin historial de cargos.</div>}
          </div>
        </Card>
      </div>
    </div>
  );

  const renderEmployeePayslipsTab = () => (
    <div className="space-y-3">
      {employeePayslips.map((payslip) => (
        <div key={payslip.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-gray-100 rounded-xl p-4 bg-gray-50/60">
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate">{payslip.title}</div>
            <div className="text-xs text-gray-500 mt-1">
              {parseDate(payslip.period_start)} - {parseDate(payslip.period_end)} · Pago: {parseDate(payslip.payment_date)}
            </div>
            <div className="mt-2">
              <Badge label={payslipStatusLabel(payslip.status)} color={payslipStatusBadge(payslip.status)} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handlePayslipDownload(payslip)}
            disabled={downloadingPayslipId === payslip.id}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {downloadingPayslipId === payslip.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Descargar
          </button>
        </div>
      ))}
      {employeePayslips.length === 0 && <EmptyState title="Este empleado aún no tiene volantes de pago adjuntos." />}
    </div>
  );

  const renderModalTab = () => {
    switch (employeeModalTab) {
      case 'personal': return renderPersonalTab();
      case 'dotacion': return renderDotacionTab();
      case 'labor': return renderLaborTab();
      case 'social': return renderSocialTab();
      case 'banking': return renderBankingTab();
      case 'payroll': return renderPayrollTab();
      case 'emergency': return renderEmergencyTab();
      case 'documents': return renderDocumentsTab();
      case 'payslips': return renderEmployeePayslipsTab();
      case 'access': return renderAccessTab();
      case 'history': return renderHistoryTab();
      default: return null;
    }
  };

  const renderReadOnlyEmployeeTab = (employee: Employee) => {
    const department = employee.department ? departmentById.get(employee.department)?.name : 'Sin área';
    const position = employee.position ? positionById.get(employee.position)?.name : 'Sin cargo';
    const branch = employee.branch ? branchById.get(employee.branch)?.name : 'Sin sede';
    const managerNames = getEmployeeManagerNames(employee, employeeById);
    const rows: Array<[string, string | number | null | undefined]> =
      employeeModalTab === 'personal'
        ? [
            ['Tipo de documento', employee.document_type],
            ['Número de documento', employee.document_number],
            ['Fecha de expedición', parseDate(employee.document_issue_date)],
            ['Lugar de expedición', employee.document_issue_place],
            ['Nombres', employee.first_name],
            ['Apellidos', employee.last_name],
            ['Fecha de nacimiento', parseDate(employee.date_of_birth)],
            ['Celular', employee.phone],
            ['Correo', employee.email],
            ['Dirección', employee.address],
            ['Ciudad/Municipio', employee.city],
            ['Departamento', employee.residence_department],
            ['Nacionalidad', employee.nationality],
            ['Género', employee.gender],
            ['Estado civil', employee.marital_status],
          ]
        : employeeModalTab === 'dotacion'
          ? [
              ['Nombre', getEmployeeName(employee)],
              ['Área', department],
              ['Cargo', position],
              ['Suéter', employee.uniform_sweater],
              ['Pantalón', employee.uniform_pants],
              ['Zapato', employee.uniform_shoes],
              ['Otro', employee.uniform_other],
            ]
        : employeeModalTab === 'labor'
          ? [
              ['Código interno', employee.employee_code],
              ['Cargo', position],
              ['Área', department],
              ['Tipo de vinculación', employmentTypeLabel(employee.employment_type)],
              ['Tipo de contrato', contractTypeLabel(employee.contract_type)],
              ['Fecha de ingreso', parseDate(employee.hire_date)],
              ['Salario básico', formatCurrency(employee.base_salary)],
              ['Estado', statusLabel(employee.status)],
              ['Sede', branch],
              ['Jefes inmediatos', managerNames],
              ['Centro de costos', employee.cost_center],
              ['Modalidad', employee.work_modality],
              ['Fecha de terminación', parseDate(employee.termination_date)],
            ]
          : employeeModalTab === 'social'
            ? [
                ['EPS', employee.eps],
                ['Fondo de pensiones', employee.pension_fund],
                ['Fondo de cesantías', employee.severance_fund],
                ['ARL', employee.arl],
                ['Nivel de riesgo ARL', employee.arl_risk_level],
                ['Caja de compensación', employee.compensation_fund],
              ]
            : employeeModalTab === 'banking'
              ? [
                  ['Banco', employee.bank_name],
                  ['Tipo de cuenta', employee.bank_account_type],
                  ['Número de cuenta', employee.bank_account_number],
                  ['Titular', employee.bank_account_holder],
                  ['Documento titular', employee.bank_account_holder_document],
                ]
              : employeeModalTab === 'emergency'
                ? [
                    ['Nombre completo', employee.emergency_contact_name],
                    ['Parentesco', employee.emergency_contact_relationship],
                    ['Celular', employee.emergency_contact_mobile],
                    ['Teléfono alternativo', employee.emergency_contact_alternate_phone],
                    ['Dirección', employee.emergency_contact_address],
                  ]
                : [];

    if (employeeModalTab === 'documents') {
      return (
        <div>
          <Table>
            <thead>
              <tr>
                <Th>Documento</Th>
                <Th>Estado</Th>
                <Th>Vence</Th>
                <Th>Archivo</Th>
              </tr>
            </thead>
            <tbody>
              {employeeDocuments.map((document) => (
                <tr key={document.id} className="hover:bg-gray-50/50">
                  <Td>
                    <div className="font-medium text-gray-900">{document.name}</div>
                    <div className="text-gray-400 text-[11px]">{optionLabel(DOCUMENT_TYPE_OPTIONS, document.document_type)}</div>
                  </Td>
                  <Td><Badge label={documentStatusLabel(document.status)} color={statusBadge(document.status)} /></Td>
                  <Td>{parseDate(document.expires_at)}</Td>
                  <Td>{document.file ? <a href={getMediaUrl(document.file)} target="_blank" rel="noreferrer" className="text-[#2a4038] underline underline-offset-4">Ver archivo</a> : 'Sin archivo'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {employeeDocuments.length === 0 && <EmptyState title="Sin documentos cargados." />}
        </div>
      );
    }
    if (employeeModalTab === 'payslips') {
      return renderEmployeePayslipsTab();
    }
    if (employeeModalTab === 'history') {
      return (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">Historial de cambios</div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {changeLogs.map((log) => (
                <div key={log.id} className="text-xs border-b border-gray-100 pb-2">
                  <div className="font-medium text-gray-900">{log.field_name}</div>
                  <div className="text-gray-400">{log.old_value || 'Vacío'} → {log.new_value || 'Vacío'}</div>
                  <div className="text-[10px] text-gray-400">{parseDate(log.created_at)}</div>
                </div>
              ))}
              {changeLogs.length === 0 && <div className="text-xs text-gray-400">Sin cambios registrados.</div>}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">Historial salarial</div>
            {salaryHistory.map((item) => (
              <div key={item.id} className="text-xs border-b border-gray-100 pb-2">
                <div className="text-gray-700">{formatCurrency(item.previous_salary)} → {formatCurrency(item.new_salary)}</div>
                <div className="text-gray-400">{parseDate(item.start_date)} · {item.reason || 'Sin motivo'}</div>
              </div>
            ))}
            {salaryHistory.length === 0 && <div className="text-xs text-gray-400">Sin historial salarial.</div>}
          </Card>
          <Card className="p-4">
            <div className="text-sm font-semibold text-gray-900 mb-3">Historial de cargos</div>
            {positionHistory.map((item) => (
              <div key={item.id} className="text-xs border-b border-gray-100 pb-2">
                <div className="text-gray-700">{item.previous_position ? positionById.get(item.previous_position)?.name : 'Inicio'} → {positionById.get(item.new_position)?.name ?? item.new_position}</div>
                <div className="text-gray-400">{parseDate(item.start_date)} · {item.reason || 'Sin motivo'}</div>
              </div>
            ))}
            {positionHistory.length === 0 && <div className="text-xs text-gray-400">Sin historial de cargos.</div>}
          </Card>
        </div>
      );
    }
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map(([label, value]) => (
          <div key={label} className="border border-gray-100 rounded-xl p-4 bg-gray-50/60">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">{label}</div>
            <div className="text-sm text-gray-700">{value || 'Sin registrar'}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Recursos Humanos</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Expedientes empresariales con nómina, seguridad social, documentos y auditoría.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === 'employees' && (
            <>
              <button
                onClick={openManagerAssignmentModal}
                disabled={isLoading || activeEmployees.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 border border-[#2a4038] text-[#2a4038] text-xs font-semibold rounded-xl hover:bg-[#eef4f1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Network size={14} />
                Asignar jefes
              </button>
              <button
                onClick={() => void handleEmployeesPdfExport()}
                disabled={exportingEmployeesPdf || isLoading || sortedEmployees.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 border border-[#2a4038] text-[#2a4038] text-xs font-semibold rounded-xl hover:bg-[#eef4f1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingEmployeesPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                {exportingEmployeesPdf ? 'Generando PDF...' : 'Exportar filtro PDF'}
              </button>
              <button
                onClick={() => void handleUniformExcelExport()}
                disabled={exportingUniformExcel || isLoading || sortedEmployees.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 border border-[#2a4038] text-[#2a4038] text-xs font-semibold rounded-xl hover:bg-[#eef4f1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingUniformExcel ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                {exportingUniformExcel ? 'Generando Excel...' : 'Descargar Excel interno'}
              </button>
            </>
          )}
          {activeTab === 'branches' && (
            <button
              onClick={() => void handleBranchesPdfExport()}
              disabled={exportingBranchesPdf}
              className="flex items-center gap-2 px-4 py-2.5 border border-[#2a4038] text-[#2a4038] text-xs font-semibold rounded-xl hover:bg-[#eef4f1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportingBranchesPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              {exportingBranchesPdf ? 'Generando PDF...' : 'Exportar PDF'}
            </button>
          )}
          <button
            onClick={activeTab === 'branches' ? openCreateBranchModal : openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#2a4038] text-white text-xs font-semibold rounded-xl hover:bg-[#3d5c4e] transition-colors"
          >
            {activeTab === 'branches' ? <Plus size={14} /> : <UserPlus size={14} />}
            {activeTab === 'branches' ? 'Nueva sede' : 'Nuevo empleado'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Perfil completado', value: `${stats.profileCompletion}%`, icon: BadgeCheck },
          { label: 'Pendientes', value: stats.pending, icon: Clock3 },
          { label: 'Vencidos', value: stats.expiredDocuments, icon: AlertTriangle },
          { label: 'Contrato restante', value: stats.contractRemaining, icon: CalendarClock },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} className="text-gray-400" />
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{stat.label}</div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 -mx-4 sm:-mx-6 md:-mx-8 lg:mx-0">
        <div className="w-full lg:w-48 flex-shrink-0 bg-gray-50 lg:bg-transparent border-b lg:border-b-0 lg:border-r border-gray-100 lg:pr-3">
          <nav className="p-3 lg:p-0 lg:sticky lg:top-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-gray-400 px-2.5 mb-1.5 hidden lg:block">Módulos</p>
            <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
              {([
                { id: 'employees', label: 'Empleados', icon: Users, desc: 'Expedientes y documentos' },
                { id: 'branches', label: 'Sedes', icon: Building2, desc: 'Sucursales y ubicaciones' },
                { id: 'catalog', label: 'Catálogos', icon: Briefcase, desc: 'Áreas, cargos y horarios' },
                { id: 'vacations', label: 'Solicitudes', icon: CalendarClock, desc: 'Vacaciones y permisos' },
                { id: 'calendar', label: 'Calendario', icon: CalendarDays, desc: 'Novedades y cumpleaños' },
                { id: 'orgchart', label: 'Organigrama', icon: Network, desc: 'Jerarquía de la empresa' },
                { id: 'documents', label: 'Normativa', icon: FileText, desc: 'Reglamento y políticas' },
                { id: 'payments', label: 'Pagos', icon: Wallet, desc: 'Volantes de pago' },
              ] as const).map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setFilterStatus('all');
                    }}
                    className={`flex-shrink-0 lg:w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all group ${active ? 'bg-[#2a4038] text-white shadow-sm' : 'hover:bg-white hover:shadow-sm text-gray-600'}`}
                  >
                    <Icon size={13} className={`flex-shrink-0 ${active ? 'text-white' : 'text-gray-400 group-hover:text-[#2a4038]'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] font-semibold whitespace-nowrap lg:whitespace-normal ${active ? 'text-white' : 'text-gray-700'}`}>{item.label}</p>
                      <p className={`text-[9px] leading-tight mt-0.5 hidden lg:block whitespace-nowrap ${active ? 'text-white/70' : 'text-gray-400'}`}>{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>

        <div className="flex-1 min-w-0 space-y-4 px-4 sm:px-6 md:px-8 lg:px-0 pt-4 lg:pt-0">
          {activeTab !== 'calendar' && activeTab !== 'vacations' && activeTab !== 'orgchart' && activeTab !== 'documents' && activeTab !== 'payments' && (
            <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por nombre, apellido, cédula, cargo, área, sede o correo..." className="w-full" />
          )}
          {activeTab === 'documents' && <AdminCompanyDocuments />}
          {activeTab === 'payments' && renderPaymentsTab()}
          {activeTab === 'employees' ? (
            <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
                <select value={filterDepartment} onChange={(event) => {
                  setFilterDepartment(event.target.value);
                  setFilterPosition('all');
                }} className={`${selectCls} w-full`}>
                  <option value="all">Todas las áreas</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
                <select value={filterPosition} onChange={(event) => setFilterPosition(event.target.value)} className={`${selectCls} w-full`}>
                  <option value="all">Todos los cargos</option>
                  {employeeFilterPositions.map((position) => <option key={position.id} value={position.id}>{position.name}</option>)}
                </select>
                <select value={filterBranch} onChange={(event) => setFilterBranch(event.target.value)} className={`${selectCls} w-full`}>
                  <option value="all">Todas las sedes</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
                <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className={`${selectCls} w-full`}>
                  <option value="all">Todos los estados laborales</option>
                  {EMPLOYEE_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select value={filterProfileStatus} onChange={(event) => setFilterProfileStatus(event.target.value)} className={`${selectCls} w-full`}>
                  <option value="all">Todos los expedientes</option>
                  {EMPLOYEE_PROFILE_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select value={filterEmploymentType} onChange={(event) => setFilterEmploymentType(event.target.value)} className={`${selectCls} w-full`}>
                  <option value="all">Toda vinculación</option>
                  {EMPLOYMENT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select value={filterContractType} onChange={(event) => setFilterContractType(event.target.value)} className={`${selectCls} w-full`}>
                  <option value="all">Todos los contratos</option>
                  {CONTRACT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select value={filterDataQuality} onChange={(event) => setFilterDataQuality(event.target.value as EmployeeDataQualityFilter)} className={`${selectCls} w-full`}>
                  {EMPLOYEE_DATA_QUALITY_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {hasActiveEmployeeFilters ? activeEmployeeFilterLabels.map((label) => (
                    <span key={label} className="inline-flex items-center rounded-full border border-[#2a4038]/15 bg-[#eef4f1] px-2.5 py-1 text-[10px] font-semibold text-[#2a4038]">
                      {label}
                    </span>
                  )) : (
                    <span className="text-[11px] text-gray-400">Sin filtros activos</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUniformColumns((current) => !current)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                      showUniformColumns
                        ? 'border-[#2a4038] bg-[#2a4038] text-white hover:bg-[#3d5c4e]'
                        : 'border-[#2a4038]/25 bg-[#eef4f1] text-[#2a4038] hover:bg-[#e3eee9]'
                    }`}
                  >
                    <Shirt size={12} />
                    {showUniformColumns ? 'Desactivar dotación' : 'Activar dotación'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleUniformExcelExport()}
                    disabled={exportingUniformExcel || isLoading || sortedEmployees.length === 0}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#2a4038]/25 px-2.5 py-1.5 text-[11px] font-semibold text-[#2a4038] transition-colors hover:bg-[#eef4f1] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {exportingUniformExcel ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
                    Excel dotación
                  </button>
                  {hasActiveEmployeeFilters && (
                    <button
                      type="button"
                      onClick={clearEmployeeFilters}
                      className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-semibold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800 lg:self-auto"
                    >
                      <X size={12} />
                      Limpiar filtros
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'vacations' ? (
            <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
                <SearchBar value={vacationSearch} onChange={setVacationSearch} placeholder="Buscar empleado, motivo o clave..." className="w-full lg:flex-1" />
                <div className="flex items-center gap-2 flex-shrink-0">
                  {(vacationSearch || vacationFilterEmployee !== 'all' || vacationFilterDepartment !== 'all' || vacationFilterBranch !== 'all' || vacationFilterStatus !== 'all' || vacationFilterType !== 'all' || vacationFilterRemuneration !== 'all' || vacationFilterStartFrom || vacationFilterStartTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setVacationSearch('');
                        setVacationFilterEmployee('all');
                        setVacationFilterDepartment('all');
                        setVacationFilterBranch('all');
                        setVacationFilterStatus('all');
                        setVacationFilterType('all');
                        setVacationFilterRemuneration('all');
                        setVacationFilterStartFrom('');
                        setVacationFilterStartTo('');
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800 whitespace-nowrap"
                    >
                      <X size={13} />
                      Limpiar filtros
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleExportVacationXlsx()}
                    disabled={exportingVacationXlsx}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#2a4038] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#3d5c4e] disabled:opacity-50 whitespace-nowrap"
                  >
                    {exportingVacationXlsx ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                    Exportar
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-2.5">
                <label className="block min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Estado</span>
                  <select value={vacationFilterStatus} onChange={(event) => setVacationFilterStatus(event.target.value)} className={`${selectCls} w-full`}>
                    {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="block min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Tipo</span>
                  <select value={vacationFilterType} onChange={(event) => setVacationFilterType(event.target.value)} className={`${selectCls} w-full`}>
                    <option value="all">Todos</option>
                    {REQUEST_TYPE_FILTER_OPTIONS.map((value) => (
                      <option key={value} value={value}>{getRequestTypeLabel(value)}</option>
                    ))}
                  </select>
                </label>
                <label className="block min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Remunerado</span>
                  <select value={vacationFilterRemuneration} onChange={(event) => setVacationFilterRemuneration(event.target.value)} className={`${selectCls} w-full`}>
                    <option value="all">Todos</option>
                    {REMUNERATION_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="block min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Desde</span>
                  <input
                    type="date"
                    value={vacationFilterStartFrom}
                    onChange={(event) => setVacationFilterStartFrom(event.target.value)}
                    className={`${inputCls} w-full`}
                  />
                </label>
                <label className="block min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Hasta</span>
                  <input
                    type="date"
                    value={vacationFilterStartTo}
                    onChange={(event) => setVacationFilterStartTo(event.target.value)}
                    className={`${inputCls} w-full`}
                  />
                </label>
                <label className="block min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Empleado</span>
                  <select value={vacationFilterEmployee} onChange={(event) => setVacationFilterEmployee(event.target.value)} className={`${selectCls} w-full`}>
                    <option value="all">Todos</option>
                    {employees.map((employee) => <option key={employee.id} value={employee.id}>{getEmployeeName(employee)}</option>)}
                  </select>
                </label>
                <label className="block min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Área</span>
                  <select value={vacationFilterDepartment} onChange={(event) => setVacationFilterDepartment(event.target.value)} className={`${selectCls} w-full`}>
                    <option value="all">Todas</option>
                    {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                </label>
                <label className="block min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Sede</span>
                  <select value={vacationFilterBranch} onChange={(event) => setVacationFilterBranch(event.target.value)} className={`${selectCls} w-full`}>
                    <option value="all">Todas</option>
                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </label>
                <label className="block min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Ordenar por</span>
                  <select value={vacationSort} onChange={(event) => setVacationSort(event.target.value as typeof vacationSort)} className={`${selectCls} w-full`}>
                    <option value="created_at">Fecha de solicitud</option>
                    <option value="start_date">Fecha del permiso</option>
                    <option value="request_type">Tipo</option>
                  </select>
                </label>
              </div>
            </div>
          ) : activeTab === 'branches' ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className={selectCls}>
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          ) : null}

      {isLoading ? (
        <LoadingState label="Cargando información de RRHH..." />
      ) : (
        <>
          {activeTab === 'employees' && filteredEmployees.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <ResultsCount count={filteredEmployees.length} label={filteredEmployees.length === 1 ? 'empleado encontrado' : 'empleados encontrados'} />
            </div>
          )}
          {activeTab === 'employees' && filteredEmployees.length > 0 && (
            <Table scrollable>
                  <thead>
                    <tr>
                      <SortableTh label="Empleado" sortKey="name" active={employeeSort} onSort={setEmployeeSort} />
                      <SortableTh label="Cargo / Sede" sortKey="department" active={employeeSort} onSort={setEmployeeSort} />
                      <SortableTh label="Estado" sortKey="status" active={employeeSort} onSort={setEmployeeSort} />
                      <SortableTh label="Perfil" sortKey="profile" active={employeeSort} onSort={setEmployeeSort} />
                      {showUniformColumns && (
                        <>
                          <Th>Suéter</Th>
                          <Th>Pantalón</Th>
                          <Th>Zapato</Th>
                          <Th>Otro</Th>
                        </>
                      )}
                      <Th>Documentos</Th>
                      <Th>Acciones</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedEmployees.map((employee) => {
                      const department = employee.department ? departmentById.get(employee.department) : null;
                      const position = employee.position ? positionById.get(employee.position) : null;
                      const branch = employee.branch ? branchById.get(employee.branch) : null;
                      return (
                        <tr
                          key={employee.id}
                          onClick={() => openEmployeeDetailModal(employee)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openEmployeeDetailModal(employee);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`Ver detalles de ${getEmployeeName(employee)}`}
                          className="cursor-pointer transition-colors hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2a4038]/30"
                        >
                          <Td>
                            <div className="font-medium text-gray-900">{getEmployeeName(employee)}</div>
                            <div className="text-gray-400 text-[11px] mt-1">{employee.employee_code || 'Código autogenerado'} · {employee.document_number || 'Sin documento'}</div>
                            <div className="text-gray-400 text-[11px]">{employee.email || 'Sin correo'}</div>
                          </Td>
                          <Td>
                            <div>{position?.name ?? 'Sin cargo'}</div>
                            <div className="text-gray-400 text-[11px] mt-1">{department?.name ?? 'Sin área'} · {branch?.name ?? 'Sin sede'}</div>
                            <div className="text-gray-400 text-[11px] mt-1">Jefes: {getEmployeeManagerNames(employee, employeeById)}</div>
                          </Td>
                          <Td>
                            <Badge label={statusLabel(employee.status)} color={statusBadge(employee.status)} />
                            <div className="mt-1.5">
                              <Badge label={profileStatusLabel(employee.profile_status)} color={statusBadge(employee.profile_status)} />
                            </div>
                          </Td>
                          <Td className="min-w-[160px]">
                            <div className="flex items-center justify-between mb-1">
                              <span>{employee.profile_completion_percentage}%</span>
                              <span className="text-gray-400 text-[11px]">{employee.age ? `${employee.age} años` : 'Edad N/D'}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#2a4038]" style={{ width: `${employee.profile_completion_percentage}%` }} />
                            </div>
                          </Td>
                          {showUniformColumns && (
                            <>
                              <Td>{getEmployeeUniformValue(employee, 'uniform_sweater')}</Td>
                              <Td>{getEmployeeUniformValue(employee, 'uniform_pants')}</Td>
                              <Td>{getEmployeeUniformValue(employee, 'uniform_shoes')}</Td>
                              <Td>
                                <div className="max-w-[220px] whitespace-pre-wrap">
                                  {getEmployeeUniformValue(employee, 'uniform_other')}
                                </div>
                              </Td>
                            </>
                          )}
                          <Td>
                            <div>Pendientes: {employee.pending_documents_count}</div>
                            <div className={employee.expired_documents_count > 0 ? 'text-red-600' : 'text-gray-400'}>
                              Vencidos: {employee.expired_documents_count}
                            </div>
                          </Td>
                          <Td className={actionsCellCls} onClick={(e) => e.stopPropagation()}>
                            <ActionsMenu
                              items={[
                                { label: 'Ver empleado', icon: Eye, onClick: () => openEmployeeDetailModal(employee) },
                                { label: 'Editar empleado', icon: Edit2, onClick: () => openEditModal(employee) },
                                {
                                  label: exportingProfileId === employee.id ? 'Descargando...' : 'Descargar perfil PDF',
                                  icon: exportingProfileId === employee.id ? Loader2 : FileDown,
                                  onClick: () => void handleEmployeeProfilePdfExport(employee),
                                  disabled: exportingProfileId === employee.id,
                                },
                                {
                                  label: exportingCertificateId === employee.id ? 'Generando...' : 'Certificado laboral',
                                  icon: exportingCertificateId === employee.id ? Loader2 : BadgeCheck,
                                  onClick: () => openCertificateModal(employee),
                                  disabled: exportingCertificateId === employee.id,
                                },
                                ...(canManageAccessCredentials ? [{
                                  label: exportingAccessId === employee.id ? 'Generando...' : 'PDF de credenciales',
                                  icon: exportingAccessId === employee.id ? Loader2 : KeyRound,
                                  onClick: () => void handleEmployeeAccessPdfExport(employee),
                                  disabled: exportingAccessId === employee.id || !employee.user || !employee.access_password,
                                }] : []),
                                {
                                  label: 'Eliminar empleado',
                                  icon: Trash2,
                                  onClick: () => handleDeleteEmployee(employee),
                                  disabled: deletingEmployeeId === employee.id,
                                  danger: true,
                                },
                              ]}
                            />
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
            </Table>
          )}
          {activeTab === 'employees' && filteredEmployees.length > 0 && (
            <div className="mt-4">
              <Pagination
                currentPage={employeePage}
                totalPages={employeeTotalPages}
                totalItems={filteredEmployees.length}
                itemsPerPage={employeePageSize}
                itemsPerPageOptions={PAGE_SIZE_OPTIONS}
                onPageChange={setEmployeePage}
                onItemsPerPageChange={setEmployeePageSize}
              />
            </div>
          )}
          {activeTab === 'employees' && filteredEmployees.length === 0 && (
            <EmptyState title="No se encontraron empleados" description="Ajusta tu búsqueda o filtros, o crea el primer empleado." />
          )}

          {activeTab === 'branches' && (
            <div className="space-y-3">
              <Card className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Search size={14} />
                  {sortedBranches.length} sedes encontradas
                </div>
                <select value={branchSort} onChange={(event) => setBranchSort(event.target.value as typeof branchSort)} className={`${selectCls} w-auto`}>
                  <option value="name">Ordenar por nombre</option>
                  <option value="code">Ordenar por código</option>
                  <option value="city">Ordenar por ciudad</option>
                  <option value="status">Ordenar por estado</option>
                </select>
              </Card>
              <Table scrollable>
                  <thead>
                    <tr>
                      <Th>Sede</Th>
                      <Th>Ubicación</Th>
                      <Th>Responsable</Th>
                      <Th>Empleados</Th>
                      <Th>Estado</Th>
                      <Th>Acciones</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBranches.map((branch) => (
                      <tr key={branch.id} className="hover:bg-gray-50/50">
                        <Td>
                          <div className="font-medium text-gray-900">{branch.name}</div>
                          <div className="text-gray-400 text-[11px] mt-1">{branch.code}</div>
                          <div className="text-gray-400 text-[11px]">{branch.email || 'Sin correo'}</div>
                        </Td>
                        <Td>
                          <div>{branch.city || 'Sin ciudad'}, {branch.department || 'Sin departamento'}</div>
                          <div className="text-gray-400 text-[11px] mt-1">{branch.country || 'Colombia'}</div>
                        </Td>
                        <Td>{branch.responsible_name || 'Sin responsable'}</Td>
                        <Td>
                          <div>{branch.employee_count ?? 0} empleados</div>
                          <div className="text-gray-400 text-[11px]">{branch.department_names?.join(', ') || 'Sin áreas'}</div>
                        </Td>
                        <Td>
                          <Badge label={branch.status === 'ACTIVE' ? 'Activa' : 'Inactiva'} color={branch.status === 'ACTIVE' ? 'green' : 'gray'} />
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openBranchDetailModal(branch)} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Ver sede">
                              <Eye size={13} />
                            </button>
                            <button onClick={() => openEditBranchModal(branch)} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Editar sede">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => handleDeleteBranch(branch)} disabled={deletingBranchId === branch.id} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50" title="Eliminar sede">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
            </Table>
              {sortedBranches.length > 0 && (
                <Pagination
                  currentPage={branchPage}
                  totalPages={branchTotalPages}
                  totalItems={sortedBranches.length}
                  itemsPerPage={branchPageSize}
                  itemsPerPageOptions={PAGE_SIZE_OPTIONS}
                  onPageChange={setBranchPage}
                  onItemsPerPageChange={setBranchPageSize}
                />
              )}
              {sortedBranches.length === 0 && (
                <EmptyState title="No se encontraron sedes" description="Ajusta tu búsqueda o crea la primera sede." />
              )}
            </div>
          )}

          {activeTab === 'catalog' && (
            <div className="space-y-4">
              <AdminStructure />
              <div className="grid lg:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-900"><Building2 size={16} /> Sedes</div>
                  <div className="space-y-2">
                    {branches.map((branch) => (
                      <div key={branch.id} className="flex justify-between border-b border-gray-100 pb-2 text-xs">
                        <span className="text-gray-700">{branch.name}</span>
                        <span className="text-gray-400">{branch.city || 'Sin ciudad'}</span>
                      </div>
                    ))}
                    {branches.length === 0 && <div className="text-xs text-gray-400">Sin sedes configuradas.</div>}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-900"><CalendarClock size={16} /> Días laborables</div>
                  <div className="flex flex-wrap gap-2">
                    {workDays.map((day) => <span key={day.id} className="px-3 py-1 border border-gray-200 rounded-lg text-xs text-gray-700">{day.name}</span>)}
                    {workDays.length === 0 && <div className="text-xs text-gray-400">Sin días configurados.</div>}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'vacations' && (
            <div className="space-y-4">
              {requestsDashboard && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                      { label: 'Pendientes', value: requestsDashboard.pending },
                      { label: 'Aprobadas', value: requestsDashboard.approved },
                      { label: 'Rechazadas', value: requestsDashboard.rejected },
                      { label: 'En revisión', value: requestsDashboard.in_review },
                      { label: 'Vencidas', value: requestsDashboard.expired },
                    ].map((item) => (
                      <Card key={item.label} className="p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">{item.label}</div>
                        <div className="text-lg font-bold text-gray-900">{item.value}</div>
                      </Card>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowVacationCharts((current) => !current)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <BarChart3 size={14} className="text-gray-400" />
                      Estadísticas y desglose (horas extra, incapacidad, por mes/tipo/área/sede/empleado)
                    </span>
                    {showVacationCharts ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {showVacationCharts && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { label: 'Horas extras', value: requestsDashboard.overtime_hours },
                          { label: 'Días incapacidad', value: requestsDashboard.incapacity_days },
                          { label: 'Vacaciones pendientes', value: requestsDashboard.pending_vacation_days },
                        ].map((item) => (
                          <Card key={item.label} className="p-4">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">{item.label}</div>
                            <div className="text-xl font-bold text-gray-900">{item.value}</div>
                          </Card>
                        ))}
                      </div>
                      <div className="grid lg:grid-cols-4 gap-4">
                        {[
                          ['Mes', requestsDashboard.charts.by_month],
                          ['Tipo', requestsDashboard.charts.by_type],
                          ['Área', requestsDashboard.charts.by_area],
                          ['Sede', requestsDashboard.charts.by_branch],
                        ].map(([label, data]) => (
                          <Card key={label as string} className="p-4">
                            <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-gray-900">
                              <BarChart3 size={14} />
                              Por {label as string}
                            </div>
                            <div className="space-y-2">
                              {(data as Array<{ label: string; value: number }>).slice(0, 5).map((item) => (
                                <div key={item.label} className="text-xs">
                                  <div className="flex justify-between mb-1 text-gray-600">
                                    <span>{item.label}</span>
                                    <span>{item.value}</span>
                                  </div>
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-[#2a4038]" style={{ width: `${Math.min(item.value * 12, 100)}%` }} />
                                  </div>
                                </div>
                              ))}
                              {(data as Array<{ label: string; value: number }>).length === 0 && (
                                <p className="text-[11px] text-gray-400">Sin datos para los filtros aplicados.</p>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                      {requestsDashboard.charts.by_employee.length > 0 && (
                        <Card className="p-4">
                          <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-gray-900">
                            <Users size={14} />
                            Solicitudes por empleado
                          </div>
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {requestsDashboard.charts.by_employee.map((item) => (
                              <button
                                key={item.employee_id}
                                type="button"
                                onClick={() => setVacationFilterEmployee(item.employee_id)}
                                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors text-left"
                                title="Filtrar solicitudes de este empleado"
                              >
                                <span className="text-xs text-gray-700 truncate">{item.label}</span>
                                <span className="text-xs font-bold text-[#2a4038] flex-shrink-0">{item.value}</span>
                              </button>
                            ))}
                          </div>
                        </Card>
                      )}
                    </div>
                  )}
                </>
              )}

              {vacationLoading && <LoadingState label="Cargando solicitudes..." />}
              {!vacationLoading && filteredVacationRequestsCount > 0 && (
                <ResultsCount count={filteredVacationRequestsCount} label={filteredVacationRequestsCount === 1 ? 'solicitud encontrada' : 'solicitudes encontradas'} />
              )}
              {!vacationLoading && (
              <Table scrollable>
                  <thead>
                    <tr>
                      <Th>Empleado</Th>
                      <Th>Tipo</Th>
                      <Th>Fechas</Th>
                      <Th>Motivo</Th>
                      <Th>Remunerado</Th>
                      <Th>Estado</Th>
                      <Th>Acciones</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVacationRequests.map((request) => {
                      const employee = employeeById.get(request.employee);
                      const canManageThisRequest = request.request_type !== 'LOAN' || canManageLoans;
                      const canResolveThisRequest =
                        canManageThisRequest &&
                        ['PENDING', 'IN_REVIEW', 'PENDING_HR', 'PENDING_ADMIN'].includes(request.status);
                      const employeeDisplayName = employee ? getEmployeeName(employee) : request.employee;
                      const RequestTypeIcon = REQUEST_TYPE_ICONS[request.request_type];
                      return (
                        <tr key={request.id} className="hover:bg-gray-50/50">
                          <Td>
                            <div className="flex items-center gap-2.5">
                              <EmployeeAvatar employee={employee} name={employeeDisplayName} />
                              <div className="min-w-0">
                                <div className="font-medium text-gray-900 truncate">{employeeDisplayName}</div>
                                <div className="text-gray-400 text-[11px] mt-0.5">{employee?.employee_code ?? 'Sin código'}</div>
                              </div>
                            </div>
                          </Td>
                          <Td>
                            <div className="flex items-center gap-1.5">
                              <RequestTypeIcon size={13} className="text-gray-400 flex-shrink-0" />
                              <span>{getRequestTypeLabel(request.request_type, request.subtype)}</span>
                            </div>
                            <div className="text-gray-400 text-[11px] mt-1 pl-[19px]">{getRequestSubtypeLabel(request.subtype)}</div>
                          </Td>
                          <Td>
                            <div className="flex items-center gap-1.5">
                              <CalendarDays size={13} className="text-gray-400 flex-shrink-0" />
                              {canManageAccessCredentials && request.request_type !== 'LOAN' && CORRECTABLE_STATUSES.includes(request.status) ? (
                                <button
                                  onClick={() => openCorrectScheduleModal(request)}
                                  className="text-left hover:underline decoration-dotted underline-offset-2 hover:text-[#2a4038] transition-colors"
                                  title="Editar fecha/hora"
                                >
                                  {getRequestScheduleLabel(request)}
                                </button>
                              ) : (
                                <span>{getRequestScheduleLabel(request)}</span>
                              )}
                            </div>
                          </Td>
                          <Td className="max-w-xs">
                            {request.reason ? (
                              <button
                                onClick={() => openRequestDetailModal(request)}
                                className="text-left group"
                                title="Ver motivo completo"
                              >
                                <span className="line-clamp-2 text-gray-700 group-hover:text-gray-900">{request.reason}</span>
                                {request.reason.length > 80 && (
                                  <span className="block text-[11px] font-semibold text-[#2a4038] group-hover:underline mt-0.5">Ver más</span>
                                )}
                              </button>
                            ) : (
                              <span className="text-gray-400">Sin motivo</span>
                            )}
                          </Td>
                          <Td><Badge label={getRequestRemunerationLabel(request)} color={getRequestRemunerationBadgeColor(request)} /></Td>
                          <Td><Badge label={requestStatusLabel(request.status)} color={statusBadge(request.status)} /></Td>
                          <Td className={actionsCellCls} onClick={(e) => e.stopPropagation()}>
                            <ActionsMenu
                              items={[
                                { label: 'Ver detalle', icon: Eye, onClick: () => openRequestDetailModal(request) },
                                { label: 'Ver PDF', icon: FileDown, onClick: () => void handleVacationPdf(request) },
                                ...(request.support_document ? [
                                  { label: 'Ver soporte adjunto', icon: Paperclip, onClick: () => window.open(getMediaUrl(request.support_document!), '_blank', 'noopener,noreferrer') },
                                  { label: 'Descargar soporte', icon: Download, onClick: () => {
                                    const link = document.createElement('a');
                                    link.href = getMediaUrl(request.support_document!);
                                    link.download = getSupportDocumentName(request.support_document!);
                                    link.click();
                                  } },
                                ] : []),
                                ...(canManageAccessCredentials && canManageThisRequest ? [{
                                  label: 'Editar',
                                  icon: Edit2,
                                  onClick: () => openEditRequestModal(request),
                                }] : []),
                                ...(canManageAccessCredentials && request.request_type !== 'LOAN' ? [{
                                  label: 'Corregir fecha/hora',
                                  icon: CalendarClock,
                                  onClick: () => openCorrectScheduleModal(request),
                                  disabled: !CORRECTABLE_STATUSES.includes(request.status),
                                }] : []),
                                ...(isAdmin && !['LOAN', 'OVERTIME', 'SCHEDULE_CHANGE', 'LABOR_CERTIFICATE'].includes(request.request_type) && request.is_remunerated === null ? [{
                                  label: 'Definir remuneración',
                                  icon: Wallet,
                                  onClick: () => openRemunerationModal(request),
                                }] : []),
                                ...(canManageThisRequest ? [{
                                  label: 'Aprobar',
                                  icon: Check,
                                  onClick: () => handleVacationAction(request, 'approve'),
                                  disabled: !canResolveThisRequest || vacationActionId === request.id,
                                },
                                {
                                  label: 'Rechazar',
                                  icon: XCircle,
                                  onClick: () => handleVacationAction(request, 'reject'),
                                  disabled: !canResolveThisRequest || vacationActionId === request.id,
                                }] : []),
                                ...(canDeleteRequest ? [{
                                  label: 'Eliminar solicitud',
                                  icon: Trash2,
                                  onClick: () => handleDeleteVacationRequest(request),
                                  disabled: deletingVacationId === request.id,
                                  danger: true,
                                }] : []),
                              ]}
                            />
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
            </Table>
              )}
              {!vacationLoading && filteredVacationRequestsCount > 0 && (
                <Pagination
                  currentPage={vacationPage}
                  totalPages={vacationTotalPages}
                  totalItems={filteredVacationRequestsCount}
                  itemsPerPage={vacationPageSize}
                  itemsPerPageOptions={PAGE_SIZE_OPTIONS}
                  onPageChange={setVacationPage}
                  onItemsPerPageChange={setVacationPageSize}
                />
              )}
              {!vacationLoading && filteredVacationRequestsCount === 0 && (
                <EmptyState title="No hay solicitudes para mostrar" />
              )}
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                  <button
                    type="button"
                    onClick={() => setCalendarView('requests')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${calendarView === 'requests' ? 'bg-white text-[#2a4038] shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <CalendarClock size={13} />
                    Novedades
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarView('birthdays')}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${calendarView === 'birthdays' ? 'bg-white text-[#2a4038] shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    <Cake size={13} />
                    Cumpleaños
                  </button>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <CalendarMonthNav month={calendarMonth} onChange={setCalendarMonth} />
                  {calendarView === 'requests' && (
                    <button
                      type="button"
                      onClick={() => void handleCalendarPdfExport()}
                      disabled={exportingCalendarPdf}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    >
                      {exportingCalendarPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                      {exportingCalendarPdf ? 'Generando...' : 'Exportar calendario PDF'}
                    </button>
                  )}
                </div>
              </div>

              {calendarView === 'requests' && (
                <>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={calendarTypeFilter}
                      onChange={(event) => setCalendarTypeFilter(event.target.value as VacationRequestType | 'all')}
                      className={selectCls}
                    >
                      <option value="all">Todos los tipos</option>
                      <option value="VACATION">Vacaciones</option>
                      <option value="PERMISSION">Permisos</option>
                      <option value="OVERTIME">Horas extras</option>
                      <option value="LEAVE">Licencias</option>
                      <option value="INCAPACITY">Incapacidades</option>
                      <option value="OTHER">Otro</option>
                    </select>
                    <select
                      value={calendarDepartmentFilter}
                      onChange={(event) => setCalendarDepartmentFilter(event.target.value)}
                      className={selectCls}
                    >
                      <option value="all">Todos los departamentos</option>
                      {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                  </div>

                  <Card className="p-4">
                    <MonthCalendar
                      month={calendarMonth}
                      renderDay={(date) => {
                        const events = calendarEventsByDay.get(toDateKey(date)) ?? [];
                        const visible = events.slice(0, 2);
                        const remaining = events.length - visible.length;
                        return (
                          <>
                            {visible.map(({ request, employee }) => (
                              <CalendarChip
                                key={request.id}
                                label={`${employee ? getEmployeeName(employee) : 'Empleado'} · ${getRequestTypeLabel(request.request_type, request.subtype)}`}
                                color={REQUEST_TYPE_CALENDAR_COLOR[request.request_type]}
                                onClick={() => openRequestDetailModal(request)}
                              />
                            ))}
                            {remaining > 0 && (
                              <CalendarMoreChip count={remaining} onClick={() => setCalendarDayDetail(date)} />
                            )}
                          </>
                        );
                      }}
                    />
                  </Card>
                </>
              )}

              {calendarView === 'birthdays' && (
                <>
                  {upcomingBirthdays.length > 0 && (
                    <Card className="p-4">
                      <p className="text-xs font-semibold text-gray-900 mb-3">Próximos cumpleaños (30 días)</p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {upcomingBirthdays.map(({ employee, next, daysUntil, turningAge }) => (
                          <div key={employee.id} className="flex items-center gap-2 px-3 py-2 bg-pink-50 border border-pink-100 rounded-lg">
                            <Cake size={14} className="text-pink-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-900 truncate">{getEmployeeName(employee)}</p>
                              <p className="text-[10px] text-gray-500">
                                {next.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })} · cumple {turningAge} años
                                {daysUntil === 0 ? ' · ¡Hoy!' : ` · en ${daysUntil} día${daysUntil === 1 ? '' : 's'}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  <Card className="p-4">
                    <MonthCalendar
                      month={calendarMonth}
                      renderDay={(date) => {
                        const key = `${date.getMonth()}-${date.getDate()}`;
                        const people = birthdaysByDay.get(key) ?? [];
                        const visible = people.slice(0, 2);
                        const remaining = people.length - visible.length;
                        return (
                          <>
                            {visible.map((person) => (
                              <CalendarChip
                                key={person.id}
                                label={getEmployeeName(person)}
                                color="pink"
                              />
                            ))}
                            {remaining > 0 && (
                              <CalendarMoreChip count={remaining} onClick={() => setCalendarDayDetail(date)} />
                            )}
                          </>
                        );
                      }}
                    />
                  </Card>
                </>
              )}
            </div>
          )}

          {activeTab === 'orgchart' && (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Network size={15} className="text-gray-400" /> Organigrama</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Jerarquía de jefe inmediato → equipo, según los empleados activos.</p>
                  </div>
                  <div className="w-full sm:w-64">
                    <SearchBar value={orgChartSearch} onChange={setOrgChartSearch} placeholder="Buscar empleado en el árbol..." />
                  </div>
                </div>
                <OrgChart
                  roots={orgForest.roots}
                  unassigned={orgForest.unassigned}
                  positionById={positionById}
                  departmentById={departmentById}
                  searchQuery={orgChartSearch}
                />
              </Card>
            </div>
          )}
        </>
      )}
        </div>
      </div>

      {showEmployeeDetailModal && viewingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowEmployeeDetailModal(false)} />
          <div className="relative bg-white max-w-6xl w-full max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900">{getEmployeeName(viewingEmployee)}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Vista de consulta del expediente. Solo lectura.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setShowEmployeeDetailModal(false);
                    openEditModal(viewingEmployee);
                  }}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Editar
                </button>
                <button onClick={() => setShowEmployeeDetailModal(false)} className="p-2 rounded-lg hover:bg-gray-200">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="px-6 pt-4 border-b border-gray-100">
              <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1">
                {MODAL_TABS.filter((tab) => !['payroll', 'access'].includes(tab.id)).map((tab) => {
                  const Icon = tab.icon;
                  const active = employeeModalTab === tab.id;
                  return (
                    <button key={tab.id} type="button" onClick={() => setEmployeeModalTab(tab.id)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${active ? 'bg-white text-[#2a4038] shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>
                      <Icon size={12} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid md:grid-cols-4 gap-4 mb-5">
                <Card className="p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Perfil completado</div><div className="text-xl font-bold text-gray-900">{viewingEmployee.profile_completion_percentage}%</div></Card>
                <Card className="p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Pendientes</div><div className="text-xl font-bold text-gray-900">{viewingEmployee.pending_documents_count}</div></Card>
                <Card className="p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Vencidos</div><div className="text-xl font-bold text-gray-900">{viewingEmployee.expired_documents_count}</div></Card>
                <Card className="p-4"><div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Contrato restante</div><div className="text-xl font-bold text-gray-900">{viewingEmployee.remaining_contract_days == null ? 'Contrato indefinido' : `${viewingEmployee.remaining_contract_days} días`}</div></Card>
              </div>
              {renderReadOnlyEmployeeTab(viewingEmployee)}
            </div>
          </div>
        </div>
      )}

      <Modal title={viewingBranch ? `${viewingBranch.name}` : ''} open={showBranchDetailModal && Boolean(viewingBranch)} onClose={() => setShowBranchDetailModal(false)} wide>
        {viewingBranch && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">{viewingBranch.code} · {viewingBranch.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                ['Dirección', viewingBranch.address],
                ['Ciudad', viewingBranch.city],
                ['Departamento', viewingBranch.department],
                ['País', viewingBranch.country],
                ['Teléfono', viewingBranch.phone],
                ['Correo', viewingBranch.email],
                ['Responsable', viewingBranch.responsible_name],
                ['Empleados asignados', viewingBranch.employee_count],
                ['Departamentos asociados', viewingBranch.department_names?.join(', ')],
              ].map(([label, value]) => (
                <div key={label} className="border border-gray-100 rounded-xl p-4 bg-gray-50/60">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">{label}</div>
                  <div className="text-sm text-gray-700">{value || 'Sin registrar'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal title={viewingRequest ? `Solicitud ${viewingRequest.request_number ?? viewingRequest.id}` : ''} open={showRequestDetailModal && Boolean(viewingRequest)} onClose={() => setShowRequestDetailModal(false)} wide>
        {viewingRequest && (
          <div className="space-y-6">
            <p className="text-xs text-gray-500">{getRequestTypeLabel(viewingRequest.request_type, viewingRequest.subtype)} · {getRequestSubtypeLabel(viewingRequest.subtype)}</p>
            {(() => {
              const employee = employeeById.get(viewingRequest.employee);
              return (
                <div className="grid md:grid-cols-4 gap-4">
                  {[
                    ['Empleado', employee ? getEmployeeName(employee) : viewingRequest.employee],
                    ['Cargo', employee?.position ? positionById.get(employee.position)?.name : 'Sin cargo'],
                    ['Área', employee?.department ? departmentById.get(employee.department)?.name : 'Sin área'],
                    ['Estado', requestStatusLabel(viewingRequest.status)],
                    ['Fecha creación', parseDate(viewingRequest.created_at)],
                    [
                      'Fecha inicio',
                      viewingRequest.is_full_day || !viewingRequest.start_time
                        ? parseDate(viewingRequest.start_date)
                        : `${parseDate(viewingRequest.start_date)} · ${formatTime(viewingRequest.start_time)}`,
                    ],
                    [
                      'Fecha fin',
                      viewingRequest.is_full_day || !viewingRequest.end_time
                        ? parseDate(viewingRequest.end_date)
                        : `${parseDate(viewingRequest.end_date)} · ${formatTime(viewingRequest.end_time)}`,
                    ],
                    ['Días / horas', `${viewingRequest.days_count ?? 0} días · ${viewingRequest.hours_count ?? 0} horas`],
                    ...(viewingRequest.request_type !== 'LOAN' ? [[
                      'Remunerado',
                      viewingRequest.request_type === 'OVERTIME'
                        ? 'Remunerado'
                        : viewingRequest.is_remunerated === null ? 'Pendiente por definir' : viewingRequest.is_remunerated ? 'Remunerado' : 'No remunerado',
                    ]] : []),
                  ].map(([label, value]) => (
                    <div key={label} className="border border-gray-100 rounded-xl p-4 bg-gray-50/60">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">{label}</div>
                      <div className="text-sm text-gray-700">{value || 'Sin registrar'}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            {viewingRequest.request_type === 'LOAN' && (
              <Card className="p-4">
                <div className="text-sm font-semibold text-gray-900 mb-3">Datos del préstamo</div>
                <div className="grid md:grid-cols-4 gap-4 text-xs">
                  {[
                    ['Solicitante', viewingRequest.loan_requester_name || '—'],
                    ['Cédula', viewingRequest.loan_requester_document || '—'],
                    ['Ciudad', viewingRequest.loan_city || '—'],
                    ['Cargo', viewingRequest.loan_position || '—'],
                    ['Concepto', viewingRequest.loan_concept || '—'],
                    ['Monto solicitado', viewingRequest.loan_amount ? `$${Number(viewingRequest.loan_amount).toLocaleString('es-CO')}` : '—'],
                    ['Monto aprobado', viewingRequest.loan_approved_amount ? `$${Number(viewingRequest.loan_approved_amount).toLocaleString('es-CO')}` : '—'],
                    ['Forma de pago', viewingRequest.loan_frequency === 'MONTHLY' ? 'Mensual' : viewingRequest.loan_frequency === 'BIWEEKLY' ? 'Quincenal' : '—'],
                    ['Cuotas', viewingRequest.loan_installments_count ?? '—'],
                    ['Número de egreso', viewingRequest.loan_expense_number || '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">{label}</div>
                      <div className="text-gray-700">{value}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {viewingRequest.request_type === 'OVERTIME' && (
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="text-sm font-semibold text-gray-900">Horario de horas extra</div>
                  <Badge label={`${Number(viewingRequest.hours_count ?? 0).toFixed(1)} h`} color="blue" />
                </div>
                {viewingRequest.overtime_shifts?.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
                          <th className="py-2 pr-3">Fecha</th>
                          <th className="py-2 pr-3">Desde</th>
                          <th className="py-2 pr-3">Hasta</th>
                          <th className="py-2 pr-3">Horas</th>
                          <th className="py-2 pr-3">Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...viewingRequest.overtime_shifts]
                          .sort((left, right) => `${left.date} ${left.start_time}`.localeCompare(`${right.date} ${right.start_time}`))
                          .map((shift) => (
                            <tr key={shift.id} className="border-b border-gray-50">
                              <td className="py-2 pr-3 whitespace-nowrap">{parseDate(shift.date)}</td>
                              <td className="py-2 pr-3 font-mono">{formatTime(shift.start_time)}</td>
                              <td className="py-2 pr-3 font-mono">{formatTime(shift.end_time)}</td>
                              <td className="py-2 pr-3 font-semibold">{Number(shift.hours_count ?? 0).toFixed(1)} h</td>
                              <td className="py-2 pr-3 text-gray-500">{shift.notes || '—'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase text-gray-400">Fecha</div>
                      <div className="text-gray-700">{parseDate(viewingRequest.start_date)}</div>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase text-gray-400">Desde</div>
                      <div className="font-mono text-gray-700">{viewingRequest.start_time ? formatTime(viewingRequest.start_time) : '—'}</div>
                    </div>
                    <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
                      <div className="text-[10px] font-semibold uppercase text-gray-400">Hasta</div>
                      <div className="font-mono text-gray-700">{viewingRequest.end_time ? formatTime(viewingRequest.end_time) : '—'}</div>
                    </div>
                  </div>
                )}
              </Card>
            )}
            {(viewingRequest.request_type === 'SCHEDULE_CHANGE' || viewingRequest.subtype === 'SCHEDULE_CHANGE') && viewingRequest.requested_work_schedule_days?.length > 0 && (
              <Card className="p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="text-sm font-semibold text-gray-900">Horario solicitado</div>
                  <Badge label={`${requestScheduleWeeklyHours(viewingRequest).toFixed(1)} h laborales/semana`} color={requestScheduleWeeklyHours(viewingRequest) === 42 ? 'green' : 'yellow'} />
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                  {[...viewingRequest.requested_work_schedule_days]
                    .sort((a, b) => a.weekday - b.weekday)
                    .map((day) => (
                      <div key={`${day.weekday}-${day.slot ?? 1}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2">
                        <span className="font-medium text-gray-700">{['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][day.weekday]}</span>
                        <span className="font-mono text-gray-500">{day.expected_start_time.slice(0, 5)} - {day.expected_end_time.slice(0, 5)}</span>
                      </div>
                    ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-2">El total descuenta automáticamente 1 hora de almuerzo por día laboral.</p>
              </Card>
            )}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="p-4"><div className="text-sm font-semibold text-gray-900 mb-2">Motivo</div><p className="text-xs text-gray-500">{viewingRequest.reason || 'Sin motivo'}</p></Card>
              <Card className="p-4"><div className="text-sm font-semibold text-gray-900 mb-2">Descripción</div><p className="text-xs text-gray-500">{viewingRequest.description || 'Sin descripción'}</p></Card>
              <Card className="p-4"><div className="text-sm font-semibold text-gray-900 mb-2">Observaciones</div><p className="text-xs text-gray-500">{viewingRequest.observations || 'Sin observaciones'}</p></Card>
            </div>
            <div className="flex justify-end">
              <button onClick={() => handleVacationPdf(viewingRequest)} className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Descargar documento (PDF)
              </button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="text-sm font-semibold text-gray-900 mb-2">Decisión del Administrador</div>
                {viewingRequest.admin_decision ? (
                  <div className="text-xs space-y-1">
                    <Badge label={requestStatusLabel(viewingRequest.admin_decision as VacationRequestStatus)} color={statusBadge(viewingRequest.admin_decision)} />
                    <div className="text-gray-400 mt-1">{parseDate(viewingRequest.admin_decided_at)}</div>
                    <div className="text-gray-500">{viewingRequest.admin_comment || 'Sin comentario'}</div>
                  </div>
                ) : <div className="text-xs text-gray-400">Aún no se ha resuelto.</div>}
              </Card>
              <Card className="p-4">
                <div className="text-sm font-semibold text-gray-900 mb-2">Decisión de Recursos Humanos</div>
                {viewingRequest.hr_decision ? (
                  <div className="text-xs space-y-1">
                    <Badge label={requestStatusLabel(viewingRequest.hr_decision as VacationRequestStatus)} color={statusBadge(viewingRequest.hr_decision)} />
                    <div className="text-gray-400 mt-1">{parseDate(viewingRequest.hr_decided_at)}</div>
                    <div className="text-gray-500">{viewingRequest.hr_comment || 'Sin comentario'}</div>
                  </div>
                ) : <div className="text-xs text-gray-400">Aún no se ha resuelto.</div>}
              </Card>
            </div>
            <Card className="p-4">
              <div className="text-sm font-semibold text-gray-900 mb-3">Flujo de aprobación</div>
              <div className="grid md:grid-cols-4 gap-3">
                {viewingRequest.approval_steps.map((step) => {
                  // El paso "Jefe inmediato" nace ya resuelto (sin pedir firma) cuando
                  // ese jefe es el mismo Administrador: su firma real queda en el paso
                  // de Aprobación final, no tiene sentido pedirle una segunda firma.
                  const isManagerNotApplicable = step.step === 'MANAGER' && step.status === 'CANCELLED' && !step.acted_at;
                  return (
                    <div key={step.id} className="border border-gray-100 rounded-xl p-3 text-xs">
                      <div className="font-medium text-gray-900">{approvalStepLabel(step.step)}</div>
                      <div className="inline-block mt-2">
                        {isManagerNotApplicable ? (
                          <Badge label="No aplica" color="gray" />
                        ) : (
                          <Badge label={requestStatusLabel(step.status)} color={statusBadge(step.status)} />
                        )}
                      </div>
                      <div className="text-gray-400 mt-2">{parseDate(step.acted_at)}</div>
                      <div className="text-gray-400">{step.comment || 'Sin comentario'}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="text-sm font-semibold text-gray-900 mb-3">Adjuntos</div>
                <div className="space-y-2">
                  {viewingRequest.support_document && <a href={getMediaUrl(viewingRequest.support_document)} target="_blank" rel="noreferrer" className="block text-xs text-[#2a4038] underline">Soporte principal</a>}
                  {viewingRequest.attachments.map((attachment) => <a key={attachment.id} href={getMediaUrl(attachment.file)} target="_blank" rel="noreferrer" className="block text-xs text-[#2a4038] underline">{attachment.name}</a>)}
                  {!viewingRequest.support_document && viewingRequest.attachments.length === 0 && <div className="text-xs text-gray-400">Sin adjuntos</div>}
                </div>
              </Card>
              <Card className="p-4">
                <div className="text-sm font-semibold text-gray-900 mb-3">Historial</div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {viewingRequest.history.map((item) => (
                    <div key={item.id} className="text-xs border-b border-gray-100 pb-2">
                      <div className="font-medium text-gray-900">{getHistoryActionLabel(item)}</div>
                      {item.old_status !== item.new_status && (
                        <div className="text-gray-400">
                          {item.old_status ? requestStatusLabel(item.old_status as VacationRequestStatus) : 'Inicio'} → {item.new_status ? requestStatusLabel(item.new_status as VacationRequestStatus) : 'Sin cambio'}
                        </div>
                      )}
                      <div className="text-gray-400">{item.comment || 'Sin comentario'} · {parseDate(item.created_at)}</div>
                    </div>
                  ))}
                  {viewingRequest.history.length === 0 && <div className="text-xs text-gray-400">Sin historial</div>}
                </div>
              </Card>
            </div>
          </div>
        )}
      </Modal>

      <Modal title="Rechazar solicitud" open={showRejectModal && Boolean(rejectingRequest)} onClose={closeRejectModal}>
        <div className="space-y-4">
          <p className="text-xs text-gray-500">Indica el motivo del rechazo. Este comentario quedará registrado en la solicitud.</p>
          <TextareaInput label="Motivo del rechazo" value={rejectReason} onChange={setRejectReason} />
          <div className="pt-2 border-t border-gray-100">
            <SignaturePad
              label="Tu firma para este rechazo"
              helperText="Se usará tu firma guardada por defecto. Si quieres firmar distinto solo para esta solicitud, dibuja o sube una firma aquí."
              onChange={setDecisionSignatureFile}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={closeRejectModal} className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={confirmRejectVacation}
              disabled={!rejectReason.trim() || (rejectingRequest ? vacationActionId === rejectingRequest.id : false)}
              className="px-4 py-2 bg-red-500 rounded-lg text-xs font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-40"
            >
              Rechazar solicitud
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        title={calendarDayDetail ? calendarDayDetail.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Detalle del día'}
        open={Boolean(calendarDayDetail)}
        onClose={() => setCalendarDayDetail(null)}
      >
        {calendarDayDetail && calendarView === 'requests' && (
          <div className="space-y-2">
            {(calendarEventsByDay.get(toDateKey(calendarDayDetail)) ?? []).map(({ request, employee }) => (
              <button
                key={request.id}
                onClick={() => {
                  setCalendarDayDetail(null);
                  openRequestDetailModal(request);
                }}
                className="w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-900 truncate">{employee ? getEmployeeName(employee) : 'Empleado'}</p>
                  <p className="text-[10px] text-gray-400">{getRequestTypeLabel(request.request_type, request.subtype)} · {requestStatusLabel(request.status)}</p>
                </div>
                <Badge label={requestStatusLabel(request.status)} color={statusBadge(request.status)} />
              </button>
            ))}
          </div>
        )}
        {calendarDayDetail && calendarView === 'birthdays' && (
          <div className="space-y-2">
            {(birthdaysByDay.get(`${calendarDayDetail.getMonth()}-${calendarDayDetail.getDate()}`) ?? []).map((person) => (
              <div key={person.id} className="flex items-center gap-2 px-3 py-2.5 border border-gray-100 rounded-lg">
                <Cake size={14} className="text-pink-500 flex-shrink-0" />
                <p className="text-xs font-semibold text-gray-900">{getEmployeeName(person)}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal title="Aprobar solicitud" open={showApproveModal && Boolean(approvingRequest)} onClose={closeApproveModal}>
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Vas a aprobar la solicitud {approvingRequest?.request_number || ''}. Esta acción quedará registrada en el historial.
          </p>
          <TextareaInput
            label="Comentario para el solicitante"
            value={approveComment}
            onChange={setApproveComment}
            placeholder="Comentario opcional que verá el empleado"
          />
          {isAdmin && approvingRequest && !['LOAN', 'OVERTIME', 'SCHEDULE_CHANGE', 'LABOR_CERTIFICATE'].includes(approvingRequest.request_type) && (
            approvingRequest?.is_remunerated === null ? (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">
                  ¿Es remunerado?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setApproveIsRemunerated(true)}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      approveIsRemunerated ? 'border-[#2a4038] bg-[#2a4038]/5 text-[#2a4038]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Sí, remunerado
                  </button>
                  <button
                    type="button"
                    onClick={() => setApproveIsRemunerated(false)}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      !approveIsRemunerated ? 'border-[#2a4038] bg-[#2a4038]/5 text-[#2a4038]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    No remunerado
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-gray-400">
                  Puedes definirlo aquí o después desde el menú de la solicitud. Una vez guardado, no se puede modificar.
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400">
                Remuneración ya definida: <span className="font-semibold text-gray-600">{approvingRequest?.is_remunerated ? 'Remunerado' : 'No remunerado'}</span> (bloqueada, no se puede cambiar).
              </p>
            )
          )}
          <SignaturePad
            label="Tu firma para esta aprobación"
            helperText="Se usará tu firma guardada por defecto. Si quieres firmar distinto solo para esta solicitud, dibuja o sube una firma aquí."
            onChange={setDecisionSignatureFile}
          />
          <div className="flex justify-end gap-2">
            <button onClick={closeApproveModal} className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={confirmApproveVacation}
              disabled={approvingRequest ? vacationActionId === approvingRequest.id : false}
              className="px-4 py-2 bg-emerald-600 rounded-lg text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-40"
            >
              Aprobar solicitud
            </button>
          </div>
        </div>
      </Modal>

      <Modal title="Editar solicitud" open={Boolean(editingRequest)} onClose={closeEditRequestModal}>
        {editingRequest && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Edita el motivo, la descripción o las observaciones de la solicitud {editingRequest.request_number || ''}.
            </p>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Motivo</label>
              <textarea
                value={editingRequestForm.reason}
                onChange={(event) => setEditingRequestForm({ ...editingRequestForm, reason: event.target.value })}
                rows={3}
                className={inputCls + ' resize-none'}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Descripción</label>
              <textarea
                value={editingRequestForm.description}
                onChange={(event) => setEditingRequestForm({ ...editingRequestForm, description: event.target.value })}
                rows={3}
                className={inputCls + ' resize-none'}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Observaciones</label>
              <textarea
                value={editingRequestForm.observations}
                onChange={(event) => setEditingRequestForm({ ...editingRequestForm, observations: event.target.value })}
                rows={3}
                className={inputCls + ' resize-none'}
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Comentario para el historial (opcional)</label>
              <textarea
                value={editingRequestComment}
                onChange={(event) => setEditingRequestComment(event.target.value)}
                placeholder="Ej: el empleado pidió corregir el motivo por error de digitación"
                rows={2}
                className={inputCls + ' resize-none'}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeEditRequestModal} className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => void handleSaveRequestEdit()}
                disabled={savingRequestEdit}
                className="px-4 py-2 bg-[#2a4038] rounded-lg text-xs font-semibold text-white hover:bg-[#3d5c4e] transition-colors disabled:opacity-40"
              >
                {savingRequestEdit ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal title="Definir remuneración" open={Boolean(remunerationRequest)} onClose={closeRemunerationModal}>
        {remunerationRequest && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Vas a definir si la solicitud {remunerationRequest.request_number || ''} es remunerada o no. Esta decisión queda bloqueada de forma permanente una vez guardada — no podrás cambiarla después.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRemunerationValue(true)}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  remunerationValue ? 'border-[#2a4038] bg-[#2a4038]/5 text-[#2a4038]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Sí, remunerado
              </button>
              <button
                type="button"
                onClick={() => setRemunerationValue(false)}
                className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  !remunerationValue ? 'border-[#2a4038] bg-[#2a4038]/5 text-[#2a4038]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                No remunerado
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeRemunerationModal} className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => void confirmSetRemuneration()}
                disabled={savingRemuneration}
                className="px-4 py-2 bg-[#2a4038] rounded-lg text-xs font-semibold text-white hover:bg-[#3d5c4e] transition-colors disabled:opacity-40"
              >
                {savingRemuneration ? 'Guardando...' : 'Guardar decisión'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal title="Corregir fecha/hora" open={Boolean(correctingRequest)} onClose={closeCorrectScheduleModal}>
        {correctingRequest && correctingRequest.request_type === 'OVERTIME' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Corrige los turnos de horas extra de la solicitud {correctingRequest.request_number || ''}. El total de horas y el rango de fechas se recalculan automáticamente. El cambio queda registrado en el historial, incluso si la solicitud ya fue aprobada.
            </p>

            <div className="space-y-3">
              {correctingShifts.map((shift, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Turno {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => setCorrectingShifts(correctingShifts.filter((_, i) => i !== index))}
                      className="text-[11px] font-semibold text-red-600 hover:underline"
                    >
                      Quitar
                    </button>
                  </div>
                  <TextInput
                    label="Fecha"
                    type="date"
                    value={shift.date}
                    onChange={(value) => setCorrectingShifts(correctingShifts.map((s, i) => (i === index ? { ...s, date: value } : s)))}
                  />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <TextInput
                      label="Hora inicio"
                      type="time"
                      value={shift.start_time}
                      onChange={(value) => setCorrectingShifts(correctingShifts.map((s, i) => (i === index ? { ...s, start_time: value } : s)))}
                    />
                    <TextInput
                      label="Hora fin"
                      type="time"
                      value={shift.end_time}
                      onChange={(value) => setCorrectingShifts(correctingShifts.map((s, i) => (i === index ? { ...s, end_time: value } : s)))}
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setCorrectingShifts([...correctingShifts, { date: correctingRequest.start_date, start_time: '', end_time: '', notes: '' }])}
                className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                + Agregar turno
              </button>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Comentario para el historial (opcional)</label>
              <textarea
                value={correctingScheduleComment}
                onChange={(event) => setCorrectingScheduleComment(event.target.value)}
                placeholder="Ej: el empleado avisó que salió una hora después"
                rows={2}
                className={inputCls + ' resize-none'}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={closeCorrectScheduleModal} className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => void handleSaveScheduleCorrection()}
                disabled={savingScheduleCorrection}
                className="px-4 py-2 bg-[#2a4038] rounded-lg text-xs font-semibold text-white hover:bg-[#3d5c4e] transition-colors disabled:opacity-40"
              >
                {savingScheduleCorrection ? 'Guardando...' : 'Guardar corrección'}
              </button>
            </div>
          </div>
        )}
        {correctingRequest && correctingRequest.request_type !== 'OVERTIME' && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Corrige la fecha/hora que digitó el empleado en la solicitud {correctingRequest.request_number || ''}. El cambio queda registrado en el historial, incluso si la solicitud ya fue aprobada.
            </p>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Duración</label>
              <select
                value={correctingSchedule.period_mode}
                onChange={(event) => setCorrectingSchedule({ ...correctingSchedule, period_mode: event.target.value as 'SINGLE_DAY' | 'DATE_RANGE' })}
                className={selectCls}
              >
                <option value="SINGLE_DAY">Un solo día</option>
                <option value="DATE_RANGE">Varios días</option>
              </select>
            </div>

            {correctingSchedule.period_mode === 'SINGLE_DAY' ? (
              <TextInput
                label="Fecha"
                type="date"
                value={correctingSchedule.single_date}
                onChange={(value) => setCorrectingSchedule({ ...correctingSchedule, single_date: value })}
              />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                <TextInput
                  label="Fecha inicio"
                  type="date"
                  value={correctingSchedule.start_date}
                  onChange={(value) => setCorrectingSchedule({ ...correctingSchedule, start_date: value })}
                />
                <TextInput
                  label="Fecha fin"
                  type="date"
                  value={correctingSchedule.end_date}
                  onChange={(value) => setCorrectingSchedule({ ...correctingSchedule, end_date: value })}
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={correctingSchedule.is_full_day}
                onChange={(event) => setCorrectingSchedule({ ...correctingSchedule, is_full_day: event.target.checked })}
                className="accent-[#2a4038]"
              />
              Jornada completa (sin horario específico)
            </label>

            {!correctingSchedule.is_full_day && (
              <div className="grid sm:grid-cols-2 gap-4">
                <TextInput
                  label="Hora inicio"
                  type="time"
                  value={correctingSchedule.start_time}
                  onChange={(value) => setCorrectingSchedule({ ...correctingSchedule, start_time: value })}
                />
                <TextInput
                  label="Hora fin"
                  type="time"
                  value={correctingSchedule.end_time}
                  onChange={(value) => setCorrectingSchedule({ ...correctingSchedule, end_time: value })}
                />
              </div>
            )}

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5 block">Comentario para el historial (opcional)</label>
              <textarea
                value={correctingScheduleComment}
                onChange={(event) => setCorrectingScheduleComment(event.target.value)}
                placeholder="Ej: el empleado avisó que salió una hora después"
                rows={2}
                className={inputCls + ' resize-none'}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={closeCorrectScheduleModal} className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => void handleSaveScheduleCorrection()}
                disabled={savingScheduleCorrection}
                className="px-4 py-2 bg-[#2a4038] rounded-lg text-xs font-semibold text-white hover:bg-[#3d5c4e] transition-colors disabled:opacity-40"
              >
                {savingScheduleCorrection ? 'Guardando...' : 'Guardar corrección'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal title="Certificado laboral" open={showCertificateModal && Boolean(certificateEmployee)} onClose={closeCertificateModal}>
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Vas a generar el certificado laboral de {certificateEmployee ? getEmployeeName(certificateEmployee) : ''}. Se emitirá con la firma digital vigente este mes de Administrador o Recursos Humanos.
          </p>

          {certificateNeedsSignature && (
            <div className="p-4 border border-amber-200 bg-amber-50 rounded-xl space-y-3">
              <p className="text-xs text-amber-800">
                Aún no hay una firma digital vigente este mes. Dibuja o sube tu firma aquí para habilitarla y generar el certificado.
              </p>
              <SignaturePad onChange={setCertificateSignatureFile} label="Tu firma digital" />
              <button
                type="button"
                onClick={handleSaveCertificateSignature}
                disabled={!certificateSignatureFile || savingCertificateSignature}
                className="px-4 py-2 bg-[#2a4038] text-white rounded-lg text-xs font-semibold hover:bg-[#3d5c4e] disabled:opacity-40 transition-colors"
              >
                {savingCertificateSignature ? 'Guardando firma...' : 'Guardar firma'}
              </button>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={closeCertificateModal} className="px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleEmployeeCertificatePdfExport}
              disabled={certificateEmployee ? exportingCertificateId === certificateEmployee.id : false}
              className="px-4 py-2 bg-[#2a4038] rounded-lg text-xs font-semibold text-white hover:bg-[#3d5c4e] transition-colors disabled:opacity-40"
            >
              {certificateEmployee && exportingCertificateId === certificateEmployee.id ? 'Generando...' : 'Generar certificado'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal title={editingBranch ? 'Editar sede' : 'Nueva sede'} open={showBranchModal} onClose={resetBranchModal} wide>
        <p className="text-xs text-gray-500 mb-4">Gestión independiente de sedes y sucursales.</p>
        <form onSubmit={handleBranchSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <TextInput label="Nombre" required value={branchForm.name} onChange={(value) => setBranchForm((current) => ({ ...current, name: value }))} />
            <TextInput label="NIT" value={branchForm.nit} onChange={(value) => setBranchForm((current) => ({ ...current, nit: value }))} />
            <div className="sm:col-span-2">
              <TextInput
                label="Razón social"
                value={branchForm.legal_name}
                onChange={(value) => setBranchForm((current) => ({ ...current, legal_name: value }))}
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Empresa/NIT propietario de esta sede. Se usa en documentos oficiales (ej. PDF de préstamos) de los
                empleados de esta sede. Si se deja vacío, se usa el nombre de la empresa por defecto.
              </p>
            </div>
            <div className="sm:col-span-2">
              <LocationPicker value={branchLocation} onChange={setBranchLocation} />
            </div>

            <div className="sm:col-span-2 relative" ref={branchSearchContainerRef}>
              <div className="relative flex items-center rounded-lg border border-gray-200 bg-white">
                <Search className="absolute left-3 w-4 h-4 text-gray-300" strokeWidth={1.5} />
                <input
                  type="text"
                  value={branchQuery}
                  disabled={!branchLocation.stateId}
                  onChange={(e) => { setBranchQuery(e.target.value); setBranchSuggestionsOpen(true); }}
                  onFocus={() => setBranchSuggestionsOpen(true)}
                  placeholder={branchLocation.stateId ? `Buscar dirección en ${branchLocation.stateName}` : 'Selecciona país y departamento primero'}
                  className="w-full pl-9 pr-8 py-2.5 bg-transparent text-sm text-gray-800 placeholder:text-gray-300 focus:outline-none rounded-lg disabled:cursor-not-allowed"
                />
                {branchSearching && <Loader2 className="absolute right-3 w-3.5 h-3.5 animate-spin text-gray-300" strokeWidth={1.5} />}
              </div>
              {branchSuggestionsOpen && branchSuggestions.length > 0 && (
                <div className="absolute z-[1100] left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {branchSuggestions.map((result) => (
                    <button
                      key={result.place_id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); void handleSelectBranchSuggestion(result); }}
                      className="w-full text-left px-3.5 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      {result.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <InteractiveLocationMap
                lat={branchForm.latitude ? Number(branchForm.latitude) : null}
                lng={branchForm.longitude ? Number(branchForm.longitude) : null}
                onMarkerMove={handleBranchMarkerMove}
                className="h-56 rounded-lg overflow-hidden border border-gray-200"
              />
            </div>

            {branchForm.address && (
              <div className="sm:col-span-2 flex items-start gap-2 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 leading-relaxed">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-[#2a4038]" strokeWidth={1.5} />
                <span className="flex-1">
                  {branchForm.address}
                  {branchReverseLoading && <Loader2 className="inline w-3 h-3 ml-1.5 animate-spin" strokeWidth={1.5} />}
                </span>
              </div>
            )}

            <div className="sm:col-span-2">
              <TextInput label="Dirección" value={branchForm.address} onChange={(value) => setBranchForm((current) => ({ ...current, address: value }))} />
            </div>

            <TextInput label="Teléfono" value={branchForm.phone} onChange={(value) => setBranchForm((current) => ({ ...current, phone: value }))} />
            <TextInput label="Correo" type="email" value={branchForm.email} onChange={(value) => setBranchForm((current) => ({ ...current, email: value }))} />
            <SelectInput label="Responsable" value={branchForm.responsible} onChange={(value) => setBranchForm((current) => ({ ...current, responsible: value }))} options={activeEmployees.map((employee) => ({ value: employee.id, label: getEmployeeName(employee) }))} emptyLabel="Sin responsable" />
            <SelectInput label="Estado" value={branchForm.status} onChange={(value) => setBranchForm((current) => ({ ...current, status: value as 'ACTIVE' | 'INACTIVE', is_active: value === 'ACTIVE' }))} options={[{ value: 'ACTIVE', label: 'Activa' }, { value: 'INACTIVE', label: 'Inactiva' }]} emptyLabel="Estado" />
          </div>
          <div className="flex gap-3 pt-4 border-t border-gray-100 mt-2">
            <button type="button" onClick={resetBranchModal} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={savingBranch} className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] disabled:opacity-50">{savingBranch ? 'Guardando...' : 'Guardar sede'}</button>
          </div>
        </form>
      </Modal>

      <Modal title="Asignar jefes inmediatos" open={showManagerAssignmentModal} onClose={() => setShowManagerAssignmentModal(false)} wide>
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)]">
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Sede</span>
              <select
                value={managerAssignmentBranch}
                onChange={(event) => {
                  setManagerAssignmentBranch(event.target.value);
                  setManagerAssignmentEmployeeIds([]);
                }}
                className={`${selectCls} w-full`}
              >
                <option value="all">Todas las sedes</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>{branch.name} · {branch.city || 'Sin ciudad'}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Buscar empleados</span>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  value={managerAssignmentSearch}
                  onChange={(event) => setManagerAssignmentSearch(event.target.value)}
                  placeholder="Nombre, documento, cargo, área o sede"
                  className={`${inputCls} w-full pl-9`}
                />
              </div>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
            <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
              <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Empleados a actualizar</p>
                  <p className="text-xs text-gray-500">{managerAssignmentEmployeeIds.length} seleccionados · {managerAssignmentEmployees.length} visibles</p>
                </div>
                <button
                  type="button"
                  onClick={toggleAllManagerAssignmentEmployees}
                  disabled={managerAssignmentEmployees.length === 0}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  <Check size={13} />
                  Seleccionar visibles
                </button>
              </div>
              <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-100">
                {managerAssignmentEmployees.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">No hay empleados activos con ese filtro.</div>
                ) : managerAssignmentEmployees.map((employee) => {
                  const branch = employee.branch ? branchById.get(employee.branch) : null;
                  const position = employee.position ? positionById.get(employee.position) : null;
                  const disabled = managerAssignmentManagerIdSet.has(employee.id);
                  return (
                    <label key={employee.id} className={`flex items-start gap-3 px-4 py-3 transition-colors ${disabled ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50 cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={managerAssignmentEmployeeIdSet.has(employee.id)}
                        onChange={() => toggleManagerAssignmentEmployee(employee.id)}
                        disabled={disabled}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-[#2a4038] focus:ring-[#2a4038]"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{getEmployeeName(employee)}</p>
                        <p className="text-xs text-gray-500">{position?.name ?? 'Sin cargo'} · {branch?.name ?? 'Sin sede'}</p>
                        <p className="text-[11px] text-gray-400">Actual: {getEmployeeManagerNames(employee, employeeById)}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">Jefes inmediatos</p>
                <p className="text-xs text-gray-500">{managerAssignmentManagerIds.length} seleccionados. Cualquiera puede firmar.</p>
              </div>
              <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-100">
                {activeEmployees.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">No hay empleados activos para elegir como jefe.</div>
                ) : [...activeEmployees]
                  .sort((left, right) => getEmployeeName(left).localeCompare(getEmployeeName(right), 'es'))
                  .map((employee) => {
                    const disabled = managerAssignmentEmployeeIdSet.has(employee.id);
                    const position = employee.position ? positionById.get(employee.position) : null;
                    return (
                      <label key={employee.id} className={`flex items-start gap-3 px-4 py-3 transition-colors ${disabled ? 'bg-gray-50 opacity-60' : 'hover:bg-gray-50 cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={managerAssignmentManagerIdSet.has(employee.id)}
                          onChange={() => toggleManagerAssignmentManager(employee.id)}
                          disabled={disabled}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-[#2a4038] focus:ring-[#2a4038]"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{getEmployeeName(employee)}</p>
                          <p className="text-xs text-gray-500">{position?.name ?? 'Sin cargo'}</p>
                        </div>
                      </label>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#2a4038]/15 bg-[#eef4f1] px-4 py-3">
            <p className="text-xs font-semibold text-[#2a4038]">
              Se reemplazarán los jefes de {managerAssignmentSelectedEmployees.length} empleado(s) por {managerAssignmentSelectedManagers.length} jefe(s).
            </p>
            <p className="mt-1 text-xs text-[#2a4038]/75">
              Jefes: {managerAssignmentSelectedManagers.map(getEmployeeName).join(', ') || 'Sin seleccionar'}
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setShowManagerAssignmentModal(false)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSaveManagerAssignments()}
              disabled={savingManagerAssignments || managerAssignmentEmployeeIds.length === 0 || managerAssignmentManagerIds.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2a4038] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#3d5c4e] disabled:opacity-50"
            >
              {savingManagerAssignments ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar asignación
            </button>
          </div>
        </div>
      </Modal>

      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={resetEmployeeModal} />
          <div className="relative bg-white max-w-6xl w-full max-h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-gray-900">{editingEmployee ? 'Editar empleado' : 'Nuevo empleado'}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Guarda como borrador sin documentos y completa el expediente por secciones.
                </p>
              </div>
              <button onClick={resetEmployeeModal} className="p-2 rounded-lg hover:bg-gray-200">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEmployeeSubmit} className="flex-1 overflow-hidden flex flex-col">
              <div className="px-6 pt-4 border-b border-gray-100">
                <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1">
                  {MODAL_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = employeeModalTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleEmployeeModalTabChange(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${active ? 'bg-white text-[#2a4038] shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        <Icon size={12} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                {editingEmployee && (
                  <div className="grid md:grid-cols-4 gap-4 mb-5">
                    <Card className="p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Perfil completado</div>
                      <div className="text-xl font-bold text-gray-900">{editingEmployee.profile_completion_percentage}%</div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Pendientes</div>
                      <div className="text-xl font-bold text-gray-900">{editingEmployee.pending_documents_count}</div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Vencidos</div>
                      <div className="text-xl font-bold text-gray-900">{editingEmployee.expired_documents_count}</div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Contrato restante</div>
                      <div className="text-xl font-bold text-gray-900">{editingEmployee.remaining_contract_days == null ? 'Contrato indefinido' : `${editingEmployee.remaining_contract_days} días`}</div>
                    </Card>
                  </div>
                )}
                {renderModalTab()}
              </div>

              <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={resetEmployeeModal} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={savingEmployee || savingDocument} className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e] disabled:opacity-50 flex items-center justify-center gap-2">
                  <Save size={14} />
                  {savingEmployee ? 'Guardando...' : editingEmployee ? 'Actualizar empleado' : 'Crear empleado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAccessReminderModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowAccessReminderModal(false)} />
          <div className="relative bg-white max-w-sm w-full rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100 text-amber-600">
                <KeyRound size={18} />
              </div>
              <h3 className="font-semibold text-gray-900">Credenciales de acceso</h3>
            </div>
            <p className="text-sm text-gray-600">
              Aún no has registrado las credenciales para este empleado, ¿quieres registrarlas antes de guardar o prefieres dejarlo para más tarde?
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleAccessReminderLater}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"
              >
                Más tarde
              </button>
              <button
                type="button"
                onClick={handleAccessReminderSetupNow}
                className="flex-1 py-2.5 bg-[#2a4038] text-white rounded-xl text-sm font-semibold hover:bg-[#3d5c4e]"
              >
                Sí
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

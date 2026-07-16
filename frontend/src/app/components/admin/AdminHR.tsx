import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarClock,
  Check,
  Clock3,
  Download,
  Edit2,
  FileDown,
  FileText,
  FileUp,
  HeartPulse,
  History,
  KeyRound,
  Landmark,
  Loader2,
  MapPin,
  Paperclip,
  Plus,
  Search,
  Save,
  ShieldCheck,
  Eye,
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
import { Badge, type BadgeColor, Card, Table, Th, Td, Modal, EmptyState, LoadingState, inputCls, selectCls, ActionsMenu, actionsCellCls } from './AdminUI';
import { ComboWithOtherInput } from './ComboWithOtherInput';
import { useToast } from '../../contexts/ToastContext';
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
  deleteEmployee,
  createBranch,
  deleteBranch,
  exportEmployeeProfilePdf,
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
  updateBranch,
  updateEmployee,
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
  createEmployeeDocument,
  updateEmployeeDocument,
  deleteEmployeeDocument,
  getEmployeeDocuments,
  getHRNotifications,
  getRequestsDashboard,
  getVacationRequests,
  openVacationRequestPdf,
  rejectVacationRequest,
  type EmployeeDocument,
  type EmployeeDocumentStatus,
  type EmployeeDocumentType,
  type HRNotification,
  type RequestsDashboard,
  type VacationRequest,
  type VacationRequestStatus,
} from '../../services/human-resources.service';
import { AdminStructure } from './AdminStructure';
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

type HRTab = 'employees' | 'branches' | 'catalog' | 'vacations';
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
  | 'labor'
  | 'social'
  | 'banking'
  | 'payroll'
  | 'emergency'
  | 'documents'
  | 'access'
  | 'history';

interface EmployeeFormState {
  user: string;
  user_role: UserRole | '';
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

const EMPTY_EMPLOYEE_FORM: EmployeeFormState = {
  user: '',
  user_role: '',
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

const MODAL_TABS: Array<{ id: EmployeeModalTab; label: string; icon: typeof Users }> = [
  { id: 'personal', label: 'Información Personal', icon: Users },
  { id: 'labor', label: 'Información Laboral', icon: Briefcase },
  { id: 'social', label: 'Seguridad Social', icon: ShieldCheck },
  { id: 'banking', label: 'Datos Bancarios', icon: Landmark },
  { id: 'payroll', label: 'Nómina', icon: Wallet },
  { id: 'emergency', label: 'Emergencia', icon: HeartPulse },
  { id: 'documents', label: 'Documentos', icon: FileText },
  { id: 'access', label: 'Acceso', icon: KeyRound },
  { id: 'history', label: 'Historial', icon: History },
];

function parseDate(value: string | null | undefined): string {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleDateString('es-CO');
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
      return !hasText(employee.manager);
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

function getRequestTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    PERMISSION: 'Permiso',
    OVERTIME: 'Horas extras',
    LEAVE: 'Licencia',
    INCAPACITY: 'Incapacidad',
    VACATION: 'Vacaciones',
    OTHER: 'Otro',
  };
  return labels[type] ?? type;
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
  return {
    ...(form.user ? { user: form.user } : {}),
    ...(form.user_role ? { user_role: form.user_role } : {}),
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
    manager: cleanNullable(form.manager),
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{label}{required && <span className="text-red-500 ml-1">*</span>}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputCls}
        placeholder={placeholder}
        disabled={disabled}
      />
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

export function TextareaInput({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
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
  const [branchSort, setBranchSort] = useState<'name' | 'code' | 'city' | 'status'>('name');
  const [branchPage, setBranchPage] = useState(1);
  const [branchPageSize, setBranchPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [employeePage, setEmployeePage] = useState(1);
  const [employeePageSize, setEmployeePageSize] = useState(DEFAULT_PAGE_SIZE);
  const [vacationPage, setVacationPage] = useState(1);
  const [vacationPageSize, setVacationPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [employeeSort, setEmployeeSort] = useState<'name' | 'department' | 'status' | 'profile'>('name');
  const [isLoading, setIsLoading] = useState(true);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [savingDocument, setSavingDocument] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [exportingEmployeesPdf, setExportingEmployeesPdf] = useState(false);
  const [exportingBranchesPdf, setExportingBranchesPdf] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<string | null>(null);
  const [exportingProfileId, setExportingProfileId] = useState<string | null>(null);
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
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [viewingBranch, setViewingBranch] = useState<Branch | null>(null);
  const [viewingRequest, setViewingRequest] = useState<VacationRequest | null>(null);
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
  const [changeLogs, setChangeLogs] = useState<EmployeeChangeLog[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<EmployeeSalaryHistory[]>([]);
  const [positionHistory, setPositionHistory] = useState<EmployeePositionHistory[]>([]);
  const [requestsDashboard, setRequestsDashboard] = useState<RequestsDashboard | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(EMPTY_EMPLOYEE_FORM);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [documentForm, setDocumentForm] = useState<DocumentFormState>(EMPTY_DOCUMENT_FORM);
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

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [departmentsRes, positionsRes, branchesRes, workDaysRes, employeesRes, vacationsRes, notificationsRes, dashboardRes] = await Promise.allSettled([
        getDepartments({ limit: 200 }),
        getPositions({ limit: 300 }),
        getBranches({ limit: 200 }),
        getWorkDays({ limit: 20 }),
        getEmployees({ limit: 200 }),
        getVacationRequests({ limit: 200 }),
        getHRNotifications({ limit: 200, status: 'UNREAD' }),
        getRequestsDashboard(),
      ]);

      if (departmentsRes.status === 'fulfilled') setDepartments(departmentsRes.value.data);
      if (positionsRes.status === 'fulfilled') setPositions(positionsRes.value.data);
      if (branchesRes.status === 'fulfilled') setBranches(branchesRes.value.data);
      if (workDaysRes.status === 'fulfilled') setWorkDays(workDaysRes.value.data);
      if (employeesRes.status === 'fulfilled') setEmployees(employeesRes.value.data);
      if (vacationsRes.status === 'fulfilled') setVacationRequests(vacationsRes.value.data);
      if (notificationsRes.status === 'fulfilled') setNotifications(notificationsRes.value.data);
      if (dashboardRes.status === 'fulfilled') setRequestsDashboard(dashboardRes.value);
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

  useEffect(() => {
    setBranchPage(1);
  }, [searchQuery, filterStatus]);

  const departmentById = useMemo(() => new Map(departments.map((department) => [department.id, department])), [departments]);
  const positionById = useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions]);
  const branchById = useMemo(() => new Map(branches.map((branch) => [branch.id, branch])), [branches]);
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);

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
    return labels;
  }, [branchById, departmentById, filterBranch, filterContractType, filterDataQuality, filterDepartment, filterEmploymentType, filterPosition, filterProfileStatus, filterStatus, positionById, searchQuery]);

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

  const filteredVacationRequests = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return vacationRequests.filter((request) => {
      const employee = employeeById.get(request.employee);
      const matchesSearch =
        !query ||
        employee?.first_name.toLowerCase().includes(query) ||
        employee?.last_name.toLowerCase().includes(query) ||
        employee?.employee_code.toLowerCase().includes(query) ||
        request.reason.toLowerCase().includes(query);
      const matchesDepartment = filterDepartment === 'all' || employee?.department === filterDepartment;
      const matchesStatus = filterStatus === 'all' || request.status === filterStatus;
      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [employeeById, filterDepartment, filterStatus, searchQuery, vacationRequests]);

  const vacationTotalPages = Math.max(1, Math.ceil(filteredVacationRequests.length / vacationPageSize));

  const paginatedVacationRequests = useMemo(() => {
    const start = (vacationPage - 1) * vacationPageSize;
    return filteredVacationRequests.slice(start, start + vacationPageSize);
  }, [vacationPage, vacationPageSize, filteredVacationRequests]);

  useEffect(() => {
    setVacationPage(1);
  }, [searchQuery, filterDepartment, filterStatus, vacationPageSize]);

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
    const [documentsRes, changesRes, salariesRes, positionsRes] = await Promise.allSettled([
      getEmployeeDocuments({ employee: employeeId, limit: 200 }),
      getEmployeeChangeLogs(employeeId),
      getEmployeeSalaryHistory(employeeId),
      getEmployeePositionHistory(employeeId),
    ]);
    setEmployeeDocuments(documentsRes.status === 'fulfilled' ? documentsRes.value.data : []);
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
    setChangeLogs([]);
    setSalaryHistory([]);
    setPositionHistory([]);
    setEmployeeModalTab('personal');
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
  };

  const resetEmployeeModal = () => {
    setShowEmployeeModal(false);
    setEditingEmployee(null);
    setEmployeeForm(EMPTY_EMPLOYEE_FORM);
    setEmployeeLocation(EMPTY_LOCATION);
    setDocumentForm(EMPTY_DOCUMENT_FORM);
    setEditingDocumentId(null);
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

  const handleEmployeeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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

  const handleVacationAction = async (request: VacationRequest, action: 'approve' | 'reject') => {
    if (action === 'reject') {
      setRejectingRequest(request);
      setRejectReason('');
      setShowRejectModal(true);
      return;
    }
    setVacationActionId(request.id);
    try {
      await approveVacationRequest(request.id);
      toast.success('Solicitud aprobada');
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo procesar la solicitud');
    } finally {
      setVacationActionId(null);
    }
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setRejectingRequest(null);
    setRejectReason('');
  };

  const confirmRejectVacation = async () => {
    if (!rejectingRequest) return;
    if (!rejectReason.trim()) {
      toast.error('Debes indicar el motivo del rechazo');
      return;
    }
    setVacationActionId(rejectingRequest.id);
    try {
      await rejectVacationRequest(rejectingRequest.id, rejectReason.trim());
      toast.info('Solicitud rechazada');
      await loadData();
      closeRejectModal();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo procesar la solicitud');
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
  };

  const activeEmployees = employees.filter((employee) => employee.status === 'ACTIVE');
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
        <TextInput label="Correo electrónico" type="email" value={employeeForm.email} onChange={(value) => {
          setEmployeeForm((current) => ({ ...current, email: value, user_email: current.user_email || value, user_email_confirm: current.user_email_confirm || value }));
        }} />
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
        <SearchableSelectInput label="Jefe inmediato" value={employeeForm.manager} onChange={(value) => setFormField('manager', value)} options={activeEmployees.filter((employee) => employee.id !== editingEmployee?.id).map((employee) => ({ value: employee.id, label: getEmployeeName(employee) }))} emptyLabel="Sin jefe asignado" />
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

  const renderAccessTab = () => (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <SelectInput label="Rol dentro del sistema" value={employeeForm.user_role} onChange={(value) => setFormField('user_role', value as UserRole | '')} options={INTERNAL_EMPLOYEE_ROLES.map((role) => ({ value: role, label: getRoleLabel(role) }))} emptyLabel="Sin acceso al sistema" />
        <TextInput label="Correo" type="email" value={employeeForm.user_email} onChange={(value) => setFormField('user_email', value)} />
        <TextInput label="Confirmar correo" type="email" value={employeeForm.user_email_confirm} onChange={(value) => setFormField('user_email_confirm', value)} />
        <TextInput label="Contraseña" type="password" value={employeeForm.user_password} onChange={(value) => setFormField('user_password', value)} placeholder={editingEmployee?.user ? 'Dejar vacío para conservar' : 'Mínimo 8 caracteres'} />
        <TextInput label="Confirmar contraseña" type="password" value={employeeForm.user_password_confirm} onChange={(value) => setFormField('user_password_confirm', value)} />
      </div>
      <div className="p-4 border border-amber-200 bg-amber-50 rounded-xl text-xs text-amber-800">
        Si asignas un rol por primera vez, correo y contraseña deben coincidir. En edición, dejar contraseña vacía conserva la actual.
      </div>
    </div>
  );

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

  const renderModalTab = () => {
    switch (employeeModalTab) {
      case 'personal': return renderPersonalTab();
      case 'labor': return renderLaborTab();
      case 'social': return renderSocialTab();
      case 'banking': return renderBankingTab();
      case 'payroll': return renderPayrollTab();
      case 'emergency': return renderEmergencyTab();
      case 'documents': return renderDocumentsTab();
      case 'access': return renderAccessTab();
      case 'history': return renderHistoryTab();
      default: return null;
    }
  };

  const renderReadOnlyEmployeeTab = (employee: Employee) => {
    const department = employee.department ? departmentById.get(employee.department)?.name : 'Sin área';
    const position = employee.position ? positionById.get(employee.position)?.name : 'Sin cargo';
    const branch = employee.branch ? branchById.get(employee.branch)?.name : 'Sin sede';
    const manager = employee.manager ? employeeById.get(employee.manager) : null;
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
              ['Jefe inmediato', manager ? getEmployeeName(manager) : 'Sin jefe'],
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
            <button
              onClick={() => void handleEmployeesPdfExport()}
              disabled={exportingEmployeesPdf || isLoading || sortedEmployees.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 border border-[#2a4038] text-[#2a4038] text-xs font-semibold rounded-xl hover:bg-[#eef4f1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportingEmployeesPdf ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              {exportingEmployeesPdf ? 'Generando PDF...' : 'Exportar filtro PDF'}
            </button>
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
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Buscar por nombre, apellido, cédula, cargo, área, sede o correo..." className="w-full" />
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
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              {activeTab === 'vacations' && (
                <select value={filterDepartment} onChange={(event) => setFilterDepartment(event.target.value)} className={selectCls}>
                  <option value="all">Todos los departamentos</option>
                  {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              )}
              {(activeTab === 'branches' || activeTab === 'vacations') && (
                <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className={selectCls}>
                  {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              )}
            </div>
          )}

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
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Pendientes', value: requestsDashboard.pending },
                      { label: 'Aprobadas', value: requestsDashboard.approved },
                      { label: 'Rechazadas', value: requestsDashboard.rejected },
                      { label: 'En revisión', value: requestsDashboard.in_review },
                      { label: 'Vencidas', value: requestsDashboard.expired },
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
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}

              {filteredVacationRequests.length > 0 && (
                <ResultsCount count={filteredVacationRequests.length} label={filteredVacationRequests.length === 1 ? 'solicitud encontrada' : 'solicitudes encontradas'} />
              )}
              <Table scrollable>
                  <thead>
                    <tr>
                      <Th>Empleado</Th>
                      <Th>Tipo</Th>
                      <Th>Fechas</Th>
                      <Th>Motivo</Th>
                      <Th>Estado</Th>
                      <Th>Acciones</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedVacationRequests.map((request) => {
                      const employee = employeeById.get(request.employee);
                      return (
                        <tr key={request.id} className="hover:bg-gray-50/50">
                          <Td>
                            <div className="font-medium text-gray-900">{employee ? getEmployeeName(employee) : request.employee}</div>
                            <div className="text-gray-400 text-[11px] mt-1">{employee?.employee_code ?? 'Sin código'}</div>
                          </Td>
                          <Td>
                            <div>{getRequestTypeLabel(request.request_type)}</div>
                            <div className="text-gray-400 text-[11px] mt-1">{getRequestSubtypeLabel(request.subtype)}</div>
                          </Td>
                          <Td>{parseDate(request.start_date)} - {parseDate(request.end_date)}</Td>
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
                          <Td><Badge label={requestStatusLabel(request.status)} color={statusBadge(request.status)} /></Td>
                          <Td>
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openRequestDetailModal(request)} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors" title="Ver detalle">
                                <Eye size={13} />
                              </button>
                              <button onClick={() => handleVacationPdf(request)} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Ver PDF">
                                <FileDown size={13} />
                              </button>
                              {request.support_document && (
                                <>
                                  <a href={getMediaUrl(request.support_document)} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Ver soporte adjunto">
                                    <Paperclip size={13} />
                                  </a>
                                  <a href={getMediaUrl(request.support_document)} download={getSupportDocumentName(request.support_document)} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Descargar soporte">
                                    <Download size={13} />
                                  </a>
                                </>
                              )}
                              <button
                                onClick={() => handleVacationAction(request, 'approve')}
                                disabled={!['PENDING', 'IN_REVIEW', 'PENDING_HR', 'PENDING_ADMIN'].includes(request.status) || vacationActionId === request.id}
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                                title="Aprobar"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                onClick={() => handleVacationAction(request, 'reject')}
                                disabled={!['PENDING', 'IN_REVIEW', 'PENDING_HR', 'PENDING_ADMIN'].includes(request.status) || vacationActionId === request.id}
                                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                                title="Rechazar"
                              >
                                <XCircle size={13} />
                              </button>
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
            </Table>
              {filteredVacationRequests.length > 0 && (
                <Pagination
                  currentPage={vacationPage}
                  totalPages={vacationTotalPages}
                  totalItems={filteredVacationRequests.length}
                  itemsPerPage={vacationPageSize}
                  itemsPerPageOptions={PAGE_SIZE_OPTIONS}
                  onPageChange={setVacationPage}
                  onItemsPerPageChange={setVacationPageSize}
                />
              )}
              {filteredVacationRequests.length === 0 && (
                <EmptyState title="No hay solicitudes para mostrar" />
              )}
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
            <p className="text-xs text-gray-500">{getRequestTypeLabel(viewingRequest.request_type)} · {getRequestSubtypeLabel(viewingRequest.subtype)}</p>
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
                    ['Fecha inicio', parseDate(viewingRequest.start_date)],
                    ['Fecha fin', parseDate(viewingRequest.end_date)],
                    ['Días / horas', `${viewingRequest.days_count ?? 0} días · ${viewingRequest.hours_count ?? 0} horas`],
                  ].map(([label, value]) => (
                    <div key={label} className="border border-gray-100 rounded-xl p-4 bg-gray-50/60">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">{label}</div>
                      <div className="text-sm text-gray-700">{value || 'Sin registrar'}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
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
                {viewingRequest.approval_steps.map((step) => (
                  <div key={step.id} className="border border-gray-100 rounded-xl p-3 text-xs">
                    <div className="font-medium text-gray-900">{approvalStepLabel(step.step)}</div>
                    <div className="inline-block mt-2"><Badge label={requestStatusLabel(step.status)} color={statusBadge(step.status)} /></div>
                    <div className="text-gray-400 mt-2">{parseDate(step.acted_at)}</div>
                    <div className="text-gray-400">{step.comment || 'Sin comentario'}</div>
                  </div>
                ))}
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
                      <div className="font-medium text-gray-900">{item.action}</div>
                      <div className="text-gray-400">{item.old_status || 'Inicio'} → {item.new_status || 'Sin cambio'}</div>
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

      <Modal title={editingBranch ? 'Editar sede' : 'Nueva sede'} open={showBranchModal} onClose={resetBranchModal} wide>
        <p className="text-xs text-gray-500 mb-4">Gestión independiente de sedes y sucursales.</p>
        <form onSubmit={handleBranchSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <TextInput label="Nombre" required value={branchForm.name} onChange={(value) => setBranchForm((current) => ({ ...current, name: value }))} />
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
                        onClick={() => setEmployeeModalTab(tab.id)}
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
    </div>
  );
}

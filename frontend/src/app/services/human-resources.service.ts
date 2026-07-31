// ============================================================
// Human Resources Service — Juhnios Rold Frontend
// Wraps attendance, request, payroll, document and notification APIs.
// ============================================================

import { api, API_BASE_URL, getAccessToken, LONG_REQUEST_TIMEOUT_MS } from './api';

const HR_PATH = '/hr';
const ATTENDANCE_PATH = `${HR_PATH}/attendance/`;
const REQUESTS_PATH = `${HR_PATH}/requests/`;
const VACATIONS_PATH = `${HR_PATH}/vacations/`;
const REQUEST_ATTACHMENTS_PATH = `${HR_PATH}/request-attachments/`;
const PAYROLL_PATH = `${HR_PATH}/payroll/`;
const PAYROLL_PERIODS_PATH = `${HR_PATH}/payroll-periods/`;
const PAYROLL_LEGAL_PARAMETERS_PATH = `${HR_PATH}/payroll-legal-parameters/`;
const HOLIDAYS_PATH = `${HR_PATH}/holidays/`;
const WORK_SCHEDULES_PATH = `${HR_PATH}/work-schedules/`;
const WORK_SCHEDULE_TEMPLATES_PATH = `${HR_PATH}/work-schedule-templates/`;
const BIOMETRIC_DEVICES_PATH = `${HR_PATH}/biometric-devices/`;
const BIOMETRIC_IDS_PATH = `${HR_PATH}/biometric-ids/`;
const BIOMETRIC_IMPORTS_PATH = `${HR_PATH}/biometric-imports/`;
const ATTENDANCE_INTELLIGENCE_SETTINGS_PATH = `${HR_PATH}/attendance-intelligence-settings/`;
const PERFORMANCE_REVIEWS_PATH = `${HR_PATH}/performance-reviews/`;
const DOCUMENTS_PATH = `${HR_PATH}/documents/`;
const NOTIFICATIONS_PATH = `${HR_PATH}/notifications/`;

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

function buildQuery(params?: Record<string, string | number | boolean | null | undefined>): string {
  if (!params) return '';
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

function normalizeListResponse<T>(payload: T[] | PaginatedResponse<T> | undefined | null): {
  data: T[];
  total: number;
  next: string | null;
  previous: string | null;
} {
  if (!payload) return { data: [], total: 0, next: null, previous: null };
  if (Array.isArray(payload)) return { data: payload, total: payload.length, next: null, previous: null };
  return {
    data: payload.results ?? [],
    total: payload.count ?? (payload.results?.length ?? 0),
    next: payload.next ?? null,
    previous: payload.previous ?? null,
  };
}

function buildVacationRequestBody(
  payload: Omit<VacationRequestPayload, 'employee'>,
): FormData | Record<string, string | boolean | number> {
  const hasFile = Object.values(payload).some((value) => value instanceof Blob);
  if (hasFile) {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      if (value instanceof Blob) formData.append(key, value);
      else formData.append(key, String(value));
    });
    return formData;
  }

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== null && value !== undefined && value !== ''),
  ) as Record<string, string | boolean | number>;
}

function buildEmployeeDocumentBody(payload: Partial<EmployeeDocumentPayload>): FormData {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    if (value instanceof File) formData.append(key, value);
    else formData.append(key, String(value));
  });
  return formData;
}

export type HRRequestStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'PENDING_HR'
  | 'PENDING_ADMIN'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FINALIZED'
  | 'EXPIRED';
export type VacationRequestStatus = HRRequestStatus;
export type VacationRequestType = 'PERMISSION' | 'OVERTIME' | 'LEAVE' | 'INCAPACITY' | 'VACATION' | 'LOAN' | 'OTHER';
export type LoanFrequency = 'BIWEEKLY' | 'MONTHLY';
export type HRRequestSubtype =
  | 'PERSONAL'
  | 'MEDICAL'
  | 'ACADEMIC'
  | 'FAMILY'
  | 'DAYTIME'
  | 'NIGHT'
  | 'SUNDAY'
  | 'HOLIDAY'
  | 'MATERNITY'
  | 'PATERNITY'
  | 'BEREAVEMENT'
  | 'MARRIAGE'
  | 'DOMESTIC_CALAMITY'
  | 'UNPAID'
  | 'GENERAL_ILLNESS'
  | 'WORK_ACCIDENT'
  | 'COMMON_ACCIDENT'
  | 'OCCUPATIONAL_DISEASE'
  | 'INDIVIDUAL'
  | 'COLLECTIVE'
  | 'SHIFT_CHANGE'
  | 'SCHEDULE_CHANGE'
  | 'ADMINISTRATIVE'
  | 'OTHER'
  | '';
export type PayrollStatus = 'DRAFT' | 'APPROVED' | 'PAID';
export type PayrollPeriodStatus = 'OPEN' | 'CALCULATED' | 'APPROVED' | 'PAID' | 'CLOSED';
export type PayrollItemSource = 'MANUAL' | 'ATTENDANCE' | 'VACATION_REQUEST' | 'LOAN_INSTALLMENT' | 'SYSTEM';
export type BiometricImportStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type AttendanceSource = 'MANUAL' | 'BIOMETRIC' | 'MANUAL_CORRECTION';
export type PublicHolidayKind = 'FIXED' | 'FIXED_MOVED_TO_MONDAY' | 'EASTER_BASED';
export type EmployeeDocumentType =
  | 'ID_COPY'
  | 'RESUME'
  | 'SIGNED_CONTRACT'
  | 'BANK_CERTIFICATE'
  | 'EPS_CERTIFICATE'
  | 'PENSION_CERTIFICATE'
  | 'SEVERANCE_CERTIFICATE'
  | 'ARL_CERTIFICATE'
  | 'COMPENSATION_CERTIFICATE'
  | 'WORK_CERTIFICATE'
  | 'OTHER';
export type EmployeeDocumentStatus = 'PENDING' | 'LOADED' | 'REJECTED' | 'EXPIRED' | 'NOT_APPLICABLE';
export type HRNotificationStatus = 'UNREAD' | 'READ' | 'DISMISSED';
export type HRNotificationType = 'DOCUMENT_EXPIRED' | 'DOCUMENT_EXPIRING' | 'MISSING_DOCUMENT' | 'GENERAL';

export interface Attendance {
  id: string;
  employee: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  notes: string;
  source: AttendanceSource;
  break_start: string | null;
  break_end: string | null;
  raw_punches: string[];
  is_manually_corrected: boolean;
  corrected_by: string | null;
  corrected_at: string | null;
  correction_reason: string;
  has_incomplete_marks: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface VacationRequestAttachment {
  id: string;
  request: string;
  attachment_type: 'CERTIFICATE' | 'INCAPACITY' | 'MEDICAL_SUPPORT' | 'ADDITIONAL';
  name: string;
  file: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface VacationRequestApprovalStep {
  id: string;
  request: string;
  step: 'REQUESTER' | 'MANAGER' | 'HR' | 'FINAL';
  sequence: number;
  status: HRRequestStatus;
  user: string | null;
  acted_at: string | null;
  comment: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface VacationRequestHistory {
  id: string;
  request: string;
  action: 'CREATED' | 'UPDATED' | 'APPROVED' | 'REJECTED' | 'COMMENTED';
  user: string | null;
  old_status: string;
  new_status: string;
  comment: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Turno individual dentro de una solicitud de horas extra (request_type=OVERTIME)
 * con varios días/horarios distintos en un solo trámite. */
export interface OvertimeShift {
  id: string;
  request: string;
  date: string;
  start_time: string;
  end_time: string;
  hours_count: string;
  notes: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface OvertimeShiftInput {
  date: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

export interface VacationRequest {
  id: string;
  employee: string;
  request_number: string | null;
  request_type: VacationRequestType;
  subtype: HRRequestSubtype;
  start_date: string;
  end_date: string;
  is_full_day: boolean;
  start_time: string | null;
  end_time: string | null;
  days_count: string | null;
  hours_count: string | null;
  reason: string;
  description: string;
  observations: string;
  due_date: string | null;
  support_document: string | null;
  loan_amount: string | null;
  loan_approved_amount: string | null;
  loan_requester_name: string;
  loan_requester_document: string;
  loan_city: string;
  loan_position: string;
  loan_concept: string;
  loan_frequency: LoanFrequency | '';
  loan_installments_count: number | null;
  loan_expense_number: string;
  loan_requester_signature: string | null;
  is_remunerated: boolean | null;
  remuneration_decided_by: string | null;
  remuneration_decided_at: string | null;
  status: HRRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_decision: HRRequestStatus | '';
  admin_decided_by: string | null;
  admin_decided_at: string | null;
  admin_comment: string;
  hr_decision: HRRequestStatus | '';
  hr_decided_by: string | null;
  hr_decided_at: string | null;
  hr_comment: string;
  attachments: VacationRequestAttachment[];
  approval_steps: VacationRequestApprovalStep[];
  history: VacationRequestHistory[];
  overtime_shifts: OvertimeShift[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RequestsDashboard {
  pending: number;
  approved: number;
  rejected: number;
  in_review: number;
  expired: number;
  overtime_hours: number | string;
  incapacity_days: number | string;
  pending_vacation_days: number | string;
  charts: {
    by_month: Array<{ label: string; value: number }>;
    by_type: Array<{ label: string; value: number }>;
    by_area: Array<{ label: string; value: number }>;
    by_branch: Array<{ label: string; value: number }>;
    by_employee: Array<{ employee_id: string; label: string; value: number }>;
  };
}

export interface PayrollItem {
  id: string;
  payroll: string;
  item_type: 'EARNING' | 'DEDUCTION';
  concept: string;
  amount: string;
  source: PayrollItemSource;
  source_vacation_request: string | null;
  concept_code: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Payroll {
  id: string;
  employee: string;
  employee_name?: string;
  period: string | null;
  period_start: string;
  period_end: string;
  base_salary: string;
  bonuses: string;
  deductions: string;
  net_salary: string;
  status: PayrollStatus;
  items: PayrollItem[];
  payslip_number: string | null;
  worked_days: string | null;
  ordinary_hours: string;
  overtime_hours: string;
  transport_allowance: string;
  health_deduction: string;
  pension_deduction: string;
  gross_earnings: string;
  total_deductions: string;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  payment_reference: string;
  signature: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PayrollPeriod {
  id: string;
  period_start: string;
  period_end: string;
  label: string;
  status: PayrollPeriodStatus;
  calculated_at: string | null;
  calculated_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  paid_by: string | null;
  notes: string;
  payrolls: Payroll[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PayrollLegalParameter {
  id: string;
  year: number;
  minimum_wage: string;
  transport_allowance_amount: string;
  transport_allowance_salary_cap_factor: string;
  health_employee_pct: string;
  pension_employee_pct: string;
  monthly_hours_divisor_default: string;
  night_ordinary_surcharge_pct: string | null;
  day_extra_surcharge_pct: string | null;
  night_extra_surcharge_pct: string | null;
  sunday_holiday_surcharge_pct: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PublicHoliday {
  id: string;
  year: number;
  name: string;
  kind: PublicHolidayKind;
  civil_date: string;
  original_date: string | null;
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EmployeeWorkScheduleDay {
  id: string;
  schedule: string;
  weekday: number;
  slot: number;
  expected_start_time: string;
  expected_end_time: string;
  is_working_day: boolean;
}

export interface EmployeeWorkSchedule {
  id: string;
  employee: string;
  source_template: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string;
  created_by: string | null;
  days: EmployeeWorkScheduleDay[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WorkScheduleTemplateDay {
  id: string;
  template: string;
  weekday: number;
  slot: number;
  expected_start_time: string;
  expected_end_time: string;
  is_working_day: boolean;
}

export interface WorkScheduleTemplate {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_by: string | null;
  days: WorkScheduleTemplateDay[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BiometricDevice {
  id: string;
  name: string;
  location: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EmployeeBiometricId {
  id: string;
  employee: string;
  device: string | null;
  biometric_code: string;
  is_active: boolean;
  valid_from: string;
  valid_to: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RawBiometricPunch {
  id: string;
  device: string | null;
  biometric_code: string;
  punched_at: string;
  raw_col3: string;
  raw_col4: string;
  raw_col5: string;
  raw_col6: string;
  raw_line: string;
  import_batch: string;
  matched_employee: string | null;
  is_duplicate: boolean;
  duplicate_of: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface BiometricImportBatch {
  id: string;
  file: string | null;
  device: string | null;
  uploaded_by: string | null;
  status: BiometricImportStatus;
  total_rows: number;
  matched_rows: number;
  unmatched_rows: number;
  duplicate_rows: number;
  error_log: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PerformanceReview {
  id: string;
  employee: string;
  reviewer: string;
  review_date: string;
  score: string;
  comments: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EmployeeDocument {
  id: string;
  employee: string;
  document_type: EmployeeDocumentType;
  name: string;
  file: string | null;
  issued_at: string | null;
  expires_at: string | null;
  uploaded_at: string;
  status: EmployeeDocumentStatus;
  observations: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface HRNotification {
  id: string;
  employee: string | null;
  document: string | null;
  notification_type: HRNotificationType;
  title: string;
  message: string;
  due_date: string | null;
  status: HRNotificationStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AttendancePayload {
  employee: string;
  date: string;
  check_in?: string | null;
  check_out?: string | null;
  notes?: string;
}

export interface VacationRequestPayload {
  employee: string;
  request_type: VacationRequestType;
  subtype?: HRRequestSubtype;
  start_date: string;
  end_date: string;
  is_full_day: boolean;
  start_time?: string | null;
  end_time?: string | null;
  days_count?: string | number | null;
  hours_count?: string | number | null;
  reason?: string;
  description?: string;
  observations?: string;
  due_date?: string | null;
  support_document?: File | null;
  loan_amount?: string | number | null;
  loan_requester_name?: string;
  loan_requester_document?: string;
  loan_city?: string;
  loan_position?: string;
  loan_concept?: string;
  loan_frequency?: LoanFrequency | '';
  loan_installments_count?: number | null;
  loan_requester_signature?: File | null;
}

export interface PayrollPayload {
  employee: string;
  period_start: string;
  period_end: string;
  base_salary: number | string;
  bonuses?: number | string;
  deductions?: number | string;
  net_salary: number | string;
  status?: PayrollStatus;
}

export interface PerformanceReviewPayload {
  employee: string;
  reviewer: string;
  review_date: string;
  score: number | string;
  comments?: string;
}

export interface EmployeeDocumentPayload {
  employee: string;
  document_type: EmployeeDocumentType;
  name: string;
  file?: File | null;
  issued_at?: string | null;
  expires_at?: string | null;
  status?: EmployeeDocumentStatus;
  observations?: string;
}

export interface ListAttendanceParams {
  page?: number;
  limit?: number;
  employee?: string;
  date?: string;
}

export interface ListVacationParams {
  page?: number;
  limit?: number;
  employee?: string;
  status?: HRRequestStatus;
  request_type?: VacationRequestType;
  subtype?: HRRequestSubtype;
  department?: string;
  branch?: string;
  search?: string;
  ordering?: string;
  start_date_from?: string;
  start_date_to?: string;
}

export interface ListPayrollParams {
  page?: number;
  limit?: number;
  employee?: string;
  status?: PayrollStatus;
}

export interface ListPerformanceReviewParams {
  page?: number;
  limit?: number;
  employee?: string;
  reviewer?: string;
}

export interface ListDocumentParams {
  page?: number;
  limit?: number;
  employee?: string;
  document_type?: EmployeeDocumentType;
  status?: EmployeeDocumentStatus;
}

export interface ListNotificationParams {
  page?: number;
  limit?: number;
  employee?: string;
  document?: string;
  notification_type?: HRNotificationType;
  status?: HRNotificationStatus;
}

// ---- Attendance ----
export async function getAttendance(params?: ListAttendanceParams): Promise<{
  data: Attendance[];
  total: number;
  next: string | null;
  previous: string | null;
}> {
  const query = buildQuery({ page: params?.page, page_size: params?.limit, employee: params?.employee, date: params?.date });
  const res = await api.get<Attendance[] | PaginatedResponse<Attendance>>(`${ATTENDANCE_PATH}${query}`);
  return normalizeListResponse(res.data);
}

export async function registerCheckIn(employeeId: string): Promise<Attendance> {
  const res = await api.post<Attendance>(`${ATTENDANCE_PATH}check-in/`, { employee_id: employeeId });
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function registerCheckOut(employeeId: string): Promise<Attendance> {
  const res = await api.post<Attendance>(`${ATTENDANCE_PATH}check-out/`, { employee_id: employeeId });
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Requests ----
export async function getVacationRequests(params?: ListVacationParams): Promise<{
  data: VacationRequest[];
  total: number;
  next: string | null;
  previous: string | null;
}> {
  const query = buildQuery({
    page: params?.page,
    page_size: params?.limit,
    employee: params?.employee,
    status: params?.status,
    request_type: params?.request_type,
    subtype: params?.subtype,
    employee__department: params?.department,
    employee__branch: params?.branch,
    search: params?.search,
    ordering: params?.ordering,
    start_date_from: params?.start_date_from,
    start_date_to: params?.start_date_to,
  });
  const res = await api.get<VacationRequest[] | PaginatedResponse<VacationRequest>>(`${REQUESTS_PATH}${query}`);
  return normalizeListResponse(res.data);
}

export async function getVacationRequestById(id: string): Promise<VacationRequest> {
  const res = await api.get<VacationRequest>(`${REQUESTS_PATH}${id}/`);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function getRequestsDashboard(params?: ListVacationParams): Promise<RequestsDashboard> {
  const query = buildQuery({
    employee: params?.employee,
    status: params?.status,
    request_type: params?.request_type,
    subtype: params?.subtype,
    employee__department: params?.department,
    employee__branch: params?.branch,
    search: params?.search,
  });
  const res = await api.get<RequestsDashboard>(`${REQUESTS_PATH}dashboard/${query}`);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function updateVacationRequest(id: string, payload: Partial<VacationRequestPayload>): Promise<VacationRequest> {
  const res = await api.patch<VacationRequest>(`${REQUESTS_PATH}${id}/`, buildVacationRequestBody(payload as Omit<VacationRequestPayload, 'employee'>));
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function createVacationRequest(payload: VacationRequestPayload): Promise<VacationRequest> {
  const res = await api.post<VacationRequest>(
    REQUESTS_PATH,
    buildVacationRequestBody({
      request_type: payload.request_type,
      subtype: payload.subtype,
      start_date: payload.start_date,
      end_date: payload.end_date,
      is_full_day: payload.is_full_day,
      start_time: payload.start_time,
      end_time: payload.end_time,
      days_count: payload.days_count,
      hours_count: payload.hours_count,
      reason: payload.reason,
      description: payload.description,
      observations: payload.observations,
      due_date: payload.due_date,
      support_document: payload.support_document,
      loan_amount: payload.loan_amount,
      loan_requester_name: payload.loan_requester_name,
      loan_requester_document: payload.loan_requester_document,
      loan_city: payload.loan_city,
      loan_position: payload.loan_position,
      loan_concept: payload.loan_concept,
      loan_frequency: payload.loan_frequency,
      loan_installments_count: payload.loan_installments_count,
      loan_requester_signature: payload.loan_requester_signature,
    }),
  );
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function getMyVacationRequests(params?: { page?: number; limit?: number }): Promise<{
  data: VacationRequest[];
  total: number;
  next: string | null;
  previous: string | null;
}> {
  const query = buildQuery({ page: params?.page, page_size: params?.limit });
  const res = await api.get<VacationRequest[] | PaginatedResponse<VacationRequest>>(`${VACATIONS_PATH}me/${query}`);
  return normalizeListResponse(res.data);
}

export async function createMyVacationRequest(payload: Omit<VacationRequestPayload, 'employee'>): Promise<VacationRequest> {
  const res = await api.post<VacationRequest>(`${VACATIONS_PATH}me/`, buildVacationRequestBody(payload));
  if (res.data) return res.data;
  throw new Error(res.message);
}

/** Crea UNA sola solicitud de horas extra a partir de varios turnos (fecha + horario
 * cada uno), en vez de tener que enviar una solicitud por cada día distinto. */
export async function createMyOvertimeRequest(payload: {
  shifts: OvertimeShiftInput[];
  reason?: string;
  description?: string;
  observations?: string;
  support_document?: File | null;
}): Promise<VacationRequest> {
  const formData = new FormData();
  formData.append('overtime_shifts', JSON.stringify(payload.shifts));
  if (payload.reason) formData.append('reason', payload.reason);
  if (payload.description) formData.append('description', payload.description);
  if (payload.observations) formData.append('observations', payload.observations);
  if (payload.support_document instanceof Blob) formData.append('support_document', payload.support_document);

  const res = await api.post<VacationRequest>(`${VACATIONS_PATH}me/`, formData);
  if (res.data) return res.data;
  throw new Error(res.message);
}

/** Solicitudes de los empleados que reportan directamente al usuario autenticado
 * (su equipo a cargo como jefe inmediato). Nunca incluye préstamos: esos quedan
 * reservados a RRHH, Administrador, Contabilidad o acceso puntual habilitado. */
export async function getTeamVacationRequests(params?: { page?: number; limit?: number }): Promise<{
  data: VacationRequest[];
  total: number;
  next: string | null;
  previous: string | null;
}> {
  const query = buildQuery({ page: params?.page, page_size: params?.limit });
  const res = await api.get<VacationRequest[] | PaginatedResponse<VacationRequest>>(`${VACATIONS_PATH}team/${query}`);
  return normalizeListResponse(res.data);
}

/** Listado dedicado y exclusivo de solicitudes de préstamo, para Recursos Humanos,
 * Administrador, el rol Contabilidad, o un usuario con acceso puntual habilitado. */
export async function getLoanRequests(params?: { page?: number; limit?: number }): Promise<{
  data: VacationRequest[];
  total: number;
  next: string | null;
  previous: string | null;
}> {
  const query = buildQuery({ page: params?.page, page_size: params?.limit });
  const res = await api.get<VacationRequest[] | PaginatedResponse<VacationRequest>>(`${VACATIONS_PATH}loans/${query}`);
  return normalizeListResponse(res.data);
}

function buildDecisionBody(
  comment: string,
  signatureFile?: File | null,
  isRemunerated?: boolean | null,
  approvedAmount?: number | null,
): FormData | { comment: string; is_remunerated?: boolean; approved_amount?: number } {
  if (signatureFile) {
    const formData = new FormData();
    formData.append('comment', comment);
    formData.append('signature_override', signatureFile);
    if (isRemunerated !== null && isRemunerated !== undefined) {
      formData.append('is_remunerated', String(isRemunerated));
    }
    if (approvedAmount !== null && approvedAmount !== undefined) {
      formData.append('approved_amount', String(approvedAmount));
    }
    return formData;
  }
  return {
    comment,
    ...(isRemunerated !== null && isRemunerated !== undefined ? { is_remunerated: isRemunerated } : {}),
    ...(approvedAmount !== null && approvedAmount !== undefined ? { approved_amount: approvedAmount } : {}),
  };
}

/** ``isRemunerated`` es una decisión exclusiva del Administrador (nunca RRHH ni
 * el jefe inmediato); pásalo únicamente cuando quien aprueba sea Admin y tenga
 * ese control en pantalla. Se puede definir aquí al aprobar, o después con
 * ``setRequestRemuneration``. ``approvedAmount`` solo aplica a préstamos: permite
 * a Administrador/Tesorería aprobar un monto menor al solicitado. */
export async function approveVacationRequest(
  id: string,
  comment = '',
  signatureFile?: File | null,
  isRemunerated?: boolean | null,
  approvedAmount?: number | null,
): Promise<VacationRequest> {
  const res = await api.post<VacationRequest>(`${REQUESTS_PATH}${id}/approve/`, buildDecisionBody(comment, signatureFile, isRemunerated, approvedAmount));
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function rejectVacationRequest(id: string, comment = '', signatureFile?: File | null): Promise<VacationRequest> {
  const res = await api.post<VacationRequest>(`${REQUESTS_PATH}${id}/reject/`, buildDecisionBody(comment, signatureFile));
  if (res.data) return res.data;
  throw new Error(res.message);
}

/** Define si la solicitud es remunerada o no, en cualquier momento (incluso ya
 * aprobada) — exclusivo del Administrador. Una vez guardada queda bloqueada
 * de forma permanente; llamar de nuevo sobre la misma solicitud falla. */
export async function setRequestRemuneration(id: string, isRemunerated: boolean): Promise<VacationRequest> {
  const res = await api.post<VacationRequest>(`${REQUESTS_PATH}${id}/set-remuneration/`, { is_remunerated: isRemunerated });
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function cancelVacationRequest(id: string, comment = ''): Promise<VacationRequest> {
  const res = await api.post<VacationRequest>(`${REQUESTS_PATH}${id}/cancel/`, { comment });
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function deleteVacationRequest(id: string): Promise<void> {
  await api.delete<void>(`${REQUESTS_PATH}${id}/`);
}

export async function finalizeVacationRequest(id: string, comment = ''): Promise<VacationRequest> {
  const res = await api.post<VacationRequest>(`${REQUESTS_PATH}${id}/finalize/`, { comment });
  if (res.data) return res.data;
  throw new Error(res.message);
}

export interface CorrectVacationScheduleParams {
  start_date: string;
  end_date: string;
  is_full_day: boolean;
  start_time?: string | null;
  end_time?: string | null;
}

/** Corrección administrativa de fecha/hora (Admin o RRHH), para arreglar un dato
 * mal digitado por el empleado mientras la solicitud sigue sin resolver. */
export async function correctVacationRequestSchedule(
  id: string,
  payload: CorrectVacationScheduleParams,
): Promise<VacationRequest> {
  const res = await api.post<VacationRequest>(`${REQUESTS_PATH}${id}/correct-schedule/`, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function openVacationRequestPdf(id: string): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
  }
  const response = await fetch(`${API_BASE_URL}${REQUESTS_PATH}${id}/pdf/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('No se pudo obtener el documento de la solicitud.');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export interface ExportRequestsXlsxParams {
  request_type?: VacationRequestType;
  status?: HRRequestStatus;
  employee__department?: string;
  employee__branch?: string;
  search?: string;
  order_by?: 'created_at' | 'request_type' | 'start_date' | 'employee';
  start_date_from?: string;
  start_date_to?: string;
}

/** Descarga el Excel de solicitudes con los mismos filtros aplicados en el listado. */
export async function exportRequestsXlsx(params?: ExportRequestsXlsxParams): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
  }
  const query = buildQuery({ ...params });
  const response = await fetch(`${API_BASE_URL}${REQUESTS_PATH}export-xlsx/${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('No se pudo generar el Excel de solicitudes.');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `solicitudes-rrhh-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function createVacationRequestAttachment(payload: {
  request: string;
  attachment_type: VacationRequestAttachment['attachment_type'];
  name: string;
  file: File;
}): Promise<VacationRequestAttachment> {
  const formData = new FormData();
  formData.append('request', payload.request);
  formData.append('attachment_type', payload.attachment_type);
  formData.append('name', payload.name);
  formData.append('file', payload.file);
  const res = await api.post<VacationRequestAttachment>(REQUEST_ATTACHMENTS_PATH, formData);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Payroll ----
export async function getPayrolls(params?: ListPayrollParams): Promise<{
  data: Payroll[];
  total: number;
  next: string | null;
  previous: string | null;
}> {
  const query = buildQuery({ page: params?.page, page_size: params?.limit, employee: params?.employee, status: params?.status });
  const res = await api.get<Payroll[] | PaginatedResponse<Payroll>>(`${PAYROLL_PATH}${query}`);
  return normalizeListResponse(res.data);
}

export async function createPayroll(payload: PayrollPayload): Promise<Payroll> {
  const res = await api.post<Payroll>(PAYROLL_PATH, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function updatePayroll(id: string, payload: Partial<PayrollPayload>): Promise<Payroll> {
  const res = await api.patch<Payroll>(`${PAYROLL_PATH}${id}/`, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function getMyPayrolls(params?: { page?: number; limit?: number }): Promise<{
  data: Payroll[];
  total: number;
  next: string | null;
  previous: string | null;
}> {
  const query = buildQuery({ page: params?.page, page_size: params?.limit });
  const res = await api.get<Payroll[] | PaginatedResponse<Payroll>>(`${PAYROLL_PATH}me/${query}`);
  return normalizeListResponse(res.data);
}

export async function addPayrollItem(
  payrollId: string,
  payload: { item_type: 'EARNING' | 'DEDUCTION'; concept: string; amount: number | string; concept_code?: string },
): Promise<Payroll> {
  const res = await api.post<Payroll>(`${PAYROLL_PATH}${payrollId}/add-item/`, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Payroll periods ----
export async function getPayrollPeriods(params?: { page?: number; limit?: number; status?: PayrollPeriodStatus }): Promise<{
  data: PayrollPeriod[];
  total: number;
  next: string | null;
  previous: string | null;
}> {
  const query = buildQuery({ page: params?.page, page_size: params?.limit, status: params?.status });
  const res = await api.get<PayrollPeriod[] | PaginatedResponse<PayrollPeriod>>(`${PAYROLL_PERIODS_PATH}${query}`);
  return normalizeListResponse(res.data);
}

export async function getPayrollPeriod(id: string): Promise<PayrollPeriod> {
  const res = await api.get<PayrollPeriod>(`${PAYROLL_PERIODS_PATH}${id}/`);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function createPayrollPeriod(payload: {
  period_start: string;
  period_end: string;
  label?: string;
}): Promise<PayrollPeriod> {
  const res = await api.post<PayrollPeriod>(`${PAYROLL_PERIODS_PATH}create-period/`, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function calculatePayrollPeriod(id: string): Promise<{
  period: PayrollPeriod;
  calculated: number;
  errors: Array<{ employee_id: string; employee: string; error: string }>;
}> {
  const res = await api.post<{
    period: PayrollPeriod;
    calculated: number;
    errors: Array<{ employee_id: string; employee: string; error: string }>;
  }>(`${PAYROLL_PERIODS_PATH}${id}/calculate/`, {}, LONG_REQUEST_TIMEOUT_MS);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function approvePayrollPeriod(id: string): Promise<PayrollPeriod> {
  const res = await api.post<PayrollPeriod>(`${PAYROLL_PERIODS_PATH}${id}/approve/`, {});
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function markPayrollPeriodPaid(id: string, paymentReference?: string): Promise<PayrollPeriod> {
  const res = await api.post<PayrollPeriod>(`${PAYROLL_PERIODS_PATH}${id}/mark-paid/`, {
    payment_reference: paymentReference || '',
  });
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Payroll legal parameters ----
export async function getPayrollLegalParameters(): Promise<PayrollLegalParameter[]> {
  const res = await api.get<PayrollLegalParameter[] | PaginatedResponse<PayrollLegalParameter>>(PAYROLL_LEGAL_PARAMETERS_PATH);
  return normalizeListResponse(res.data).data;
}

export async function createPayrollLegalParameter(payload: {
  year: number;
  minimum_wage: number | string;
  transport_allowance_amount: number | string;
  transport_allowance_salary_cap_factor?: number | string;
  health_employee_pct?: number | string;
  pension_employee_pct?: number | string;
  monthly_hours_divisor_default?: number | string;
  night_ordinary_surcharge_pct?: number | string | null;
  day_extra_surcharge_pct?: number | string | null;
  night_extra_surcharge_pct?: number | string | null;
  sunday_holiday_surcharge_pct?: number | string | null;
}): Promise<PayrollLegalParameter> {
  const res = await api.post<PayrollLegalParameter>(PAYROLL_LEGAL_PARAMETERS_PATH, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function updatePayrollLegalParameter(
  id: string,
  payload: Partial<{
    minimum_wage: number | string;
    transport_allowance_amount: number | string;
    transport_allowance_salary_cap_factor: number | string;
    health_employee_pct: number | string;
    pension_employee_pct: number | string;
    monthly_hours_divisor_default: number | string;
    night_ordinary_surcharge_pct: number | string | null;
    day_extra_surcharge_pct: number | string | null;
    night_extra_surcharge_pct: number | string | null;
    sunday_holiday_surcharge_pct: number | string | null;
  }>,
): Promise<PayrollLegalParameter> {
  const res = await api.patch<PayrollLegalParameter>(`${PAYROLL_LEGAL_PARAMETERS_PATH}${id}/`, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Public holidays ----
export async function getPublicHolidays(params?: { year?: number }): Promise<PublicHoliday[]> {
  const query = buildQuery({ year: params?.year });
  const res = await api.get<PublicHoliday[] | PaginatedResponse<PublicHoliday>>(`${HOLIDAYS_PATH}${query}`);
  return normalizeListResponse(res.data).data;
}

export async function generateYearHolidays(year: number): Promise<PublicHoliday[]> {
  const res = await api.post<PublicHoliday[]>(`${HOLIDAYS_PATH}generate-year/`, { year });
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function updatePublicHoliday(id: string, payload: Partial<PublicHoliday>): Promise<PublicHoliday> {
  const res = await api.patch<PublicHoliday>(`${HOLIDAYS_PATH}${id}/`, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function deletePublicHoliday(id: string): Promise<void> {
  await api.delete(`${HOLIDAYS_PATH}${id}/`);
}

// ---- Employee work schedules ----
export async function getEmployeeWorkSchedules(params?: { employee?: string; is_active?: boolean }): Promise<EmployeeWorkSchedule[]> {
  const query = buildQuery({ employee: params?.employee, is_active: params?.is_active });
  const res = await api.get<EmployeeWorkSchedule[] | PaginatedResponse<EmployeeWorkSchedule>>(`${WORK_SCHEDULES_PATH}${query}`);
  return normalizeListResponse(res.data).data;
}

export async function setEmployeeWorkSchedule(payload: {
  employee: string;
  start_date: string;
  notes?: string;
  days: Array<{
    weekday: number;
    slot?: number;
    expected_start_time: string;
    expected_end_time: string;
    is_working_day?: boolean;
  }>;
}): Promise<EmployeeWorkSchedule> {
  const res = await api.post<EmployeeWorkSchedule>(`${WORK_SCHEDULES_PATH}set-for-employee/`, payload, LONG_REQUEST_TIMEOUT_MS);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Work schedule templates ----
type ScheduleDayPayload = Array<{
  weekday: number;
  slot?: number;
  expected_start_time: string;
  expected_end_time: string;
  is_working_day?: boolean;
}>;

export async function getWorkScheduleTemplates(): Promise<WorkScheduleTemplate[]> {
  const res = await api.get<WorkScheduleTemplate[] | PaginatedResponse<WorkScheduleTemplate>>(WORK_SCHEDULE_TEMPLATES_PATH);
  return normalizeListResponse(res.data).data;
}

export async function createWorkScheduleTemplate(payload: {
  name: string;
  description?: string;
  days: ScheduleDayPayload;
}): Promise<WorkScheduleTemplate> {
  const res = await api.post<WorkScheduleTemplate>(WORK_SCHEDULE_TEMPLATES_PATH, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function updateWorkScheduleTemplate(
  id: string,
  payload: Partial<{ name: string; description: string; days: ScheduleDayPayload }>,
): Promise<WorkScheduleTemplate> {
  const res = await api.patch<WorkScheduleTemplate>(`${WORK_SCHEDULE_TEMPLATES_PATH}${id}/`, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function applyWorkScheduleTemplate(
  templateId: string,
  payload: { employee_ids: string[]; start_date: string; notes?: string },
): Promise<{ applied: number; errors: Array<{ employee_id: string; employee: string; error: string }> }> {
  const res = await api.post<{ applied: number; errors: Array<{ employee_id: string; employee: string; error: string }> }>(
    `${WORK_SCHEDULE_TEMPLATES_PATH}${templateId}/apply/`,
    payload,
    LONG_REQUEST_TIMEOUT_MS,
  );
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Biometric devices & mapping ----
export async function getBiometricDevices(): Promise<BiometricDevice[]> {
  const res = await api.get<BiometricDevice[] | PaginatedResponse<BiometricDevice>>(BIOMETRIC_DEVICES_PATH);
  return normalizeListResponse(res.data).data;
}

export async function createBiometricDevice(payload: { name: string; location?: string }): Promise<BiometricDevice> {
  const res = await api.post<BiometricDevice>(BIOMETRIC_DEVICES_PATH, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function getEmployeeBiometricIds(params?: { employee?: string }): Promise<EmployeeBiometricId[]> {
  const query = buildQuery({ employee: params?.employee });
  const res = await api.get<EmployeeBiometricId[] | PaginatedResponse<EmployeeBiometricId>>(`${BIOMETRIC_IDS_PATH}${query}`);
  return normalizeListResponse(res.data).data;
}

export async function createEmployeeBiometricId(payload: {
  employee: string;
  biometric_code: string;
  device?: string | null;
}): Promise<EmployeeBiometricId> {
  const res = await api.post<EmployeeBiometricId>(BIOMETRIC_IDS_PATH, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function deleteEmployeeBiometricId(id: string): Promise<void> {
  await api.delete(`${BIOMETRIC_IDS_PATH}${id}/`);
}

// ---- Biometric imports ----
export async function getBiometricImportBatches(): Promise<BiometricImportBatch[]> {
  const res = await api.get<BiometricImportBatch[] | PaginatedResponse<BiometricImportBatch>>(BIOMETRIC_IMPORTS_PATH);
  return normalizeListResponse(res.data).data;
}

export async function uploadBiometricFile(file: File, deviceId?: string): Promise<BiometricImportBatch> {
  const formData = new FormData();
  formData.append('file', file);
  if (deviceId) formData.append('device', deviceId);
  const res = await api.post<BiometricImportBatch>(`${BIOMETRIC_IMPORTS_PATH}upload/`, formData, LONG_REQUEST_TIMEOUT_MS);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function getUnmatchedPunches(batchId: string): Promise<RawBiometricPunch[]> {
  const res = await api.get<RawBiometricPunch[]>(`${BIOMETRIC_IMPORTS_PATH}${batchId}/unmatched/`);
  return res.data ?? [];
}

export interface UnmatchedBiometricCode {
  biometric_code: string;
  occurrences: number;
  last_seen: string;
  device: string | null;
  device_name: string | null;
}

export async function getUnmatchedBiometricCodes(): Promise<UnmatchedBiometricCode[]> {
  const res = await api.get<UnmatchedBiometricCode[]>(`${BIOMETRIC_IMPORTS_PATH}unmatched-codes/`);
  return res.data ?? [];
}

// ---- Attendance intelligence settings ----
export interface AttendanceIntelligenceSettings {
  id: string;
  duplicate_punch_window_minutes: number;
  schedule_proximity_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getAttendanceIntelligenceSettings(): Promise<AttendanceIntelligenceSettings> {
  const res = await api.get<AttendanceIntelligenceSettings>(`${ATTENDANCE_INTELLIGENCE_SETTINGS_PATH}current/`);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function updateAttendanceIntelligenceSettings(payload: {
  duplicate_punch_window_minutes?: number;
  schedule_proximity_minutes?: number;
}): Promise<AttendanceIntelligenceSettings> {
  const res = await api.post<AttendanceIntelligenceSettings>(`${ATTENDANCE_INTELLIGENCE_SETTINGS_PATH}current/`, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function consolidateBiometricBatch(batchId: string): Promise<{
  created: number;
  updated: number;
  skipped_corrected: number;
  incomplete: number;
}> {
  const res = await api.post<{ created: number; updated: number; skipped_corrected: number; incomplete: number }>(
    `${BIOMETRIC_IMPORTS_PATH}${batchId}/consolidate/`,
    {},
    LONG_REQUEST_TIMEOUT_MS,
  );
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Attendance correction ----
export async function correctAttendance(
  id: string,
  payload: { check_in?: string | null; check_out?: string | null; break_start?: string | null; break_end?: string | null; reason: string },
): Promise<Attendance> {
  const res = await api.post<Attendance>(`${ATTENDANCE_PATH}${id}/correct/`, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function getPendingCorrectionAttendance(params?: { employee?: string; date_from?: string; date_to?: string }): Promise<Attendance[]> {
  const query = buildQuery({ employee: params?.employee, date_from: params?.date_from, date_to: params?.date_to });
  const res = await api.get<Attendance[] | PaginatedResponse<Attendance>>(`${ATTENDANCE_PATH}pending-correction/${query}`);
  return normalizeListResponse(res.data).data;
}

// ---- Performance reviews ----
export async function getPerformanceReviews(params?: ListPerformanceReviewParams): Promise<{
  data: PerformanceReview[];
  total: number;
  next: string | null;
  previous: string | null;
}> {
  const query = buildQuery({ page: params?.page, page_size: params?.limit, employee: params?.employee, reviewer: params?.reviewer });
  const res = await api.get<PerformanceReview[] | PaginatedResponse<PerformanceReview>>(`${PERFORMANCE_REVIEWS_PATH}${query}`);
  return normalizeListResponse(res.data);
}

export async function createPerformanceReview(payload: PerformanceReviewPayload): Promise<PerformanceReview> {
  const res = await api.post<PerformanceReview>(PERFORMANCE_REVIEWS_PATH, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Documents ----
export async function getEmployeeDocuments(params?: ListDocumentParams): Promise<{
  data: EmployeeDocument[];
  total: number;
  next: string | null;
  previous: string | null;
}> {
  const query = buildQuery({
    page: params?.page,
    page_size: params?.limit,
    employee: params?.employee,
    document_type: params?.document_type,
    status: params?.status,
  });
  const res = await api.get<EmployeeDocument[] | PaginatedResponse<EmployeeDocument>>(`${DOCUMENTS_PATH}${query}`);
  return normalizeListResponse(res.data);
}

export async function createEmployeeDocument(payload: EmployeeDocumentPayload): Promise<EmployeeDocument> {
  const res = await api.post<EmployeeDocument>(DOCUMENTS_PATH, buildEmployeeDocumentBody(payload));
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function updateEmployeeDocument(id: string, payload: Partial<EmployeeDocumentPayload>): Promise<EmployeeDocument> {
  const res = await api.patch<EmployeeDocument>(`${DOCUMENTS_PATH}${id}/`, buildEmployeeDocumentBody(payload));
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function deleteEmployeeDocument(id: string): Promise<void> {
  await api.delete(`${DOCUMENTS_PATH}${id}/`);
}

export async function getMyEmployeeDocuments(): Promise<EmployeeDocument[]> {
  const res = await api.get<EmployeeDocument[]>(`${DOCUMENTS_PATH}me/`);
  return res.data ?? [];
}

export async function createMyEmployeeDocument(payload: Omit<EmployeeDocumentPayload, 'employee' | 'status'>): Promise<EmployeeDocument> {
  const res = await api.post<EmployeeDocument>(`${DOCUMENTS_PATH}me/`, buildEmployeeDocumentBody(payload));
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Notifications ----
export async function getHRNotifications(params?: ListNotificationParams): Promise<{
  data: HRNotification[];
  total: number;
  next: string | null;
  previous: string | null;
}> {
  const query = buildQuery({
    page: params?.page,
    page_size: params?.limit,
    employee: params?.employee,
    document: params?.document,
    notification_type: params?.notification_type,
    status: params?.status,
  });
  const res = await api.get<HRNotification[] | PaginatedResponse<HRNotification>>(`${NOTIFICATIONS_PATH}${query}`);
  return normalizeListResponse(res.data);
}

export async function markHRNotificationRead(id: string): Promise<HRNotification> {
  const res = await api.post<HRNotification>(`${NOTIFICATIONS_PATH}${id}/mark-read/`, {});
  if (res.data) return res.data;
  throw new Error(res.message);
}

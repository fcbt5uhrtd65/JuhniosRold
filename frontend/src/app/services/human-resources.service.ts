// ============================================================
// Human Resources Service — Juhnios Rold Frontend
// Wraps attendance, request, payroll, document and notification APIs.
// ============================================================

import { api, API_BASE_URL, getAccessToken } from './api';

const HR_PATH = '/hr';
const ATTENDANCE_PATH = `${HR_PATH}/attendance/`;
const REQUESTS_PATH = `${HR_PATH}/requests/`;
const VACATIONS_PATH = `${HR_PATH}/vacations/`;
const REQUEST_ATTACHMENTS_PATH = `${HR_PATH}/request-attachments/`;
const PAYROLL_PATH = `${HR_PATH}/payroll/`;
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
  if (payload.support_document instanceof Blob) {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      if (value instanceof Blob) formData.append(key, value);
      else formData.append(key, String(value));
    });
    return formData;
  }

  const { support_document: _supportDocument, ...rest } = payload;
  return Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== null && value !== undefined && value !== ''),
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
export type VacationRequestType = 'PERMISSION' | 'OVERTIME' | 'LEAVE' | 'INCAPACITY' | 'VACATION' | 'OTHER';
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
  };
}

export interface PayrollItem {
  id: string;
  payroll: string;
  item_type: 'EARNING' | 'DEDUCTION';
  concept: string;
  amount: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Payroll {
  id: string;
  employee: string;
  period_start: string;
  period_end: string;
  base_salary: string;
  bonuses: string;
  deductions: string;
  net_salary: string;
  status: PayrollStatus;
  items: PayrollItem[];
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

function buildDecisionBody(comment: string, signatureFile?: File | null): FormData | { comment: string } {
  if (signatureFile) {
    const formData = new FormData();
    formData.append('comment', comment);
    formData.append('signature_override', signatureFile);
    return formData;
  }
  return { comment };
}

export async function approveVacationRequest(id: string, comment = '', signatureFile?: File | null): Promise<VacationRequest> {
  const res = await api.post<VacationRequest>(`${REQUESTS_PATH}${id}/approve/`, buildDecisionBody(comment, signatureFile));
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function rejectVacationRequest(id: string, comment = '', signatureFile?: File | null): Promise<VacationRequest> {
  const res = await api.post<VacationRequest>(`${REQUESTS_PATH}${id}/reject/`, buildDecisionBody(comment, signatureFile));
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function cancelVacationRequest(id: string, comment = ''): Promise<VacationRequest> {
  const res = await api.post<VacationRequest>(`${REQUESTS_PATH}${id}/cancel/`, { comment });
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function finalizeVacationRequest(id: string, comment = ''): Promise<VacationRequest> {
  const res = await api.post<VacationRequest>(`${REQUESTS_PATH}${id}/finalize/`, { comment });
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

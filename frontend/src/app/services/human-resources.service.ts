// ============================================================
// Human Resources Service — Juhnios Rold Frontend
// Wraps attendance, vacation, payroll and HR document endpoints.
// ============================================================

import { api } from './api';

const HR_PATH = '/hr';
const ATTENDANCE_PATH = `${HR_PATH}/attendance/`;
const VACATIONS_PATH = `${HR_PATH}/vacations/`;
const PAYROLL_PATH = `${HR_PATH}/payroll/`;
const PERFORMANCE_REVIEWS_PATH = `${HR_PATH}/performance-reviews/`;
const DOCUMENTS_PATH = `${HR_PATH}/documents/`;

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
  if (!payload) {
    return { data: [], total: 0, next: null, previous: null };
  }

  if (Array.isArray(payload)) {
    return { data: payload, total: payload.length, next: null, previous: null };
  }

  return {
    data: payload.results ?? [],
    total: payload.count ?? (payload.results?.length ?? 0),
    next: payload.next ?? null,
    previous: payload.previous ?? null,
  };
}

export type VacationRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PayrollStatus = 'DRAFT' | 'APPROVED' | 'PAID';

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

export interface VacationRequest {
  id: string;
  employee: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: VacationRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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
  document_type: string;
  name: string;
  file: string;
  expires_at: string | null;
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
  start_date: string;
  end_date: string;
  reason?: string;
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
  document_type: string;
  name: string;
  file: string;
  expires_at?: string | null;
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
  status?: VacationRequestStatus;
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
  document_type?: string;
}

// ---- Attendance ----
export async function getAttendance(params?: ListAttendanceParams): Promise<{
  data: Attendance[];
  total: number;
  next: string | null;
  previous: string | null;
}> {
  const query = buildQuery({
    page: params?.page,
    page_size: params?.limit,
    employee: params?.employee,
    date: params?.date,
  });
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

// ---- Vacation requests ----
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
  });
  const res = await api.get<VacationRequest[] | PaginatedResponse<VacationRequest>>(`${VACATIONS_PATH}${query}`);
  return normalizeListResponse(res.data);
}

export async function createVacationRequest(payload: VacationRequestPayload): Promise<VacationRequest> {
  const res = await api.post<VacationRequest>(VACATIONS_PATH, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function approveVacationRequest(id: string): Promise<VacationRequest> {
  const res = await api.post<VacationRequest>(`${VACATIONS_PATH}${id}/approve/`, {});
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function rejectVacationRequest(id: string): Promise<VacationRequest> {
  const res = await api.post<VacationRequest>(`${VACATIONS_PATH}${id}/reject/`, {});
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
  const query = buildQuery({
    page: params?.page,
    page_size: params?.limit,
    employee: params?.employee,
    status: params?.status,
  });
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
  const query = buildQuery({
    page: params?.page,
    page_size: params?.limit,
    employee: params?.employee,
    reviewer: params?.reviewer,
  });
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
  });
  const res = await api.get<EmployeeDocument[] | PaginatedResponse<EmployeeDocument>>(`${DOCUMENTS_PATH}${query}`);
  return normalizeListResponse(res.data);
}

export async function createEmployeeDocument(payload: EmployeeDocumentPayload): Promise<EmployeeDocument> {
  const res = await api.post<EmployeeDocument>(DOCUMENTS_PATH, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

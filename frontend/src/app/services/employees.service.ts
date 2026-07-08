// ============================================================
// Employees Service — Juhnios Rold Frontend
// Wraps employee, catalog, branch, work-day and HR history APIs.
// ============================================================

import { API_BASE_URL, api, getAccessToken } from './api';
import type { UserRole } from './auth.service';

const EMPLOYEES_PATH = '/employees/';
const DEPARTMENTS_PATH = '/employees/departments/';
const POSITIONS_PATH = '/employees/positions/';
const BRANCHES_PATH = '/employees/branches/';
const WORK_DAYS_PATH = '/employees/work-days/';
const FIELD_CONFIGURATIONS_PATH = '/employees/field-configurations/';
const CONTRACTS_PATH = '/employees/contracts/';
const CHANGE_LOGS_PATH = '/employees/change-logs/';
const SALARY_HISTORY_PATH = '/employees/salary-history/';
const POSITION_HISTORY_PATH = '/employees/position-history/';

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

function hasFile(payload: Record<string, unknown>): boolean {
  return Object.values(payload).some((value) => typeof File !== 'undefined' && value instanceof File);
}

function toRequestBody(payload: Record<string, unknown>): FormData | Record<string, unknown> {
  if (!hasFile(payload)) {
    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    );
  }

  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => formData.append(key, String(item)));
      return;
    }
    if (value instanceof File) {
      formData.append(key, value);
      return;
    }
    formData.append(key, String(value));
  });
  return formData;
}

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'LEAVE' | 'SUSPENDED' | 'TERMINATED';
export type EmployeeProfileStatus = 'DRAFT' | 'REGISTERED' | 'INCOMPLETE' | 'COMPLETE' | 'DOCUMENTED' | 'RETIRED';
export type DocumentType = 'CC' | 'CE' | 'PASSPORT' | 'NIT' | 'OTHER' | '';
export type Gender = 'FEMALE' | 'MALE' | 'NON_BINARY' | 'OTHER' | 'NOT_SPECIFIED' | '';
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'FREE_UNION' | 'DIVORCED' | 'WIDOWED' | 'OTHER' | '';
export type EmploymentType = 'EMPLOYEE' | 'SENA_APPRENTICE' | 'INTERN' | 'CONTRACTOR';
export type ContractType = 'INDEFINITE' | 'FIXED_TERM' | 'SERVICES' | 'APPRENTICESHIP' | 'INTERNSHIP' | 'OTHER';
export type WorkModality = 'ONSITE' | 'REMOTE' | 'HYBRID' | '';
export type BankAccountType = 'SAVINGS' | 'CHECKING' | '';
export type SalaryType = 'FIXED' | 'VARIABLE' | 'INTEGRAL';
export type HRFieldSection =
  | 'PERSONAL'
  | 'LABOR'
  | 'SOCIAL_SECURITY'
  | 'BANKING'
  | 'PAYROLL'
  | 'EMERGENCY'
  | 'DOCUMENTS'
  | 'ACCESS';

export interface Department {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Position {
  id: string;
  department: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Branch {
  id: string;
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
  responsible: string | null;
  responsible_name: string;
  status: 'ACTIVE' | 'INACTIVE';
  is_active: boolean;
  employee_count: number;
  department_names: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface WorkDay {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface HRFieldConfiguration {
  id: string;
  section: HRFieldSection;
  field_name: string;
  label: string;
  is_required: boolean;
  is_active: boolean;
  help_text: string;
  choices: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Contract {
  id: string;
  employee: string;
  contract_type: 'INDEFINITE' | 'FIXED_TERM' | 'SERVICES';
  start_date: string;
  end_date: string | null;
  base_salary: string;
  is_active: boolean;
  document: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Employee {
  id: string;
  user: string | null;
  user_role_code: UserRole | '';
  created_by: string | null;
  updated_by: string | null;
  employee_code: string;
  profile_status: EmployeeProfileStatus;
  document_type: DocumentType;
  document_number: string | null;
  document_issue_date: string | null;
  document_issue_place: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  email: string;
  phone: string;
  address: string;
  city: string;
  residence_department: string;
  photo: string;
  nationality: string;
  gender: Gender;
  marital_status: MaritalStatus;
  department: string | null;
  position: string | null;
  manager: string | null;
  employment_type: EmploymentType;
  contract_type: ContractType;
  hire_date: string | null;
  base_salary: string;
  termination_date: string | null;
  status: EmployeeStatus;
  branch: string | null;
  cost_center: string;
  work_modality: WorkModality;
  termination_reason: string;
  work_observations: string;
  eps: string;
  pension_fund: string;
  severance_fund: string;
  arl: string;
  arl_risk_level: string;
  compensation_fund: string;
  bank_name: string;
  bank_account_type: BankAccountType;
  bank_account_number: string;
  bank_account_holder: string;
  bank_account_holder_document: string;
  salary_type: SalaryType;
  transport_allowance_applies: boolean;
  integral_salary: boolean;
  weekly_working_hours: string | null;
  working_days: string[];
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_mobile: string;
  emergency_contact_alternate_phone: string;
  emergency_contact_address: string;
  age: number | null;
  seniority_days: number | null;
  time_in_position_days: number | null;
  remaining_contract_days: number | null;
  profile_completion_percentage: number;
  pending_documents_count: number;
  expired_documents_count: number;
  contracts: Contract[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DepartmentPayload {
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface PositionPayload {
  department: string;
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface BranchPayload {
  code: string;
  name: string;
  address?: string;
  city?: string;
  department?: string;
  country?: string;
  latitude?: string | null;
  longitude?: string | null;
  phone?: string;
  email?: string;
  responsible?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  is_active?: boolean;
}

export interface WorkDayPayload {
  code: string;
  name: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface EmployeePayload {
  user?: string | null;
  user_role?: UserRole | '';
  user_email?: string;
  user_email_confirm?: string;
  user_password?: string;
  user_password_confirm?: string;
  employee_code?: string;
  profile_status?: EmployeeProfileStatus;
  document_type?: DocumentType;
  document_number?: string | null;
  document_issue_date?: string | null;
  document_issue_place?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string | null;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  residence_department?: string;
  photo?: File | string | null;
  nationality?: string;
  gender?: Gender;
  marital_status?: MaritalStatus;
  department?: string | null;
  position?: string | null;
  manager?: string | null;
  employment_type?: EmploymentType;
  contract_type?: ContractType;
  hire_date?: string | null;
  base_salary?: string | number;
  termination_date?: string | null;
  status?: EmployeeStatus;
  branch?: string | null;
  cost_center?: string;
  work_modality?: WorkModality;
  termination_reason?: string;
  work_observations?: string;
  eps?: string;
  pension_fund?: string;
  severance_fund?: string;
  arl?: string;
  arl_risk_level?: string;
  compensation_fund?: string;
  bank_name?: string;
  bank_account_type?: BankAccountType;
  bank_account_number?: string;
  bank_account_holder?: string;
  bank_account_holder_document?: string;
  salary_type?: SalaryType;
  transport_allowance_applies?: boolean;
  integral_salary?: boolean;
  weekly_working_hours?: string | number | null;
  working_days?: string[];
  emergency_contact_name?: string;
  emergency_contact_relationship?: string;
  emergency_contact_mobile?: string;
  emergency_contact_alternate_phone?: string;
  emergency_contact_address?: string;
}

export interface ListEmployeesParams {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  position?: string;
  status?: EmployeeStatus;
  profile_status?: EmployeeProfileStatus;
  branch?: string;
  employment_type?: EmploymentType;
}

export interface ListDepartmentsParams {
  page?: number;
  limit?: number;
  search?: string;
  is_active?: boolean;
}

export interface ListPositionsParams extends ListDepartmentsParams {
  department?: string;
}

export interface ListBranchesParams extends ListDepartmentsParams {
  city?: string;
  department?: string;
  country?: string;
  responsible?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  ordering?: string;
}

export interface PaginatedEmployees {
  data: Employee[];
  total: number;
  next: string | null;
  previous: string | null;
}

export interface PaginatedDepartments {
  data: Department[];
  total: number;
  next: string | null;
  previous: string | null;
}

export interface PaginatedPositions {
  data: Position[];
  total: number;
  next: string | null;
  previous: string | null;
}

export interface PaginatedBranches {
  data: Branch[];
  total: number;
  next: string | null;
  previous: string | null;
}

export interface PaginatedWorkDays {
  data: WorkDay[];
  total: number;
  next: string | null;
  previous: string | null;
}

interface BackendEmployeeListResponse extends PaginatedResponse<Employee> {}
interface BackendDepartmentListResponse extends PaginatedResponse<Department> {}
interface BackendPositionListResponse extends PaginatedResponse<Position> {}
interface BackendBranchListResponse extends PaginatedResponse<Branch> {}
interface BackendWorkDayListResponse extends PaginatedResponse<WorkDay> {}

// ---- Departments ----
export async function getDepartments(params?: ListDepartmentsParams): Promise<PaginatedDepartments> {
  const query = buildQuery({ page: params?.page, page_size: params?.limit, search: params?.search, is_active: params?.is_active });
  const res = await api.get<Department[] | BackendDepartmentListResponse>(`${DEPARTMENTS_PATH}${query}`);
  return normalizeListResponse(res.data);
}

export async function createDepartment(payload: DepartmentPayload): Promise<Department> {
  const res = await api.post<Department>(DEPARTMENTS_PATH, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function updateDepartment(id: string, payload: Partial<DepartmentPayload>): Promise<Department> {
  const res = await api.patch<Department>(`${DEPARTMENTS_PATH}${id}/`, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function deleteDepartment(id: string): Promise<void> {
  await api.delete(`${DEPARTMENTS_PATH}${id}/`);
}

export async function exportDepartmentsPdf(): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
  }

  const response = await fetch(`${API_BASE_URL}${DEPARTMENTS_PATH}export-pdf/`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('No se pudo exportar el PDF de departamentos.');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'departamentos-juhnios-rold.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ---- Positions ----
export async function getPositions(params?: ListPositionsParams): Promise<PaginatedPositions> {
  const query = buildQuery({
    page: params?.page,
    page_size: params?.limit,
    search: params?.search,
    department: params?.department,
    is_active: params?.is_active,
  });
  const res = await api.get<Position[] | BackendPositionListResponse>(`${POSITIONS_PATH}${query}`);
  return normalizeListResponse(res.data);
}

export async function createPosition(payload: PositionPayload): Promise<Position> {
  const res = await api.post<Position>(POSITIONS_PATH, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function updatePosition(id: string, payload: Partial<PositionPayload>): Promise<Position> {
  const res = await api.patch<Position>(`${POSITIONS_PATH}${id}/`, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function deletePosition(id: string): Promise<void> {
  await api.delete(`${POSITIONS_PATH}${id}/`);
}

export async function exportPositionsPdf(): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
  }

  const response = await fetch(`${API_BASE_URL}${POSITIONS_PATH}export-pdf/`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('No se pudo exportar el PDF de cargos.');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'cargos-juhnios-rold.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ---- Branches ----
export async function getBranches(params?: ListBranchesParams): Promise<PaginatedBranches> {
  const query = buildQuery({
    page: params?.page,
    page_size: params?.limit,
    search: params?.search,
    city: params?.city,
    department: params?.department,
    country: params?.country,
    responsible: params?.responsible,
    status: params?.status,
    ordering: params?.ordering,
    is_active: params?.is_active,
  });
  const res = await api.get<Branch[] | BackendBranchListResponse>(`${BRANCHES_PATH}${query}`);
  return normalizeListResponse(res.data);
}

export async function getBranchById(id: string): Promise<Branch> {
  const res = await api.get<Branch>(`${BRANCHES_PATH}${id}/`);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function createBranch(payload: BranchPayload): Promise<Branch> {
  const res = await api.post<Branch>(BRANCHES_PATH, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function updateBranch(id: string, payload: Partial<BranchPayload>): Promise<Branch> {
  const res = await api.patch<Branch>(`${BRANCHES_PATH}${id}/`, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function deleteBranch(id: string): Promise<void> {
  await api.delete(`${BRANCHES_PATH}${id}/`);
}

export async function exportBranchesPdf(): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
  }

  const response = await fetch(`${API_BASE_URL}${BRANCHES_PATH}export-pdf/`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('No se pudo exportar el PDF de sedes.');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sedes-juhnios-rold.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ---- Work days ----
export async function getWorkDays(params?: ListDepartmentsParams): Promise<PaginatedWorkDays> {
  const query = buildQuery({ page: params?.page, page_size: params?.limit, search: params?.search, is_active: params?.is_active });
  const res = await api.get<WorkDay[] | BackendWorkDayListResponse>(`${WORK_DAYS_PATH}${query}`);
  return normalizeListResponse(res.data);
}

export async function createWorkDay(payload: WorkDayPayload): Promise<WorkDay> {
  const res = await api.post<WorkDay>(WORK_DAYS_PATH, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- Field configuration ----
export async function getHRFieldConfigurations(params?: {
  page?: number;
  limit?: number;
  section?: HRFieldSection;
  is_required?: boolean;
  is_active?: boolean;
}): Promise<{ data: HRFieldConfiguration[]; total: number; next: string | null; previous: string | null }> {
  const query = buildQuery({
    page: params?.page,
    page_size: params?.limit,
    section: params?.section,
    is_required: params?.is_required,
    is_active: params?.is_active,
  });
  const res = await api.get<HRFieldConfiguration[] | PaginatedResponse<HRFieldConfiguration>>(`${FIELD_CONFIGURATIONS_PATH}${query}`);
  return normalizeListResponse(res.data);
}

// ---- Employees ----
export async function getEmployees(params?: ListEmployeesParams): Promise<PaginatedEmployees> {
  const query = buildQuery({
    page: params?.page,
    page_size: params?.limit,
    search: params?.search,
    department: params?.department,
    position: params?.position,
    status: params?.status,
    profile_status: params?.profile_status,
    branch: params?.branch,
    employment_type: params?.employment_type,
  });
  const res = await api.get<Employee[] | BackendEmployeeListResponse>(`${EMPLOYEES_PATH}${query}`);
  return normalizeListResponse(res.data);
}

export async function getEmployeeById(id: string): Promise<Employee> {
  const res = await api.get<Employee>(`${EMPLOYEES_PATH}${id}/`);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function createEmployee(payload: EmployeePayload): Promise<Employee> {
  const res = await api.post<Employee>(EMPLOYEES_PATH, toRequestBody(payload as Record<string, unknown>));
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function updateEmployee(id: string, payload: Partial<EmployeePayload>): Promise<Employee> {
  const res = await api.patch<Employee>(`${EMPLOYEES_PATH}${id}/`, toRequestBody(payload as Record<string, unknown>));
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function deleteEmployee(id: string): Promise<void> {
  await api.delete(`${EMPLOYEES_PATH}${id}/`);
}

export async function getMyEmployeeProfile(): Promise<Employee> {
  const res = await api.get<Employee>(`${EMPLOYEES_PATH}me/`);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function updateMyEmployeeProfile(payload: Partial<EmployeePayload>): Promise<Employee> {
  const res = await api.patch<Employee>(`${EMPLOYEES_PATH}me/`, toRequestBody(payload as Record<string, unknown>));
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function exportEmployeesPdf(): Promise<void> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Tu sesion expiro. Inicia sesion de nuevo.');
  }

  const response = await fetch(`${API_BASE_URL}${EMPLOYEES_PATH}export-pdf/`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('No se pudo exportar el PDF de empleados.');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'empleados-juhnios-rold.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ---- Contracts ----
export async function getContracts(params?: {
  page?: number;
  limit?: number;
  employee?: string;
  contract_type?: Contract['contract_type'];
  is_active?: boolean;
}): Promise<{ data: Contract[]; total: number; next: string | null; previous: string | null }> {
  const query = buildQuery({
    page: params?.page,
    page_size: params?.limit,
    employee: params?.employee,
    contract_type: params?.contract_type,
    is_active: params?.is_active,
  });
  const res = await api.get<Contract[] | PaginatedResponse<Contract>>(`${CONTRACTS_PATH}${query}`);
  return normalizeListResponse(res.data);
}

export async function createContract(payload: {
  employee: string;
  contract_type: Contract['contract_type'];
  start_date: string;
  end_date?: string | null;
  base_salary: string | number;
  is_active?: boolean;
  document?: string;
}): Promise<Contract> {
  const res = await api.post<Contract>(CONTRACTS_PATH, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

// ---- History ----
export interface EmployeeChangeLog {
  id: string;
  employee: string;
  changed_by: string | null;
  field_name: string;
  old_value: string;
  new_value: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EmployeeSalaryHistory {
  id: string;
  employee: string;
  previous_salary: string | null;
  new_salary: string;
  start_date: string;
  changed_by: string | null;
  reason: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EmployeePositionHistory {
  id: string;
  employee: string;
  previous_position: string | null;
  new_position: string;
  start_date: string;
  changed_by: string | null;
  reason: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export async function getEmployeeChangeLogs(employee: string): Promise<{ data: EmployeeChangeLog[]; total: number; next: string | null; previous: string | null }> {
  const res = await api.get<EmployeeChangeLog[] | PaginatedResponse<EmployeeChangeLog>>(`${CHANGE_LOGS_PATH}${buildQuery({ employee, page_size: 200 })}`);
  return normalizeListResponse(res.data);
}

export async function getEmployeeSalaryHistory(employee: string): Promise<{ data: EmployeeSalaryHistory[]; total: number; next: string | null; previous: string | null }> {
  const res = await api.get<EmployeeSalaryHistory[] | PaginatedResponse<EmployeeSalaryHistory>>(`${SALARY_HISTORY_PATH}${buildQuery({ employee, page_size: 200 })}`);
  return normalizeListResponse(res.data);
}

export async function getEmployeePositionHistory(employee: string): Promise<{ data: EmployeePositionHistory[]; total: number; next: string | null; previous: string | null }> {
  const res = await api.get<EmployeePositionHistory[] | PaginatedResponse<EmployeePositionHistory>>(`${POSITION_HISTORY_PATH}${buildQuery({ employee, page_size: 200 })}`);
  return normalizeListResponse(res.data);
}

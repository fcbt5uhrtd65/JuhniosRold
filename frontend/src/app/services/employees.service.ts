// ============================================================
// Employees Service — Juhnios Rold Frontend
// Wraps the backend employee, department and position endpoints.
// ============================================================

import { api } from './api';

const EMPLOYEES_PATH = '/employees/';
const DEPARTMENTS_PATH = '/employees/departments/';
const POSITIONS_PATH = '/employees/positions/';
const CONTRACTS_PATH = '/employees/contracts/';

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

export type EmployeeStatus = 'ACTIVE' | 'LEAVE' | 'SUSPENDED' | 'TERMINATED';

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
  employee_code: string;
  document_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address: string;
  department: string;
  position: string;
  manager: string | null;
  hire_date: string;
  termination_date: string | null;
  status: EmployeeStatus;
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

export interface EmployeePayload {
  user?: string | null;
  employee_code: string;
  document_number: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  department: string;
  position: string;
  manager?: string | null;
  hire_date: string;
  termination_date?: string | null;
  status?: EmployeeStatus;
}

export interface ListEmployeesParams {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  position?: string;
  status?: EmployeeStatus;
}

export interface ListDepartmentsParams {
  page?: number;
  limit?: number;
  search?: string;
  is_active?: boolean;
}

export interface ListPositionsParams {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  is_active?: boolean;
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

interface BackendEmployeeListResponse extends PaginatedResponse<Employee> {}
interface BackendDepartmentListResponse extends PaginatedResponse<Department> {}
interface BackendPositionListResponse extends PaginatedResponse<Position> {}

// ---- Departments ----
export async function getDepartments(params?: ListDepartmentsParams): Promise<PaginatedDepartments> {
  const query = buildQuery({
    page: params?.page,
    page_size: params?.limit,
    search: params?.search,
    is_active: params?.is_active,
  });
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

// ---- Employees ----
export async function getEmployees(params?: ListEmployeesParams): Promise<PaginatedEmployees> {
  const query = buildQuery({
    page: params?.page,
    page_size: params?.limit,
    search: params?.search,
    department: params?.department,
    position: params?.position,
    status: params?.status,
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
  const res = await api.post<Employee>(EMPLOYEES_PATH, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function updateEmployee(id: string, payload: Partial<EmployeePayload>): Promise<Employee> {
  const res = await api.patch<Employee>(`${EMPLOYEES_PATH}${id}/`, payload);
  if (res.data) return res.data;
  throw new Error(res.message);
}

export async function deleteEmployee(id: string): Promise<void> {
  await api.delete(`${EMPLOYEES_PATH}${id}/`);
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

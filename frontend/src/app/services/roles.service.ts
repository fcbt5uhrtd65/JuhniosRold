import { api } from './api';

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string;
  is_superuser: boolean;
  is_default: boolean;
  is_active: boolean;
  component_permissions: RoleComponentPermission[];
  created_at: string;
  updated_at: string;
}

export interface Component {
  id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleComponentPermission {
  id: string;
  role: string;
  component: Component;
  can_view: boolean;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRolePayload {
  code: string;
  name: string;
  description?: string;
  is_superuser?: boolean;
  is_default?: boolean;
  is_active?: boolean;
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
  is_superuser?: boolean;
  is_default?: boolean;
  is_active?: boolean;
}

export interface CreateComponentPayload {
  code: string;
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface UpdateComponentPayload {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface SetPermissionPayload {
  role: string;
  component_id: string;
  can_view: boolean;
  can_edit: boolean;
}

// --- Roles ---

export async function getRoles(): Promise<Role[]> {
  const res = await api.get<Role[]>('/auth/roles/');
  if (Array.isArray(res.data)) return res.data;
  if (res.data && 'results' in (res.data as Record<string, unknown>)) {
    return (res.data as { results: Role[] }).results;
  }
  return [];
}

export async function createRole(payload: CreateRolePayload): Promise<Role> {
  const res = await api.post<Role>('/auth/roles/', payload);
  if (!res.data) throw new Error(res.message);
  return res.data;
}

export async function updateRole(id: string, payload: UpdateRolePayload): Promise<Role> {
  const res = await api.patch<Role>(`/auth/roles/${id}/`, payload);
  if (!res.data) throw new Error(res.message);
  return res.data;
}

export async function deleteRole(id: string): Promise<void> {
  await api.delete(`/auth/roles/${id}/`);
}

// --- Components ---

export async function getComponents(): Promise<Component[]> {
  const res = await api.get<Component[]>('/auth/components/');
  if (Array.isArray(res.data)) return res.data;
  if (res.data && 'results' in (res.data as Record<string, unknown>)) {
    return (res.data as { results: Component[] }).results;
  }
  return [];
}

export async function createComponent(payload: CreateComponentPayload): Promise<Component> {
  const res = await api.post<Component>('/auth/components/', payload);
  if (!res.data) throw new Error(res.message);
  return res.data;
}

export async function updateComponent(id: string, payload: UpdateComponentPayload): Promise<Component> {
  const res = await api.patch<Component>(`/auth/components/${id}/`, payload);
  if (!res.data) throw new Error(res.message);
  return res.data;
}

export async function deleteComponent(id: string): Promise<void> {
  await api.delete(`/auth/components/${id}/`);
}

// --- Role-Component Permissions ---

export async function getRolePermissions(): Promise<RoleComponentPermission[]> {
  const res = await api.get<RoleComponentPermission[]>('/auth/role-permissions/');
  if (Array.isArray(res.data)) return res.data;
  if (res.data && 'results' in (res.data as Record<string, unknown>)) {
    return (res.data as { results: RoleComponentPermission[] }).results;
  }
  return [];
}

export async function setRolePermission(payload: SetPermissionPayload): Promise<RoleComponentPermission> {
  const res = await api.post<RoleComponentPermission>('/auth/role-permissions/', payload);
  if (!res.data) throw new Error(res.message);
  return res.data;
}

export async function updateRolePermission(
  id: string,
  payload: { can_view: boolean; can_edit: boolean },
): Promise<RoleComponentPermission> {
  const res = await api.patch<RoleComponentPermission>(`/auth/role-permissions/${id}/`, payload);
  if (!res.data) throw new Error(res.message);
  return res.data;
}

export async function deleteRolePermission(id: string): Promise<void> {
  await api.delete(`/auth/role-permissions/${id}/`);
}

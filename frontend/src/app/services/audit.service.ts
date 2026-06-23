import { api } from './api';

const AUDIT_LOGS_PATH = '/audit/logs/';

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface AuditLog {
  id: string;
  actor: string | null;
  actor_email: string | null;
  module: string;
  action: string;
  resource_type: string;
  resource_id: string;
  ip_address: string | null;
  user_agent: string;
  request_path: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

async function getPage<T>(path: string): Promise<T[]> {
  const firstResponse = await api.get<PaginatedResponse<T>>(`${path}?page_size=100&ordering=-created_at`);
  const firstPage = firstResponse.data;
  if (!firstPage) return [];

  const totalPages = Math.ceil(firstPage.count / 100);
  if (totalPages <= 1) return firstPage.results;

  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      api.get<PaginatedResponse<T>>(`${path}?page_size=100&page=${index + 2}&ordering=-created_at`),
    ),
  );

  return [
    ...firstPage.results,
    ...remainingPages.flatMap(response => response.data?.results ?? []),
  ];
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  return getPage<AuditLog>(AUDIT_LOGS_PATH);
}


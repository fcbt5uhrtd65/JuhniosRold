import { api } from './api';

export type NotificationType =
  | 'order_confirmed'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'wholesale_activated'
  | 'promo'
  | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  action_url: string;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

export async function fetchNotifications(): Promise<Notification[]> {
  const res = await api.get<Notification[]>('/notifications/');
  return Array.isArray(res.data) ? res.data : [];
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const res = await api.patch<Notification>(`/notifications/${id}/read/`, {});
  if (!res.data) throw new Error('Error al marcar notificación.');
  return res.data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch('/notifications/read-all/', {});
}

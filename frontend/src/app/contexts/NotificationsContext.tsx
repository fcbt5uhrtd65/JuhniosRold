import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useUser } from './UserContext';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from '../services/notifications.service';

const POLL_INTERVAL_MS = 30_000;

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshSoon: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch {
      // silencioso: no interrumpir la UI si el polling falla
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [currentUser, refresh]);

  const markRead = useCallback(async (id: string) => {
    try {
      const updated = await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? updated : n));
    } catch {
      // silencioso
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {
      // silencioso
    }
  }, []);

  const refreshSoon = useCallback(() => {
    void refresh();
    window.setTimeout(() => void refresh(), 1000);
    window.setTimeout(() => void refresh(), 3000);
  }, [refresh]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, refresh, refreshSoon }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}

import {createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode} from 'react';
import {useAuth} from './AuthContext';
import {fetchNotifications, fetchUnreadCount, markAsRead, markAllAsRead} from '../api/notification/NotificationApi';
import type {Notification} from '../type/NotificationType';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    loadNotifications: (silent?: boolean) => Promise<boolean>;
    refreshAll: (silent?: boolean) => Promise<boolean>;
    handleMarkAsRead: (id: number) => Promise<void>;
    handleMarkAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({children}: { children: ReactNode }) {
    const {isAuthenticated} = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const wsRef = useRef<WebSocket | null>(null);

    const loadNotifications = useCallback(async (silent: boolean = false) => {
        try {
            const res = await fetchNotifications(undefined, silent ? { skipGlobalError: true } : undefined);
            setNotifications(res.result ?? []);
            return true;
        } catch (error) {
            console.error(error);
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const loadUnreadCount = useCallback(async (silent: boolean = false) => {
        try {
            const res = await fetchUnreadCount(silent ? { skipGlobalError: true } : undefined);
            setUnreadCount(res.result ?? 0);
        } catch (error) {
            console.error(error);
        }
    }, []);

    const handleMarkAsRead = useCallback(async (id: number) => {
        await markAsRead(id);
        setNotifications(prev => prev.map(n => n.id === id ? {...n, isRead: true} : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
    }, []);

    const handleMarkAllAsRead = useCallback(async () => {
        await markAllAsRead();
        setNotifications(prev => prev.map(n => ({...n, isRead: true})));
        setUnreadCount(0);
    }, []);

    const refreshAll = useCallback(async (silent: boolean = false) => {
        const [ok] = await Promise.all([loadNotifications(silent), loadUnreadCount(silent)]);
        return ok;
    }, [loadNotifications, loadUnreadCount]);

    useEffect(() => {
        if (!isAuthenticated) return;

        refreshAll();

        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let reconnectAttempt = 0;
        let isCancelled = false;

        const connect = () => {
            if (isCancelled) return;

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/notification`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                reconnectAttempt = 0; // 연결 성공 시 backoff 리셋
            };

            ws.onmessage = (event) => {
                try {
                    const notification: Notification = JSON.parse(event.data);
                    setNotifications(prev => [notification, ...prev]);
                    setUnreadCount(prev => prev + 1);
                } catch (error) {
                    console.error(error);
                }
            };

            ws.onerror = (event) => {
                console.error('[NotificationWS] connection error:', event);
                // UI 알림 없음 — onclose 에서 reconnect 로 복구
            };

            ws.onclose = () => {
                wsRef.current = null;
                if (!isCancelled) {
                    const delay = Math.min(3000 * Math.pow(2, reconnectAttempt), 60_000);
                    reconnectAttempt++;
                    reconnectTimer = setTimeout(() => {
                        refreshAll(true);
                        connect();
                    }, delay);
                }
            };
        };

        connect();

        return () => {
            isCancelled = true;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            wsRef.current?.close();
            wsRef.current = null;
        };
    }, [isAuthenticated, refreshAll]);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            loading,
            loadNotifications,
            refreshAll,
            handleMarkAsRead,
            handleMarkAllAsRead,
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
    return ctx;
}

import {createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode} from 'react';
import {useAuth} from './AuthContext';
import {fetchNotifications, fetchUnreadCount, markAsRead, markAllAsRead} from '../api/notification/NotificationApi';
import type {Notification} from '../type/NotificationType';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    loadNotifications: () => Promise<void>;
    refreshAll: () => Promise<void>;
    handleMarkAsRead: (id: number) => Promise<void>;
    handleMarkAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({children}: { children: ReactNode }) {
    const {isAuthenticated} = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const wsRef = useRef<WebSocket | null>(null);

    const loadNotifications = useCallback(async () => {
        try {
            const res = await fetchNotifications();
            setNotifications(res.result ?? []);
        } catch {
            // ignore
        }
    }, []);

    const loadUnreadCount = useCallback(async () => {
        try {
            const res = await fetchUnreadCount();
            setUnreadCount(res.result ?? 0);
        } catch {
            // ignore
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

    const refreshAll = useCallback(async () => {
        await Promise.all([loadNotifications(), loadUnreadCount()]);
    }, [loadNotifications, loadUnreadCount]);

    useEffect(() => {
        if (!isAuthenticated) return;

        refreshAll();

        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let isCancelled = false;

        const connect = () => {
            if (isCancelled) return;

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/notification`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onmessage = (event) => {
                try {
                    const notification: Notification = JSON.parse(event.data);
                    setNotifications(prev => [notification, ...prev]);
                    setUnreadCount(prev => prev + 1);
                } catch {
                    // ignore
                }
            };

            ws.onerror = () => {
                // silent
            };

            ws.onclose = () => {
                wsRef.current = null;
                if (!isCancelled) {
                    reconnectTimer = setTimeout(() => {
                        refreshAll();
                        connect();
                    }, 3000);
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

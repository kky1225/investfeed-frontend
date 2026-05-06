import {createContext, useContext, useEffect, useRef, ReactNode, useCallback} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {requireOk} from '../lib/apiResponse';
import {usePollingQuery} from '../lib/pollingQuery';
import {useAuth} from './AuthContext';
import {fetchNotifications, fetchUnreadCount, markAsRead, markAllAsRead} from '../api/notification/NotificationApi';
import type {Notification} from '../type/NotificationType';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    loading: boolean;
    lastUpdated: Date | null;
    pollError: boolean;
    loadNotifications: (silent?: boolean) => Promise<boolean>;
    refreshAll: (silent?: boolean) => Promise<boolean>;
    handleMarkAsRead: (id: number) => Promise<void>;
    handleMarkAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const NOTIFICATIONS_KEY = ['notifications'] as const;
const UNREAD_COUNT_KEY = ['notifications', 'unreadCount'] as const;

export function NotificationProvider({children}: { children: ReactNode }) {
    const {isAuthenticated} = useAuth();
    const queryClient = useQueryClient();
    const wsRef = useRef<WebSocket | null>(null);

    // 알림 목록 — 인증된 경우에만 1분 폴링
    const notificationsQuery = usePollingQuery<Notification[]>(
        NOTIFICATIONS_KEY,
        (config) => fetchNotifications(undefined, config),
        {enabled: isAuthenticated, fallback: []},
    );

    // 미읽음 카운트 — 인증된 경우에만 1분 폴링
    const unreadCountQuery = usePollingQuery<number>(
        UNREAD_COUNT_KEY,
        (config) => fetchUnreadCount(config),
        {enabled: isAuthenticated, fallback: 0},
    );

    const notifications: Notification[] = notificationsQuery.data ?? [];
    const unreadCount: number = unreadCountQuery.data ?? 0;
    const loading = notificationsQuery.isLoading;
    const lastUpdated = notificationsQuery.lastUpdated;
    const pollError = notificationsQuery.pollError;

    // 기존 외부 인터페이스 호환을 위한 wrapper
    const loadNotifications = useCallback(async (_silent: boolean = false) => {
        try {
            await queryClient.refetchQueries({queryKey: NOTIFICATIONS_KEY});
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }, [queryClient]);

    const refreshAll = useCallback(async (_silent: boolean = false) => {
        try {
            await Promise.all([
                queryClient.refetchQueries({queryKey: NOTIFICATIONS_KEY}),
                queryClient.refetchQueries({queryKey: UNREAD_COUNT_KEY}),
            ]);
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }, [queryClient]);

    const markAsReadMutation = useMutation({
        mutationFn: async (id: number) => {
            requireOk(await markAsRead(id), '알림 읽음 처리');
            return id;
        },
        onSuccess: (id) => {
            queryClient.setQueryData<Notification[] | null>(NOTIFICATIONS_KEY, (prev) => {
                if (!prev) return prev;
                return prev.map(n => n.id === id ? {...n, isRead: true} : n);
            });
            queryClient.setQueryData<number | null>(UNREAD_COUNT_KEY, (prev) => {
                if (prev == null) return prev;
                return Math.max(0, prev - 1);
            });
            queryClient.invalidateQueries({queryKey: NOTIFICATIONS_KEY});
            queryClient.invalidateQueries({queryKey: UNREAD_COUNT_KEY});
        },
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            requireOk(await markAllAsRead(), '전체 알림 읽음 처리');
        },
        onSuccess: () => {
            queryClient.setQueryData<Notification[] | null>(NOTIFICATIONS_KEY, (prev) => {
                if (!prev) return prev;
                return prev.map(n => ({...n, isRead: true}));
            });
            queryClient.setQueryData<number | null>(UNREAD_COUNT_KEY, () => 0);
            queryClient.invalidateQueries({queryKey: NOTIFICATIONS_KEY});
            queryClient.invalidateQueries({queryKey: UNREAD_COUNT_KEY});
        },
    });

    const handleMarkAsRead = useCallback(async (id: number) => {
        await markAsReadMutation.mutateAsync(id);
    }, [markAsReadMutation]);

    const handleMarkAllAsRead = useCallback(async () => {
        await markAllAsReadMutation.mutateAsync();
    }, [markAllAsReadMutation]);

    // WebSocket 라이프사이클 — 신규 알림 push 수신
    useEffect(() => {
        if (!isAuthenticated) return;

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
                reconnectAttempt = 0;
            };

            ws.onmessage = (event) => {
                try {
                    const notification: Notification = JSON.parse(event.data);
                    queryClient.setQueryData<Notification[] | null>(NOTIFICATIONS_KEY, (prev) => {
                        if (!prev) return [notification];
                        return [notification, ...prev];
                    });
                    queryClient.setQueryData<number | null>(UNREAD_COUNT_KEY, (prev) => {
                        if (prev == null) return 1;
                        return prev + 1;
                    });
                } catch (error) {
                    console.error(error);
                }
            };

            ws.onerror = (event) => {
                console.error('[NotificationWS] connection error:', event);
            };

            ws.onclose = () => {
                wsRef.current = null;
                if (!isCancelled) {
                    const delay = Math.min(3000 * Math.pow(2, reconnectAttempt), 60_000);
                    reconnectAttempt++;
                    reconnectTimer = setTimeout(() => {
                        // 재연결 시 최신 데이터 동기화 후 connect
                        queryClient.invalidateQueries({queryKey: NOTIFICATIONS_KEY});
                        queryClient.invalidateQueries({queryKey: UNREAD_COUNT_KEY});
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
    }, [isAuthenticated, queryClient]);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            loading,
            lastUpdated,
            pollError,
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

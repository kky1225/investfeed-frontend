import {createContext, useContext, useEffect, useRef, ReactNode, useCallback} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
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

interface NotificationsRes {
    code: string;
    msg?: string;
    result: Notification[];
}

interface UnreadCountRes {
    code: string;
    msg?: string;
    result: number;
}

export function NotificationProvider({children}: { children: ReactNode }) {
    const {isAuthenticated} = useAuth();
    const queryClient = useQueryClient();
    const wsRef = useRef<WebSocket | null>(null);

    // 알림 목록 — 인증된 경우에만 1분 폴링
    const notificationsQuery = useQuery<NotificationsRes>({
        queryKey: NOTIFICATIONS_KEY,
        queryFn: async ({signal}) => {
            const res = await fetchNotifications(undefined, {signal, skipGlobalError: true});
            if (res.code !== "0000") throw new Error(res.message || `알림 조회 실패 (${res.code})`);
            return res;
        },
        enabled: isAuthenticated,
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
    });

    // 미읽음 카운트 — 인증된 경우에만 1분 폴링
    const unreadCountQuery = useQuery<UnreadCountRes>({
        queryKey: UNREAD_COUNT_KEY,
        queryFn: async ({signal}) => {
            const res = await fetchUnreadCount({signal, skipGlobalError: true});
            if (res.code !== "0000") throw new Error(res.message || `미읽음 카운트 조회 실패 (${res.code})`);
            return res;
        },
        enabled: isAuthenticated,
        refetchInterval: 60_000,
        refetchIntervalInBackground: false,
    });

    const notifications: Notification[] = notificationsQuery.data?.result ?? [];
    const unreadCount: number = unreadCountQuery.data?.result ?? 0;
    const loading = notificationsQuery.isLoading;
    const lastUpdated: Date | null = notificationsQuery.data ? new Date(notificationsQuery.dataUpdatedAt) : null;
    const pollError: boolean = !!notificationsQuery.error;

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

    const handleMarkAsRead = useCallback(async (id: number) => {
        const res = await markAsRead(id);
        if (res.code !== "0000") throw new Error(res.message || `알림 읽음 처리 실패 (${res.code})`);
        // optimistic cache 갱신
        queryClient.setQueryData<NotificationsRes | undefined>(NOTIFICATIONS_KEY, (prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                result: prev.result.map(n => n.id === id ? {...n, isRead: true} : n),
            };
        });
        queryClient.setQueryData<UnreadCountRes | undefined>(UNREAD_COUNT_KEY, (prev) => {
            if (!prev) return prev;
            return {...prev, result: Math.max(0, prev.result - 1)};
        });
    }, [queryClient]);

    const handleMarkAllAsRead = useCallback(async () => {
        const res = await markAllAsRead();
        if (res.code !== "0000") throw new Error(res.message || `전체 알림 읽음 처리 실패 (${res.code})`);
        queryClient.setQueryData<NotificationsRes | undefined>(NOTIFICATIONS_KEY, (prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                result: prev.result.map(n => ({...n, isRead: true})),
            };
        });
        queryClient.setQueryData<UnreadCountRes | undefined>(UNREAD_COUNT_KEY, (prev) => {
            if (!prev) return prev;
            return {...prev, result: 0};
        });
    }, [queryClient]);

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
                    queryClient.setQueryData<NotificationsRes | undefined>(NOTIFICATIONS_KEY, (prev) => {
                        if (!prev) {
                            return {code: '0000', result: [notification]};
                        }
                        return {...prev, result: [notification, ...prev.result]};
                    });
                    queryClient.setQueryData<UnreadCountRes | undefined>(UNREAD_COUNT_KEY, (prev) => {
                        if (!prev) {
                            return {code: '0000', result: 1};
                        }
                        return {...prev, result: prev.result + 1};
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

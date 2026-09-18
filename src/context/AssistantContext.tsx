import {createContext, useCallback, useContext, useState, type ReactNode, useRef} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {usePollingQuery} from '../lib/pollingQuery';
import {useAuth} from './AuthContext';
import {fetchAssistantUnreadCount, markTimelineRead} from '../api/assistant/AssistantApi';

interface AssistantContextType {
    drawerOpen: boolean;
    openDrawer: () => void;
    closeDrawer: () => void;
    unreadCount: number;
    /** 2차 인증을 통과해 개인 섹션까지 받는 상태. secure 호출 실패 시 false 로 되돌림 */
    personalUnlocked: boolean;
    setPersonalUnlocked: (v: boolean) => void;
    /** "개인 파트 보기" 버튼: 이때만 2차 인증 다이얼로그를 띄운다. 이후 자동 재조회는 조용히 실패 → 공개 타임라인 */
    requestPersonalUnlock: () => void;
    /** 다음 secure 조회 1회에 다이얼로그를 허용할지. 읽으면 소모된다 */
    consumeUnlockPrompt: () => boolean;
    markRead: (lastSeenId: number) => void;
}

const AssistantContext = createContext<AssistantContextType | null>(null);

export const ASSISTANT_UNREAD_KEY = ['assistant', 'unreadCount'] as const;
export const ASSISTANT_TIMELINE_KEY = ['assistant', 'timeline'] as const;

export function AssistantProvider({children}: { children: ReactNode }) {
    const {isAuthenticated} = useAuth();
    const queryClient = useQueryClient();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [personalUnlocked, setPersonalUnlocked] = useState(false);
    const unlockPromptRef = useRef(false);
    const requestPersonalUnlock = useCallback(() => {
        unlockPromptRef.current = true;
        setPersonalUnlocked(true);
    }, []);
    const consumeUnlockPrompt = useCallback(() => {
        const v = unlockPromptRef.current;
        unlockPromptRef.current = false;
        return v;
    }, []);

    // 미확인 수 — 인증된 경우에만 1분 폴링 (WebSocket 은 2단계에서 검토)
    const unreadQuery = usePollingQuery<number>(
        ASSISTANT_UNREAD_KEY,
        (config) => fetchAssistantUnreadCount(config),
        {enabled: isAuthenticated, fallback: 0},
    );

    const readMutation = useMutation({
        mutationFn: (lastSeenId: number) => markTimelineRead({lastSeenId}),
        onSuccess: (res) => {
            queryClient.setQueryData(ASSISTANT_UNREAD_KEY, res.result ?? 0);
        },
    });

    const markRead = useCallback((lastSeenId: number) => {
        if (lastSeenId <= 0) return;
        readMutation.mutate(lastSeenId);
    }, [readMutation]);

    const openDrawer = useCallback(() => setDrawerOpen(true), []);
    const closeDrawer = useCallback(() => setDrawerOpen(false), []);

    return (
        <AssistantContext.Provider value={{
            drawerOpen,
            openDrawer,
            closeDrawer,
            unreadCount: unreadQuery.data ?? 0,
            personalUnlocked,
            setPersonalUnlocked,
            requestPersonalUnlock,
            consumeUnlockPrompt,
            markRead,
        }}>
            {children}
        </AssistantContext.Provider>
    );
}

export function useAssistant() {
    const ctx = useContext(AssistantContext);
    if (!ctx) throw new Error('useAssistant must be used within AssistantProvider');
    return ctx;
}

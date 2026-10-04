import {useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject} from 'react';
import {useInfiniteQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import ButtonBase from '@mui/material/ButtonBase';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import dayjs from 'dayjs';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import {useAlert} from '../../context/AlertContext';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import {requireOk} from '../../lib/apiResponse';
import {getServerNow} from '../../lib/serverTime';
import {deleteAssistantMessage, fetchSecureTimeline, fetchTimeline} from '../../api/assistant/AssistantApi';
import type {ChatPick, TimelineMessage, TimelinePage, TimelineView} from '../../type/AssistantType';
import {ASSISTANT_TIMELINE_KEY, useAssistant} from '../../context/AssistantContext';
import AssistantMessageView from './AssistantMessageView';

function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date(getServerNow());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const days = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return '오늘';
    if (days === 1) return '어제';
    if (days < 7) return `${days}일 전`;
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function groupByDate(items: TimelineMessage[]): Map<string, TimelineMessage[]> {
    const groups = new Map<string, TimelineMessage[]>();
    for (const m of items) {
        const key = formatDate(m.createdAt);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(m);
    }
    return groups;
}

/** 미확인 배지 대상 (서버 TimelineService.UNREAD_TYPES 와 같은 기준) */
const UNREAD_TYPES = ['BRIEFING', 'ALERT'];

interface AssistantTimelineProps {
    /** 서버에 아직 반영되지 않은 진행 중·실패 질문 (패널이 그린다) */
    tail?: ReactNode;
    /** 값이 바뀌면 맨 아래로 스크롤 (새 질문·새 카드) */
    tailVersion?: number;
    onPick?: (pick: ChatPick) => void;
    /** 보기 필터. 바뀌면 패널이 key 로 이 컴포넌트를 새로 그린다 (최신 위치부터) */
    filter: TimelineView;
    /** 스크롤 컨테이너 (패널의 overflow 영역). 2차 인증 전환 시 위치 복원용 */
    scrollRef: RefObject<HTMLDivElement | null>;
}

/** 화면 맨 위에 걸친 메시지와 그 위치. 2차 인증으로 개인 섹션이 펼쳐져도 같은 자리를 보게 한다 */
interface ScrollAnchor { id: string | null; offset: number; atBottom: boolean; }

function captureAnchor(c: HTMLDivElement | null): ScrollAnchor | null {
    if (!c) return null;
    const atBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 40;
    const top = c.getBoundingClientRect().top;
    for (const el of c.querySelectorAll<HTMLElement>('[data-msg-id]')) {
        const r = el.getBoundingClientRect();
        if (r.bottom > top) return {id: el.dataset.msgId ?? null, offset: r.top - top, atBottom};
    }
    return {id: null, offset: 0, atBottom};
}

const EMPTY_TEXT: Record<TimelineView, string> = {
    ALL: '아직 도착한 메시지가 없습니다.',
    BRIEFING: '아직 도착한 브리핑·알림이 없습니다.',
    CHAT: '아직 대화가 없습니다. 아래에 질문을 입력해 보세요.',
};

/** 서버 타임라인(최신순 페이지) + 진행 중 질문. 열릴 때 최신 id 로 읽음 처리 */
export default function AssistantTimeline({tail, tailVersion = 0, onPick, filter, scrollRef}: AssistantTimelineProps) {
    const {personalUnlocked, setPersonalUnlocked, requestPersonalUnlock, unlockTarget, clearUnlockTarget, consumeUnlockPrompt, markRead} = useAssistant();
    // 열 때 이미 있던 메시지의 마지막 id. 개인 내용은 이것보다 새 것("보기" 누른 것 포함)만 펼친 채로 보인다 (2026-10-01)
    const openedMaxIdRef = useRef<number | null>(null);
    useEffect(() => { clearUnlockTarget(); }, [clearUnlockTarget]);
    const markedRef = useRef<number>(0);
    // 열린 시점의 미확인 수. 첫 페이지 응답은 읽음 처리 전에 계산된 값이라 여기서만 붙잡아 둔다
    const unreadAtOpenRef = useRef<number | null>(null);
    const didScrollRef = useRef(false);
    const unreadMarkRef = useRef<HTMLDivElement | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const anchorRef = useRef<ScrollAnchor | null>(null);
    const restorePendingRef = useRef(false);
    const prevUnlockedRef = useRef(personalUnlocked);

    const queryClient = useQueryClient();
    const showAlert = useAlert();
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; isQuestion: boolean } | null>(null);
    const deleteMutation = useMutation({
        mutationFn: async (id: number) => requireOk(await deleteAssistantMessage(id), '메시지 삭제'),
        onSuccess: () => { setDeleteTarget(null); void queryClient.invalidateQueries({queryKey: ASSISTANT_TIMELINE_KEY}); },
        onError: (e) => { setDeleteTarget(null); showAlert((e as Error).message || '메시지를 삭제하지 못했습니다', 'error'); },
    });

    const query = useInfiniteQuery({
        queryKey: [...ASSISTANT_TIMELINE_KEY, personalUnlocked, filter],
        queryFn: async ({pageParam, signal}) => {
            const q = {before: pageParam ?? undefined, limit: 20, view: filter};
            if (!personalUnlocked) return requireOk<TimelinePage>(await fetchTimeline(q, {signal, skipGlobalError: true}), '비서 타임라인 조회');
            // 버튼으로 요청한 첫 조회만 2차 인증 다이얼로그 허용. 세션 만료 후 자동 재조회는 조용히 실패 → 아래 effect 가 공개로 되돌림
            const prompt = pageParam === undefined && consumeUnlockPrompt();
            return requireOk<TimelinePage>(
                await fetchSecureTimeline(q, {signal, skipGlobalError: true, secondaryAuthSilent: !prompt}),
                '비서 타임라인 조회',
            );
        },
        initialPageParam: undefined as number | undefined,
        getNextPageParam: (last) => last.nextCursor ?? undefined,
        retry: false,
        refetchOnWindowFocus: false,
        // 2차 인증 전환(공개 ↔ 개인)으로 다시 조회하는 동안 이전 목록을 그대로 둔다. 목록이 사라지면 스크롤이 맨 위로 리셋된다
        placeholderData: (prev) => prev,
    });

    // 사용자가 스크롤할 때마다 보던 위치를 기억 (복원 대기 중에는 레이아웃 변화로 생긴 스크롤 이벤트 무시)
    useEffect(() => {
        const c = scrollRef.current;
        if (!c) return;
        const onScroll = () => { if (!restorePendingRef.current) anchorRef.current = captureAnchor(c); };
        c.addEventListener('scroll', onScroll, {passive: true});
        return () => c.removeEventListener('scroll', onScroll);
    }, [scrollRef]);

    // 공개 ↔ 개인 전환 직후: 전환 전 위치를 붙잡고 복원 대기
    useLayoutEffect(() => {
        if (prevUnlockedRef.current === personalUnlocked) return;
        prevUnlockedRef.current = personalUnlocked;
        anchorRef.current = anchorRef.current ?? captureAnchor(scrollRef.current);
        restorePendingRef.current = true;
    }, [personalUnlocked, scrollRef]);

    // 새 본문이 그려지면 같은 메시지가 같은 자리에 오도록 맞춘다. 맨 아래를 보고 있었으면 맨 아래 유지
    useLayoutEffect(() => {
        if (!restorePendingRef.current || query.isPlaceholderData || query.isLoading) return;
        restorePendingRef.current = false;
        const c = scrollRef.current;
        const a = anchorRef.current;
        if (!c || !a) return;
        if (a.atBottom) {
            c.scrollTop = c.scrollHeight;
        } else if (a.id) {
            const el = c.querySelector<HTMLElement>(`[data-msg-id="${a.id}"]`);
            if (el) c.scrollTop += el.getBoundingClientRect().top - c.getBoundingClientRect().top - a.offset;
        }
        anchorRef.current = captureAnchor(c);
    }, [query.data, query.isPlaceholderData, query.isLoading, scrollRef]);

    // secure 조회가 실패(2차 인증 취소 등)하면 공개 타임라인으로 되돌림
    // 다시 조회 중이면 기다린다 — 예전 실패 상태가 남은 채 바로 되돌리면 "보기"가 먹지 않았다 (2026-10-01)
    useEffect(() => {
        if (personalUnlocked && query.isError && !query.isFetching) setPersonalUnlocked(false);
    }, [personalUnlocked, query.isError, query.isFetching, setPersonalUnlocked]);

    const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
    if (openedMaxIdRef.current === null && query.data) openedMaxIdRef.current = items[0]?.id ?? 0;

    useEffect(() => {
        const latest = items[0]?.id ?? 0;
        if (latest > markedRef.current) {
            markedRef.current = latest;
            markRead(latest);
        }
    }, [items, markRead]);

    // 표시 순서: 오래된 것 → 최신 (채팅). 서버는 최신순이므로 뒤집는다
    const ordered = useMemo(() => [...items].reverse(), [items]);
    const groups = useMemo(() => groupByDate(ordered), [ordered]);

    if (unreadAtOpenRef.current === null && query.data?.pages[0]) {
        unreadAtOpenRef.current = query.data.pages[0].unreadCount;
    }

    /** 안 읽은 것 중 가장 오래된 메시지 id. 없으면 null (→ 맨 아래로) */
    const firstUnreadId = useMemo(() => {
        const unread = unreadAtOpenRef.current ?? 0;
        if (unread <= 0) return null;
        const targets = items.filter((m) => UNREAD_TYPES.includes(m.body.type));   // items 는 최신순
        return targets.slice(0, unread).at(-1)?.id ?? null;                        // 불러온 것보다 많으면 가장 오래된 것
    }, [items]);

    // 열 때 한 번만: 안 읽은 첫 메시지로, 없으면 최신으로. 이후 스크롤은 건드리지 않는다
    useEffect(() => {
        if (didScrollRef.current || query.isLoading || ordered.length === 0) return;
        didScrollRef.current = true;
        requestAnimationFrame(() => {
            const target = unreadMarkRef.current ?? bottomRef.current;
            target?.scrollIntoView({block: unreadMarkRef.current ? 'start' : 'end'});
        });
    }, [ordered.length, query.isLoading]);

    // 이전 메시지를 위에 붙여도 보던 메시지가 같은 자리에 있도록 (붙이기 전 위치 기억 → 위 복원 effect 가 맞춘다, 2026-10-01)
    const loadOlder = () => {
        anchorRef.current = captureAnchor(scrollRef.current);
        if (anchorRef.current) anchorRef.current.atBottom = false;   // 맨 아래 유지가 아니라 보던 메시지 고정
        restorePendingRef.current = true;
        void query.fetchNextPage();
    };

    // 질문을 보내거나 카드가 도착하면 맨 아래로
    useEffect(() => {
        if (tailVersion > 0) bottomRef.current?.scrollIntoView({block: 'end'});
    }, [tailVersion]);

    if (query.isLoading) {
        return <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24}/></Box>;
    }

    return (
        <Stack spacing={1.5} sx={{px: 1.5, py: 1}}>
            {query.isError && !personalUnlocked && (
                <Alert severity="error">타임라인을 불러오지 못했습니다.</Alert>
            )}
            {query.hasNextPage && (
                <Button size="small" onClick={loadOlder} disabled={query.isFetchingNextPage}>
                    {query.isFetchingNextPage ? '불러오는 중…' : '이전 메시지 더 보기'}
                </Button>
            )}
            {ordered.length === 0 && !query.isError && !tail && (
                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{py: 4}}>
                    {EMPTY_TEXT[filter]}
                </Typography>
            )}
            {Array.from(groups.entries()).map(([date, msgs]) => (
                <Stack key={date} spacing={1}>
                    <Divider><Typography variant="caption" color="text.secondary">{date}</Typography></Divider>
                    {msgs.map((m) => (
                        <Box key={m.id} id={`assistant-msg-${m.id}`} data-msg-id={m.id}
                             sx={{scrollMarginTop: 8, '&:hover .msg-actions': {opacity: 1}}}>
                            {m.id === firstUnreadId && (
                                <Box ref={unreadMarkRef} sx={{scrollMarginTop: 8, pb: 1}}>
                                    <Divider><Typography variant="caption" color="primary">여기까지 읽음</Typography></Divider>
                                </Box>
                            )}
                            <AssistantMessageView
                                message={m}
                                onUnlock={personalUnlocked ? undefined : () => requestPersonalUnlock(m.id)}
                                autoOpen={m.id === unlockTarget || m.id > (openedMaxIdRef.current ?? 0)}
                                onPick={onPick}
                            />
                            {/* 메시지 아래 작은 줄: 시각 · 삭제. 마우스를 올리면 보이고(터치 기기는 항상), 자리는 항상 잡아 둬 화면이 흔들리지 않는다 */}
                            <Stack
                                className="msg-actions"
                                direction="row"
                                alignItems="center"
                                spacing={1}
                                justifyContent={m.body.type === 'USER' ? 'flex-end' : 'flex-start'}
                                sx={{mt: 0.5, px: 0.75, minHeight: 20, opacity: 0, transition: 'opacity .15s', '@media (hover: none)': {opacity: 1}}}
                            >
                                <Typography variant="caption" color="text.disabled">{dayjs(m.createdAt).format('HH:mm')}</Typography>
                                <ButtonBase
                                    onClick={() => setDeleteTarget({id: m.id, isQuestion: m.body.type === 'USER'})}
                                    sx={{fontSize: 12, color: 'text.disabled', borderRadius: 1, px: 0.5, '&:hover': {color: 'error.main'}}}
                                >
                                    <DeleteOutlineIcon sx={{fontSize: 14, mr: 0.25}}/>삭제
                                </ButtonBase>
                            </Stack>
                        </Box>
                    ))}
                </Stack>
            ))}
            {tail}
            <Box ref={bottomRef}/>
            <DeleteConfirmDialog
                open={!!deleteTarget}
                title="메시지 삭제"
                message={`이 메시지를 삭제할까요? 삭제하면 복구할 수 없습니다.${deleteTarget?.isQuestion ? '\n질문을 지우면 비서가 이전 대화 맥락을 잊습니다.' : ''}`}
                pending={deleteMutation.isPending}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            />
        </Stack>
    );
}

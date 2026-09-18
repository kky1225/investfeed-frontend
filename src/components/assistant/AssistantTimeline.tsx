import {useEffect, useMemo, useRef} from 'react';
import {useInfiniteQuery} from '@tanstack/react-query';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import {requireOk} from '../../lib/apiResponse';
import {getServerNow} from '../../lib/serverTime';
import {fetchSecureTimeline, fetchTimeline} from '../../api/assistant/AssistantApi';
import type {TimelineMessage, TimelinePage} from '../../type/AssistantType';
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

/** 서버 타임라인(최신순 페이지) + 로컬 안내 항목. 열릴 때 최신 id 로 읽음 처리 */
export default function AssistantTimeline({localItems}: { localItems: TimelineMessage[] }) {
    const {personalUnlocked, setPersonalUnlocked, requestPersonalUnlock, consumeUnlockPrompt, markRead} = useAssistant();
    const markedRef = useRef<number>(0);

    const query = useInfiniteQuery({
        queryKey: [...ASSISTANT_TIMELINE_KEY, personalUnlocked],
        queryFn: async ({pageParam, signal}) => {
            const q = {before: pageParam ?? undefined, limit: 20};
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
    });

    // secure 조회가 실패(2차 인증 취소 등)하면 공개 타임라인으로 되돌림
    useEffect(() => {
        if (personalUnlocked && query.isError) setPersonalUnlocked(false);
    }, [personalUnlocked, query.isError, setPersonalUnlocked]);

    const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

    useEffect(() => {
        const latest = items[0]?.id ?? 0;
        if (latest > markedRef.current) {
            markedRef.current = latest;
            markRead(latest);
        }
    }, [items, markRead]);

    // 표시 순서: 오래된 것 → 최신 (채팅). 서버는 최신순이므로 뒤집는다
    const ordered = useMemo(() => [...items].reverse().concat(localItems), [items, localItems]);
    const groups = useMemo(() => groupByDate(ordered), [ordered]);

    if (query.isLoading) {
        return <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24}/></Box>;
    }

    return (
        <Stack spacing={1.5} sx={{px: 1.5, py: 1}}>
            {query.isError && !personalUnlocked && (
                <Alert severity="error">타임라인을 불러오지 못했습니다.</Alert>
            )}
            {query.hasNextPage && (
                <Button size="small" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                    {query.isFetchingNextPage ? '불러오는 중…' : '이전 메시지 더 보기'}
                </Button>
            )}
            {ordered.length === 0 && !query.isError && (
                <Typography variant="body2" color="text.secondary" textAlign="center" sx={{py: 4}}>
                    아직 도착한 브리핑이 없습니다.
                </Typography>
            )}
            {Array.from(groups.entries()).map(([date, msgs]) => (
                <Stack key={date} spacing={1}>
                    <Divider><Typography variant="caption" color="text.secondary">{date}</Typography></Divider>
                    {msgs.map((m) => <AssistantMessageView key={m.id} message={m} onUnlock={personalUnlocked ? undefined : requestPersonalUnlock}/>)}
                </Stack>
            ))}
        </Stack>
    );
}

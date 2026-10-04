import {useCallback, useEffect, useRef, useState} from 'react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import DeleteConfirmDialog from './DeleteConfirmDialog';
import {deleteAssistantMessages} from '../../api/assistant/AssistantApi';
import {requireOk} from '../../lib/apiResponse';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import ButtonBase from '@mui/material/ButtonBase';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import type {ChatPick, TimelineView, TurnCard} from '../../type/AssistantType';
import {AssistantChatError, assistantChat, assistantHealth, type ChatRequest} from '../../api/assistant/AssistantChatApi';
import {useAssistantToken} from '../../hooks/useAssistantToken';
import {ASSISTANT_TIMELINE_KEY, useAssistant} from '../../context/AssistantContext';
import AssistantTimeline from './AssistantTimeline';
import AssistantSettings from './AssistantSettings';
import {AnswerView, UserBubble} from './AssistantMessageView';

interface AssistantPanelProps {
    /** 드로어면 닫기(X), 전체 화면이면 뒤로가기 */
    onClose: () => void;
    variant: 'drawer' | 'page';
}

/** 서버 타임라인에 아직 없는 질문 — 진행 중이거나, 전송 실패했거나, 저장에 실패한 턴 */
interface LiveTurn {
    key: string;
    req: ChatRequest;
    status: 'sending' | 'done' | 'failed';
    cards: TurnCard[];
    reply?: string;
    route?: string;
    error?: string;
}

const UNAVAILABLE = '질문 기능을 일시적으로 사용할 수 없습니다. 브리핑·알림은 정상적으로 제공됩니다.';

/** 필터별 전체 삭제 확인 문구 */
const CLEAR_TEXT: Record<TimelineView, string> = {
    ALL: '질문·답변·브리핑·알림을 모두 삭제할까요?',
    BRIEFING: '브리핑·알림을 모두 삭제할까요? 질문·답변은 그대로 남습니다.',
    CHAT: '질문과 답변을 모두 삭제할까요? 브리핑·알림은 그대로 남습니다.',
};

/** 보기 필터 칩. 열 때마다 전체로 시작한다 (기억하지 않음, 2026-10-01) */
const FILTERS: { value: TimelineView; label: string }[] = [
    {value: 'ALL', label: '전체'},
    {value: 'BRIEFING', label: '브리핑·알림'},
    {value: 'CHAT', label: '대화'},
];

/** 드로어와 전체 화면이 공유하는 본체: 헤더 · 타임라인 또는 설정 · 입력창 */
export default function AssistantPanel({onClose, variant}: AssistantPanelProps) {
    const [view, setView] = useState<'timeline' | 'settings'>('timeline');
    const [draft, setDraft] = useState('');
    const [turns, setTurns] = useState<LiveTurn[]>([]);
    const [tailVersion, setTailVersion] = useState(0);
    const [healthy, setHealthy] = useState(true);
    const [filter, setFilter] = useState<TimelineView>('ALL');
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [clearOpen, setClearOpen] = useState(false);
    const clearMutation = useMutation({
        mutationFn: async () => requireOk(await deleteAssistantMessages(filter), '메시지 전체 삭제'),
        onSuccess: () => {
            setClearOpen(false);
            if (filter !== 'BRIEFING') setTurns([]);   // 화면에만 남아 있던 실패·진행 중 질문도 비운다
            void queryClient.invalidateQueries({queryKey: ASSISTANT_TIMELINE_KEY});
        },
        onError: () => setClearOpen(false),
    });
    const queryClient = useQueryClient();
    const {getToken, invalidate} = useAssistantToken();
    const {personalUnlocked, setPersonalUnlocked} = useAssistant();
    const seq = useRef(0);

    const checkHealth = useCallback(() => { assistantHealth().then(setHealthy); }, []);
    useEffect(checkHealth, [checkHealth]);

    const patch = useCallback((key: string, f: (t: LiveTurn) => LiveTurn) => {
        setTurns((prev) => prev.map((t) => (t.key === key ? f(t) : t)));
        setTailVersion((v) => v + 1);
    }, []);

    const run = useCallback(async (key: string, req: ChatRequest) => {
        let finished = false;
        let saved = false;
        const onEvent = (event: string, data: unknown) => {
            if (event === 'card') patch(key, (t) => ({...t, cards: [...t.cards, data as TurnCard]}));
            else if (event === 'reply') {
                const r = data as { text: string; route: string };
                patch(key, (t) => ({...t, reply: r.text, route: r.route}));
            }
            else if (event === 'done') { finished = true; saved = !!(data as { saved?: boolean }).saved; }
        };
        try {
            // 토큰 발급은 2차 인증 경로. 통과했으면 개인 카드도 볼 수 있으므로 타임라인을 개인 모드로 둔다
            let token = await getToken();
            if (!personalUnlocked) setPersonalUnlocked(true);
            try {
                await assistantChat(token, req, onEvent);
            } catch (e) {
                if (!(e instanceof AssistantChatError && e.status === 401)) throw e;
                invalidate();
                token = await getToken();
                await assistantChat(token, req, onEvent);
            }
            if (!finished) throw new Error('응답이 중간에 끊겼습니다');
        } catch (e) {
            checkHealth();
            patch(key, (t) => ({...t, status: 'failed', error: e instanceof AssistantChatError ? '전송에 실패했습니다' : (e as Error).message || '전송에 실패했습니다'}));
            return;
        }
        if (!saved) {   // 타임라인 저장 실패 — 화면에는 남겨 둔다
            patch(key, (t) => ({...t, status: 'done'}));
            return;
        }
        await queryClient.invalidateQueries({queryKey: ASSISTANT_TIMELINE_KEY});
        setTurns((prev) => prev.filter((t) => t.key !== key));
        setTailVersion((v) => v + 1);
    }, [checkHealth, getToken, invalidate, patch, personalUnlocked, queryClient, setPersonalUnlocked]);

    const send = useCallback((req: ChatRequest) => {
        const key = `t${++seq.current}`;
        setFilter((f) => (f === 'BRIEFING' ? 'ALL' : f));   // 브리핑·알림만 보던 중이면 질문·답이 보이도록
        setTurns((prev) => [...prev, {key, req, status: 'sending', cards: []}]);
        setTailVersion((v) => v + 1);
        void run(key, req);
    }, [run]);

    const retry = (turn: LiveTurn) => {
        patch(turn.key, (t) => ({...t, status: 'sending', cards: [], reply: undefined, route: undefined, error: undefined}));
        void run(turn.key, turn.req);
    };

    const handleSend = () => {
        const text = draft.trim();
        if (!text) return;
        setDraft('');
        send({message: text});
    };

    const handlePick = useCallback((pick: ChatPick) => send({message: pick.name, pick}), [send]);

    const tail = turns.length > 0 && (
        <Stack spacing={1.5}>
            {turns.map((t) => (
                <Stack key={t.key} spacing={1}>
                    <UserBubble
                        text={t.req.message}
                        footer={t.status === 'failed' && (
                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{mt: 0.5}}>
                                <Typography variant="caption" color="error">{t.error}</Typography>
                                <Button size="small" onClick={() => retry(t)}>재시도</Button>
                            </Stack>
                        )}
                    />
                    {t.status !== 'failed' && (
                        <AnswerView text={t.reply} cards={t.cards} route={t.route} onPick={handlePick} pending={t.status === 'sending' && !t.reply}/>
                    )}
                </Stack>
            ))}
        </Stack>
    );

    return (
        <Stack sx={{height: '100%', minHeight: 0}}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider'}}>
                {variant === 'page' && (
                    <IconButton size="small" onClick={onClose} aria-label="뒤로"><ArrowBackIcon fontSize="small"/></IconButton>
                )}
                <SmartToyOutlinedIcon fontSize="small" color="primary"/>
                <Typography variant="subtitle1" sx={{fontWeight: 600, flexGrow: 1}}>
                    {view === 'timeline' ? 'AI 비서' : '비서 설정'}
                </Typography>
                <Tooltip title={view === 'timeline' ? '설정' : '타임라인으로'}>
                    <IconButton size="small" onClick={() => setView((v) => (v === 'timeline' ? 'settings' : 'timeline'))}>
                        {view === 'timeline' ? <SettingsOutlinedIcon fontSize="small"/> : <ArrowBackIcon fontSize="small"/>}
                    </IconButton>
                </Tooltip>
                {variant === 'drawer' && (
                    <IconButton size="small" onClick={onClose} aria-label="닫기"><CloseIcon fontSize="small"/></IconButton>
                )}
            </Stack>

            {view === 'timeline' && (
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider'}}>
                    {FILTERS.map((f) => (
                        <Chip
                            key={f.value}
                            size="small"
                            label={f.label}
                            color={filter === f.value ? 'primary' : 'default'}
                            variant={filter === f.value ? 'filled' : 'outlined'}
                            onClick={() => setFilter(f.value)}
                        />
                    ))}
                    {/* 보고 있는 필터의 내용 전체 삭제. 메시지 아래 삭제 버튼과 같은 모양: 작은 휴지통 + 작은 글씨, 올리면 빨강 */}
                    <ButtonBase
                        onClick={() => setClearOpen(true)}
                        sx={{ml: 'auto !important', fontSize: 12, color: 'text.secondary', borderRadius: 1, px: 0.75, py: 0.25, '&:hover': {color: 'error.main'}}}
                    >
                        <DeleteOutlineIcon sx={{fontSize: 15, mr: 0.25}}/>전체 삭제
                    </ButtonBase>
                </Stack>
            )}

            <Box ref={scrollRef} sx={{flexGrow: 1, overflowY: 'auto', minHeight: 0}}>
                {view === 'timeline'
                    ? <AssistantTimeline
                        key={filter}
                        filter={filter}
                        scrollRef={scrollRef}
                        tail={filter === 'BRIEFING' ? undefined : tail}
                        tailVersion={tailVersion}
                        onPick={handlePick}
                    />
                    : <AssistantSettings/>}
            </Box>

            <DeleteConfirmDialog
                open={clearOpen}
                title={`${FILTERS.find((f) => f.value === filter)?.label} 전체 삭제`}
                message={`${CLEAR_TEXT[filter]}\n삭제하면 복구할 수 없습니다.`}
                pending={clearMutation.isPending}
                onCancel={() => setClearOpen(false)}
                onConfirm={() => clearMutation.mutate()}
            />

            {view === 'timeline' && (
                <Box sx={{borderTop: '1px solid', borderColor: 'divider'}}>
                    {!healthy && <Alert severity="warning" sx={{borderRadius: 0}}>{UNAVAILABLE}</Alert>}
                    <Stack direction="row" spacing={1} sx={{p: 1.5}}>
                        <TextField
                            size="small"
                            fullWidth
                            placeholder="시세·수급·일정·내 계좌를 물어보세요"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            slotProps={{htmlInput: {maxLength: 500}}}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); } }}
                        />
                        <IconButton color="primary" onClick={handleSend} aria-label="보내기"><SendRoundedIcon/></IconButton>
                    </Stack>
                </Box>
            )}
        </Stack>
    );
}

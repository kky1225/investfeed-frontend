import type {ReactNode} from 'react';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import {TREND_COLORS} from '../CustomRender';
import Chip from '@mui/material/Chip';
import dayjs from 'dayjs';
import type {ChatPick, HoldingAlertPayload, TimelineMessage, TurnCard} from '../../type/AssistantType';
import TurnCardView from './cards/TurnCardView';
import AssistantBubble from './AssistantBubble';
import TypingDots from './TypingDots';
import Divider from '@mui/material/Divider';
import {HoldingAlertQuote} from './cards/MarketCards';
import SummaryTiles from './SummaryTiles';
import SectionView from './SectionView';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const asOfLabel = (iso: string) => { const d = dayjs(iso); return `${d.format('M/D')}(${WEEKDAY[d.day()]}) ${d.format('HH:mm')} 기준`; };

const SUBTYPE_LABEL: Record<string, string> = {
    US_CLOSE: '미국 장 마감',
    KR_PRE: '국내 장 전',
    KR_CLOSE: '국내 장 마감',
    KR_ACCOUNT: '국내 계좌 마감',
    COIN_DAILY: '코인 마감',
    INDEX_WARN: '지수 급변',      // ±3%·±5%. 오를 때도 오므로 "경고" 대신 (2026-10-01)
    INDEX_CB: '서킷브레이커',
    RELEASE: '지표 발표',
    HOLDING: '보유 종목',
};

/**
 * 알림 종류별 아이콘. 헤드라인 문자열에는 이모지를 넣지 않고 화면이 색과 함께 그린다 (2026-09-17).
 * 이모지는 색을 폰트가 정해 통제가 안 되고, 색 문법은 상승 빨강·하락 파랑뿐이라 경고색이 없다.
 */
const ALERT_ICON: Record<string, { Icon: typeof WarningAmberIcon; color: 'warning' | 'error' | 'info' }> = {
    INDEX_CB: {Icon: ReportProblemIcon, color: 'error'},
    RELEASE: {Icon: CampaignOutlinedIcon, color: 'info'},
};

/** 지수 급변은 방향 화살표 (상승 빨강·하락 파랑). 헤드라인 첫 부호로 판단 ("코스닥 +3.01% (881.52)") */
function IndexMoveIcon({headline}: { headline: string }) {
    const sign = headline.match(/[+-](?=\d)/)?.[0];
    if (!sign) return null;
    const Icon = sign === '+' ? TrendingUpIcon : TrendingDownIcon;
    return <Icon sx={{fontSize: 21, mt: '2px', flexShrink: 0, color: sign === '+' ? TREND_COLORS.up : TREND_COLORS.down}}/>;
}

/** 질문 (오른쪽 말풍선) */
export function UserBubble({text, footer}: { text: string; footer?: ReactNode }) {
    return (
        <Stack alignItems="flex-end">
            <Box sx={{maxWidth: '85%', px: 1.75, py: 1, borderRadius: 3, bgcolor: 'primary.main', color: 'primary.contrastText', whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                <Typography variant="body2">{text}</Typography>
            </Box>
            {footer}
        </Stack>
    );
}

/**
 * 답변 (2026-10-01): 카드가 있으면 카드만 (브리핑 카드처럼, 문구 없음), 카드가 없으면 말풍선.
 * 오류(시간 초과 등)는 카드가 있어도 말풍선을 함께 보인다. 문장은 전부 코드 고정 문구 (LLM 문장 없음)
 */
export function AnswerView({text, cards, route, onUnlock, onPick, pending, autoOpen = true}: {
    text?: string | null;
    cards: TurnCard[];
    /** TOOL / REJECT / ASK_USER / PICK / BLOCKED / ERROR */
    route?: string | null;
    onUnlock?: () => void;
    onPick?: (pick: ChatPick) => void;
    pending?: boolean;
    autoOpen?: boolean;
}) {
    const showText = !!text && (cards.length === 0 || route === 'ERROR');
    return (
        <Stack spacing={1}>
            {cards.map((c, i) => <TurnCardView key={`${c.kind}-${i}`} card={c} onUnlock={onUnlock} onPick={onPick} autoOpen={autoOpen}/>)}
            {showText && <AssistantBubble text={text!}/>}
            {pending && <TypingDots/>}
        </Stack>
    );
}

export default function AssistantMessageView({message, onUnlock, onPick, autoOpen = true}: {
    message: TimelineMessage;
    onUnlock?: () => void;
    onPick?: (pick: ChatPick) => void;
    /** 2차 인증으로 잠금이 풀릴 때 이 메시지의 개인 내용을 펼칠지 ("보기"를 누른 메시지만 true) */
    autoOpen?: boolean;
}) {
    const {body} = message;
    if (body.type === 'USER') return <UserBubble text={body.headline.text}/>;
    if (body.type === 'ASSISTANT') return <AnswerView text={body.headline.text} cards={body.turnCards ?? []} route={body.subtype} onUnlock={onUnlock} onPick={onPick} autoOpen={autoOpen}/>;
    const label = body.subtype ? SUBTYPE_LABEL[body.subtype] ?? body.subtype : body.type;
    const isBriefing = body.type === 'BRIEFING' || body.type === 'ALERT';
    const alertIcon = body.subtype ? ALERT_ICON[body.subtype] : undefined;
    const holdingCards = body.subtype === 'HOLDING' && body.turnCards?.some((c) => c.kind === 'HOLDING_ALERT')
        ? body.turnCards.filter((c) => c.kind === 'HOLDING_ALERT') : null;
    return (
        <Paper variant="outlined" sx={{px: 2.25, py: 1.75, borderRadius: 3, bgcolor: 'background.default'}}>
            <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={label} color={isBriefing ? 'primary' : 'default'} variant="outlined" sx={{height: 22}}/>
                {body.asOf && (
                    <Typography variant="caption" color="text.secondary">
                        {asOfLabel(body.asOf)}
                    </Typography>
                )}
            </Stack>
            {/* 보유 종목 1건이면 카드가 곧 내용이라 헤드라인을 생략, 여러 건이면 "보유 N종목 급등락" */}
            {!(holdingCards && holdingCards.length === 1) && (
                <Stack direction="row" alignItems="flex-start" spacing={0.75} sx={{mt: 1}}>
                    {alertIcon && <alertIcon.Icon color={alertIcon.color} sx={{fontSize: 21, mt: '2px', flexShrink: 0}}/>}
                    {body.subtype === 'INDEX_WARN' && <IndexMoveIcon headline={body.headline.text}/>}
                    <Typography sx={{fontSize: 17, fontWeight: 600, lineHeight: 1.4}}>
                        {body.headline.text}
                    </Typography>
                </Stack>
            )}
            {holdingCards ? (
                // 보유 종목 급등락: 종목마다 시세 카드 모양 (헤드라인·표 대신, 2026-10-02)
                <Stack spacing={1.5} divider={<Divider/>} sx={{mt: 1.25}}>
                    {holdingCards.map((c, i) => <HoldingAlertQuote key={i} p={c.payload as HoldingAlertPayload}/>)}
                </Stack>
            ) : (<>
            {body.summary && <SummaryTiles summary={body.summary}/>}
            {body.sections.length > 0 && (
                <Box sx={{mt: 0.5}}>
                    {body.sections.map((s) => <SectionView key={s.id} section={s} onUnlock={onUnlock} autoOpen={autoOpen}/>)}
                </Box>
            )}
            </>)}
        </Paper>
    );
}

import {useQuery} from '@tanstack/react-query';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type {
    BriefingPointerPayload, CalendarItemPayload, ChatPick, CircuitBreakerAnswerPayload, GlobalIndexPayload, HoldingPayload, MarketInvestorFlowPayload,
    MarketBriefPayload, MarketSummaryPayload, NewsRowPayload, PnlPayload, PortfolioPayload, PriceAlertDeletePreviewPayload, PriceAlertPreviewPayload,
    RecommendListPayload,
    SectorPerformancePayload, StockChoicePayload, StockInvestorFlowPayload, StockQuoteAnswerPayload, StockQuotePayload, TradingRankPayload, TurnCard,
    WatchlistGroupsPayload, WatchlistPayload, GoalsPayload, GoalUpdatePreviewPayload,
} from '../../../type/AssistantType';
import {fetchAssistantCard} from '../../../api/assistant/AssistantApi';
import {requireOk} from '../../../lib/apiResponse';
import {CardFrame, PersonalOpenContext} from './CardParts';
import {
    BriefingLinkCard, CalendarCard, GlobalIndexCard, MarketBriefCard, MarketFlowCard, MarketSummaryCard, NewsCard, RecommendCard,
    SectorPerformanceCard, StockChoiceCard, StockFlowCard, StockQuoteCard, TradingRankCard, WatchlistCard, WatchlistGroupsCard,
} from './MarketCards';
import {ConfirmGoalCard, ConfirmPriceAlertCard, ConfirmPriceAlertDeleteCard, GoalsCard, HoldingCard, PnlCard, PortfolioCard} from './PersonalCards';
import AssistantMessageView from '../AssistantMessageView';
import AssistantBubble from '../AssistantBubble';

/** 카드 종류 이름 (오류·잠금 카드 제목) */
export const CARD_LABEL: Record<string, string> = {
    get_market_summary: '시장 요약',
    get_circuit_breakers: '서킷브레이커',
    get_market_investor_flow: '투자자 수급',
    get_trading_rank: '거래 순위',
    get_sector_performance: '업종 등락',
    get_stock_quote: '종목 시세',
    get_stock_investor_flow: '종목 수급',
    get_global_indexes: '해외 지수',
    get_treasury_yields: '국채 금리',
    get_exchange_rates: '환율',
    get_calendar: '일정',
    get_recommend_list: '추천 목록',
    search_news: '뉴스',
    get_my_watchlist: '관심종목',
    show_briefing: '브리핑',
    show_my_portfolio: '내 계좌',
    show_my_holding: '보유 종목',
    show_my_pnl: '실현손익',
    show_my_goals: '투자 목표',
    create_price_alert: '목표가 알림',
    delete_price_alert: '목표가 알림 삭제',
    update_my_goal: '투자 목표 변경',
    PORTFOLIO: '내 계좌',
    HOLDING: '보유 종목',
    REALIZED_PNL: '실현손익',
    CONFIRM_PRICE_ALERT: '목표가 알림',
    GOALS: '투자 목표',
    CONFIRM_GOAL: '투자 목표 변경',
    STOCK_CHOICE: '종목 선택',
};

interface Props {
    card: TurnCard;
    /** 잠긴 개인 카드의 "2차 인증 후 보기" */
    onUnlock?: () => void;
    /** 종목 선택 카드 버튼 */
    onPick?: (pick: ChatPick) => void;
    /** 잠금이 풀릴 때 이 카드를 펼칠지 ("보기"를 누른 메시지만 true) */
    autoOpen?: boolean;
}

/** 브리핑 형식 시장 카드인지 (예전 답변은 이전 형식) */
const isBrief = (v: unknown): v is MarketBriefPayload => !!v && typeof v === 'object' && 'sections' in v && 'summary' in v;

/** 문장으로 답한 도구 결과 ("발동하지 않았습니다", "휴장일입니다" 등) — 서버가 reply 문장을 준다 */
const replyText = (v: unknown): string | null =>
    !!v && typeof v === 'object' && 'reply' in v && typeof (v as {reply: unknown}).reply === 'string' ? (v as {reply: string}).reply : null;

function render(kind: string, payload: unknown, card: TurnCard, onPick?: (p: ChatPick) => void) {
    const meta = {asOf: card.asOf, source: card.source};
    const reply = replyText(payload);
    if (reply) return <AssistantBubble text={reply}/>;
    switch (kind) {
        case 'get_circuit_breakers': {
            // 발동했으면 타임라인에 게시된 서킷브레이커 알림 카드를 그대로 보여 준다 (발동 없음은 위에서 문장 말풍선)
            const p = payload as CircuitBreakerAnswerPayload;
            return (
                <Stack spacing={1.5}>
                    {p.alerts.map((a) => (
                        <AssistantMessageView key={a.alertId} message={{id: a.alertId, createdAt: a.asOf, body: a.body}}/>
                    ))}
                </Stack>
            );
        }
        case 'get_market_summary':
            return isBrief(payload) ? <MarketBriefCard p={payload} meta={meta}/> : <MarketSummaryCard p={payload as MarketSummaryPayload} meta={meta}/>;
        case 'get_market_investor_flow': return <MarketFlowCard p={payload as MarketInvestorFlowPayload} meta={meta}/>;
        case 'get_trading_rank': return <TradingRankCard p={payload as TradingRankPayload} meta={meta}/>;
        case 'get_sector_performance': {
            const p = payload as SectorPerformancePayload;
            if (!p.notice) return <SectorPerformanceCard p={p} meta={meta}/>;
            return (
                <Stack spacing={1}>
                    <AssistantBubble text={p.notice}/>
                    <SectorPerformanceCard p={p} meta={meta}/>
                </Stack>
            );
        }
        case 'get_stock_quote': {
            // 여러 종목 중 일부만 그날 조회할 수 없으면 {quotes, notice} — 안내 말풍선 + 조회된 카드
            if (Array.isArray(payload)) return <StockQuoteCard p={payload as StockQuotePayload[]} meta={meta}/>;
            const a = payload as StockQuoteAnswerPayload;
            return (
                <Stack spacing={1}>
                    <AssistantBubble text={a.notice}/>
                    <StockQuoteCard p={a.quotes} meta={meta}/>
                </Stack>
            );
        }
        case 'get_stock_investor_flow': return <StockFlowCard p={payload as StockInvestorFlowPayload[]} meta={meta}/>;
        case 'get_global_indexes':
            return isBrief(payload) ? <MarketBriefCard p={payload} meta={meta}/> : <GlobalIndexCard p={payload as GlobalIndexPayload[]} meta={meta}/>;
        case 'get_treasury_yields':
        case 'get_exchange_rates': return <MarketBriefCard p={payload as MarketBriefPayload} meta={meta}/>;
        case 'get_calendar': return <CalendarCard p={payload as CalendarItemPayload[]} meta={meta} args={card.args}/>;
        case 'get_recommend_list': return <RecommendCard p={payload as RecommendListPayload} meta={meta}/>;
        case 'search_news': return <NewsCard p={payload as NewsRowPayload[]} meta={meta}/>;
        case 'get_my_watchlist':
            return 'groups' in (payload as object)
                ? <WatchlistGroupsCard p={payload as WatchlistGroupsPayload} meta={meta} onPick={onPick}/>
                : <WatchlistCard p={payload as WatchlistPayload} meta={meta}/>;
        case 'show_briefing': return <BriefingLinkCard p={payload as BriefingPointerPayload} meta={meta}/>;
        case 'PORTFOLIO': return <PortfolioCard p={payload as PortfolioPayload}/>;
        case 'HOLDING': return <HoldingCard p={payload as HoldingPayload}/>;
        case 'REALIZED_PNL': return <PnlCard p={payload as PnlPayload}/>;
        case 'GOALS': return <GoalsCard p={payload as GoalsPayload}/>;
        case 'CONFIRM_GOAL': return <ConfirmGoalCard p={payload as GoalUpdatePreviewPayload} cardRef={card.ref} status={card.actionStatus}/>;
        case 'create_price_alert': return <ConfirmPriceAlertCard p={payload as PriceAlertPreviewPayload} cardRef={(payload as PriceAlertPreviewPayload).confirmRef} status={card.actionStatus}/>;
        case 'delete_price_alert': return <ConfirmPriceAlertDeleteCard p={payload as PriceAlertDeletePreviewPayload} status={card.actionStatus}/>;
        case 'CONFIRM_PRICE_ALERT': return <ConfirmPriceAlertCard p={payload as PriceAlertPreviewPayload} cardRef={card.ref} status={card.actionStatus}/>;
        case 'STOCK_CHOICE': return <StockChoiceCard p={payload as StockChoicePayload} onPick={onPick}/>;
        default: return <CardFrame title={kind}><Typography variant="body2" color="text.secondary">표시할 수 없는 카드입니다</Typography></CardFrame>;
    }
}

/** 실시간 답변의 개인 카드: 참조(ref)로 Kotlin 에서 본문 조회 (2차 인증 경로) */
function RefCard({card, onPick}: { card: TurnCard; onPick?: (p: ChatPick) => void }) {
    const q = useQuery({
        queryKey: ['assistant', 'card', card.ref],
        queryFn: async ({signal}) => requireOk(await fetchAssistantCard(card.ref!, {signal, skipGlobalError: true}), '카드 조회'),
        retry: false,
        staleTime: Infinity,
    });
    if (q.isLoading) return <CardFrame title={CARD_LABEL[card.kind] ?? card.kind}><CircularProgress size={18}/></CardFrame>;
    if (q.isError || !q.data) {
        return <CardFrame title={CARD_LABEL[card.kind] ?? card.kind}><Typography variant="body2" color="text.secondary">카드가 만료되었거나 불러오지 못했습니다</Typography></CardFrame>;
    }
    return render(q.data.kind, q.data.payload, card, onPick);
}

export default function TurnCardView({card, onUnlock, onPick, autoOpen = true}: Props) {
    const title = CARD_LABEL[card.kind] ?? card.kind;
    if (card.status === 'LOCKED') {
        return (
            <CardFrame title={title}>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <LockOutlinedIcon sx={{fontSize: 16, color: 'text.disabled'}}/>
                    <Typography variant="body2" color="text.secondary" sx={{flexGrow: 1}}>개인 정보 카드 (2차 인증 후 표시)</Typography>
                    {onUnlock && <Button size="small" onClick={onUnlock}>보기</Button>}
                </Stack>
            </CardFrame>
        );
    }
    if (card.error) {
        return (
            <CardFrame title={title} asOf={card.asOf}>
                <Stack direction="row" alignItems="center" spacing={0.75}>
                    <WarningAmberIcon color="warning" sx={{fontSize: 16}}/>
                    <Typography variant="body2" color="text.secondary">{card.error}</Typography>
                </Stack>
            </CardFrame>
        );
    }
    if (card.payload === undefined || card.payload === null) {
        return card.ref ? <RefCard card={card} onPick={onPick}/> : null;
    }
    // 개인 카드 처음 펼침 상태: 새로 온 답변·"보기" 누른 메시지만 펼침, 비서를 열 때 이미 있던 것은 접힘
    return <PersonalOpenContext.Provider value={autoOpen}>{render(card.kind, card.payload, card, onPick)}</PersonalOpenContext.Provider>;
}

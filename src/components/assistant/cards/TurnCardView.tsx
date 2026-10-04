import {useQuery} from '@tanstack/react-query';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type {
    BriefingPointerPayload, CalendarItemPayload, ChatPick, GlobalIndexPayload, HoldingPayload, MarketInvestorFlowPayload,
    MarketBriefPayload, MarketSummaryPayload, NewsRowPayload, PnlPayload, PortfolioPayload, PriceAlertPreviewPayload, RecommendListPayload,
    StockChoicePayload, StockInvestorFlowPayload, StockQuotePayload, TurnCard,
} from '../../../type/AssistantType';
import {fetchAssistantCard} from '../../../api/assistant/AssistantApi';
import {requireOk} from '../../../lib/apiResponse';
import {CardFrame, PersonalOpenContext} from './CardParts';
import {
    BriefingLinkCard, CalendarCard, GlobalIndexCard, MarketBriefCard, MarketFlowCard, MarketSummaryCard, NewsCard, RecommendCard,
    StockChoiceCard, StockFlowCard, StockQuoteCard,
} from './MarketCards';
import {ConfirmPriceAlertCard, HoldingCard, PnlCard, PortfolioCard} from './PersonalCards';

/** 카드 종류 이름 (오류·잠금 카드 제목) */
export const CARD_LABEL: Record<string, string> = {
    get_market_summary: '시장 요약',
    get_market_investor_flow: '투자자 수급',
    get_stock_quote: '종목 시세',
    get_stock_investor_flow: '종목 수급',
    get_global_indexes: '해외 지수',
    get_calendar: '일정',
    get_recommend_list: '추천 목록',
    search_news: '뉴스',
    show_briefing: '브리핑',
    show_my_portfolio: '내 계좌',
    show_my_holding: '보유 종목',
    show_my_pnl: '실현손익',
    create_price_alert: '목표가 알림',
    PORTFOLIO: '내 계좌',
    HOLDING: '보유 종목',
    REALIZED_PNL: '실현손익',
    CONFIRM_PRICE_ALERT: '목표가 알림',
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

function render(kind: string, payload: unknown, card: TurnCard, onPick?: (p: ChatPick) => void) {
    const meta = {asOf: card.asOf, source: card.source};
    switch (kind) {
        case 'get_market_summary':
            return isBrief(payload) ? <MarketBriefCard p={payload} meta={meta}/> : <MarketSummaryCard p={payload as MarketSummaryPayload} meta={meta}/>;
        case 'get_market_investor_flow': return <MarketFlowCard p={payload as MarketInvestorFlowPayload} meta={meta}/>;
        case 'get_stock_quote': return <StockQuoteCard p={payload as StockQuotePayload[]} meta={meta}/>;
        case 'get_stock_investor_flow': return <StockFlowCard p={payload as StockInvestorFlowPayload[]} meta={meta}/>;
        case 'get_global_indexes':
            return isBrief(payload) ? <MarketBriefCard p={payload} meta={meta}/> : <GlobalIndexCard p={payload as GlobalIndexPayload[]} meta={meta}/>;
        case 'get_calendar': return <CalendarCard p={payload as CalendarItemPayload[]} meta={meta} args={card.args}/>;
        case 'get_recommend_list': return <RecommendCard p={payload as RecommendListPayload} meta={meta}/>;
        case 'search_news': return <NewsCard p={payload as NewsRowPayload[]} meta={meta}/>;
        case 'show_briefing': return <BriefingLinkCard p={payload as BriefingPointerPayload} meta={meta}/>;
        case 'PORTFOLIO': return <PortfolioCard p={payload as PortfolioPayload}/>;
        case 'HOLDING': return <HoldingCard p={payload as HoldingPayload}/>;
        case 'REALIZED_PNL': return <PnlCard p={payload as PnlPayload}/>;
        case 'CONFIRM_PRICE_ALERT': return <ConfirmPriceAlertCard p={payload as PriceAlertPreviewPayload} cardRef={card.ref}/>;
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

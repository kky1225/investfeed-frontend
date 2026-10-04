// Kotlin domain/assistant DTO 와 1:1 (docs/assistant-spec.md 5.3)

export type MessageType = 'BRIEFING' | 'ALERT' | 'USER' | 'ASSISTANT' | 'SYSTEM';
export type HeadlineScope = 'PERSONAL' | 'MARKET';
/** LOCKED: 2차 인증 전 개인 섹션 껍데기 (제목만) */
export type SectionStatus = 'OK' | 'EMPTY' | 'FAILED' | 'LOCKED';

export interface Headline {
    text: string;
    scope: HeadlineScope;
    publicText?: string | null;
}

export interface Section {
    id: string;
    title: string;
    personal: boolean;
    status: SectionStatus;
    asOf?: string | null;
    /** 섹션 상단 지표 타일 (요약 줄과 같은 `라벨 값 (부가) · …` 형식). 개인 보유 섹션의 총 평가금액·일간 수익 등 */
    summary?: string | null;
    /** 개인 보유 섹션의 계좌 요약. 있으면 계좌 화면과 같은 카드로 그린다 (2026-09-18) */
    account?: AccountBlock | null;
    /** 마크다운 (GFM 부분집합) + 색 문법 {값|up} / {값|down} */
    text: string;
}

/** 칸 하나. value 는 서버가 서식·색 문법까지 완성한 문자열 */
export interface AccountStat {
    label: string;
    value: string;
}

export interface AccountBroker {
    name: string;
    /** 조회 실패면 null */
    total: string | null;
    /** 증권사가 하나면 빈 배열 (총액과 같은 숫자라서) */
    stats: AccountStat[];
    /** 종목 표 마크다운 */
    table: string;
    failed: boolean;
}

/** 총액 카드 + 증권사별 카드. 칸 순서는 총 수익 → 일간 수익 → 실현(이달) */
export interface AccountBlock {
    total: string;
    stats: AccountStat[];
    brokers: AccountBroker[];
}

export interface MessageBody {
    schemaVersion: number;
    type: MessageType;
    subtype?: string | null;
    asOf?: string | null;
    headline: Headline;
    summary: string;
    sections: Section[];
    cards: string[];
    refs: Record<string, number>;
    turnCards?: TurnCard[];
}

export interface TurnCard {
    kind: string;
    personal?: boolean;
    status?: SectionStatus;
    ref?: string | null;
    asOf?: string | null;
    source?: string | null;
    error?: string | null;
    payload?: unknown;
    /** 조회 조건 (공개 데이터 카드의 도구 인자). 예: get_calendar {from, to, type, country} */
    args?: Record<string, unknown> | null;
}

export type StockMarket = 'KR' | 'US' | 'CRYPTO';

export interface StockCandidate { code: string; name: string; market: StockMarket; }
export interface StockChoicePayload { query: string; candidates: StockCandidate[]; }

export interface IndexSnapshot { name: string; close: number; changeRate: number | null; changeAmount: number | null; high: number | null; low: number | null; }
export interface MarketSummaryPayload {
    market: 'KOSPI' | 'KOSDAQ';
    index: IndexSnapshot;
    secondary: IndexSnapshot | null;
    flow: { foreignEok: number | null; institutionEok: number | null; individualEok: number | null } | null;
    tradingDay: string;
}

export interface FlowStock { code: string; name: string; netAmountEok: number; periodChangeRate: number | null; streakDays: number | null; }
export interface MarketInvestorFlowPayload {
    investor: 'FOREIGN' | 'INSTITUTION' | 'PENSION' | 'INDIVIDUAL';
    market: 'KOSPI' | 'KOSDAQ';
    days: number;
    side: 'BUY' | 'SELL';
    minStreakDays: number | null;
    stocks: FlowStock[];
}

export interface StockQuotePayload {
    code: string; name: string; market: StockMarket; link: string; currency: string;
    price: number; changeRate: number | null; changeAmount: number | null; volume: number | null;
    high: number | null; low: number | null; high52w: number | null; low52w: number | null;
}

export interface StockFlowDay { date: string; foreignEok: number | null; institutionEok: number | null; individualEok: number | null; close: number | null; changeRate: number | null; }
export interface StockInvestorFlowPayload { code: string; name: string; link: string; days: StockFlowDay[]; foreignStreak: number; institutionStreak: number; }

/** 보유 종목 급등락 알림 1종목 (2026-10-02~, 잠금 없음). 시세 카드 모양으로 그린다 */
export interface HoldingAlertPayload { name: string; link: string; price: number | null; currency: string; label: string; up: boolean; }

/** 시장 카드 (2026-10-01~): 브리핑과 같은 지수 타일(summary) + 섹션. get_market_summary·get_global_indexes */
export interface MarketBriefPayload { title: string; asOf: string; summary: string; sections: Section[]; }

export interface GlobalIndexPayload { type: string; name: string; price: string; changeAmount: string; changeRate: string; delayStatus: string; updatedAt: string; }

export interface CalendarItemPayload { date: string; name: string; country: string; type: string; value: string | null; }

export interface RecommendListPayload { label: string; pickDate: string | null; items: { code: string; name: string; grade: string }[]; }

export interface NewsRowPayload { title: string; link: string; pubDate: string; }

export interface BriefingPointerPayload { messageId: number; headline: string; createdAt: string; type: string; }

export interface HoldingRowPayload {
    code: string; name: string; link: string | null; broker: string; currency: string;
    eval: number | null; dayRate: number | null; dayChange: number | null; totalRate: number | null; evalProfit: number | null;
}
export interface ClassSummaryPayload {
    assetClass: StockMarket; currency: string; eval: number; dayChange: number | null; dayRate: number | null; totalRate: number | null;
    brokers: string[]; failedBrokers: string[];
}
export interface PortfolioPayload {
    asOf: string; totalEvalKrw: number | null; usdKrw: number | null;
    classes: ClassSummaryPayload[]; topGainers: HoldingRowPayload[]; topLosers: HoldingRowPayload[];
    filter: { dayRateLt: number | null; dayRateGt: number | null; totalRateLt: number | null; totalRateGt: number | null } | null;
    filtered: HoldingRowPayload[] | null;
    realizedMonthWon: number | null;
    /** 브리핑과 같은 계좌 섹션 (2026-10-01~). 없으면 이전 형식 */
    sections?: Section[];
}

export interface HoldingPayload {
    asOf: string; code: string; name: string; market: StockMarket; link: string; currency: string;
    curPrc: number | null; dayRate: number | null; dayChange: number | null;
    brokers: { broker: string; qty: number | null; purPrice: number | null; eval: number | null; evalProfit: number | null; totalRate: number | null }[];
}

export interface PnlPayload {
    period: 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR'; year: number; month: number | null; totalWon: number;
    byClass: Record<string, number>;
    rows: { broker: string; market: 'STOCK' | 'CRYPTO'; year: number; month: number; realizedPnl: number }[];
}

export interface PriceAlertPreviewPayload {
    asOf: string; code: string; name: string; market: StockMarket; assetCode: string;
    price: number; direction: 'ABOVE' | 'BELOW'; currency: string;
}

export interface StoredCard { ref: string; memberId: number; kind: string; createdAt: string; payload: unknown; }

export interface ChatPick { code: string; market: StockMarket; name: string; }

export interface TimelineMessage {
    id: number;
    createdAt: string;
    body: MessageBody;
}

/** 타임라인 보기 필터 (Kotlin TimelineView). BRIEFING = 브리핑·알림, CHAT = 질문·답변 */
export type TimelineView = 'ALL' | 'BRIEFING' | 'CHAT';

export interface TimelinePage {
    items: TimelineMessage[];
    nextCursor: number | null;
    unreadCount: number;
    personalIncluded: boolean;
}

export interface AssistantSettingRes {
    /** 국내주식: 07:00 장 전 + 16:00 마감 */
    krEnabled: boolean;
    /** 미국주식: 미국 마감 */
    usEnabled: boolean;
    /** 코인: 09:05 코인 마감. 행이 없으면 코인 계좌가 있을 때만 기본 on */
    coinEnabled: boolean;
    /** 국내 지수(코스피·코스닥) 장중 ±3%·±5% 급변 알림 */
    krWarnEnabled: boolean;
    /** 미국 지수(나스닥·S&P500) 장중 ±3%·±5% 급변 알림 */
    usWarnEnabled: boolean;
    /** 지표 발표 알림. 서킷브레이커는 설정과 관계없이 항상 */
    releaseAlertEnabled: boolean;
    sectionsOff: string[];
}

export type AssistantSettingReq = AssistantSettingRes;

export interface ReadMarkerReq {
    lastSeenId: number;
}

/** POST /api/assistant/secure/token — RS256 비서 토큰 (5분). 메모리에만 보관, 저장소 X */
export interface AssistantTokenRes {
    token: string;
    expiresAt: string;
    kid: string;
}

/** 설정 화면의 섹션 on/off 목록. id 는 Kotlin 렌더러가 내보내는 섹션 ID 와 같아야 한다 */
export const BRIEFING_SECTIONS: { group: string; items: { id: string; label: string; personal?: boolean }[] }[] = [
    {
        group: '미국 장 마감',
        items: [
            {id: 'U1A', label: '내 미국 종목', personal: true},
            {id: 'U2', label: '미국 지수'},
            {id: 'U2B', label: '미국 국채 금리'},
            {id: 'U4', label: '환율'},
        ],
    },
    {
        group: '국내 장 전 (07:00)',
        items: [
            {id: 'P2B', label: '오늘 추천 (시스템 분류)'},
            {id: 'P4', label: '매크로'},
        ],
    },
    {
        group: '국내 장 마감 (16:00)',
        items: [
            {id: 'C2', label: '국내 지수'},
            {id: 'C3', label: '투자자 수급'},
            {id: 'C4', label: '업종'},
            {id: 'C6', label: '환율 마감'},
        ],
    },
    {
        group: '국내 계좌 마감 (20:05)',
        items: [
            {id: 'C1A', label: '내 국내 종목', personal: true},
        ],
    },
    {
        group: '코인 마감 (09:05)',
        items: [
            {id: 'K1A', label: '내 코인', personal: true},
            {id: 'K2', label: '코인 시세'},
        ],
    },
];

export type TelegramStatus = 'NONE' | 'ACTIVE' | 'PAUSED' | 'BLOCKED';

export interface TelegramStatusRes {
    /** 서버에 봇 토큰이 있는지. false 면 연결 불가 안내 */
    configured: boolean;
    status: TelegramStatus;
    linkedAt: string | null;
    botUsername: string;
    /** 관리자 전체 발송 차단 중 */
    sendBlocked: boolean;
}

export interface TelegramLinkCodeRes {
    code: string;
    expiresAt: string;
    /** https://t.me/{bot}?start={code} — 누르면 텔레그램에 /start {code} 자동 입력 */
    deepLink: string;
}

export interface TelegramStatusReq {
    status: 'ACTIVE' | 'PAUSED';
}

// ── 관리자 (별칭 사전 · 사용량) ──

export interface AssistantAliasRes { id: number; alias: string; market: StockMarket; stkCd: string; createdAt: string; }
export interface AssistantAliasCreateReq { alias: string; market: StockMarket; stkCd: string; }

export interface AssistantUsageSum {
    turns: number;
    llmCalls: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    costUsd: number;
    rejectCount: number;
    askCount: number;
    /** ERROR + BLOCKED */
    errorCount: number;
    /** 턴 평균 응답 시간 */
    avgLatencyMs: number;
}

/** 관리자 — 회원 처리 기록 1건 (질문 원문 없음) */
export interface AssistantChatLogRes {
    id: number;
    createdAt: string;
    /** TOOL / PICK / REJECT / ASK_USER / BLOCKED / ERROR */
    route: string;
    reason: string | null;
    tools: string[];
    /** 화면 문구 — 서버(ChatLogLabel)가 코드에서 만든다 */
    routeLabel: string;
    requestLabel: string | null;
    reasonLabel: string | null;
    toolErrorCount: number;
    llmCalls: number;
    costUsd: number;
    latencyMs: number;
}

export interface AssistantUsageRes {
    month: string;
    total: AssistantUsageSum;
    daily: { date: string; usage: AssistantUsageSum }[];
    members: { memberId: number; loginId: string | null; usage: AssistantUsageSum }[];
}

export interface EconomicIndicator {
    code: string;
    name: string;
    country: string;
    latestValue: string;
    latestDate: string;
    unit: string;
    change: string | null;
    previousValue?: string | null;
}

export interface IndicatorHistoryReq {
    code: string;
    country: string;
}

export interface IndicatorDataPoint {
    date: string;
    value: string;
    originalValue?: string | null;
    observationDate?: string | null;
}

export interface IndicatorHistoryRes {
    code: string;
    name: string;
    unit: string;
    chartType: string; // linear, stepAfter
    frequency: string; // D, W, M, Q
    data: IndicatorDataPoint[];
}

export interface CalendarEventsReq {
    year: number;
    month: number;
}

export interface CalendarEvent {
    id: number | null;
    date: string;
    name: string;
    country: string;
    value: string | null;
    isFuture: boolean;
    type: string; // INDICATOR, HOLIDAY, MEETING
    source: string; // ECOS, FRED, HOLIDAY(공휴일), KRX(거래소 자체 휴장), MANUAL
    note?: string | null; // 값 옆 안내. 대체 지표면 "전월비 · 전년비 미발표", 값이 없으면 "미발표"
}

export interface ManualCalendarEventReq {
    date: string;
    name: string;
    country: string;
    value?: string | null;
    type: string;
}

export interface BulkRefreshReq {
    yearFrom: number;
    yearTo: number;
}

export interface BulkRefreshStatus {
    running: boolean;
    yearFrom: number | null;
    yearTo: number | null;
    totalMonths: number;
    processedMonths: number;
    failedMonths: number;
    currentMonth: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    errorMessage: string | null;
}

export interface UpdateCalendarEventMutationVars {
    id: number;
    req: ManualCalendarEventReq;
}

/** 국내 장 시각이 평소(09:00~15:30)와 다른 날 (수능일 등). 백엔드 MarketSessionRes */
export interface MarketSession {
    id: number;
    date: string;      // yyyy-MM-dd
    name: string;
    openTime: string;  // HH:mm
    closeTime: string; // HH:mm
    preMarket: boolean; // NXT 프리마켓 운영 여부
}

/** 백엔드 MarketSessionReq */
export interface MarketSessionReq {
    date: string;
    name: string;
    openTime: string;
    closeTime: string;
    preMarket: boolean;
}

export interface UpdateMarketSessionMutationVars {
    id: number;
    req: MarketSessionReq;
}

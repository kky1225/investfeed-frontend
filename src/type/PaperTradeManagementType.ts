export interface AdminPaperAccountRes {
    summary: AccountSummary;
    holdings: PaperHoldingItem[];
}

export interface AccountSummary {
    deposit: number;
    orderableAmt: number;
    totalPurAmt: number;
    totalEvltAmt: number;
    totalEvltPl: number;
    totalPrftRt: number | null;
    nav: number;
}

export interface PaperHoldingItem {
    stkCd: string;
    stkNm: string;
    rmndQty: number;
    trdeAbleQty: number;
    purPric: number;
    curPrc: number;
    purAmt: number;
    evltAmt: number;
    evltvPrft: number;
    prftRt: number | null;
    possRt: number | null;
}

export interface AdminPaperRealizedPnlRes {
    viewMode: 'monthly' | 'yearly' | 'all' | string;
    year: number | null;
    month: number | null;
    items: PaperRealizedPnlMonthlyItem[];
}

export interface PaperRealizedPnlMonthlyItem {
    year: number;
    month: number;
    realizedPnl: number;
    totalBuyAmt: number;
    totalSellAmt: number;
    tradeFee: number;
    tradeTax: number;
}

export interface AdminPaperTradeHistoryRes {
    ordDt: string;          // YYYYMMDD
    items: PaperTradeHistoryItem[];
}

export interface PaperTradeHistoryItem {
    ordDt: string;
    ordTm: string | null;
    stkCd: string;
    stkNm: string;
    ioTpNm: string | null;
    trdeTp: string | null;
    cntrQty: number;
    cntrUv: number;
    ordQty: number;
    ordUv: number;
    ordNo: string | null;
}

export interface AdminHoldingGradeRes {
    evalDate: string | null;          // YYYY-MM-DD. 데이터 없으면 null.
    items: HoldingGradeItem[];
}

export interface HoldingGradeItem {
    stkCd: string;
    stkNm: string;
    type: string;                     // STRONG_BUY / BUY / HOLD / SELL / STRONG_SELL
    originSide: string | null;        // BUY / SELL
    marketType: string | null;        // KOSPI / KOSDAQ
    penfndK: number | null;
    frgnrMcapRatio: number | null;
}

export interface PaperTradeReportRes {
    startDate: string | null;
    startNav: number;
    currentNav: number;
    totalReturnPct: number;
    kospiReturnPct: number | null;
    kosdaqReturnPct: number | null;
    blendedBenchmarkPct: number;
}
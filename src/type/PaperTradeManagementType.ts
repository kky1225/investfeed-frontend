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
    frgnrOppositeK: number | null;    // 외국인 반대 K (BLOCK/freeze/부분비중 강도)
    frgnrSameDirK: number | null;     // 외국인 동조 K (하드스톱)
    priorTrendRatio: number | null;   // B′ 추세 명확성 (STRONG)
    foreignerAligned: boolean | null; // 옵션B 외국인 동조
    evaluationReason: string | null;  // HARD_SELL / BLOCK_FREEZE / BLOCK_PARTIAL / CONFLICT (복수면 '|'), 없으면 null
    targetWeightRatio: number | null; // 부분비중 0.10, 그 외 null(기본)
    // ─── 상세(팝업)용 — 모듈 보정 전 백본 + 백본사유 + 6개 후행 모듈 트리거 ───
    preAdjustmentType: string | null; // 모듈 보정 전 백본 등급 (HOLD→BUY 격상 추적)
    backboneReason: string | null;    // 백본 분류 사유 한 줄 (수급 근거)
    pvTrigger: string | null;         // PROMOTE / DEMOTE / NONE
    maTrigger: string | null;
    vpTrigger: string | null;
    rsiTrigger: string | null;
    hl52wTrigger: string | null;
    breakoutTrigger: string | null;
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
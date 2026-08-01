export enum UsStockChartType {
    MINUTE_1 = 'MINUTE_1',
    MINUTE_3 = 'MINUTE_3',
    MINUTE_5 = 'MINUTE_5',
    MINUTE_10 = 'MINUTE_10',
    MINUTE_30 = 'MINUTE_30',
    DAY = 'DAY',
    WEEK = 'WEEK',
    MONTH = 'MONTH',
    YEAR = 'YEAR',
}

export interface UsStockDetailReq {
    stexTp: string; // 거래소구분 ND/NY/NA
    chartType: UsStockChartType;
}

export interface UsStockInfo {
    stexTp: string | null;
    stkCd: string | null;
    stkNm: string | null;
    stkEnm: string | null;
    curPrc: string | null;
    predPreSig: string | null;
    predPre: string | null;
    fluRt: string | null;
    accTrdeQty: string | null;
    baseExrt: string | null; // 환율
    wk52HgstPric: string | null;
    wk52HgstPricDt: string | null;
    wk52HgstPricPreRt: string | null;
    wk52LwstPric: string | null;
    wk52LwstPricDt: string | null;
    wk52LwstPricPreRt: string | null;
    preOpenPric: string | null;
    preHighPric: string | null;
    preLowPric: string | null;
    baseClosePric: string | null; // 전일종가
    openPric: string | null;
    highPric: string | null;
    lowPric: string | null;
    stkCnt: string | null; // 상장주식수
    mac: string | null; // 시가총액 (천 USD)
    lgIndsCd: string | null; // 업종 대분류
    smIndsCd: string | null; // 업종 소분류
    currUnit: string | null;
    trdSuspTp: string | null; // 0:정상
}

export interface UsStockChart {
    dt: string | null;
    curPrc: string | null;
    openPric: string | null;
    highPric: string | null;
    lowPric: string | null;
    trdeQty: string | null;
    trdePrica: string | null;
}

export interface UsStockDailyPrice {
    dt: string | null;
    curPrc: string | null;
    predPreSig: string | null;
    predPre: string | null;
    fluRt: string | null;
    openPric: string | null;
    highPric: string | null;
    lowPric: string | null;
    accTrdeQty: string | null;
    trdePrica: string | null;
}

export interface UsStockDetailRes {
    usStockInfo: UsStockInfo;
    chartList: UsStockChart[];
    dailyPriceList: UsStockDailyPrice[];
}

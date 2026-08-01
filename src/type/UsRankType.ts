export interface UsRankListReq {
    type: string, // 0: 거래대금, 1: 거래량, 2: 급등
}

export interface UsRankListItem {
    stkCd: string,
    stexTp: string, // ND: NASDAQ, NY: NYSE, NA: AMEX
    rank: string,
    stkNm: string,
    fluRt: string,
    curPrc: string,
    trdePrica: string,
}

export interface UsRankListRes {
    rankList: UsRankListItem[],
}

export interface UsStockStreamItem {
    stkCd: string,
    stexTp: string, // ND: NASDAQ, NY: NYSE, NA: AMEX
}

export interface UsStockStreamReq {
    items: UsStockStreamItem[],
}

export interface UsRankGridRow {
    id: string;
    stexTp: string;
    rank: string;
    stkNm: string;
    fluRt: string;
    curPrc: string;
    trdePrica: string;
}

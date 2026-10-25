export interface SectListReq {
    indsCd: string, // 001:종합(KOSPI), 101:종합(KOSDAQ)
}

export interface SectGridRow {
    id: string;
    stkCd: string;
    stkNm: string;
    fluRt: string;
    curPrc: string;
}

export interface SectListItem {
    curPrc: string,
    fluRt: string,
    preSig: string,
    stkCd: string,
    stkNm: string,
    trdePrica: string, // 단위: 백만원
    trdeQty: string,
    rising: string, // 상승 종목수
    stdns: string, // 보합 종목수
    fall: string, // 하락 종목수
    floStkNum: string, // 상장 종목수
}

export interface SectListStreamReq {
    items: Array<string>
}

export interface SectStockListReq {
    mrktTp: string
}

export interface SectStockListItem {
    stkCd: string,
    stkNm: string,
    fluRt: string,
    curPrc: string,
    predPreSig: string,
    nowTrdeQty: string
}

export interface SectListStreamRes {
    type: string,
    name: string,
    item: string,
    values: Array<SectListStream>
}

export interface SectListStream {
    code: string,
    value: string,
    fluRt: string,
    trend: string,
}

export interface SectStockListStream {
    code: string,
    value: string,
    fluRt: string,
    trend: string,
}

export interface SectStockGridRow {
    id: string,
    stkNm: string;
    fluRt: string;
    curPrc: string;
    predPreSig: string;
    nowTrdeQty: string;
}

export interface SectListRes {
    sectList: SectListItem[],
}

export interface SectStockListRes {
    sectStockList: SectStockListItem[],
}
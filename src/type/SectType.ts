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
    trdePrica: string,
    trdeQty: string
}

export interface SectListStreamReq {
    items: Array<string>
}

export interface SectStockListReq {
    indsCd: string,
    mrktTp: string
}

export interface SectStockListRes {
    sectStockList: Array<SectStockListItem>
}

export interface SectStockListStreamReq {
    items: Array<string>
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

export interface SectStockListStreamRes {
    type: string,
    name: string,
    item: string,
    values: Array<SectStockListStream>
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
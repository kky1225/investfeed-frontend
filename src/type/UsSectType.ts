export interface UsSectListItem {
    indsCd: string, // 업종코드
    indsNm: string, // 업종명
    perf1d: string, // 1일 수익률
    perf5d: string, // 5일 수익률
    perf1m: string, // 1개월 수익률
    perf3m: string, // 3개월 수익률
    perf6m: string, // 6개월 수익률
    perfYtd: string, // 연중 수익률
    perf1y: string, // 1년 수익률
}

export interface UsSectStockListReq {
    sortTp: string // 1:등락율상위, 2:등락율하위
}

export interface UsSectStockListItem {
    stkCd: string,
    stexTp: string, // ND:NASDAQ, NY:NYSE, NA:AMEX
    stkNm: string,
    fluRt: string,
    curPrc: string,
    predPreSig: string,
    accTrdeQty: string
}

export interface UsSectStockGridRow {
    id: string,
    stexTp: string,
    stkNm: string,
    fluRt: string,
    curPrc: string,
    accTrdeQty: string,
}

export interface UsSectStockStreamItem {
    stkCd: string,
    stexTp: string,
}

export interface UsSectStockStreamReq {
    items: Array<UsSectStockStreamItem>
}

export interface UsSectListRes {
    sectList: UsSectListItem[],
}

export interface UsSectStockListRes {
    sectStockList: UsSectStockListItem[],
}

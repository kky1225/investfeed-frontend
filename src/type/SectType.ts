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
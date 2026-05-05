export interface ThemeListReq {
    dateTp: string,
    fluPlAmtTp: "1" | "3"
}

export interface ThemeListItem {
    themaGrpCd: string,
    themaNm: string,
    fluSig: string,
    fluRt: string,
    risingStkNum: string,
    fallStkNum: string,
    dtPrftRt: string,
    mainStk: string
}

export interface ThemeGridRow {
    id: string;
    rank: string;
    themaNm: string,
    fluSig: string,
    fluRt: string;
    dtPrftRt: string,
}

export interface ThemeStockListReq {
    dateTp: string,
}

export interface ThemeStockListItem {
    stkCd: string,
    stkNm: string,
    curPrc: string,
    fluSig: string,
    predPre: string,
    fluRt: string,
    accTrdeQty: string,
    dtPrftRtN: string,
}

export interface ThemeStockGridRow {
    id: string,
    stkNm: string,
    curPrc: string,
    fluRt: string,
    accTrdeQty: string,
    dtPrftRtN: string
}

export interface ThemeStockListStreamReq {
    items: Array<string>
}

export interface ThemeStockListStream {
    code: string,
    value: string,
    fluRt: string,
    trend: string,
}

export interface ThemeStockListStreamRes {
    type: string,
    name: string,
    item: string,
    values: Array<ThemeStockListStream>
}
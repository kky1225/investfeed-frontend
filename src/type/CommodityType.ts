export interface CommodityDetailReq {
    stkCd: string, // 종목코드 M04020000 금 99.99_1kg, M04020100 미니금 99.99_100g
    chartType: CommodityChartType,
}

export interface CommodityDetailSteamReq {
    stkCd: string, // 종목코드 M04020000 금 99.99_1kg, M04020100 미니금 99.99_100g
}

export enum CommodityChartType {
    MINUTE_1 = "MINUTE_1",
    MINUTE_3 = "MINUTE_3",
    MINUTE_5 = "MINUTE_5",
    MINUTE_10 = "MINUTE_10",
    MINUTE_30 = "MINUTE_30",
    DAY = "DAY",
    WEEK = "WEEK",
    MONTH = "MONTH",
    YEAR = "YEAR"
}

export interface CommodityListItem {
    stkCd: string,
    stkNm: string,
    curPrc: string,
    predPreSig: string,
    fluRt: string,
    trdeQty: string,
    trdePrica: string,
    openPric: string,
    tmN: string,
    chartMinuteList: Array<ChartMinute>
}

export interface ChartMinute {
    curPrc: string,
    cntrTm: string,
}

export interface CommodityStreamRes {
    type: string,
    name: string,
    item: string,
    values: Array<CommodityStream>
}

export interface CommodityStream {
    code: string,
    value: string,
    fluRt: string,
    trend: string,
}

export interface CommodityChart {
    curPrc: string,
    dt: string,
    highPric: string,
    lowPric: string,
    openPric: string,
    trdePrica: string,
    trdeQty: string
}
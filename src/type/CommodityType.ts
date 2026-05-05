export interface CommodityDetailReq {
    chartType: CommodityChartType,
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
}

export interface CommodityListItem {
    stkCd: string,
    stkNm: string,
    curPrc: string,
    predPreSig: string,
    predPre: string,
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
    change: string,
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

export interface CommodityInfo {
    stkCd: string,
    stkNm: string,
    curPrc: string,
    predPreSig: string,
    predPre: string,
    fluRt: string,
    trdeQty: string,
    trdePrica: string,
    highPric: string,
    openPric: string,
    lowPric: string,
    _250hgst: string,
    _250lwst: string,
    tm: string,
    indNetprps: number,
    frgnrNetprps: number,
    orgnNetprps: number,
    nxtEnable: string,
    orderWarning: string,
    marketCode: string,
    marketName: string,
}

export interface CommodityListRes {
    commodityList: CommodityListItem[],
}

export interface CommodityDetailRes {
    commodityInfo: CommodityInfo,
    commodityChartList: CommodityChart[],
}
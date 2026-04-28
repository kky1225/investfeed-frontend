export interface IndexDetailReq {
    chart_type: IndexChartType,
}

export enum IndexChartType {
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

export interface IndexListItem {
    indsCd: string,
    indsNm: string,
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

export interface IndexStreamRes {
    type: string,
    name: string,
    item: string,
    values: Array<IndexStream>
}

export interface IndexStream {
    code: string,
    value: string,
    change: string,
    fluRt: string,
    trend: string,
}
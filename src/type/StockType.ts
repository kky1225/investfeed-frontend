export interface StockGridRow {
    id: string;
    rank: string;
    stkNm: string;
    fluRt: string;
    curPrc: string;
    trdePrica: string;
}

export interface StockDetailReq {
    chartType: StockChartType
}

export enum StockChartType {
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

export interface StockStreamReq {
    items: Array<string>
}

export interface StockStreamRes {
    type: string,
    name: string,
    item: string,
    values: Record<string, string>
}

export interface StockStream {
    code: string,
    value: string,
    fluRt: string,
    predPre: string,
    trend: string,
}

export interface StockDividendItem {
    dvdnBasDt: string,
    stckDvdnRcdNm: string,
    stckGenrDvdnAmt: string,
    cashDvdnPayDt: string,
}
export interface StockListReq {
    type: string, // 0: 거래대금, 1: 거래량, 2: 급등
}

export interface StockListRes {
    return_code: string,
    return_msg: string,
    stockList: Array<StockListItem>
}

export interface StockListItem {
    stkCd: string,
    rank: string,
    stkNm: string,
    fluRt: string,
    curPrc: string,
    trdePrica: string,
}

export interface StockGridRow {
    id: string;
    rank: string;
    stkNm: string;
    fluRt: string;
    curPrc: string;
    trdePrica: string;
}

export interface StockDetailReq {
    stkCd: string, // 거래소별 종목코드(KRX:039490,NXT:039490_NX,SOR:039490_AL)
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
    values: Array<StockStream>
}

export interface StockStream {
    code: string,
    value: string,
    fluRt: string,
    trend: string,
}
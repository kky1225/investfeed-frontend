export interface StockListReq {
    type: string, // 0: 거래대금, 1: 거래량, 2: 급등
}

export interface StockListRes {
    return_code: string,
    return_msg: string,
    stockList: Array<StockListItem>
}

export interface StockListItem {
    stk_cd: string,
    rank: string,
    stk_nm: string,
    flu_rt: string,
    cur_prc: string,
    trde_prica: string,
}

export interface StockGridRow {
    id: string;
    rank: string;
    stk_nm: string;
    flu_rt: string;
    cur_prc: string;
    trde_prica: string;
}

export interface StockDetailReq {
    stk_cd: string, // 거래소별 종목코드(KRX:039490,NXT:039490_NX,SOR:039490_AL)
    chart_type: StockChartType
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
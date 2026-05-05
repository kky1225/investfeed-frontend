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

export interface StockInfo {
    stkCd: string,
    stkNm: string,
    per: string,
    eps: string,
    roe: string,
    pbr: string,
    mac: string,
    macWght: string,
    forExhRt: string,
    _250hgst: string,
    _250lwst: string,
    highPric: string,
    openPric: string,
    lowPric: string,
    curPrc: string,
    preSig: string,
    predPre: string,
    fluRt: string,
    trdeQty: string,
    tm: string,
    trdePrica: string,
    nxtEnable: string,
    orderWarning: string,
    marketCode: string,
    marketName: string,
    upName: string,
    expCntrPric: string,
    expCntrFluRt: string,
    expCntrPreSig: string,
}

export interface StockChart {
    dt: string,
    curPrc: string,
    openPric: string,
    highPric: string,
    lowPric: string,
    trdeQty: string,
    trdePrica: string,
}

export interface StockInvestor {
    dt: string,
    indInvsr: string,
    frgnrInvsr: string,
    orgn: string,
    etcFnnc: string,
    fnncInvt: string,
    insrnc: string,
    invtrt: string,
    samoFund: string,
    penfndEtc: string,
    bank: string,
    natn: string,
    etcCorp: string,
    natfor: string,
}

export interface StockInvestorChart {
    tm: string,
    frgnrInvsr: string,
    orgn: string,
    penfnd_etc: string,
}

export interface StockProgram {
    dt: string,
    prmSellQty: string,
    prmBuyQty: string,
    prmNetprpsQty: string,
    prmNetprpsQtyIrds: string,
}

export interface StockShortSelling {
    dt: string,
    trdeQty: string,
    shrtsQty: string,
    trdeWght: string,
    shrtsTrdePrica: string,
    shrtsAvgPric: string,
}

export interface StockDetailRes {
    stockInfo: StockInfo,
    stockChartList: StockChart[],
    stockInvestorChartList: StockInvestorChart[],
    stockInvestorList: StockInvestor[],
    stockProgramList: StockProgram[],
    stockProgramChartList: unknown[],
    stockShortSellingList: StockShortSelling[],
    dividendList: StockDividendItem[],
}
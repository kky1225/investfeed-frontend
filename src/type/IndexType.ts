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

export interface IndexInfo {
    indsCd: string,
    indsNm: string,
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
    tmN: string,
    indNetprps: string,
    frgnrNetprps: string,
    orgnNetprps: string,
    dfrtTrdeNetprps: string,
    ndiffproTrdeNetprps: string,
    allNetprps: string,
}

export interface IndexChart {
    curPrc: string,
    trdeQty: string,
    dt: string,
    openPric: string,
    highPric: string,
    lowPric: string,
    trdePrica: string,
}

export interface ProgramChart {
    cntrTm: string,
    dfrtTrdeNetprps: string,
    ndiffproTrdeNetprps: string,
    allNetprps: string,
}

export interface ProgramListItem {
    dt: string,
    dfrtTrdeTdy: string,
    ndiffproTrdeTdy: string,
    allTdy: string,
}

export interface IndexInvestorDailyItem {
    dt: string,
    indNetprps: string,
    frgnrNetprps: string,
    orgnNetprps: string,
    scNetprps: string,
    insrncNetprps: string,
    invtrtNetprps: string,
    bankNetprps: string,
    endwNetprps: string,
    etcCorpNetprps: string,
    samoFundNetprps: string,
    natnNetprps: string,
    jnsinkmNetprps: string,
    nativeTrmtFrgnrNetprps: string,
}

export interface IndexListRes {
    indexList: IndexListItem[],
}

export interface IndexDetailRes {
    indexInfo: IndexInfo,
    chartList: IndexChart[],
    programChartList: ProgramChart[],
    programList: ProgramListItem[],
    investorDailyList: IndexInvestorDailyItem[],
}
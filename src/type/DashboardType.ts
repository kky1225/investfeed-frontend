export interface DashboardIndexListItem {
    indsCd: string,
    indsNm: string,
    curPrc: string,
    predPreSig: string,
    fluRt: string,
    tm: string,
    ind: string,
    orgn: string,
    frgnr: string,
    chartList: Array<ChartDay>
}

export interface ChartDay {
    curPrc: string,
    dt: string,
}

export interface InvestorTradeRankList {
    id: string,
    stkCd: string,
    rank: string,
    stkNm: string,
    pridStkpcFluRt: string,
    nettrdeAmt: string
}
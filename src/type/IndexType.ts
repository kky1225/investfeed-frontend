export interface IndexDetailReq {
    inds_cd: string, // 업종코드 001:종합(KOSPI), 002:대형주, 003:중형주, 004:소형주 101:종합(KOSDAQ), 201:KOSPI200, 302:KOSTAR, 701: KRX100 나머지 ※ 업종코드 참고
    chart_type: IndexChartType,
}

export interface IndexDetailSteamReq {
    inds_cd: string, // 업종코드 001:종합(KOSPI), 002:대형주, 003:중형주, 004:소형주 101:종합(KOSDAQ), 201:KOSPI200, 302:KOSTAR, 701: KRX100 나머지 ※ 업종코드 참고
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
    fluRt: string,
    trend: string,
}
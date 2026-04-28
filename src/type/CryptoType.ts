export interface CryptoListItem {
    market: string,
    koreanName: string,
    englishName: string,
    tradePrice: number,
    change: string,
    changeRate: number,
    changePrice: number,
    signedChangeRate: number,
    signedChangePrice: number,
    accTradePrice24h: number,
    accTradeVolume24h: number,
    highest52WeekPrice: number,
    highest52WeekDate: string,
    lowest52WeekPrice: number,
    lowest52WeekDate: string,
    tradeDateTimeKst: string,
    chartMinuteList: Array<CryptoChartMinute>,
}

export interface CryptoChartMinute {
    tradePrice: number,
    candleDateTimeKst: string,
}

export interface CryptoDetailReq {
    chartType: CryptoChartType,
}

export enum CryptoChartType {
    MINUTE_1 = "MINUTE_1",
    MINUTE_3 = "MINUTE_3",
    MINUTE_5 = "MINUTE_5",
    MINUTE_10 = "MINUTE_10",
    MINUTE_30 = "MINUTE_30",
    DAY = "DAY",
    WEEK = "WEEK",
    MONTH = "MONTH",
    YEAR = "YEAR",
}

export interface CryptoDetailInfo {
    market: string,
    koreanName: string,
    englishName: string,
    tradePrice: number,
    openingPrice: number,
    highPrice: number,
    lowPrice: number,
    prevClosingPrice: number,
    change: string,
    signedChangeRate: number,
    signedChangePrice: number,
    accTradePrice24h: number,
    accTradeVolume24h: number,
    highest52WeekPrice: number,
    highest52WeekDate: string,
    lowest52WeekPrice: number,
    lowest52WeekDate: string,
    tradeDateTimeKst: string,
}

export interface CryptoChart {
    dt: string,
    tradePrice: number,
    openingPrice: number,
    highPrice: number,
    lowPrice: number,
    candleAccTradeVolume: number,
    candleAccTradePrice: number,
}

export interface CryptoRankItem {
    market: string,
    koreanName: string,
    englishName: string,
    tradePrice: number,
    signedChangePrice: number,
    signedChangeRate: number,
    change: string,
    accTradePrice24h: number,
    accTradeVolume24h: number,
    highPrice: number,
    lowPrice: number,
    prevClosingPrice: number,
    warning: boolean,
}

export interface FearGreedRes {
    current: FearGreedItem,
    history: FearGreedItem[],
}

export interface FearGreedItem {
    value: number,
    classification: string,
    date: string,
}

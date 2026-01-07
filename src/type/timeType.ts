export interface TimeNowReq {
    marketType: MarketType
}

export enum MarketType {
    INDEX = "INDEX", STOCK = "STOCK", COMMODITY = "COMMODITY",
}
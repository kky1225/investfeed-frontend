export interface GoldDetailReq {
    stk_cd: string, // M04020000
    chart_type: ChartType
}

export enum ChartType {
    MINUTE_1 = "MINUTE_1",
    MINUTE_3 = "MINUTE_3",
    MINUTE_5 = "MINUTE_5",
    MINUTE_10 = "MINUTE_10",
    MINUTE_30 = "MINUTE_30",
    DAY = "DAY",
    WEEK = "WEEK",
    MONTH = "MONTH",
}
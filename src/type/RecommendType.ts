export type RecommendType = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

export type TodayDirection = 'MATCH' | 'MISMATCH';

export interface RecommendListItem {
    type: RecommendType, // 추천 등급
    stkCd: string, // 종목코드
    stkNm: string, // 종목명
    fluRt: string, // 등락률
    curPrc: string, // 현재가
    preSig: string, // 대비기호
    predPre: string, // 전일대비
    todayDirection?: TodayDirection | null, // 당일 매매 동향 (보조 지표)
    isHolding?: boolean, // 사용자가 키움증권에 보유 중인 종목인지
    streakDays?: number, // 같은 진영(매수/매도)으로 연속 추천된 일수
}

export interface RecommendListStreamReq {
    items: Array<string>
}

export interface RecommendListStreamRes {
    type: string,
    name: string,
    item: string,
    values: Array<RecommendListStream>
}

export interface RecommendListStream {
    code: string,
    value: string,
    change: string,
    fluRt: string,
    trend: string,
}

export interface RecommendListRes {
    recommendList: RecommendListItem[],
    avoidList: RecommendListItem[],
    holdList: RecommendListItem[],
}

export type RiskPreset = 'AGGRESSIVE' | 'NORMAL' | 'CONSERVATIVE';

export interface RecommendSettingReq {
    riskPreset: RiskPreset,
    priceVolatilityEnabled: boolean,
    movingAverageEnabled: boolean,
}

export interface RecommendSettingRes {
    riskPreset: RiskPreset,
    priceVolatilityEnabled: boolean,
    movingAverageEnabled: boolean,
}
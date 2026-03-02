export interface RecommendListRes {
    recommendList: Array<RecommendListItem>,
    avoidList: Array<RecommendListItem>,
}

export interface RecommendListItem {
    stkCd: string, // 종목코드
    stkNm: string, // 종목명
    fluRt: string, // 등락률
    curPrc: string, // 현재가
    preSig: string, // 대비기호
}
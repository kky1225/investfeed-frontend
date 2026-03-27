export interface RankListReq {
    type: string, // 0: 거래대금, 1: 거래량, 2: 급등
}

export interface RankListRes {
    return_code: string,
    return_msg: string,
    rankList: Array<RankListItem>
}

export interface RankListItem {
    stkCd: string,
    rank: string,
    stkNm: string,
    fluRt: string,
    curPrc: string,
    trdePrica: string,
}
export interface InvestorListReq {
    trdeTp: string,
    orgnTp: string,
}

export interface InvestorListItem {
    stkCd: string, // 종목코드
    stkNm: string, // 종목명
    curPrc: string, // 현재가
    preSig: string, // 대비기호
    predPre: string, // 전일대비
    fluRt: string, // 등락율
    accTrdeQty: string, // 누적거래량
    netprpsAmt: string, // 순매수금액
    netprpsQty: string, // 순매수수량
}

export interface InvestorGridRow {
    id: string,
    rank: number,
    stkNm: string,
    fluRt: string,
    curPrc: string,
    netprpsAmt: string,
    trend?: string,
}

export interface InvestorStreamReq {
    items: Array<string>
}

export interface InvestorStream {
    code: string,
    value: string,
    fluRt: string,
    trend: string,
}

export interface InvestorListRes {
    investorList: InvestorListItem[],
    /** 기준 거래일 yyyy-MM-dd */
    baseDate?: string | null,
    /** 장중 잠정치(ETF 없음)면 true, 장 마감 확정치(ETF 포함)면 false */
    provisional?: boolean,
}
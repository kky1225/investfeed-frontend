export interface InvestorListReq {
    trdeTp: string,
    orgnTp: string,
}

export interface InvestorListRes {
    stockInvestorList: Array<InvestorListItem>
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

export interface InvestorStreamReq {
    items: Array<string>
}

export interface InvestorStreamRes {
    type: string,
    name: string,
    item: string,
    values: Array<InvestorStream>
}

export interface InvestorStream {
    code: string,
    value: string,
    fluRt: string,
    trend: string,
}
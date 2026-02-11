export interface InvestorListReq {
    trdeTp: string,
    orgnTp: string,
}

export interface InvestorListRes {
    stockInvestorList: Array<InvestorListItem>
}

export interface InvestorListItem {
    stkCd: string, // 종목코
    stkNm: string, // 종목명
    selQty: string, // 매도량
    buyQty: string, // 매수량
    netslmt: string, // 순매도
}
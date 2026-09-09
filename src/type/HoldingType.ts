export interface HoldingStreamReq {
    items: Array<string>
}

export interface HoldingStock {
    id: number,
    stkCd: string,
    stkNm: string,
    curPrc: string,
    purPric: string,
    purAmt: string,
    evltAmt: string,
    evltvPrft: string,
    prftRt: string,
    rmndQty: string,
    possRt: string,
    predClosePric: string,
    dayPl?: string, // 당일 손익(원). 증권사 API가 직접 제공하는 경우 사용(예: 토스)
    stexTp?: string, // 거래소구분 ND:NASDAQ, NY:NYSE, NA:AMEX. 미국 종목만 값 존재
    usStkCd?: string, // 미국 상세 조회용 티커(stkCd 의 _US 접미사 제외). 미국 종목만 값 존재
    // 미국 종목의 거래 통화(USD) 원본값. 원화 필드는 합계·비중 계산용, 표시는 이 값을 쓴다.
    curPrcUsd?: string,
    purPricUsd?: string,
    evltAmtUsd?: string,
    evltvPrftUsd?: string,
}

export interface HoldingStreamRes {
    type: string,
    name: string,
    item: string,
    values: Record<string, string>
}

/** useHoldingStream 훅의 buffer entry — stream 으로 들어오는 부분 갱신값. */
export interface HoldingBuffer {
    curPrc?: string;
    predPre?: string;
    rmndQty?: string;
    purPric?: string;
    curPrcUsd?: string; // 미국 실시간(FE) 체결가 — 달러
}

export type HoldingListData = {
    holdingList: HoldingStock[];
    totPurAmt: string;
    totEvltAmt: string;
    totEvltPl: string;
    totPrftRt: string;
    balance: string;
    // 달러 현금. 증권사마다 개념이 다르다(키움=외화예수금, 토스=달러 주문가능금액).
    balanceUsd?: string | null;
    // 위 달러 현금의 원화 환산액. 총자산 합계에 더한다.
    balanceUsdKrw?: string | null;
} | null;

export type CryptoHoldingListData = HoldingListData;

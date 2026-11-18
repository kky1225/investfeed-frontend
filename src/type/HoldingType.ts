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
    sessionLabel?: string | null, // 미국 데이·프리·애프터마켓 (토스 연동 회원만)
    regularClose?: number | null, // 장구분 등락률 기준 정규장 종가 (USD)
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

/** 내 매매를 조회할 종목의 시장 */
export type StockTradeMarket = 'KR' | 'US';

/** 체결 한 건 */
export interface StockTrade {
    broker: string;         // 증권사 이름
    // 체결 시각. 차트 캔들의 시각과 같은 기준(국내는 한국 시각, 미국은 미국 동부 시각).
    // yyyyMMddHHmmss, 증권사가 체결 시각을 주지 않으면(키움) yyyyMMdd
    dt: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
}

/** 증권사별 보유 수량과 평단가 */
export interface StockTradeHolding {
    broker: string;
    quantity: number;
    avgPrice: number;
}

/** 한 종목의 내 매매 (차트 표시용) */
export interface StockTradeRes {
    trades: StockTrade[];           // 오래된 순
    holdings: StockTradeHolding[];  // 평단가는 종목 통화 기준 (국내 원, 미국 달러)
    failedBrokers: string[];        // 조회에 실패해 위 목록에서 빠진 증권사 이름
}

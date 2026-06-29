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
}

export type HoldingListData = {
    holdingList: HoldingStock[];
    totPurAmt: string;
    totEvltAmt: string;
    totEvltPl: string;
    totPrftRt: string;
    balance: string;
} | null;

export type CryptoHoldingListData = HoldingListData;

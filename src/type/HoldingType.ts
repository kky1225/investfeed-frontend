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

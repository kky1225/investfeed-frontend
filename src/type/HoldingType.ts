export interface HoldingStreamReq {
    items: Array<string>
}

export interface HoldingListRes {
    totPurAmt: string,
    totEvltAmt: string,
    totEvltPl: string,
    totPrftRt: string,
    holdingList: Array<HoldingStock>
}

export interface HoldingStock {
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

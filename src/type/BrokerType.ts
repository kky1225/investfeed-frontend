export type BrokerType = 'API' | 'MANUAL';
export type BrokerMarket = 'STOCK' | 'CRYPTO';

// 증권사 마스터 (관리자용)
export interface Broker {
    id: number;
    name: string;
    type: BrokerType;
    market: BrokerMarket;
}

export interface CreateBrokerReq {
    name: string;
    type: BrokerType;
    market: BrokerMarket;
}

// 내 증권사 (사용자용)
export interface MemberBroker {
    id: number;
    brokerId: number;
    name: string;
    type: BrokerType;
    market: BrokerMarket;
    orderIndex: number;
}

export interface AddMyBrokerReq {
    brokerId: number;
}

// 수동 보유주식
export interface ManualHolding {
    id: number;
    stkCd: string;
    stkNm: string;
    purPrice: number;
    quantity: number;
    purAmt: number;
    curPrc: string;
    fluRt: string;
    basePric: string;
}

export interface CreateManualHoldingReq {
    brokerId: number;
    stkCd: string;
    stkNm: string;
    purPrice: number;
    quantity: number;
    purAmt: number;
}

export interface UpdateManualHoldingReq {
    purPrice: number;
    quantity: number;
    purAmt: number;
}

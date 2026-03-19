export interface CryptoInterestGroup {
    id: number;
    groupNm: string;
    displayOrder: number;
}

export interface CryptoInterestItem {
    id: number;
    market: string;
    koreanName: string;
    tradePrice: number;
    signedChangeRate: number;
    change: string;
}

export interface CreateCryptoGroupReq {
    groupNm: string;
}

export interface UpdateCryptoGroupReq {
    groupNm: string;
}

export interface AddCryptoItemReq {
    market: string;
    koreanName: string;
}

export interface ReorderReq {
    orderedIds: number[];
}

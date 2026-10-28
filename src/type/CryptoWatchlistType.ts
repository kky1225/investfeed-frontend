export interface CryptoWatchlistGroup {
    id: number;
    groupNm: string;
    displayOrder: number;
}

export interface CryptoWatchlistItem {
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

export interface UpdateGroupMutationVars {
    id: number;
    req: UpdateCryptoGroupReq;
}

export interface ReorderItemsMutationVars {
    groupId: number;
    req: ReorderReq;
}

export interface AddItemMutationVars {
    groupId: number;
    req: AddCryptoItemReq;
}

export interface DeleteItemMutationVars {
    groupId: number;
    itemId: number;
}

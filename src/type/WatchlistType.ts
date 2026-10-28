export interface WatchlistGroup {
    id: number;
    groupNm: string;
    displayOrder: number;
}

export interface WatchlistItem {
    id: number;
    stkCd: string;
    stkNm: string;
    stexTp?: string; // 미지정: 국내, ND/NY/NA: 미국 거래소
    curPrc: string;
    fluRt: string;
    mrktNm?: string; // 국내 시장명 (코스피/코스닥/ETF 등)
    sessionLabel?: string | null; // 미국 데이·프리·애프터마켓 (토스 연동 회원만)
    regularClose?: number | null; // 장구분 등락률 기준 정규장 종가 (USD)
}

export interface CreateGroupReq {
    groupNm: string;
}

export interface UpdateGroupReq {
    groupNm: string;
}

export interface AddItemReq {
    stkCd: string;
    stkNm: string;
    stexTp?: string; // 미지정: 국내, ND/NY/NA: 미국 거래소
}

export interface ReorderReq {
    orderedIds: number[];
}

export interface UpdateGroupMutationVars {
    id: number;
    req: UpdateGroupReq;
}

export interface ReorderItemsMutationVars {
    groupId: number;
    req: ReorderReq;
}

export interface AddItemMutationVars {
    groupId: number;
    req: AddItemReq;
}

export interface DeleteItemMutationVars {
    groupId: number;
    itemId: number;
}

export interface InterestGroup {
    id: number;
    groupNm: string;
    displayOrder: number;
}

export interface InterestItem {
    id: number;
    stkCd: string;
    stkNm: string;
    curPrc: string;
    fluRt: string;
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

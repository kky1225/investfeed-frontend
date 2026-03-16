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

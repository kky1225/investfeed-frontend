import api from "../../axios.ts";
import type {ApiResponse} from "../../type/AuthType";
import {AddItemReq, CreateGroupReq, InterestGroup, InterestItem, ReorderReq, UpdateGroupReq} from "../../type/InterestType.ts";

export const fetchInterestGroups = async (): Promise<ApiResponse<InterestGroup[]>> => {
    const res = await api.get<ApiResponse<InterestGroup[]>>("/stock/interest/groups");
    return res.data;
};

export const createInterestGroup = async (req: CreateGroupReq): Promise<ApiResponse<InterestGroup>> => {
    const res = await api.post<ApiResponse<InterestGroup>>("/stock/interest/groups", req);
    return res.data;
};

export const updateInterestGroup = async (groupId: number, req: UpdateGroupReq): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/stock/interest/groups/${groupId}`, req);
    return res.data;
};

export const deleteInterestGroup = async (groupId: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/stock/interest/groups/${groupId}`);
    return res.data;
};

export const fetchInterestItems = async (groupId: number): Promise<ApiResponse<InterestItem[]>> => {
    const res = await api.get<ApiResponse<InterestItem[]>>(`/stock/interest/groups/${groupId}/items`);
    return res.data;
};

export const addInterestItem = async (groupId: number, req: AddItemReq): Promise<ApiResponse<InterestItem>> => {
    const res = await api.post<ApiResponse<InterestItem>>(`/stock/interest/groups/${groupId}/items`, req);
    return res.data;
};

export const deleteInterestItem = async (groupId: number, itemId: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/stock/interest/groups/${groupId}/items/${itemId}`);
    return res.data;
};

export const reorderInterestGroups = async (req: ReorderReq): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>("/stock/interest/groups/reorder", req);
    return res.data;
};

export const reorderInterestItems = async (groupId: number, req: ReorderReq): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/stock/interest/groups/${groupId}/items/reorder`, req);
    return res.data;
};

export const fetchInterestItemsStream = async (groupId: number): Promise<ApiResponse<null>> => {
    const res = await api.get<ApiResponse<null>>(`/stock/interest/groups/${groupId}/items/stream`);
    return res.data;
};

import api from "../../axios.ts";
import type {ApiResponse} from "../../type/AuthType";
import {AddCryptoItemReq, CreateCryptoGroupReq, CryptoInterestGroup, CryptoInterestItem, ReorderReq, UpdateCryptoGroupReq} from "../../type/CryptoInterestType.ts";

export const fetchCryptoInterestGroups = async (): Promise<ApiResponse<CryptoInterestGroup[]>> => {
    const res = await api.get<ApiResponse<CryptoInterestGroup[]>>(`/crypto/interest/groups`);
    return res.data;
}

export const createCryptoInterestGroup = async (req: CreateCryptoGroupReq): Promise<ApiResponse<CryptoInterestGroup>> => {
    const res = await api.post<ApiResponse<CryptoInterestGroup>>(`/crypto/interest/groups`, req);
    return res.data;
}

export const updateCryptoInterestGroup = async (groupId: number, req: UpdateCryptoGroupReq): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/crypto/interest/groups/${groupId}`, req);
    return res.data;
}

export const deleteCryptoInterestGroup = async (groupId: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/crypto/interest/groups/${groupId}`);
    return res.data;
}

export const reorderCryptoInterestGroups = async (req: ReorderReq): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/crypto/interest/groups/reorder`, req);
    return res.data;
}

export const fetchCryptoInterestItems = async (groupId: number): Promise<ApiResponse<CryptoInterestItem[]>> => {
    const res = await api.get<ApiResponse<CryptoInterestItem[]>>(`/crypto/interest/groups/${groupId}/items`);
    return res.data;
}

export const addCryptoInterestItem = async (groupId: number, req: AddCryptoItemReq): Promise<ApiResponse<CryptoInterestItem>> => {
    const res = await api.post<ApiResponse<CryptoInterestItem>>(`/crypto/interest/groups/${groupId}/items`, req);
    return res.data;
}

export const deleteCryptoInterestItem = async (groupId: number, itemId: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/crypto/interest/groups/${groupId}/items/${itemId}`);
    return res.data;
}

export const reorderCryptoInterestItems = async (groupId: number, req: ReorderReq): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/crypto/interest/groups/${groupId}/items/reorder`, req);
    return res.data;
}

export const fetchCryptoInterestItemsStream = async (groupId: number): Promise<ApiResponse<null>> => {
    const res = await api.get<ApiResponse<null>>(`/crypto/interest/groups/${groupId}/items/stream`);
    return res.data;
}

import api from "../../axios.ts";
import type {ApiResponse} from "../../type/AuthType";
import {AddCryptoItemReq, CreateCryptoGroupReq, CryptoWatchlistGroup, CryptoWatchlistItem, ReorderReq, UpdateCryptoGroupReq} from "../../type/CryptoWatchlistType.ts";

export const fetchCryptoWatchlistGroups = async (): Promise<ApiResponse<CryptoWatchlistGroup[]>> => {
    const res = await api.get<ApiResponse<CryptoWatchlistGroup[]>>(`/crypto/watchlist/groups`);
    return res.data;
}

export const createCryptoWatchlistGroup = async (req: CreateCryptoGroupReq): Promise<ApiResponse<CryptoWatchlistGroup>> => {
    const res = await api.post<ApiResponse<CryptoWatchlistGroup>>(`/crypto/watchlist/groups`, req);
    return res.data;
}

export const updateCryptoWatchlistGroup = async (groupId: number, req: UpdateCryptoGroupReq): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/crypto/watchlist/groups/${groupId}`, req);
    return res.data;
}

export const deleteCryptoWatchlistGroup = async (groupId: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/crypto/watchlist/groups/${groupId}`);
    return res.data;
}

export const reorderCryptoWatchlistGroups = async (req: ReorderReq): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/crypto/watchlist/groups/reorder`, req);
    return res.data;
}

export const fetchCryptoWatchlistItems = async (groupId: number): Promise<ApiResponse<CryptoWatchlistItem[]>> => {
    const res = await api.get<ApiResponse<CryptoWatchlistItem[]>>(`/crypto/watchlist/groups/${groupId}/items`);
    return res.data;
}

export const addCryptoWatchlistItem = async (groupId: number, req: AddCryptoItemReq): Promise<ApiResponse<CryptoWatchlistItem>> => {
    const res = await api.post<ApiResponse<CryptoWatchlistItem>>(`/crypto/watchlist/groups/${groupId}/items`, req);
    return res.data;
}

export const deleteCryptoWatchlistItem = async (groupId: number, itemId: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/crypto/watchlist/groups/${groupId}/items/${itemId}`);
    return res.data;
}

export const reorderCryptoWatchlistItems = async (groupId: number, req: ReorderReq): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/crypto/watchlist/groups/${groupId}/items/reorder`, req);
    return res.data;
}

export const fetchCryptoWatchlistItemsStream = async (groupId: number): Promise<ApiResponse<null>> => {
    const res = await api.get<ApiResponse<null>>(`/crypto/watchlist/groups/${groupId}/items/stream`);
    return res.data;
}

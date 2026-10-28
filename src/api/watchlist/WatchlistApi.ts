import api from "../../axios.ts";
import type {ApiResponse} from "../../type/AuthType";
import {AddItemReq, CreateGroupReq, WatchlistGroup, WatchlistItem, ReorderReq, UpdateGroupReq} from "../../type/WatchlistType.ts";

export const fetchWatchlistGroups = async (): Promise<ApiResponse<WatchlistGroup[]>> => {
    const res = await api.get<ApiResponse<WatchlistGroup[]>>("/stock/watchlist/groups");
    return res.data;
};

export const createWatchlistGroup = async (req: CreateGroupReq): Promise<ApiResponse<WatchlistGroup>> => {
    const res = await api.post<ApiResponse<WatchlistGroup>>("/stock/watchlist/groups", req);
    return res.data;
};

export const updateWatchlistGroup = async (groupId: number, req: UpdateGroupReq): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/stock/watchlist/groups/${groupId}`, req);
    return res.data;
};

export const deleteWatchlistGroup = async (groupId: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/stock/watchlist/groups/${groupId}`);
    return res.data;
};

export const fetchWatchlistItems = async (groupId: number): Promise<ApiResponse<WatchlistItem[]>> => {
    const res = await api.get<ApiResponse<WatchlistItem[]>>(`/stock/watchlist/groups/${groupId}/items`);
    return res.data;
};

export const addWatchlistItem = async (groupId: number, req: AddItemReq): Promise<ApiResponse<WatchlistItem>> => {
    const res = await api.post<ApiResponse<WatchlistItem>>(`/stock/watchlist/groups/${groupId}/items`, req);
    return res.data;
};

export const deleteWatchlistItem = async (groupId: number, itemId: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/stock/watchlist/groups/${groupId}/items/${itemId}`);
    return res.data;
};

export const reorderWatchlistGroups = async (req: ReorderReq): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>("/stock/watchlist/groups/reorder", req);
    return res.data;
};

export const reorderWatchlistItems = async (groupId: number, req: ReorderReq): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/stock/watchlist/groups/${groupId}/items/reorder`, req);
    return res.data;
};

export const fetchWatchlistItemsStream = async (groupId: number): Promise<ApiResponse<null>> => {
    const res = await api.get<ApiResponse<null>>(`/stock/watchlist/groups/${groupId}/items/stream`);
    return res.data;
};

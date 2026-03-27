import api from "../../axios.ts";
import {AddCryptoItemReq, CreateCryptoGroupReq, ReorderReq, UpdateCryptoGroupReq} from "../../type/CryptoInterestType.ts";

export const fetchCryptoInterestGroups = async () => {
    const res = await api.get(`/crypto/interest/groups`);
    return res.data;
}

export const createCryptoInterestGroup = async (req: CreateCryptoGroupReq) => {
    const res = await api.post(`/crypto/interest/groups`, req);
    return res.data;
}

export const updateCryptoInterestGroup = async (groupId: number, req: UpdateCryptoGroupReq) => {
    const res = await api.put(`/crypto/interest/groups/${groupId}`, req);
    return res.data;
}

export const deleteCryptoInterestGroup = async (groupId: number) => {
    const res = await api.delete(`/crypto/interest/groups/${groupId}`);
    return res.data;
}

export const reorderCryptoInterestGroups = async (req: ReorderReq) => {
    const res = await api.put(`/crypto/interest/groups/reorder`, req);
    return res.data;
}

export const fetchCryptoInterestItems = async (groupId: number) => {
    const res = await api.get(`/crypto/interest/groups/${groupId}/items`);
    return res.data;
}

export const addCryptoInterestItem = async (groupId: number, req: AddCryptoItemReq) => {
    const res = await api.post(`/crypto/interest/groups/${groupId}/items`, req);
    return res.data;
}

export const deleteCryptoInterestItem = async (groupId: number, itemId: number) => {
    const res = await api.delete(`/crypto/interest/groups/${groupId}/items/${itemId}`);
    return res.data;
}

export const reorderCryptoInterestItems = async (groupId: number, req: ReorderReq) => {
    const res = await api.put(`/crypto/interest/groups/${groupId}/items/reorder`, req);
    return res.data;
}

export const fetchCryptoInterestItemsStream = async (groupId: number) => {
    const res = await api.post(`/crypto/interest/groups/${groupId}/items/stream`);
    return res.data;
}

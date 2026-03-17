import api from "../../axios.ts";
import {AddItemReq, CreateGroupReq, ReorderReq, UpdateGroupReq} from "../../type/InterestType.ts";

export const fetchInterestGroups = async () => {
    const res = await api.get("/interest/groups");
    return res.data;
};

export const createInterestGroup = async (req: CreateGroupReq) => {
    const res = await api.post("/interest/groups", req);
    return res.data;
};

export const updateInterestGroup = async (groupId: number, req: UpdateGroupReq) => {
    const res = await api.put(`/interest/groups/${groupId}`, req);
    return res.data;
};

export const deleteInterestGroup = async (groupId: number) => {
    const res = await api.delete(`/interest/groups/${groupId}`);
    return res.data;
};

export const fetchInterestItems = async (groupId: number) => {
    const res = await api.get(`/interest/groups/${groupId}/items`);
    return res.data;
};

export const addInterestItem = async (groupId: number, req: AddItemReq) => {
    const res = await api.post(`/interest/groups/${groupId}/items`, req);
    return res.data;
};

export const deleteInterestItem = async (groupId: number, itemId: number) => {
    const res = await api.delete(`/interest/groups/${groupId}/items/${itemId}`);
    return res.data;
};

export const reorderInterestGroups = async (req: ReorderReq) => {
    const res = await api.put("/interest/groups/reorder", req);
    return res.data;
};

export const reorderInterestItems = async (groupId: number, req: ReorderReq) => {
    const res = await api.put(`/interest/groups/${groupId}/items/reorder`, req);
    return res.data;
};

export const fetchInterestItemsStream = async (groupId: number) => {
    const res = await api.post(`/interest/groups/${groupId}/items/stream`);
    return res.data;
};

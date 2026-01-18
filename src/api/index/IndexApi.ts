import api from "../../axios.ts";
import {IndexDetailReq, IndexDetailSteamReq} from "../../type/IndexType.ts";

export const fetchIndexList = async () => {
    const res = await api.get(`/index/list`);
    return res.data
}

export const fetchIndexListStream = async () => {
    const res = await api.get(`/index/list/stream`);
    return res.data
}

export const fetchIndexDetail = async (req: IndexDetailReq) => {
    const res = await api.get(`/index/detail`, {params: req});
    return res.data
}

export const fetchIndexDetailStream = async (req: IndexDetailSteamReq) => {
    const res = await api.get(`/index/detail/stream`, {params: req});
    return res.data
}
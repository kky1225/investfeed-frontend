import api from "../../axios.ts";
import {indexDetailReq, indexDetailSteamReq} from "../../type/IndexType.ts";

export const fetchIndexList = async () => {
    const res = await api.get(`/index/list`);
    return res.data
}

export const fetchIndexListStream = async () => {
    const res = await api.get(`/index/list/stream`);
    return res.data
}

export const fetchIndexDetail = async (req: indexDetailReq) => {
    const res = await api.get(`/index/detail`, {params: req});
    return res.data
}

export const fetchIndexDetailStream = async (req: indexDetailSteamReq) => {
    const res = await api.get(`/index/detail/stream`, {params: req});
    return res.data
}
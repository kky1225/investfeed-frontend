import api from "../../axios.ts";
import {indexDetailReq, indexDetailSteamReq} from "../../type/IndexType.ts";

export const fetchCommodityList = async () => {
    const res = await api.get(`/commodity/list`);
    return res.data
}

export const fetchCommodityListStream = async () => {
    const res = await api.get(`/commodity/list/stream`);
    return res.data
}

export const fetchCommodityDetail = async (req: indexDetailReq) => {
    const res = await api.get(`/commodity/detail`, {params: req});
    return res.data
}

export const fetchCommodityDetailStream = async (req: indexDetailSteamReq) => {
    const res = await api.get(`/commodity/detail/stream`, {params: req});
    return res.data
}
import api from "../../axios.ts";
import {CommodityDetailReq, CommodityDetailSteamReq} from "../../type/CommodityType.ts";

export const fetchCommodityList = async () => {
    const res = await api.get(`/commodity/list`);
    return res.data
}

export const fetchCommodityListStream = async () => {
    const res = await api.get(`/commodity/list/stream`);
    return res.data
}

export const fetchCommodityDetail = async (req: CommodityDetailReq) => {
    const res = await api.get(`/commodity/detail`, {params: req});
    return res.data
}

export const fetchCommodityDetailStream = async (req: CommodityDetailSteamReq) => {
    const res = await api.get(`/commodity/detail/stream`, {params: req});
    return res.data
}
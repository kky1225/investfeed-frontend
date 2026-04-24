import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {CommodityDetailReq, CommodityDetailSteamReq} from "../../type/CommodityType.ts";

export const fetchCommodityList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/commodity/list`, config);
    return res.data
}

export const fetchCommodityListStream = async () => {
    const res = await api.get(`/commodity/list/stream`);
    return res.data
}

export const fetchCommodityDetail = async (req: CommodityDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/commodity/detail`, {...config, params: req});
    return res.data
}

export const fetchCommodityDetailStream = async (req: CommodityDetailSteamReq) => {
    const res = await api.get(`/commodity/detail/stream`, {params: req});
    return res.data
}
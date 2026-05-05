import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {CommodityDetailReq} from "../../type/CommodityType.ts";

export const fetchCommodityList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/commodities`, config);
    return res.data
}

export const fetchCommodityStream = async (items: string[]) => {
    const res = await api.post(`/commodities/stream`, {items});
    return res.data
}

export const fetchCommodityDetail = async (stkCd: string, req: CommodityDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/commodities/${stkCd}`, {...config, params: req});
    return res.data
}

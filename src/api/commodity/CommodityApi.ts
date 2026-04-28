import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {CommodityDetailReq} from "../../type/CommodityType.ts";

export const fetchCommodityList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/commodities`, config);
    return res.data
}

export const fetchCommodityListStream = async () => {
    const res = await api.get(`/commodities/stream`);
    return res.data
}

export const fetchCommodityDetail = async (stkCd: string, req: CommodityDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/commodities/${stkCd}`, {...config, params: req});
    return res.data
}

export const fetchCommodityDetailStream = async (stkCd: string) => {
    const res = await api.get(`/commodities/${stkCd}/stream`);
    return res.data
}

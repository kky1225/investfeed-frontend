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

/** 차트의 과거 구간 한 페이지. cursor 없이 부르면 가장 최근 구간, 받은 nextCursor 를 넣으면 그 이전 구간 */
export const fetchCommodityCandles = async (
    stkCd: string, req: { chartType: string, cursor?: string }, config?: AxiosRequestConfig,
) => {
    const res = await api.get(`/commodities/${stkCd}/candles`, {...config, params: req});
    return res.data
}

export const fetchCommodityDetail =async (stkCd: string, req: CommodityDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/commodities/${stkCd}`, {...config, params: req});
    return res.data
}

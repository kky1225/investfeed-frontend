import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {IndexDetailReq} from "../../type/IndexType.ts";

export const fetchIndexList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/indexes`, config);
    return res.data
}

export const fetchIndexStream = async (items: string[]) => {
    const res = await api.post(`/stock/indexes/stream`, {items});
    return res.data
}

/** 차트의 과거 구간 한 페이지. cursor 없이 부르면 가장 최근 구간, 받은 nextCursor 를 넣으면 그 이전 구간 */
export const fetchIndexCandles = async (
    indsCd: string, req: { chartType: string, cursor?: string }, config?: AxiosRequestConfig,
) => {
    const res = await api.get(`/stock/indexes/${indsCd}/candles`, {...config, params: req});
    return res.data
}

export const fetchIndexDetail =async (indsCd: string, req: IndexDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/indexes/${indsCd}`, {...config, params: req});
    return res.data
}

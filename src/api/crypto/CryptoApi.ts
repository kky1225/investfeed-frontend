import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {CryptoDetailReq} from "../../type/CryptoType.ts";

export const fetchCryptoList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/cryptos`, config);
    return res.data;
}

export const fetchCryptoStream = async (items: string[]) => {
    const res = await api.post(`/cryptos/stream`, {items});
    return res.data;
}

export const fetchCryptoDetail = async (market: string, req: CryptoDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/cryptos/${market}`, {...config, params: req});
    return res.data;
}

/** 차트의 과거 구간 한 페이지. cursor 없이 부르면 가장 최근 구간, 받은 nextCursor 를 넣으면 그 이전 구간 */
export const fetchCryptoCandles = async (
    market: string, req: { chartType: string, cursor?: string }, config?: AxiosRequestConfig,
) => {
    const res = await api.get(`/cryptos/${market}/candles`, {...config, params: req});
    return res.data;
}

export const fetchCryptoRankList =async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/cryptos/ranks`, config);
    return res.data;
}

export const fetchCryptoRankStream = async () => {
    const res = await api.get(`/cryptos/ranks/stream`);
    return res.data;
}

export const fetchCryptoSearch = async (keyword: string) => {
    const res = await api.get(`/cryptos/search`, {params: {keyword}});
    return res.data;
}

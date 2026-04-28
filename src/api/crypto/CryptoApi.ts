import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {CryptoDetailReq} from "../../type/CryptoType.ts";

export const fetchCryptoList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/cryptos`, config);
    return res.data;
}

export const fetchCryptoListStream = async () => {
    const res = await api.get(`/cryptos/stream`);
    return res.data;
}

export const fetchCryptoDetailStream = async (market: string) => {
    const res = await api.get(`/cryptos/${market}/stream`);
    return res.data;
}

export const fetchCryptoDetail = async (market: string, req: CryptoDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/cryptos/${market}`, {...config, params: req});
    return res.data;
}

export const fetchCryptoRankList = async (config?: AxiosRequestConfig) => {
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

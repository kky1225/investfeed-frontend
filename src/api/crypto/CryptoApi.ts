import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {CryptoDetailReq} from "../../type/CryptoType.ts";

export const fetchCryptoList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/crypto/list`, config);
    return res.data;
}

export const fetchCryptoListStream = async () => {
    const res = await api.get(`/crypto/list/stream`);
    return res.data;
}

export const fetchCryptoDetailStream = async (market: string) => {
    const res = await api.get(`/crypto/detail/stream`, {params: {market}});
    return res.data;
}

export const fetchCryptoDetail = async (req: CryptoDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/crypto/detail`, {...config, params: req});
    return res.data;
}

export const fetchCryptoRankList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/crypto/rank`, config);
    return res.data;
}

export const fetchCryptoRankStream = async () => {
    const res = await api.get(`/crypto/rank/stream`);
    return res.data;
}

export const fetchCryptoSearch = async (keyword: string) => {
    const res = await api.get(`/crypto/search`, {params: {keyword}});
    return res.data;
}

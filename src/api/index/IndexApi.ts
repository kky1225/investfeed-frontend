import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {IndexDetailReq} from "../../type/IndexType.ts";

export const fetchIndexList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/indexes`, config);
    return res.data
}

export const fetchIndexListStream = async () => {
    const res = await api.get(`/stock/indexes/stream`);
    return res.data
}

export const fetchIndexDetail = async (indsCd: string, req: IndexDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/indexes/${indsCd}`, {...config, params: req});
    return res.data
}

export const fetchIndexDetailStream = async (indsCd: string) => {
    const res = await api.get(`/stock/indexes/${indsCd}/stream`);
    return res.data
}

import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {UsRankListReq, UsStockStreamReq} from "../../type/UsRankType.ts";

export const fetchUsRankList = async (req: UsRankListReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/us-stock/ranks`, {...config, params: req});
    return res.data;
}

export const fetchUsRankStream = async (req: UsStockStreamReq) => {
    const res = await api.post(`/us-stock/ranks/stream`, req);
    return res.data;
}
import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {RankListReq} from "../../type/RankType.ts";
import {StockStreamReq} from "../../type/StockType.ts";

export const fetchRankList = async (req: RankListReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/ranks`, {...config, params: req});
    return res.data;
}

export const fetchRankStream = async (req: StockStreamReq) => {
    const res = await api.post(`/stock/ranks/stream`, req);
    return res.data;
}

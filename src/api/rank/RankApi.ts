import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {RankListReq} from "../../type/RankType.ts";

export const fetchRankList = async (req: RankListReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/rank/list`, {...config, params: req});
    return res.data;
}
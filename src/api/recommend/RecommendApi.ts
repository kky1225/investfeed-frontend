import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {StockStreamReq} from "../../type/StockType.ts";

export const fetchRecommendList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/recommendations`, config);
    return res.data;
}

export const fetchRecommendListStream = async (req: StockStreamReq) => {
    const res = await api.post(`/stock/recommendations/stream`, req);
    return res.data;
}

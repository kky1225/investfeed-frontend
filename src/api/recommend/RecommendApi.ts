import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {StockStreamReq} from "../../type/StockType.ts";
import type {RecommendSettingReq, RecommendSettingRes} from "../../type/RecommendType.ts";
import type {ApiResponse} from "../../type/AuthType";

export const fetchRecommendList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/recommendations`, config);
    return res.data;
}

export const fetchRecommendListStream = async (req: StockStreamReq) => {
    const res = await api.post(`/stock/recommendations/stream`, req);
    return res.data;
}

export const fetchRecommendSetting = async (config?: AxiosRequestConfig): Promise<ApiResponse<RecommendSettingRes>> => {
    const res = await api.get<ApiResponse<RecommendSettingRes>>(`/stock/recommendations/settings`, config);
    return res.data;
}

export const saveRecommendSetting = async (req: RecommendSettingReq): Promise<ApiResponse<RecommendSettingRes>> => {
    const res = await api.put<ApiResponse<RecommendSettingRes>>(`/stock/recommendations/settings`, req);
    return res.data;
}

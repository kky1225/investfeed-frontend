import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import type {ApiResponse} from "../../type/AuthType.ts";
import {MarketIndexDashboardRes} from "../../type/MarketIndexType.ts";

export const fetchMarketIndexAll = async (config?: AxiosRequestConfig): Promise<ApiResponse<MarketIndexDashboardRes>> => {
    const res = await api.get('/market-indexes', config);
    return res.data;
}

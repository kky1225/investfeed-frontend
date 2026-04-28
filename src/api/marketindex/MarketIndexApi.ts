import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {MarketIndexDashboardRes} from "../../type/MarketIndexType.ts";

export const fetchMarketIndexAll = async (config?: AxiosRequestConfig): Promise<MarketIndexDashboardRes> => {
    const res = await api.get('/market-indexes', config);
    return res.data;
}

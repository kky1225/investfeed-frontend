import api from "../../axios.ts";
import {MarketIndexDashboardRes} from "../../type/MarketIndexType.ts";

export const fetchMarketIndexAll = async (): Promise<MarketIndexDashboardRes> => {
    const res = await api.get('/market-index');
    return res.data;
}

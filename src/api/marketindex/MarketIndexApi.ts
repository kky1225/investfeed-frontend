import api from "../../axios.ts";
import {MarketIndexRes} from "../../type/MarketIndexType.ts";

export const fetchMarketIndexAll = async (): Promise<MarketIndexRes[]> => {
    const res = await api.get('/market-index');
    return res.data;
}

import api from "../../axios.ts";
import {StockStreamReq} from "../../type/StockType.ts";

export const fetchRecommendList = async () => {
    const res = await api.get(`/recommend/list`);
    return res.data;
}

export const fetchRecommendListStream = async (req: StockStreamReq) => {
    const res = await api.post(`/stock/stream`, req);
    return res.data;
}
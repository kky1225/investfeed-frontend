import api from "../../axios.ts";
import {StockListReq} from "../../type/StockType.ts";

export const fetchStockList = async (req: StockListReq) => {
    const res = await api.get(`/stock/list`, {params: req});
    return res.data;
}
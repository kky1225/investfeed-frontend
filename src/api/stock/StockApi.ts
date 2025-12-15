import api from "../../axios.ts";
import {StockDetailReq, StockListReq, StockStreamReq} from "../../type/StockType.ts";

export const fetchStockList = async (req: StockListReq) => {
    const res = await api.get(`/stock/list`, {params: req});
    return res.data;
}

export const fetchStockDetail = async (req: StockDetailReq) => {
    const res = await api.get(`/stock/detail`, {params: req});
    return res.data;
}

export const fetchStockStream = async (req: StockStreamReq) => {
    const res = await api.post(`/stock/detail/stream`, req);
    return res.data;
}
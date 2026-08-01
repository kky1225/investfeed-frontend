import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import type {UsStockDetailReq} from "../../type/UsStockType.ts";

export const fetchUsStockSearch = async (keyword: string, config?: AxiosRequestConfig) => {
    const res = await api.get(`/us-stock/stocks`, {...config, params: {keyword}});
    return res.data;
}

export const fetchUsStockDetail = async (stkCd: string, req: UsStockDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/us-stock/stocks/${stkCd}`, {...config, params: req});
    return res.data;
}

export const fetchUsStockDetailStream = async (req: { stkCd: string; stexTp: string }) => {
    const res = await api.post(`/us-stock/stocks/stream`, req);
    return res.data;
}

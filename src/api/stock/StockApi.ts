import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {StockDetailReq, StockStreamReq} from "../../type/StockType.ts";

export const fetchStockDetail = async (req: StockDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/detail`, {...config, params: req});
    return res.data;
}

export const fetchStockChart = async (req: StockDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/chart`, {...config, params: req});
    return res.data;
}

export const fetchStockStream = async (req: StockStreamReq) => {
    const res = await api.post(`/stock/stream`, req);
    return res.data;
}

export const fetchStockProgramChart = async (stkCd: string) => {
    const res = await api.get(`/stock/program-chart`, {params: {stkCd}});
    return res.data;
}

export const fetchStockSearch = async (keyword: string) => {
    const res = await api.get(`/stock/search`, {params: {keyword}});
    return res.data;
}

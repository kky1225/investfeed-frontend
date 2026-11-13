import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {StockCandleReq, StockDetailReq, StockStreamReq} from "../../type/StockType.ts";

export const fetchStockDetail = async (stkCd: string, req: StockDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/stocks/${stkCd}`, {...config, params: req});
    return res.data;
}

export const fetchStockChart = async (stkCd: string, req: StockDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/stocks/${stkCd}/chart`, {...config, params: req});
    return res.data;
}

/** 차트의 과거 구간 한 페이지. cursor 없이 부르면 가장 최근 구간, 받은 nextCursor 를 넣으면 그 이전 구간 */
export const fetchStockCandles = async (stkCd: string, req: StockCandleReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/stocks/${stkCd}/candles`, {...config, params: req});
    return res.data;
}

export const fetchStockStream =async (req: StockStreamReq) => {
    const res = await api.post(`/stocks/stream`, req);
    return res.data;
}

export const fetchStockProgramChart = async (stkCd: string) => {
    const res = await api.get(`/stocks/${stkCd}/program-chart`);
    return res.data;
}

export const fetchStockSearch = async (keyword: string) => {
    const res = await api.get(`/stocks`, {params: {keyword}});
    return res.data;
}

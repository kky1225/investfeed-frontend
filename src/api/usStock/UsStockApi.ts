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

/** 차트의 과거 구간 한 페이지. cursor 없이 부르면 가장 최근 구간, 받은 nextCursor 를 넣으면 그 이전 구간 */
export const fetchUsStockCandles = async (
    stkCd: string, req: { stexTp: string, chartType: string, cursor?: string }, config?: AxiosRequestConfig,
) => {
    const res = await api.get(`/us-stock/stocks/${stkCd}/candles`, {...config, params: req});
    return res.data;
}

export const fetchUsStockDetailStream =async (req: { stkCd: string; stexTp: string }) => {
    const res = await api.post(`/us-stock/stocks/stream`, req);
    return res.data;
}

import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {StockDetailReq} from "../../type/StockType.ts";
import {CryptoDetailReq} from "../../type/CryptoType.ts";
import {CommodityDetailReq} from "../../type/CommodityType.ts";
import type {MultiViewStreamReq} from "../../type/MultiViewType.ts";

export const fetchMultiViewStockChart = async (stkCd: string, req: StockDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/multi-view/charts/stock/${stkCd}`, {...config, params: req});
    return res.data;
}

export const fetchMultiViewCryptoDetail = async (market: string, req: CryptoDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/multi-view/charts/crypto/${market}`, {...config, params: req});
    return res.data;
}

export const fetchMultiViewCommodityDetail = async (stkCd: string, req: CommodityDetailReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/multi-view/charts/commodity/${stkCd}`, {...config, params: req});
    return res.data;
}

export const fetchMultiViewStockStream = async (req: MultiViewStreamReq) => {
    const res = await api.post(`/multi-view/stocks/stream`, req);
    return res.data;
}

export const fetchMultiViewCryptoStream = async (req: MultiViewStreamReq) => {
    const res = await api.post(`/multi-view/cryptos/stream`, req);
    return res.data;
}

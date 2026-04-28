import type {AxiosRequestConfig} from "axios";
import {ThemeListReq, ThemeStockListReq, ThemeStockListStreamReq} from "../../type/ThemeType.ts";
import api from "../../axios.ts";

export const fetchThemeList = async (req: ThemeListReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/themes`, {...config, params: req});
    return res.data;
}

export const fetchThemeStockList = async (themaGrpCd: string, req: ThemeStockListReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/themes/${themaGrpCd}/stocks`, {...config, params: req});
    return res.data;
}

export const fetchThemeStockListStream = async (req: ThemeStockListStreamReq) => {
    const res = await api.post(`/stock/themes/stocks/stream`, {params: req});
    return res.data;
}
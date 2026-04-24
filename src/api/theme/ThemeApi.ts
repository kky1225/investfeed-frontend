import type {AxiosRequestConfig} from "axios";
import {ThemeListReq, ThemeStockListReq, ThemeStockListStreamReq} from "../../type/ThemeType.ts";
import api from "../../axios.ts";

export const fetchThemeList = async (req: ThemeListReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/theme/list`, {...config, params: req});
    return res.data;
}

export const fetchThemeStockList = async (req: ThemeStockListReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/theme/stock/list`, {...config, params: req});
    return res.data;
}

export const fetchThemeStockListStream = async (req: ThemeStockListStreamReq) => {
    const res = await api.post(`/stock/theme/stock/list/stream`, {params: req});
    return res.data;
}
import {ThemeListReq, ThemeStockListReq} from "../../type/ThemeType.ts";
import api from "../../axios.ts";

export const fetchThemeList = async (req: ThemeListReq) => {
    const res = await api.get(`/theme/list`, {params: req});
    return res.data;
}

export const fetchThemeStockList = async (req: ThemeStockListReq) => {
    const res = await api.get(`/theme/stock/list`, {params: req});
    return res.data;
}
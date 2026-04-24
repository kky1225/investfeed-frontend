import type {AxiosRequestConfig} from "axios";
import {SectListReq, SectListStreamReq, SectStockListReq} from "../../type/SectType.ts";
import api from "../../axios.ts";

export const fetchSectList = async (req: SectListReq, config?: AxiosRequestConfig) => {
    const res = await api.get("/stock/sect/list", {...config, params: req});
    return res.data;
}

export const fetchSectListStream = async (req: SectListStreamReq) => {
    const res = await api.get("/stock/sect/list/stream", {params: req});
    return res.data;
}

export const fetchSectStockList = async (req: SectStockListReq, config?: AxiosRequestConfig) => {
    const res = await api.get("/stock/sect/stock/list", {...config, params: req});
    return res.data;
}
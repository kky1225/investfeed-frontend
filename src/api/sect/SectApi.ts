import type {AxiosRequestConfig} from "axios";
import {SectListReq, SectListStreamReq, SectStockListReq} from "../../type/SectType.ts";
import api from "../../axios.ts";

export const fetchSectList = async (req: SectListReq, config?: AxiosRequestConfig) => {
    const res = await api.get("/stock/sects", {...config, params: req});
    return res.data;
}

export const fetchSectListStream = async (req: SectListStreamReq) => {
    const res = await api.get("/stock/sects/stream", {params: req});
    return res.data;
}

export const fetchSectStockList = async (indsCd: string, req: SectStockListReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/sects/${indsCd}/stocks`, {...config, params: req});
    return res.data;
}
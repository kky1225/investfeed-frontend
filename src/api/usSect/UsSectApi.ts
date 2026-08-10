import type {AxiosRequestConfig} from "axios";
import {UsSectStockListReq, UsSectStockStreamReq} from "../../type/UsSectType.ts";
import api from "../../axios.ts";

export const fetchUsSectList = async (config?: AxiosRequestConfig) => {
    const res = await api.get("/us-stock/sects", {...config});
    return res.data;
}

export const fetchUsSectStockList = async (indsCd: string, req: UsSectStockListReq, config?: AxiosRequestConfig) => {
    const res = await api.get(`/us-stock/sects/${indsCd}/stocks`, {...config, params: req});
    return res.data;
}

export const fetchUsSectStockStream = async (req: UsSectStockStreamReq) => {
    const res = await api.post(`/us-stock/sects/stream`, req);
    return res.data;
}

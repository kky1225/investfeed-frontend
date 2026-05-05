import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {HoldingStreamReq} from "../../type/HoldingType.ts";

export const fetchAssetDashboard = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/asset`, config);
    return res.data;
}

export const fetchAssetStockStream = async (req: HoldingStreamReq) => {
    const res = await api.post(`/asset/stocks/stream`, req);
    return res.data;
}

export const fetchAssetCryptoStream = async (req: HoldingStreamReq) => {
    const res = await api.post(`/asset/cryptos/stream`, req);
    return res.data;
}

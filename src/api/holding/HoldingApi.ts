import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {HoldingStreamReq} from "../../type/HoldingType.ts";
import {HoldingReorderReq} from "../../type/BrokerType.ts";

export const fetchHoldingList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/holdings`, config);
    return res.data;
}

export const fetchHoldingStream = async (req: HoldingStreamReq) => {
    const res = await api.post(`/stock/holdings/stream`, req);
    return res.data;
}

export const reorderApiHoldings = async (req: HoldingReorderReq) => {
    const res = await api.patch(`/stock/holdings/manual/reorder`, req);
    return res.data;
}

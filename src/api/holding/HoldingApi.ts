import api from "../../axios.ts";
import {HoldingStreamReq} from "../../type/HoldingType.ts";
import {HoldingReorderReq} from "../../type/BrokerType.ts";

export const fetchHoldingList = async () => {
    const res = await api.get(`/stock/holding/list`);
    return res.data;
}

export const fetchHoldingStream = async (req: HoldingStreamReq) => {
    const res = await api.post(`/stock/holding/stream`, req);
    return res.data;
}

export const reorderApiHoldings = async (req: HoldingReorderReq) => {
    const res = await api.put(`/stock/holding/manual/reorder`, req);
    return res.data;
}

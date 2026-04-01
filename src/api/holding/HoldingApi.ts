import api from "../../axios.ts";
import {HoldingStreamReq} from "../../type/HoldingType.ts";

export const fetchHoldingList = async () => {
    const res = await api.get(`/stock/holding/list`);
    return res.data;
}

export const fetchHoldingStream = async (req: HoldingStreamReq) => {
    const res = await api.post(`/stock/holding/stream`, req);
    return res.data;
}

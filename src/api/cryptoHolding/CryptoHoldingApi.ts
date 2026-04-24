import api from "../../axios.ts";
import {HoldingStreamReq} from "../../type/HoldingType.ts";
import {HoldingReorderReq} from "../../type/BrokerType.ts";

export const fetchCryptoHoldingList = async () => {
    const res = await api.get(`/crypto/holding/list`);
    return res.data;
}

export const fetchCryptoHoldingStream = async (req: HoldingStreamReq) => {
    const res = await api.post(`/crypto/holding/stream`, req);
    return res.data;
}

export const reorderCryptoApiHoldings = async (req: HoldingReorderReq) => {
    const res = await api.patch(`/crypto/holding/reorder`, req);
    return res.data;
}

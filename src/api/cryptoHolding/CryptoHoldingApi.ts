import api from "../../axios.ts";
import {HoldingStreamReq} from "../../type/HoldingType.ts";
import {HoldingReorderReq} from "../../type/BrokerType.ts";

export const fetchCryptoHoldingList = async () => {
    const res = await api.get(`/crypto/holdings`);
    return res.data;
}

export const fetchCryptoHoldingStream = async (req: HoldingStreamReq) => {
    const res = await api.post(`/crypto/holdings/stream`, req);
    return res.data;
}

export const reorderCryptoApiHoldings = async (req: HoldingReorderReq) => {
    const res = await api.patch(`/crypto/holdings/reorder`, req);
    return res.data;
}

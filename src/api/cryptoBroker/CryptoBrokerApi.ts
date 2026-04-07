import api from "../../axios.ts";
import {AddMyBrokerReq, CreateManualHoldingReq, HoldingReorderReq, UpdateBalanceReq, UpdateManualHoldingReq} from "../../type/BrokerType.ts";

// 사용자용 - 거래소 목록 (추가 시 선택용)
export const fetchCryptoBrokerList = async () => {
    const res = await api.get(`/crypto/broker/list`);
    return res.data;
}

// 사용자용 - 내 거래소 관리
export const fetchMyCryptoBrokerList = async () => {
    const res = await api.get(`/crypto/broker/my/list`);
    return res.data;
}

export const addMyCryptoBroker = async (req: AddMyBrokerReq) => {
    const res = await api.post(`/crypto/broker/my/add`, req);
    return res.data;
}

export const removeMyCryptoBroker = async (memberBrokerId: number) => {
    const res = await api.delete(`/crypto/broker/my/${memberBrokerId}`);
    return res.data;
}

// 수동 보유코인
export const fetchCryptoManualHoldingList = async (memberBrokerId: number) => {
    const res = await api.get(`/crypto/holding/manual/list/${memberBrokerId}`);
    return res.data;
}

export const createCryptoManualHolding = async (req: CreateManualHoldingReq) => {
    const res = await api.post(`/crypto/holding/manual/create`, req);
    return res.data;
}

export const updateCryptoManualHolding = async (holdingId: number, req: UpdateManualHoldingReq) => {
    const res = await api.put(`/crypto/holding/manual/${holdingId}`, req);
    return res.data;
}

export const deleteCryptoManualHolding = async (holdingId: number) => {
    const res = await api.delete(`/crypto/holding/manual/${holdingId}`);
    return res.data;
}

export const updateCryptoBrokerBalance = async (memberBrokerId: number, req: UpdateBalanceReq) => {
    const res = await api.put(`/crypto/holding/manual/balance/${memberBrokerId}`, req);
    return res.data;
}

export const reorderCryptoHoldings = async (req: HoldingReorderReq) => {
    const res = await api.put(`/crypto/holding/manual/reorder`, req);
    return res.data;
}

import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {AddMyBrokerReq, CreateManualHoldingReq, HoldingReorderReq, UpdateBalanceReq, UpdateManualHoldingReq} from "../../type/BrokerType.ts";

// 사용자용 - 거래소 목록 (추가 시 선택용)
export const fetchCryptoBrokerList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/crypto/brokers`, config);
    return res.data;
}

// 사용자용 - 내 거래소 관리
export const fetchMyCryptoBrokerList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/crypto/brokers/my`, config);
    return res.data;
}

export const addMyCryptoBroker = async (req: AddMyBrokerReq) => {
    const res = await api.post(`/crypto/brokers/my`, req);
    return res.data;
}

export const removeMyCryptoBroker = async (memberBrokerId: number) => {
    const res = await api.delete(`/crypto/brokers/my/${memberBrokerId}`);
    return res.data;
}

// 수동 보유코인
export const fetchCryptoManualHoldingList = async (memberBrokerId: number, config?: AxiosRequestConfig) => {
    const res = await api.get(`/crypto/holdings/manual/${memberBrokerId}`, config);
    return res.data;
}

export const createCryptoManualHolding = async (req: CreateManualHoldingReq) => {
    const res = await api.post(`/crypto/holdings/manual`, req);
    return res.data;
}

export const updateCryptoManualHolding = async (holdingId: number, req: UpdateManualHoldingReq) => {
    const res = await api.patch(`/crypto/holdings/manual/${holdingId}`, req);
    return res.data;
}

export const deleteCryptoManualHolding = async (holdingId: number) => {
    const res = await api.delete(`/crypto/holdings/manual/${holdingId}`);
    return res.data;
}

export const updateCryptoBrokerBalance = async (memberBrokerId: number, req: UpdateBalanceReq) => {
    const res = await api.patch(`/crypto/holdings/manual/balance/${memberBrokerId}`, req);
    return res.data;
}

export const reorderCryptoHoldings = async (req: HoldingReorderReq) => {
    const res = await api.patch(`/crypto/holdings/manual/reorder`, req);
    return res.data;
}

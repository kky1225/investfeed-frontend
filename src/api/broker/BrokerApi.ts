import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import {AddMyBrokerReq, CreateBrokerReq, CreateManualHoldingReq, HoldingReorderReq, UpdateBalanceReq, UpdateManualHoldingReq} from "../../type/BrokerType.ts";

// 관리자용 - 증권사 마스터 관리 (2차 비밀번호 필요)
export const fetchAdminBrokerList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/admin/brokers`, config);
    return res.data;
}

export const createBroker = async (req: CreateBrokerReq) => {
    const res = await api.post(`/admin/brokers`, req);
    return res.data;
}

export const updateBroker = async (brokerId: number, req: CreateBrokerReq) => {
    const res = await api.put(`/admin/brokers/${brokerId}`, req);
    return res.data;
}

export const deleteBroker = async (brokerId: number) => {
    const res = await api.delete(`/admin/brokers/${brokerId}`);
    return res.data;
}

// 사용자용 - 증권사 목록 (추가 시 선택용)
export const fetchBrokerList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/brokers`, config);
    return res.data;
}

// 사용자용 - 내 증권사 관리
export const fetchMyBrokerList = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/brokers/my`, config);
    return res.data;
}

export const addMyBroker = async (req: AddMyBrokerReq) => {
    const res = await api.post(`/stock/brokers/my`, req);
    return res.data;
}

export const removeMyBroker = async (memberBrokerId: number) => {
    const res = await api.delete(`/stock/brokers/my/${memberBrokerId}`);
    return res.data;
}

// 수동 보유주식
export const fetchManualHoldingList = async (memberBrokerId: number, config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/holdings/manual/${memberBrokerId}`, config);
    return res.data;
}

export const createManualHolding = async (req: CreateManualHoldingReq) => {
    const res = await api.post(`/stock/holdings/manual`, req);
    return res.data;
}

export const updateManualHolding = async (holdingId: number, req: UpdateManualHoldingReq) => {
    const res = await api.patch(`/stock/holdings/manual/${holdingId}`, req);
    return res.data;
}

export const deleteManualHolding = async (holdingId: number) => {
    const res = await api.delete(`/stock/holdings/manual/${holdingId}`);
    return res.data;
}

export const updateBrokerBalance = async (memberBrokerId: number, req: UpdateBalanceReq) => {
    const res = await api.patch(`/stock/holdings/manual/balance/${memberBrokerId}`, req);
    return res.data;
}

export const reorderHoldings = async (req: HoldingReorderReq) => {
    const res = await api.patch(`/stock/holdings/manual/reorder`, req);
    return res.data;
}

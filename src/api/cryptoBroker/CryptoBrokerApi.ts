import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import type {ApiResponse} from "../../type/AuthType";
import {AddMyBrokerReq, Broker, CreateManualHoldingReq, HoldingReorderReq, ManualHolding, MemberBroker, UpdateBalanceReq, UpdateManualHoldingReq} from "../../type/BrokerType.ts";

// 사용자용 - 거래소 목록 (추가 시 선택용)
export const fetchCryptoBrokerList = async (config?: AxiosRequestConfig): Promise<ApiResponse<{brokers: Broker[]}>> => {
    const res = await api.get<ApiResponse<{brokers: Broker[]}>>(`/crypto/brokers`, config);
    return res.data;
}

// 사용자용 - 내 거래소 관리
export const fetchMyCryptoBrokerList = async (config?: AxiosRequestConfig): Promise<ApiResponse<{brokers: MemberBroker[]}>> => {
    const res = await api.get<ApiResponse<{brokers: MemberBroker[]}>>(`/crypto/brokers/my`, config);
    return res.data;
}

export const addMyCryptoBroker = async (req: AddMyBrokerReq): Promise<ApiResponse<MemberBroker>> => {
    const res = await api.post<ApiResponse<MemberBroker>>(`/crypto/brokers/my`, req);
    return res.data;
}

export const removeMyCryptoBroker = async (memberBrokerId: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/crypto/brokers/my/${memberBrokerId}`);
    return res.data;
}

// 수동 보유코인
export const fetchCryptoManualHoldingList = async (memberBrokerId: number, config?: AxiosRequestConfig): Promise<ApiResponse<{holdings: ManualHolding[]; balance: number} | null>> => {
    const res = await api.get<ApiResponse<{holdings: ManualHolding[]; balance: number} | null>>(`/crypto/holdings/manual/${memberBrokerId}`, config);
    return res.data;
}

export const createCryptoManualHolding = async (req: CreateManualHoldingReq): Promise<ApiResponse<ManualHolding>> => {
    const res = await api.post<ApiResponse<ManualHolding>>(`/crypto/holdings/manual`, req);
    return res.data;
}

export const updateCryptoManualHolding = async (holdingId: number, req: UpdateManualHoldingReq): Promise<ApiResponse<ManualHolding>> => {
    const res = await api.patch<ApiResponse<ManualHolding>>(`/crypto/holdings/manual/${holdingId}`, req);
    return res.data;
}

export const deleteCryptoManualHolding = async (holdingId: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/crypto/holdings/manual/${holdingId}`);
    return res.data;
}

export const updateCryptoBrokerBalance = async (memberBrokerId: number, req: UpdateBalanceReq): Promise<ApiResponse<number>> => {
    const res = await api.patch<ApiResponse<number>>(`/crypto/holdings/manual/balance/${memberBrokerId}`, req);
    return res.data;
}

export const reorderCryptoHoldings = async (req: HoldingReorderReq): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/crypto/holdings/manual/reorder`, req);
    return res.data;
}

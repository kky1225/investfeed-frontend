import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import type {ApiResponse} from "../../type/AuthType";
import {AddMyBrokerReq, Broker, CreateBrokerReq, CreateManualHoldingReq, HoldingReorderReq, ManualHolding, MemberBroker, UpdateBalanceReq, UpdateManualHoldingReq} from "../../type/BrokerType.ts";

// 관리자용 - 증권사 마스터 관리 (2차 비밀번호 필요)
export const fetchAdminBrokerList = async (config?: AxiosRequestConfig): Promise<ApiResponse<{brokers: Broker[]}>> => {
    const res = await api.get<ApiResponse<{brokers: Broker[]}>>(`/admin/brokers`, config);
    return res.data;
}

export const createBroker = async (req: CreateBrokerReq): Promise<ApiResponse<Broker>> => {
    const res = await api.post<ApiResponse<Broker>>(`/admin/brokers`, req);
    return res.data;
}

export const updateBroker = async (brokerId: number, req: CreateBrokerReq): Promise<ApiResponse<Broker>> => {
    const res = await api.put<ApiResponse<Broker>>(`/admin/brokers/${brokerId}`, req);
    return res.data;
}

export const deleteBroker = async (brokerId: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/admin/brokers/${brokerId}`);
    return res.data;
}

// 사용자용 - 증권사 목록 (추가 시 선택용)
export const fetchBrokerList = async (config?: AxiosRequestConfig): Promise<ApiResponse<{brokers: Broker[]}>> => {
    const res = await api.get<ApiResponse<{brokers: Broker[]}>>(`/stock/brokers`, config);
    return res.data;
}

// 사용자용 - 내 증권사 관리
export const fetchMyBrokerList = async (config?: AxiosRequestConfig): Promise<ApiResponse<{brokers: MemberBroker[]}>> => {
    const res = await api.get<ApiResponse<{brokers: MemberBroker[]}>>(`/stock/brokers/my`, config);
    return res.data;
}

export const addMyBroker = async (req: AddMyBrokerReq): Promise<ApiResponse<MemberBroker>> => {
    const res = await api.post<ApiResponse<MemberBroker>>(`/stock/brokers/my`, req);
    return res.data;
}

export const removeMyBroker = async (memberBrokerId: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/stock/brokers/my/${memberBrokerId}`);
    return res.data;
}

// 수동 보유주식
export const fetchManualHoldingList = async (memberBrokerId: number, config?: AxiosRequestConfig): Promise<ApiResponse<{holdings: ManualHolding[]; balance: number} | null>> => {
    const res = await api.get<ApiResponse<{holdings: ManualHolding[]; balance: number} | null>>(`/stock/holdings/manual/${memberBrokerId}`, config);
    return res.data;
}

export const createManualHolding = async (req: CreateManualHoldingReq): Promise<ApiResponse<ManualHolding>> => {
    const res = await api.post<ApiResponse<ManualHolding>>(`/stock/holdings/manual`, req);
    return res.data;
}

export const updateManualHolding = async (holdingId: number, req: UpdateManualHoldingReq): Promise<ApiResponse<ManualHolding>> => {
    const res = await api.patch<ApiResponse<ManualHolding>>(`/stock/holdings/manual/${holdingId}`, req);
    return res.data;
}

export const deleteManualHolding = async (holdingId: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/stock/holdings/manual/${holdingId}`);
    return res.data;
}

export const updateBrokerBalance = async (memberBrokerId: number, req: UpdateBalanceReq): Promise<ApiResponse<number>> => {
    const res = await api.patch<ApiResponse<number>>(`/stock/holdings/manual/balance/${memberBrokerId}`, req);
    return res.data;
}

export const reorderHoldings = async (req: HoldingReorderReq): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/stock/holdings/manual/reorder`, req);
    return res.data;
}

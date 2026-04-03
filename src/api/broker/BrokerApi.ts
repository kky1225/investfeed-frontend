import api from "../../axios.ts";
import {AddMyBrokerReq, CreateBrokerReq, CreateManualHoldingReq, HoldingReorderReq, UpdateManualHoldingReq} from "../../type/BrokerType.ts";

// 관리자용 - 증권사 마스터 관리 (2차 비밀번호 필요)
export const fetchAdminBrokerList = async () => {
    const res = await api.get(`/admin/broker/list`);
    return res.data;
}

export const createBroker = async (req: CreateBrokerReq) => {
    const res = await api.post(`/admin/broker/create`, req);
    return res.data;
}

export const updateBroker = async (brokerId: number, req: CreateBrokerReq) => {
    const res = await api.put(`/admin/broker/${brokerId}`, req);
    return res.data;
}

export const deleteBroker = async (brokerId: number) => {
    const res = await api.delete(`/admin/broker/${brokerId}`);
    return res.data;
}

// 사용자용 - 증권사 목록 (추가 시 선택용)
export const fetchBrokerList = async () => {
    const res = await api.get(`/stock/broker/list`);
    return res.data;
}

// 사용자용 - 내 증권사 관리
export const fetchMyBrokerList = async () => {
    const res = await api.get(`/stock/broker/my/list`);
    return res.data;
}

export const addMyBroker = async (req: AddMyBrokerReq) => {
    const res = await api.post(`/stock/broker/my/add`, req);
    return res.data;
}

export const removeMyBroker = async (memberBrokerId: number) => {
    const res = await api.delete(`/stock/broker/my/${memberBrokerId}`);
    return res.data;
}

// 수동 보유주식
export const fetchManualHoldingList = async (memberBrokerId: number) => {
    const res = await api.get(`/stock/holding/manual/list/${memberBrokerId}`);
    return res.data;
}

export const createManualHolding = async (req: CreateManualHoldingReq) => {
    const res = await api.post(`/stock/holding/manual/create`, req);
    return res.data;
}

export const updateManualHolding = async (holdingId: number, req: UpdateManualHoldingReq) => {
    const res = await api.put(`/stock/holding/manual/${holdingId}`, req);
    return res.data;
}

export const deleteManualHolding = async (holdingId: number) => {
    const res = await api.delete(`/stock/holding/manual/${holdingId}`);
    return res.data;
}

export const reorderHoldings = async (req: HoldingReorderReq) => {
    const res = await api.put(`/stock/holding/manual/reorder`, req);
    return res.data;
}

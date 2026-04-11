import api from '../../axios.ts';
import {
    ManualRealizedPnlCreateReq,
    ManualRealizedPnlUpdateReq,
    RealizedPnlSyncReq
} from '../../type/RealizedPnlType.ts';

// 주식 실현손익
export const fetchStockRealizedPnlList = async (year?: number, month?: number) => {
    const res = await api.post('/stock/realizedpnl/list', {year, month});
    return res.data;
};

export const syncStockRealizedPnl = async (req: RealizedPnlSyncReq) => {
    const res = await api.post('/stock/realizedpnl/sync', req);
    return res.data;
};

export const createStockManualPnl = async (req: ManualRealizedPnlCreateReq) => {
    const res = await api.post('/stock/realizedpnl/manual/create', req);
    return res.data;
};

export const updateStockManualPnl = async (id: number, req: ManualRealizedPnlUpdateReq) => {
    const res = await api.put(`/stock/realizedpnl/manual/${id}`, req);
    return res.data;
};

export const deleteStockManualPnl = async (id: number) => {
    const res = await api.delete(`/stock/realizedpnl/manual/${id}`);
    return res.data;
};

// 코인 실현손익
export const fetchCryptoRealizedPnlList = async (year?: number, month?: number) => {
    const res = await api.post('/crypto/realizedpnl/list', {year, month});
    return res.data;
};

export const createCryptoManualPnl = async (req: ManualRealizedPnlCreateReq) => {
    const res = await api.post('/crypto/realizedpnl/manual/create', req);
    return res.data;
};

export const updateCryptoManualPnl = async (id: number, req: ManualRealizedPnlUpdateReq) => {
    const res = await api.put(`/crypto/realizedpnl/manual/${id}`, req);
    return res.data;
};

export const deleteCryptoManualPnl = async (id: number) => {
    const res = await api.delete(`/crypto/realizedpnl/manual/${id}`);
    return res.data;
};


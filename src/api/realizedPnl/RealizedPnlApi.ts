import type {AxiosRequestConfig} from 'axios';
import api from '../../axios.ts';
import {
    ManualRealizedPnlCreateReq,
    ManualRealizedPnlUpdateReq,
    RealizedPnlSyncReq
} from '../../type/RealizedPnlType.ts';

// 주식 실현손익
export const fetchStockRealizedPnlList = async (year?: number, month?: number, config?: AxiosRequestConfig) => {
    const res = await api.get('/stock/realized-pnl', {...config, params: {year, month}});
    return res.data;
};

export const syncStockRealizedPnl = async (req: RealizedPnlSyncReq, config?: AxiosRequestConfig) => {
    const res = await api.post('/stock/realized-pnl/sync', req, config);
    return res.data;
};

export const createStockManualPnl = async (req: ManualRealizedPnlCreateReq) => {
    const res = await api.post('/stock/realized-pnl/manual', req);
    return res.data;
};

export const updateStockManualPnl = async (id: number, req: ManualRealizedPnlUpdateReq) => {
    const res = await api.patch(`/stock/realized-pnl/manual/${id}`, req);
    return res.data;
};

export const deleteStockManualPnl = async (id: number) => {
    const res = await api.delete(`/stock/realized-pnl/manual/${id}`);
    return res.data;
};

// 코인 실현손익
export const fetchCryptoRealizedPnlList = async (year?: number, month?: number, config?: AxiosRequestConfig) => {
    const res = await api.get('/crypto/realized-pnl', {...config, params: {year, month}});
    return res.data;
};

export const createCryptoManualPnl = async (req: ManualRealizedPnlCreateReq) => {
    const res = await api.post('/crypto/realized-pnl/manual', req);
    return res.data;
};

export const updateCryptoManualPnl = async (id: number, req: ManualRealizedPnlUpdateReq) => {
    const res = await api.patch(`/crypto/realized-pnl/manual/${id}`, req);
    return res.data;
};

export const deleteCryptoManualPnl = async (id: number) => {
    const res = await api.delete(`/crypto/realized-pnl/manual/${id}`);
    return res.data;
};


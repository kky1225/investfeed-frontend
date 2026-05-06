import type {AxiosRequestConfig} from 'axios';
import api from '../../axios.ts';
import type {ApiResponse} from '../../type/AuthType';
import {
    ManualRealizedPnlCreateReq,
    ManualRealizedPnlUpdateReq,
    RealizedPnlItem,
    RealizedPnlSyncReq
} from '../../type/RealizedPnlType.ts';

export type RealizedPnlListRes = {items: RealizedPnlItem[]};

// 주식 실현손익
export const fetchStockRealizedPnlList = async (year?: number, month?: number, config?: AxiosRequestConfig): Promise<ApiResponse<RealizedPnlListRes>> => {
    const res = await api.get<ApiResponse<RealizedPnlListRes>>('/stock/realized-pnl', {...config, params: {year, month}});
    return res.data;
};

export const syncStockRealizedPnl = async (req: RealizedPnlSyncReq, config?: AxiosRequestConfig): Promise<ApiResponse<RealizedPnlListRes>> => {
    const res = await api.post<ApiResponse<RealizedPnlListRes>>('/stock/realized-pnl/sync', req, config);
    return res.data;
};

export const createStockManualPnl = async (req: ManualRealizedPnlCreateReq): Promise<ApiResponse<RealizedPnlItem>> => {
    const res = await api.post<ApiResponse<RealizedPnlItem>>('/stock/realized-pnl/manual', req);
    return res.data;
};

export const updateStockManualPnl = async (id: number, req: ManualRealizedPnlUpdateReq): Promise<ApiResponse<RealizedPnlItem>> => {
    const res = await api.patch<ApiResponse<RealizedPnlItem>>(`/stock/realized-pnl/manual/${id}`, req);
    return res.data;
};

export const deleteStockManualPnl = async (id: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/stock/realized-pnl/manual/${id}`);
    return res.data;
};

// 코인 실현손익
export const fetchCryptoRealizedPnlList = async (year?: number, month?: number, config?: AxiosRequestConfig): Promise<ApiResponse<RealizedPnlListRes>> => {
    const res = await api.get<ApiResponse<RealizedPnlListRes>>('/crypto/realized-pnl', {...config, params: {year, month}});
    return res.data;
};

export const createCryptoManualPnl = async (req: ManualRealizedPnlCreateReq): Promise<ApiResponse<RealizedPnlItem>> => {
    const res = await api.post<ApiResponse<RealizedPnlItem>>('/crypto/realized-pnl/manual', req);
    return res.data;
};

export const updateCryptoManualPnl = async (id: number, req: ManualRealizedPnlUpdateReq): Promise<ApiResponse<RealizedPnlItem>> => {
    const res = await api.patch<ApiResponse<RealizedPnlItem>>(`/crypto/realized-pnl/manual/${id}`, req);
    return res.data;
};

export const deleteCryptoManualPnl = async (id: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/crypto/realized-pnl/manual/${id}`);
    return res.data;
};

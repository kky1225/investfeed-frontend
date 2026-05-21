import type {AxiosRequestConfig} from 'axios';
import api from '../../axios';
import type {ApiResponse} from '../../type/AuthType';
import type {
    AdminHoldingGradeRes,
    AdminPaperAccountRes,
    AdminPaperRealizedPnlRes,
    AdminPaperTradeHistoryRes,
    PaperTradeReportRes,
} from '../../type/PaperTradeManagementType';

export const fetchPaperAccount = async (
    config?: AxiosRequestConfig,
): Promise<ApiResponse<AdminPaperAccountRes>> => {
    const res = await api.get<ApiResponse<AdminPaperAccountRes>>('/admin/paper-trade/account', config);
    return res.data;
};

export const fetchPaperRealizedPnl = async (
    viewMode: 'monthly' | 'yearly' | 'all',
    year?: number,
    month?: number,
): Promise<ApiResponse<AdminPaperRealizedPnlRes>> => {
    const params: Record<string, string | number> = {viewMode};
    if (year != null) params.year = year;
    if (month != null) params.month = month;
    const res = await api.get<ApiResponse<AdminPaperRealizedPnlRes>>('/admin/paper-trade/realized-pnl', {params});
    return res.data;
};

export const fetchPaperTradeHistory = async (
    ordDt?: string,
): Promise<ApiResponse<AdminPaperTradeHistoryRes>> => {
    const res = await api.get<ApiResponse<AdminPaperTradeHistoryRes>>('/admin/paper-trade/trade-history', {
        params: ordDt ? {ordDt} : undefined,
    });
    return res.data;
};

export const fetchPaperReport = async (
    config?: AxiosRequestConfig,
): Promise<ApiResponse<PaperTradeReportRes>> => {
    const res = await api.get<ApiResponse<PaperTradeReportRes>>('/admin/paper-trade/report', config);
    return res.data;
};

export const fetchPaperHoldingGrade = async (
    evalDate?: string,
): Promise<ApiResponse<AdminHoldingGradeRes>> => {
    const res = await api.get<ApiResponse<AdminHoldingGradeRes>>('/admin/paper-trade/holding-grade', {
        params: evalDate ? {evalDate} : undefined,
    });
    return res.data;
};

import type {AxiosRequestConfig} from 'axios';
import api from '../../axios.ts';
import type {
    BulkRefreshReq, BulkRefreshStatus, CalendarEventsReq, IndicatorHistoryReq, ManualCalendarEventReq, MarketSession, MarketSessionReq,
} from '../../type/EconomicCalendarType.ts';
import type {ApiResponse} from '../../type/AuthType.ts';

export const fetchEconomicIndicators = async (config?: AxiosRequestConfig) => {
    const res = await api.get('/calendar/indicators', config);
    return res.data;
};

export const fetchIndicatorHistory = async (req: IndicatorHistoryReq, config?: AxiosRequestConfig) => {
    const res = await api.get('/calendar/history', {...config, params: req});
    return res.data;
};

export const fetchCalendarEvents = async (req: CalendarEventsReq, config?: AxiosRequestConfig) => {
    const res = await api.get('/calendar/events', {...config, params: req});
    return res.data;
};

export const fetchManualCalendarEvents = async (req: CalendarEventsReq, config?: AxiosRequestConfig) => {
    const res = await api.get('/admin/calendar/events', {...config, params: req});
    return res.data;
};

export const createCalendarEvent = async (req: ManualCalendarEventReq) => {
    const res = await api.post('/admin/calendar/events', req);
    return res.data;
};

export const updateCalendarEvent = async (id: number, req: ManualCalendarEventReq) => {
    const res = await api.put(`/admin/calendar/events/${id}`, req);
    return res.data;
};

export const deleteCalendarEvent = async (id: number) => {
    const res = await api.delete(`/admin/calendar/events/${id}`);
    return res.data;
};

export const fetchMarketSessions = async (year: number, config?: AxiosRequestConfig): Promise<ApiResponse<MarketSession[]>> => {
    const res = await api.get<ApiResponse<MarketSession[]>>('/admin/calendar/sessions', {...config, params: {year}});
    return res.data;
};

export const createMarketSession = async (req: MarketSessionReq): Promise<ApiResponse<MarketSession>> => {
    const res = await api.post<ApiResponse<MarketSession>>('/admin/calendar/sessions', req);
    return res.data;
};

export const updateMarketSession = async (id: number, req: MarketSessionReq): Promise<ApiResponse<MarketSession>> => {
    const res = await api.put<ApiResponse<MarketSession>>(`/admin/calendar/sessions/${id}`, req);
    return res.data;
};

export const deleteMarketSession = async (id: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/admin/calendar/sessions/${id}`);
    return res.data;
};

export const startBulkRefresh =async (req: BulkRefreshReq): Promise<ApiResponse<BulkRefreshStatus>> => {
    const res = await api.post<ApiResponse<BulkRefreshStatus>>('/admin/calendar/bulk-refresh', req);
    return res.data;
};

export const fetchBulkRefreshStatus = async (config?: AxiosRequestConfig): Promise<ApiResponse<BulkRefreshStatus>> => {
    const res = await api.get<ApiResponse<BulkRefreshStatus>>('/admin/calendar/bulk-refresh/status', config);
    return res.data;
};

import type {AxiosRequestConfig} from 'axios';
import api from '../../axios.ts';
import type {BulkRefreshReq, BulkRefreshStatus, CalendarEventsReq, IndicatorHistoryReq, ManualCalendarEventReq} from '../../type/EconomicCalendarType.ts';
import type {ApiResponse} from '../../type/AuthType.ts';

export const fetchEconomicIndicators = async () => {
    const res = await api.get('/calendar/indicators');
    return res.data;
};

export const fetchIndicatorHistory = async (req: IndicatorHistoryReq) => {
    const res = await api.get('/calendar/history', {params: req});
    return res.data;
};

export const fetchCalendarEvents = async (req: CalendarEventsReq) => {
    const res = await api.get('/calendar/events', {params: req});
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

export const startBulkRefresh = async (req: BulkRefreshReq): Promise<ApiResponse<BulkRefreshStatus>> => {
    const res = await api.post<ApiResponse<BulkRefreshStatus>>('/admin/calendar/bulk-refresh', req);
    return res.data;
};

export const fetchBulkRefreshStatus = async (config?: AxiosRequestConfig): Promise<ApiResponse<BulkRefreshStatus>> => {
    const res = await api.get<ApiResponse<BulkRefreshStatus>>('/admin/calendar/bulk-refresh/status', config);
    return res.data;
};

import api from '../../axios.ts';
import type {CalendarEventsReq, IndicatorHistoryReq, ManualCalendarEventReq} from '../../type/EconomicCalendarType.ts';

export const fetchEconomicIndicators = async () => {
    const res = await api.post('/calendar/indicators');
    return res.data;
};

export const fetchIndicatorHistory = async (req: IndicatorHistoryReq) => {
    const res = await api.post('/calendar/history', req);
    return res.data;
};

export const fetchCalendarEvents = async (req: CalendarEventsReq) => {
    const res = await api.post('/calendar/events', req);
    return res.data;
};

export const fetchManualCalendarEvents = async (req: CalendarEventsReq) => {
    const res = await api.post('/calendar/events/list', req);
    return res.data;
};

export const createCalendarEvent = async (req: ManualCalendarEventReq) => {
    const res = await api.post('/calendar/events/create', req);
    return res.data;
};

export const updateCalendarEvent = async (id: number, req: ManualCalendarEventReq) => {
    const res = await api.put(`/calendar/events/${id}`, req);
    return res.data;
};

export const deleteCalendarEvent = async (id: number) => {
    const res = await api.delete(`/calendar/events/${id}`);
    return res.data;
};

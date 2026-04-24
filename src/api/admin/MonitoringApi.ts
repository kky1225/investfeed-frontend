import type {AxiosRequestConfig} from 'axios';
import api from '../../axios';
import type { ApiResponse } from '../../type/AuthType';
import type {
    SchedulerStatusRes,
    SchedulerLogRes,
    SchedulerConfigLogRes,
    UpdateSchedulerTimeoutReq,
    AcknowledgeLogReq,
    LogAckHistoryRes,
    PageRes,
    RedisCacheRes,
    ErrorLogRes,
    SystemStatusRes,
    TriggerSchedulerRes,
    RedisInvalidateRes,
    SchedulerLogsReq,
    SchedulerConfigLogsReq,
    ErrorLogsReq,
} from '../../type/MonitoringType';

export const fetchSchedulerStatus = async (config?: AxiosRequestConfig): Promise<ApiResponse<SchedulerStatusRes[]>> => {
    const res = await api.get<ApiResponse<SchedulerStatusRes[]>>('/admin/monitoring/scheduler-status', config);
    return res.data;
};

export const fetchSchedulerLogs = async (req: SchedulerLogsReq, config?: AxiosRequestConfig): Promise<ApiResponse<PageRes<SchedulerLogRes>>> => {
    const res = await api.post<ApiResponse<PageRes<SchedulerLogRes>>>('/admin/monitoring/scheduler-logs', req, config);
    return res.data;
};

export const fetchRedis = async (config?: AxiosRequestConfig): Promise<ApiResponse<RedisCacheRes>> => {
    const res = await api.get<ApiResponse<RedisCacheRes>>('/admin/monitoring/redis', config);
    return res.data;
};

export const invalidateRedisPrefix = async (prefix: string): Promise<ApiResponse<RedisInvalidateRes>> => {
    const res = await api.delete<ApiResponse<RedisInvalidateRes>>('/admin/monitoring/redis/cache', { params: { prefix } });
    return res.data;
};

export const fetchErrorLogs = async (req: ErrorLogsReq, config?: AxiosRequestConfig): Promise<ApiResponse<PageRes<ErrorLogRes>>> => {
    const res = await api.post<ApiResponse<PageRes<ErrorLogRes>>>('/admin/monitoring/error-logs', req, config);
    return res.data;
};

export const acknowledgeErrorLog = async (
    id: number,
    req: AcknowledgeLogReq,
): Promise<ApiResponse<ErrorLogRes>> => {
    const res = await api.patch<ApiResponse<ErrorLogRes>>(`/admin/monitoring/error-logs/${id}/acknowledge`, req);
    return res.data;
};

export const fetchSystemStatus = async (config?: AxiosRequestConfig): Promise<ApiResponse<SystemStatusRes>> => {
    const res = await api.get<ApiResponse<SystemStatusRes>>('/admin/monitoring/system-status', config);
    return res.data;
};

export const updateSchedulerTimeout = async (
    name: string,
    req: UpdateSchedulerTimeoutReq,
): Promise<ApiResponse<SchedulerStatusRes>> => {
    const res = await api.patch<ApiResponse<SchedulerStatusRes>>(`/admin/monitoring/scheduler-status/${encodeURIComponent(name)}`, req);
    return res.data;
};

export const triggerScheduler = async (name: string): Promise<ApiResponse<TriggerSchedulerRes>> => {
    const res = await api.post<ApiResponse<TriggerSchedulerRes>>(`/admin/monitoring/scheduler-status/${encodeURIComponent(name)}/trigger`);
    return res.data;
};

export const acknowledgeSchedulerLog = async (
    id: number,
    req: AcknowledgeLogReq,
): Promise<ApiResponse<SchedulerLogRes>> => {
    const res = await api.patch<ApiResponse<SchedulerLogRes>>(`/admin/monitoring/scheduler-logs/${id}/acknowledge`, req);
    return res.data;
};

export const cancelAcknowledgeSchedulerLog = async (id: number): Promise<ApiResponse<SchedulerLogRes>> => {
    const res = await api.delete<ApiResponse<SchedulerLogRes>>(`/admin/monitoring/scheduler-logs/${id}/acknowledge`);
    return res.data;
};

export const fetchSchedulerLogAckHistory = async (id: number): Promise<ApiResponse<LogAckHistoryRes[]>> => {
    const res = await api.get<ApiResponse<LogAckHistoryRes[]>>(`/admin/monitoring/scheduler-logs/${id}/ack-history`);
    return res.data;
};

export const cancelAcknowledgeErrorLog = async (id: number): Promise<ApiResponse<ErrorLogRes>> => {
    const res = await api.delete<ApiResponse<ErrorLogRes>>(`/admin/monitoring/error-logs/${id}/acknowledge`);
    return res.data;
};

export const fetchErrorLogAckHistory = async (id: number): Promise<ApiResponse<LogAckHistoryRes[]>> => {
    const res = await api.get<ApiResponse<LogAckHistoryRes[]>>(`/admin/monitoring/error-logs/${id}/ack-history`);
    return res.data;
};

export const fetchSchedulerConfigLogs = async (req: SchedulerConfigLogsReq, config?: AxiosRequestConfig): Promise<ApiResponse<PageRes<SchedulerConfigLogRes>>> => {
    const res = await api.post<ApiResponse<PageRes<SchedulerConfigLogRes>>>('/admin/monitoring/scheduler-config-logs', req, config);
    return res.data;
};

import type {AxiosRequestConfig} from 'axios';
import api from '../../axios';
import type { ApiResponse } from '../../type/AuthType';
import type {
    SchedulerStatusRes,
    SchedulerLogRes,
    ErrorLogRes,
    UpdateSchedulerTimeoutReq,
    AcknowledgeLogReq,
    BulkAcknowledgeReq,
    BulkAcknowledgeRes,
    LogAckHistoryRes,
    TriggerSchedulerRes,
    RedisInvalidateRes,
    SchedulerLogsReq,
    SchedulerConfigLogsReq,
    ErrorLogsReq,
    SchedulerOverviewRes,
    ConfigLogsOverviewRes,
    RedisOverviewRes,
    ErrorLogsOverviewRes,
    ApiCallsOverviewRes,
    SystemOverviewRes,
} from '../../type/MonitoringType';

export const fetchSchedulerOverview = async (req: SchedulerLogsReq, config?: AxiosRequestConfig): Promise<ApiResponse<SchedulerOverviewRes>> => {
    const res = await api.get<ApiResponse<SchedulerOverviewRes>>('/admin/monitoring/scheduler', {...config, params: req});
    return res.data;
};

export const fetchConfigLogsOverview = async (req: SchedulerConfigLogsReq, config?: AxiosRequestConfig): Promise<ApiResponse<ConfigLogsOverviewRes>> => {
    const res = await api.get<ApiResponse<ConfigLogsOverviewRes>>('/admin/monitoring/config-logs', {...config, params: req});
    return res.data;
};

export const fetchRedisOverview = async (config?: AxiosRequestConfig): Promise<ApiResponse<RedisOverviewRes>> => {
    const res = await api.get<ApiResponse<RedisOverviewRes>>('/admin/monitoring/redis', config);
    return res.data;
};

export const fetchErrorLogsOverview = async (req: ErrorLogsReq, config?: AxiosRequestConfig): Promise<ApiResponse<ErrorLogsOverviewRes>> => {
    const res = await api.get<ApiResponse<ErrorLogsOverviewRes>>('/admin/monitoring/errors', {...config, params: req});
    return res.data;
};

export const fetchApiCallsOverview = async (config?: AxiosRequestConfig): Promise<ApiResponse<ApiCallsOverviewRes>> => {
    const res = await api.get<ApiResponse<ApiCallsOverviewRes>>('/admin/monitoring/api-calls', config);
    return res.data;
};

export const fetchSystemOverview = async (config?: AxiosRequestConfig): Promise<ApiResponse<SystemOverviewRes>> => {
    const res = await api.get<ApiResponse<SystemOverviewRes>>('/admin/monitoring/system', config);
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

export const bulkAcknowledgeSchedulerLogs = async (req: BulkAcknowledgeReq): Promise<ApiResponse<BulkAcknowledgeRes>> => {
    const res = await api.post<ApiResponse<BulkAcknowledgeRes>>('/admin/monitoring/scheduler-logs/acknowledge-bulk', req);
    return res.data;
};

export const acknowledgeErrorLog = async (
    id: number,
    req: AcknowledgeLogReq,
): Promise<ApiResponse<ErrorLogRes>> => {
    const res = await api.patch<ApiResponse<ErrorLogRes>>(`/admin/monitoring/error-logs/${id}/acknowledge`, req);
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

export const bulkAcknowledgeErrorLogs = async (req: BulkAcknowledgeReq): Promise<ApiResponse<BulkAcknowledgeRes>> => {
    const res = await api.post<ApiResponse<BulkAcknowledgeRes>>('/admin/monitoring/error-logs/acknowledge-bulk', req);
    return res.data;
};

export const invalidateRedisPrefix = async (prefix: string): Promise<ApiResponse<RedisInvalidateRes>> => {
    const res = await api.delete<ApiResponse<RedisInvalidateRes>>('/admin/monitoring/redis/cache', { params: { prefix } });
    return res.data;
};

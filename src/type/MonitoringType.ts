export type SchedulerState = 'SUCCESS' | 'WARNING' | 'FAILED' | 'STUCK' | 'PENDING';

export interface SchedulerCatalogRes {
    schedulerName: string;
    schedulerType: 'FAST' | 'SLOW';
    defaultTimeoutSec: number;
    label: string;
}

export interface SchedulerStatusRes {
    schedulerName: string;
    schedulerType: 'FAST' | 'SLOW';
    timeoutSec: number;
    state: SchedulerState;
    lastStartedAt: string | null;
    lastFinishedAt: string | null;
    lastSuccessAt: string | null;
    lastSuccessDurationMs: number | null;
    lastFailureAt: string | null;
    lastFailureMessage: string | null;
    updatedAt: string;
}

export interface SchedulerLogRes {
    id: number;
    schedulerName: string;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    status: 'SUCCESS' | 'FAILED' | 'INTERRUPTED';
    errorMessage: string | null;
    acknowledged: boolean;
    acknowledgedBy: number | null;
    acknowledgedByName: string | null;
    acknowledgedAt: string | null;
    acknowledgeNote: string | null;
}

export interface AcknowledgeLogReq {
    note?: string | null;
}

export interface BulkAcknowledgeReq {
    note?: string | null;
    ids?: number[] | null;
}

export interface BulkAcknowledgeRes {
    processedCount: number;
    appliedNote: string;
}

export interface UnacknowledgedCountRes {
    schedulerLogs: number;
    errorLogs: number;
}

export interface DailyCallCount {
    date: string;     // "YYYY-MM-DD"
    count: number;
}

export interface ApiCallStatsItemRes {
    provider: string;
    label: string;
    todayCount: number;
    dailyLimit: number | null;
    usageRatio: number | null;
    recent7Days: DailyCallCount[];
}

export interface ApiCallStatsRes {
    items: ApiCallStatsItemRes[];
}

export interface SchedulerOverviewRes {
    catalog: SchedulerCatalogRes[];
    statuses: SchedulerStatusRes[];
    logs: PageRes<SchedulerLogRes>;
    unackCount: UnacknowledgedCountRes;
}

export interface ConfigLogsOverviewRes {
    logs: PageRes<SchedulerConfigLogRes>;
    unackCount: UnacknowledgedCountRes;
}

export interface RedisOverviewRes {
    redis: RedisCacheRes;
    unackCount: UnacknowledgedCountRes;
}

export interface ErrorLogsOverviewRes {
    logs: PageRes<ErrorLogRes>;
    unackCount: UnacknowledgedCountRes;
}

export interface ApiCallsOverviewRes {
    stats: ApiCallStatsRes;
    unackCount: UnacknowledgedCountRes;
}

export interface SystemOverviewRes {
    system: SystemStatusRes;
    unackCount: UnacknowledgedCountRes;
}

export interface LogAckHistoryRes {
    id: number;
    action: 'ACKNOWLEDGE' | 'EDIT_NOTE' | 'CANCEL' | 'BULK_ACKNOWLEDGE';
    oldNote: string | null;
    newNote: string | null;
    actedBy: number;
    actedByName: string | null;
    actedAt: string;
}

export interface SchedulerConfigLogRes {
    id: number;
    schedulerName: string;
    fieldName: string;
    oldValue: string | null;
    newValue: string;
    changedBy: number;
    changedByName: string | null;
    changedAt: string;
    reason: string | null;
}

export interface UpdateSchedulerTimeoutReq {
    timeoutSec: number;
    reason?: string | null;
}

export interface PageRes<T> {
    content: T[];
    totalElements: number;
    totalPages: number;
    number: number;
    size: number;
}

export interface SchedulerLogsReq {
    schedulerName?: string | null;
    status?: string | null;
    acknowledged?: boolean | null;
    /** "YYYY-MM-DD" — 해당 날짜 00:00:00 부터 포함 */
    fromDate?: string | null;
    /** "YYYY-MM-DD" — 해당 날짜 23:59:59.999 까지 포함 */
    toDate?: string | null;
    messageKeyword?: string | null;
    page?: number;
    size?: number;
}

export interface SchedulerConfigLogsReq {
    schedulerName?: string | null;
    page?: number;
    size?: number;
}

export interface ErrorLogsReq {
    acknowledged?: boolean | null;
    fromDate?: string | null;
    toDate?: string | null;
    messageKeyword?: string | null;
    page?: number;
    size?: number;
}

export interface RedisPrefixRes {
    prefix: string;
    description: string;
    keyCount: number;
    minTtlSec: number | null;
    maxTtlSec: number | null;
}

export interface RedisCacheRes {
    prefixes: RedisPrefixRes[];
}

export interface ErrorLogRes {
    id: number;
    occurredAt: string;
    loggerName: string;
    threadName: string | null;
    message: string | null;
    stackTrace: string | null;
    acknowledged: boolean;
    acknowledgedBy: number | null;
    acknowledgedByName: string | null;
    acknowledgedAt: string | null;
    acknowledgeNote: string | null;
}

export interface SystemStatusRes {
    dbStatus: 'UP' | 'DOWN';
    redisStatus: 'UP' | 'DOWN';
    heapUsedMb: number;
    heapMaxMb: number;
    heapUsagePercent: number;
    uptimeSec: number;
    jvmThreads: number;
    tomcatActive: number;
    tomcatMax: number;
    fastSchedulerActive: number;
    fastSchedulerMax: number;
    slowSchedulerActive: number;
    slowSchedulerMax: number;
}

export interface TriggerSchedulerRes {
    schedulerName: string;
}

export interface RedisInvalidateRes {
    deleted: number;
}

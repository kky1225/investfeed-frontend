export type SchedulerState = 'SUCCESS' | 'WARNING' | 'FAILED' | 'STUCK' | 'PENDING';

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

export interface LogAckHistoryRes {
    id: number;
    action: 'ACKNOWLEDGE' | 'EDIT_NOTE' | 'CANCEL';
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
    page?: number;
    size?: number;
}

export interface SchedulerConfigLogsReq {
    schedulerName?: string | null;
    page?: number;
    size?: number;
}

export interface ErrorLogsReq {
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

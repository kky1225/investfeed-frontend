export interface EconomicIndicator {
    code: string;
    name: string;
    country: string;
    latestValue: string;
    latestDate: string;
    unit: string;
    change: string | null;
    previousValue?: string | null;
}

export interface IndicatorHistoryReq {
    code: string;
    country: string;
}

export interface IndicatorDataPoint {
    date: string;
    value: string;
    originalValue?: string | null;
    observationDate?: string | null;
}

export interface IndicatorHistoryRes {
    code: string;
    name: string;
    unit: string;
    chartType: string; // linear, stepAfter
    frequency: string; // D, W, M, Q
    data: IndicatorDataPoint[];
}

export interface CalendarEventsReq {
    year: number;
    month: number;
}

export interface CalendarEvent {
    id: number | null;
    date: string;
    name: string;
    country: string;
    value: string | null;
    isFuture: boolean;
    type: string; // INDICATOR, HOLIDAY, MEETING
    source: string; // ECOS, FRED, HOLIDAY, MANUAL
}

export interface ManualCalendarEventReq {
    date: string;
    name: string;
    country: string;
    value?: string | null;
    type: string;
}

export interface BulkRefreshReq {
    yearFrom: number;
    yearTo: number;
}

export interface BulkRefreshStatus {
    running: boolean;
    yearFrom: number | null;
    yearTo: number | null;
    totalMonths: number;
    processedMonths: number;
    failedMonths: number;
    currentMonth: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    errorMessage: string | null;
}

export interface UpdateCalendarEventMutationVars {
    id: number;
    req: ManualCalendarEventReq;
}

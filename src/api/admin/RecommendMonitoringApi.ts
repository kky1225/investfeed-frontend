import api from '../../axios';
import type {ApiResponse} from '../../type/AuthType';
import type {
    AdminRecommendPickRes,
    AdminMarketSnapshotRes,
    AdminBackfillStatusRes,
    AdminBacktestMetricsRes,
} from '../../type/RecommendMonitoringType';

/**
 * 추천 신호 조회. date 미지정/오늘 = stock_pick (현재 상태), 과거 일자 = stock_pick_history (수익률 포함).
 */
export const fetchAdminRecommendPicks = async (date?: string): Promise<ApiResponse<AdminRecommendPickRes[]>> => {
    const res = await api.get<ApiResponse<AdminRecommendPickRes[]>>('/admin/recommend/monitoring/picks', {
        params: date ? {date} : undefined,
    });
    return res.data;
};

export const fetchAdminMarketSnapshots = async (days: number = 30): Promise<ApiResponse<AdminMarketSnapshotRes[]>> => {
    const res = await api.get<ApiResponse<AdminMarketSnapshotRes[]>>('/admin/recommend/monitoring/snapshots', {
        params: {days},
    });
    return res.data;
};

export const fetchAdminBackfillStatus = async (days: number = 25): Promise<ApiResponse<AdminBackfillStatusRes[]>> => {
    const res = await api.get<ApiResponse<AdminBackfillStatusRes[]>>('/admin/recommend/monitoring/backfill-status', {
        params: {days},
    });
    return res.data;
};

export const fetchAdminBacktestMetrics = async (periodDays: number = 30): Promise<ApiResponse<AdminBacktestMetricsRes>> => {
    const res = await api.get<ApiResponse<AdminBacktestMetricsRes>>('/admin/recommend/monitoring/metrics', {
        params: {periodDays},
    });
    return res.data;
};

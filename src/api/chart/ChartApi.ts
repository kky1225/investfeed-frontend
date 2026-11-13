import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import type {ApiResponse} from "../../type/AuthType";
import type {AssetType} from "../../type/NotificationType.ts";
import type {ChartDrawingRes, ChartSetting} from "../../type/ChartType.ts";
import type {Drawing} from "../../lib/chart/types.ts";

export const fetchChartSetting = async (config?: AxiosRequestConfig): Promise<ApiResponse<ChartSetting>> => {
    const res = await api.get<ApiResponse<ChartSetting>>("/chart/settings", config);
    return res.data;
};

export const saveChartSetting = async (req: ChartSetting): Promise<ApiResponse<ChartSetting>> => {
    const res = await api.put<ApiResponse<ChartSetting>>("/chart/settings", req);
    return res.data;
};

export const fetchChartDrawings = async (
    assetType: AssetType, assetCode: string, config?: AxiosRequestConfig,
): Promise<ApiResponse<ChartDrawingRes>> => {
    const res = await api.get<ApiResponse<ChartDrawingRes>>(
        `/chart/drawings/${assetType}/${encodeURIComponent(assetCode)}`, config,
    );
    return res.data;
};

/** 이 종목의 선 전체를 바꾼다. 빈 목록이면 모두 삭제 */
export const saveChartDrawings = async (
    assetType: AssetType, assetCode: string, drawings: Drawing[],
): Promise<ApiResponse<ChartDrawingRes>> => {
    const res = await api.put<ApiResponse<ChartDrawingRes>>(
        `/chart/drawings/${assetType}/${encodeURIComponent(assetCode)}`, {drawings},
    );
    return res.data;
};

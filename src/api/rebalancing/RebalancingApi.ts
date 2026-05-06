import type {AxiosRequestConfig} from 'axios';
import api from '../../axios.ts';
import type {ApiResponse} from '../../type/AuthType';
import type {RebalancingSettingReq, RebalancingSettingRes, RebalancingStatusRes} from '../../type/RebalancingType.ts';

export const saveRebalancingSetting = async (req: RebalancingSettingReq): Promise<ApiResponse<RebalancingSettingRes>> => {
    const res = await api.post<ApiResponse<RebalancingSettingRes>>('/rebalancing', req);
    return res.data;
};

export const fetchRebalancingStatus = async (config?: AxiosRequestConfig): Promise<ApiResponse<RebalancingStatusRes | null>> => {
    const res = await api.get<ApiResponse<RebalancingStatusRes | null>>('/rebalancing', config);
    return res.data;
};

export const deleteRebalancingSetting = async (): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>('/rebalancing');
    return res.data;
};

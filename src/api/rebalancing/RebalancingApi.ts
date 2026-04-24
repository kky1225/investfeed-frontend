import type {AxiosRequestConfig} from 'axios';
import api from '../../axios.ts';
import type {RebalancingSettingReq} from '../../type/RebalancingType.ts';

export const saveRebalancingSetting = async (req: RebalancingSettingReq) => {
    const res = await api.post('/rebalancing/setting', req);
    return res.data;
};

export const fetchRebalancingStatus = async (config?: AxiosRequestConfig) => {
    const res = await api.get('/rebalancing/status', config);
    return res.data;
};

export const deleteRebalancingSetting = async () => {
    const res = await api.delete('/rebalancing/setting');
    return res.data;
};

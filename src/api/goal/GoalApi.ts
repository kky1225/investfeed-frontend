import type {AxiosRequestConfig} from 'axios';
import api from '../../axios.ts';
import type {ApiResponse} from '../../type/AuthType';
import type {GoalDashboardRes, InvestmentGoalCreateReq, InvestmentGoalRes, InvestmentGoalUpdateReq} from '../../type/GoalType.ts';

export const createGoal = async (req: InvestmentGoalCreateReq): Promise<ApiResponse<InvestmentGoalRes>> => {
    const res = await api.post<ApiResponse<InvestmentGoalRes>>('/goals', req);
    return res.data;
};

export const updateGoal = async (id: number, req: InvestmentGoalUpdateReq): Promise<ApiResponse<InvestmentGoalRes>> => {
    const res = await api.patch<ApiResponse<InvestmentGoalRes>>(`/goals/${id}`, req);
    return res.data;
};

export const deleteGoal = async (id: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/goals/${id}`);
    return res.data;
};

export const fetchGoalDashboard = async (config?: AxiosRequestConfig): Promise<ApiResponse<GoalDashboardRes>> => {
    const res = await api.get<ApiResponse<GoalDashboardRes>>('/goals/dashboard', config);
    return res.data;
};

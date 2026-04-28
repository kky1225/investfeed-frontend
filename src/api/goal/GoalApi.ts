import type {AxiosRequestConfig} from 'axios';
import api from '../../axios.ts';
import type {InvestmentGoalCreateReq, InvestmentGoalUpdateReq} from '../../type/GoalType.ts';

export const createGoal = async (req: InvestmentGoalCreateReq) => {
    const res = await api.post('/goals', req);
    return res.data;
};

export const updateGoal = async (id: number, req: InvestmentGoalUpdateReq) => {
    const res = await api.patch(`/goals/${id}`, req);
    return res.data;
};

export const deleteGoal = async (id: number) => {
    const res = await api.delete(`/goals/${id}`);
    return res.data;
};

export const fetchGoals = async () => {
    const res = await api.get('/goals');
    return res.data;
};

export const fetchGoalDashboard = async (config?: AxiosRequestConfig) => {
    const res = await api.get('/goals/dashboard', config);
    return res.data;
};

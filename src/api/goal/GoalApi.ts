import api from '../../axios.ts';
import type {InvestmentGoalCreateReq, InvestmentGoalUpdateReq} from '../../type/GoalType.ts';

export const createGoal = async (req: InvestmentGoalCreateReq) => {
    const res = await api.post('/goal', req);
    return res.data;
};

export const updateGoal = async (id: number, req: InvestmentGoalUpdateReq) => {
    const res = await api.patch(`/goal/${id}`, req);
    return res.data;
};

export const deleteGoal = async (id: number) => {
    const res = await api.delete(`/goal/${id}`);
    return res.data;
};

export const fetchGoals = async () => {
    const res = await api.get('/goal');
    return res.data;
};

export const fetchGoalDashboard = async () => {
    const res = await api.get('/goal/dashboard');
    return res.data;
};

import api from "../../axios.ts";
import {DashboardStreamReq} from "../../type/dashboardType.ts";

export const fetchDashboard = async () => {
    const res = await api.post(`/dashboard`);
    return res.data;
};

export const fetchDashboardStream = async (req: DashboardStreamReq) => {
    const res = await api.post(`/dashboard/stream`, req);
    return res.data;
}
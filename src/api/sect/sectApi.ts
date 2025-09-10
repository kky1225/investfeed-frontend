import api from "../../axios.ts";
import {indexListReq} from "../../type/sectType.ts";

export const fetchDashboard = async (req: indexListReq) => {
    const res = await api.post(`/dashboard`, req);
    return res.data;
};

export const fetchDashboardStream = async () => {
    const res = await api.get(`/dashboard/stream`, {});
    return res.data;
}
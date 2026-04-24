import api from "../../axios.ts";

export const fetchDashboard = async () => {
    const res = await api.get(`/stock/dashboard`);
    return res.data;
};
import api from "../../axios.ts";

export const fetchDashboard = async () => {
    const res = await api.post(`/stock/dashboard`);
    return res.data;
};
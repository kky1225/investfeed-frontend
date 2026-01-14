import api from "../../axios.ts";

export const fetchDashboard = async () => {
    const res = await api.post(`/dashboard`);
    return res.data;
};
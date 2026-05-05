import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";

export const fetchDashboard = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/stock/dashboard`, config);
    return res.data;
};

export const fetchDashboardStream = async () => {
    const res = await api.get(`/stock/dashboard/stream`);
    return res.data;
};

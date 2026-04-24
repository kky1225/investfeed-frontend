import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";

export const fetchAssetDashboard = async (config?: AxiosRequestConfig) => {
    const res = await api.get(`/asset/dashboard`, config);
    return res.data;
}

import api from "../../axios.ts";

export const fetchAssetDashboard = async () => {
    const res = await api.get(`/asset/dashboard`);
    return res.data;
}

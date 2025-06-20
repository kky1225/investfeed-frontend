import api from "../../axios.ts";
import {indexListReq} from "../../type/sectType.ts";

export const fetchDashboard = async (req: indexListReq) => {
    const response = await api.post(`/dashboard`, req);
    return response.data;
};
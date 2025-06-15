import api from "../../axios.ts";
import {indexListReq} from "../../type/sectType.ts";

export const fetchIndexList = async (req: indexListReq) => {
    const response = await api.get(`/api/sect/indexList`, req);
    return response.data;
};
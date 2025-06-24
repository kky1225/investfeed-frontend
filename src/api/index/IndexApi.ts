import api from "../../axios.ts";
import {indexDetailReq} from "../../type/IndexType.ts";

export const fetchIndexList = async () => {
    const response = await api.get(`/index/list`);
    return response.data
}

export const fetchIndexDetail = async (req: indexDetailReq) => {
    const response = await api.get(`/index/detail`, {params: req});
    return response.data
}
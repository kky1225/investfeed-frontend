import api from "../../axios.ts";

export const fetchIndexList = async () => {
    const response = await api.get(`/index/list`);
    return response.data
}
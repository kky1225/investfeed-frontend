import api from "../../axios.ts";

export const fetchRecommendList = async () => {
    const res = await api.get(`/recommend/list`);
    return res.data;
}
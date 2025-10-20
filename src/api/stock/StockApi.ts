import api from "../../axios.ts";

export const fetchStockList = async () => {
    const res = await api.get(`/stock/list`);
    return res.data;
}
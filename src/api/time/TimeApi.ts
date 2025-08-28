import api from "../../axios.ts";

export const fetchTimeNow = async () => {
    const response = await api.get("/time/now");
    return response.data;
}
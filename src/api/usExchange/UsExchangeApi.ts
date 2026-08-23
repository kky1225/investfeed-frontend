import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";

export const fetchUsExchangeRate = async (config?: AxiosRequestConfig) => {
    const res = await api.get("/us-stock/exchange", {...config});

    return res.data;
}

export const fetchUsExchangeHistory = async (config?: AxiosRequestConfig) => {
    const res = await api.get("/us-stock/exchange/history", {...config});

    return res.data;
}

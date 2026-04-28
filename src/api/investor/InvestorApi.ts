import type {AxiosRequestConfig} from "axios";
import {InvestorListReq, InvestorStreamReq} from "../../type/InvestorType.ts";
import api from "../../axios.ts";

export const fetchInvestorList = async (req: InvestorListReq, config?: AxiosRequestConfig) => {
    const res = await api.get("/stock/investors", {...config, params: req});
    return res.data;
}

export const fetchInvestorStream = async (req: InvestorStreamReq) => {
    const res = await api.post(`/stock/investors/stream`, req);
    return res.data;
}
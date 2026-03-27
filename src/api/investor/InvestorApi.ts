import {InvestorListReq, InvestorStreamReq} from "../../type/InvestorType.ts";
import api from "../../axios.ts";

export const fetchInvestorList = async (req: InvestorListReq) => {
    const res = await api.get("/stock/investor/list", {params: req});
    return res.data;
}

export const fetchInvestorStream = async (req: InvestorStreamReq) => {
    const res = await api.post(`/stock/investor/stream`, req);
    return res.data;
}
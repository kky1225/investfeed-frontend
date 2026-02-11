import {InvestorListReq} from "../../type/InvestorType.ts";
import api from "../../axios.ts";

export const fetchInvestorList = async (req: InvestorListReq) => {
    const res = await api.get("/investor/list", {params: req});
    return res.data;
}
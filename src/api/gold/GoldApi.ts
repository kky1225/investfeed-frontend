import api from "../../axios.ts";
import {GoldDetailReq} from "../../type/GoldType.ts";

export const fetchGoldDetail = async (req: GoldDetailReq) => {
    const res = await api.get(`/gold/detail`, {params: req});
    return res.data
}
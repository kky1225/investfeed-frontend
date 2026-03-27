import api from "../../axios.ts";
import {RankListReq} from "../../type/RankType.ts";

export const fetchRankList = async (req: RankListReq) => {
    const res = await api.get(`/stock/rank/list`, {params: req});
    return res.data;
}
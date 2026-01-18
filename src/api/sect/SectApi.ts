import {SectListReq} from "../../type/SectType.ts";
import api from "../../axios.ts";

export const fetchSectList = async (req: SectListReq) => {
    const res = await api.get("/sect/list", {params: req});
    return res.data;
}
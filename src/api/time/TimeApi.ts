import api from "../../axios.ts";
import {TimeNowReq} from "../../type/timeType.ts";

export const fetchTimeNow = async (req :TimeNowReq) => {
    const res = await api.get("/time/now", {params: req});
    return res.data;
}
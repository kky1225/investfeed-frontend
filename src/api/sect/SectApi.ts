import {SectListReq, SectListStreamReq, SectStockListReq, SectStockListStreamReq} from "../../type/SectType.ts";
import api from "../../axios.ts";

export const fetchSectList = async (req: SectListReq) => {
    const res = await api.get("/sect/list", {params: req});
    return res.data;
}

export const fetchSectListStream = async (req: SectListStreamReq) => {
    const res = await api.get("/sect/list/stream", {params: req});
    return res.data;
}

export const fetchSectStockList = async (req: SectStockListReq) => {
    const res = await api.get("/sect/stock/list", {params: req});
    return res.data;
}

export const fetchSectStockListStream = async (req: SectStockListStreamReq) => {
    const res = await api.get("/sect/stock/list/stream", {params: req});
    return res.data;
}
import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import type {ApiResponse} from "../../type/AuthType";
import {HoldingStreamReq, HoldingListData} from "../../type/HoldingType.ts";
import {HoldingReorderReq} from "../../type/BrokerType.ts";

export const fetchHoldingList = async (config?: AxiosRequestConfig): Promise<ApiResponse<HoldingListData>> => {
    const res = await api.get<ApiResponse<HoldingListData>>(`/stock/holdings`, config);
    return res.data;
}

export const fetchHoldingStream = async (req: HoldingStreamReq): Promise<ApiResponse<null>> => {
    const res = await api.post<ApiResponse<null>>(`/stock/holdings/stream`, req);
    return res.data;
}

export const reorderApiHoldings = async (req: HoldingReorderReq): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/stock/holdings/manual/reorder`, req);
    return res.data;
}

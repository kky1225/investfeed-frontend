import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import type {ApiResponse} from "../../type/AuthType";
import {HoldingStreamReq, CryptoHoldingListData} from "../../type/HoldingType.ts";
import {HoldingReorderReq} from "../../type/BrokerType.ts";

export const fetchCryptoHoldingList = async (config?: AxiosRequestConfig): Promise<ApiResponse<CryptoHoldingListData>> => {
    const res = await api.get<ApiResponse<CryptoHoldingListData>>(`/crypto/holdings`, config);
    return res.data;
}

export const fetchCryptoHoldingStream = async (req: HoldingStreamReq): Promise<ApiResponse<null>> => {
    const res = await api.post<ApiResponse<null>>(`/crypto/holdings/stream`, req);
    return res.data;
}

export const reorderCryptoApiHoldings = async (req: HoldingReorderReq): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/crypto/holdings/reorder`, req);
    return res.data;
}

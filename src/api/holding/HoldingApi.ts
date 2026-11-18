import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import type {ApiResponse} from "../../type/AuthType";
import {HoldingStreamReq, HoldingListData, StockTradeMarket, StockTradeRes} from "../../type/HoldingType.ts";
import {HoldingReorderReq} from "../../type/BrokerType.ts";

export const fetchHoldingList = async (config?: AxiosRequestConfig): Promise<ApiResponse<HoldingListData>> => {
    const res = await api.get<ApiResponse<HoldingListData>>(`/stock/holdings`, config);
    return res.data;
}

export const fetchTossHoldingList = async (config?: AxiosRequestConfig): Promise<ApiResponse<HoldingListData>> => {
    const res = await api.get<ApiResponse<HoldingListData>>(`/stock/holdings/toss`, config);
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

/** 한 종목의 내 매매(최근 1년 체결과 증권사별 보유). 보유 종목과 같이 2차 인증이 필요하다 */
export const fetchStockTrades = async (
    stkCd: string, market: StockTradeMarket, config?: AxiosRequestConfig,
): Promise<ApiResponse<StockTradeRes>> => {
    const res = await api.get<ApiResponse<StockTradeRes>>(`/stock/holdings/trades/${stkCd}`, {...config, params: {market}});
    return res.data;
}

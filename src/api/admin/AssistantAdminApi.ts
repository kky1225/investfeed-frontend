import type {AxiosRequestConfig} from 'axios';
import api from '../../axios';
import type {ApiResponse} from '../../type/AuthType';
import type {AssistantAliasCreateReq, AssistantAliasRes, AssistantChatLogRes, AssistantUsageRes} from '../../type/AssistantType';

/** 관리자 — 비서 종목 별칭 사전 (종목명 해석용) */
export const fetchAssistantAliases = async (config?: AxiosRequestConfig): Promise<ApiResponse<AssistantAliasRes[]>> => {
    const res = await api.get<ApiResponse<AssistantAliasRes[]>>('/admin/assistant/aliases', config);
    return res.data;
};

export const createAssistantAlias = async (req: AssistantAliasCreateReq): Promise<ApiResponse<AssistantAliasRes>> => {
    const res = await api.post<ApiResponse<AssistantAliasRes>>('/admin/assistant/aliases', req);
    return res.data;
};

export const deleteAssistantAlias = async (id: number): Promise<ApiResponse<number>> => {
    const res = await api.delete<ApiResponse<number>>(`/admin/assistant/aliases/${id}`);
    return res.data;
};

/** 관리자 — 비서 Q&A 사용량 (월, YYYY-MM) */
export const fetchAssistantUsage = async (month: string, config?: AxiosRequestConfig): Promise<ApiResponse<AssistantUsageRes>> => {
    const res = await api.get<ApiResponse<AssistantUsageRes>>('/admin/assistant/usage', {...config, params: {month}});
    return res.data;
};

/** 관리자 — 회원별 처리 기록 (월, 질문 원문 없음) */
export const fetchAssistantMemberLogs = async (memberId: number, month: string, config?: AxiosRequestConfig): Promise<ApiResponse<AssistantChatLogRes[]>> => {
    const res = await api.get<ApiResponse<AssistantChatLogRes[]>>(`/admin/assistant/usage/members/${memberId}/logs`, {...config, params: {month}});
    return res.data;
};

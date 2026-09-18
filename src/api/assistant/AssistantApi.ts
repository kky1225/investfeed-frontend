import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import type {ApiResponse} from "../../type/AuthType";
import type {AssistantSettingReq, AssistantSettingRes, AssistantTokenRes, ReadMarkerReq, TimelinePage} from "../../type/AssistantType.ts";

export interface TimelineQuery {
    before?: number;
    limit?: number;
    date?: string; // YYYY-MM-DD
}

/** 로그인만. 개인 섹션 제거된 타임라인 */
export const fetchTimeline = async (query: TimelineQuery = {}, config?: AxiosRequestConfig): Promise<ApiResponse<TimelinePage>> => {
    const res = await api.get<ApiResponse<TimelinePage>>("/assistant/timeline", {...config, params: query});
    return res.data;
};

/** 2차 인증 경로. 전체 본문. 인터셉터가 2차 인증 다이얼로그를 처리한다 */
export const fetchSecureTimeline = async (query: TimelineQuery = {}, config?: AxiosRequestConfig): Promise<ApiResponse<TimelinePage>> => {
    const res = await api.get<ApiResponse<TimelinePage>>("/assistant/secure/timeline", {
        ...config,
        params: query,
        secondaryAuthSource: 'assistant',
    });
    return res.data;
};

export const fetchAssistantUnreadCount = async (config?: AxiosRequestConfig): Promise<ApiResponse<number>> => {
    const res = await api.get<ApiResponse<number>>("/assistant/timeline/unread-count", config);
    return res.data;
};

export const markTimelineRead = async (req: ReadMarkerReq): Promise<ApiResponse<number>> => {
    const res = await api.patch<ApiResponse<number>>("/assistant/timeline/read-marker", req);
    return res.data;
};

/** 2차 인증 경로. Python 호출용 비서 토큰 발급. 사용자 JWT 는 Python 에 절대 보내지 않는다 */
export const issueAssistantToken = async (): Promise<ApiResponse<AssistantTokenRes>> => {
    const res = await api.post<ApiResponse<AssistantTokenRes>>("/assistant/secure/token", null, {secondaryAuthSource: 'assistant'});
    return res.data;
};

export const fetchAssistantSetting = async (config?: AxiosRequestConfig): Promise<ApiResponse<AssistantSettingRes>> => {
    const res = await api.get<ApiResponse<AssistantSettingRes>>("/assistant/settings", config);
    return res.data;
};

export const saveAssistantSetting = async (req: AssistantSettingReq): Promise<ApiResponse<AssistantSettingRes>> => {
    const res = await api.put<ApiResponse<AssistantSettingRes>>("/assistant/settings", req);
    return res.data;
};

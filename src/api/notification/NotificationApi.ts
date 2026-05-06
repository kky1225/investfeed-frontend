import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import type {ApiResponse} from "../../type/AuthType";
import type {Notification, PriceTarget, PriceTargetCreateReq} from "../../type/NotificationType.ts";
import type {NotificationSettingReq, NotificationSettingRes} from "../../type/NotificationSettingType.ts";

export const fetchNotifications = async (assetType?: string, config?: AxiosRequestConfig): Promise<ApiResponse<Notification[]>> => {
    const params = assetType ? {assetType} : {};
    const res = await api.get<ApiResponse<Notification[]>>("/notifications", {...config, params});
    return res.data;
};

export const fetchUnreadCount = async (config?: AxiosRequestConfig): Promise<ApiResponse<number>> => {
    const res = await api.get<ApiResponse<number>>("/notifications/unread-count", config);
    return res.data;
};

export const markAsRead = async (id: number): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>(`/notifications/${id}/read`);
    return res.data;
};

export const markAllAsRead = async (): Promise<ApiResponse<null>> => {
    const res = await api.patch<ApiResponse<null>>("/notifications/read-all");
    return res.data;
};

export const createPriceTarget = async (req: PriceTargetCreateReq): Promise<ApiResponse<PriceTarget>> => {
    const res = await api.post<ApiResponse<PriceTarget>>("/notifications/price-targets", req);
    return res.data;
};

export const fetchPriceTargets = async (config?: AxiosRequestConfig): Promise<ApiResponse<PriceTarget[]>> => {
    const res = await api.get<ApiResponse<PriceTarget[]>>("/notifications/price-targets", config);
    return res.data;
};

export const deletePriceTarget = async (id: number): Promise<ApiResponse<null>> => {
    const res = await api.delete<ApiResponse<null>>(`/notifications/price-targets/${id}`);
    return res.data;
};

export const fetchNotificationSetting = async (config?: AxiosRequestConfig): Promise<ApiResponse<NotificationSettingRes>> => {
    const res = await api.get<ApiResponse<NotificationSettingRes>>("/notifications/settings", config);
    return res.data;
};

export const saveNotificationSetting = async (req: NotificationSettingReq): Promise<ApiResponse<NotificationSettingRes>> => {
    const res = await api.put<ApiResponse<NotificationSettingRes>>("/notifications/settings", req);
    return res.data;
};

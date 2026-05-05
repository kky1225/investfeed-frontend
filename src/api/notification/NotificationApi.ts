import type {AxiosRequestConfig} from "axios";
import api from "../../axios.ts";
import type {NotificationSettingReq} from "../../type/NotificationSettingType.ts";

export const fetchNotifications = async (assetType?: string, config?: AxiosRequestConfig) => {
    const params = assetType ? {assetType} : {};
    const res = await api.get("/notifications", {...config, params});
    return res.data;
};

export const fetchUnreadCount = async (config?: AxiosRequestConfig) => {
    const res = await api.get("/notifications/unread-count", config);
    return res.data;
};

export const markAsRead = async (id: number) => {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data;
};

export const markAllAsRead = async () => {
    const res = await api.patch("/notifications/read-all");
    return res.data;
};

export const createPriceTarget = async (req: import("../../type/NotificationType.ts").PriceTargetCreateReq) => {
    const res = await api.post("/notifications/price-targets", req);
    return res.data;
};

export const fetchPriceTargets = async (config?: AxiosRequestConfig) => {
    const res = await api.get("/notifications/price-targets", config);
    return res.data;
};

export const deletePriceTarget = async (id: number) => {
    const res = await api.delete(`/notifications/price-targets/${id}`);
    return res.data;
};

export const fetchNotificationSetting = async (config?: AxiosRequestConfig) => {
    const res = await api.get("/notifications/settings", config);
    return res.data;
};

export const saveNotificationSetting = async (req: NotificationSettingReq) => {
    const res = await api.put("/notifications/settings", req);
    return res.data;
};

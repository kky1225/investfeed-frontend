import api from "../../axios.ts";

export const fetchNotifications = async (assetType?: string) => {
    const params = assetType ? {assetType} : {};
    const res = await api.get("/notifications", {params});
    return res.data;
};

export const fetchUnreadCount = async () => {
    const res = await api.get("/notifications/unread-count");
    return res.data;
};

export const markAsRead = async (id: number) => {
    const res = await api.put(`/notifications/${id}/read`);
    return res.data;
};

export const markAllAsRead = async () => {
    const res = await api.put("/notifications/read-all");
    return res.data;
};

export const createPriceTarget = async (req: import("../../type/NotificationType.ts").PriceTargetCreateReq) => {
    const res = await api.post("/notifications/price-targets", req);
    return res.data;
};

export const fetchPriceTargets = async () => {
    const res = await api.get("/notifications/price-targets");
    return res.data;
};

export const deletePriceTarget = async (id: number) => {
    const res = await api.delete(`/notifications/price-targets/${id}`);
    return res.data;
};

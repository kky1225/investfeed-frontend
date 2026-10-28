import type {Notification} from '../type/NotificationType';

export function getNavigationPath(notification: Notification): string {
    if (notification.link) return notification.link;
    if (notification.type === 'GOAL') {
        return '/dashboard';
    }
    if (notification.type === 'REBALANCING') {
        return '/rebalancing';
    }
    if (notification.type === 'API_KEY') {
        return '/settings';
    }
    if (notification.type === 'PRICE') {
        if (notification.assetType === 'STOCK') {
            return `/stock/detail/${notification.assetCode}`;
        }
        return `/crypto/detail/${notification.assetCode}`;
    }
    return `/stock/detail/${notification.assetCode}`;
}

export type NotificationType = 'PRICE' | 'TRADE';
export type AssetType = 'STOCK' | 'CRYPTO';
export type Direction = 'UP' | 'DOWN';

export interface Notification {
    id: number;
    type: NotificationType;
    assetType: AssetType;
    assetCode: string;
    assetName: string;
    threshold: number;
    direction: Direction;
    fluRt: number;
    isRead: boolean;
    createdAt: string;
}

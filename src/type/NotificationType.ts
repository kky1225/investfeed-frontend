export type NotificationType = 'PRICE' | 'TRADE' | 'TARGET_PRICE';
export type AssetType = 'STOCK' | 'CRYPTO';
export type Direction = 'UP' | 'DOWN' | 'UPPER_LIMIT' | 'LOWER_LIMIT' | 'HIGH_52W' | 'LOW_52W' | 'TARGET_ABOVE' | 'TARGET_BELOW';
export type PriceTargetDirection = 'ABOVE' | 'BELOW';

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

export interface PriceTarget {
    id: number;
    assetType: AssetType;
    assetCode: string;
    assetName: string;
    targetPrice: number;
    direction: PriceTargetDirection;
    createdAt: string;
}

export interface PriceTargetCreateReq {
    assetType: AssetType;
    assetCode: string;
    assetName: string;
    targetPrice: number;
    direction: PriceTargetDirection;
}

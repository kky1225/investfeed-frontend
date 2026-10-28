export type NotificationType = 'PRICE' | 'TRADE' | 'TARGET_PRICE' | 'GOAL' | 'REBALANCING' | 'API_KEY';
export type AssetType = 'STOCK' | 'CRYPTO' | 'TOTAL';
export type Direction = 'UP' | 'DOWN' | 'UPPER_LIMIT' | 'LOWER_LIMIT' | 'HIGH_52W' | 'LOW_52W' | 'TARGET_ABOVE' | 'TARGET_BELOW' | 'GOAL_ACHIEVED' | 'REBALANCING_ASSET' | 'REBALANCING_STOCK';
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
    price: number | null;     // 등락률 알림 발송 시점 현재가 (과거 알림은 null)
    isRead: boolean;
    createdAt: string;
    /** 눌렀을 때 갈 상세 화면 (서버 계산, 2026-10-27). null 이면 알림 종류로 이동 — 미국 상세는 거래소 구분이 필요해 서버가 준다 */
    link?: string | null;
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

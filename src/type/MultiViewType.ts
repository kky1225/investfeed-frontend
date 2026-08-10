export type MultiViewAssetType = 'STOCK' | 'US_STOCK' | 'CRYPTO' | 'COMMODITY';

export interface SelectedAsset {
    type: MultiViewAssetType;
    code: string;
    name: string;
    stexTp?: string; // US_STOCK 전용 — 거래소구분 ND:NASDAQ, NY:NYSE, NA:AMEX
}

export interface MultiViewStreamReq {
    items: string[];
}

export interface MultiViewUsStreamItem {
    stkCd: string;
    stexTp: string;
}

export interface MultiViewUsStreamReq {
    items: MultiViewUsStreamItem[];
}

export interface StreamUpdate {
    value: string;
    fluRt: string;
    predPre: string;
    trend: 'up' | 'down' | 'neutral';
}

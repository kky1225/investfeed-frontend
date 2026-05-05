export type MultiViewAssetType = 'STOCK' | 'CRYPTO' | 'COMMODITY';

export interface SelectedAsset {
    type: MultiViewAssetType;
    code: string;
    name: string;
}

export interface MultiViewStreamReq {
    items: string[];
}

export interface StreamUpdate {
    value: string;
    fluRt: string;
    predPre: string;
    trend: 'up' | 'down' | 'neutral';
}

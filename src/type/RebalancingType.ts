export type RatioDirection = 'MIN' | 'MAX';

export interface RebalancingSettingReq {
    stockRatio: number;
    stockDirection: RatioDirection;
    cryptoRatio: number;
    cryptoDirection: RatioDirection;
    cashRatio: number;
    cashDirection: RatioDirection;
    maxStockRatio: number;
}

export interface RebalancingSettingRes {
    stockRatio: number;
    stockDirection: RatioDirection;
    cryptoRatio: number;
    cryptoDirection: RatioDirection;
    cashRatio: number;
    cashDirection: RatioDirection;
    maxStockRatio: number;
}

export interface AssetRatioStatus {
    stockRatio: number;
    cryptoRatio: number;
    cashRatio: number;
    stockAmount: number;
    cryptoAmount: number;
    cashAmount: number;
    totalAsset: number;
}

export interface OverweightAssetItem {
    assetType: string;
    currentRatio: number;
    targetRatio: number;
    direction: RatioDirection;
    excessAmount: number;
}

export interface OverweightStockItem {
    stkCd: string;
    stkNm: string;
    brokerName: string;
    currentRatio: number;
    maxRatio: number;
    curPrc: number;
    evltAmt: number;
    sellQuantity: number;
    sellAmount: number;
}

export interface RebalancingStatusRes {
    setting: RebalancingSettingRes;
    currentRatios: AssetRatioStatus;
    overweightAssets: OverweightAssetItem[];
    overweightStocks: OverweightStockItem[];
}

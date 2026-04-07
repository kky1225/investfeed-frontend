export interface AssetDashboardRes {
    totalAsset: number;
    totalEvltAmt: number;
    totalPurAmt: number;
    totalEvltPl: number;
    totalPrftRt: string;
    totalCash: number;
    stockSummary: AssetGroupSummary;
    cryptoSummary: AssetGroupSummary;
}

export interface AssetGroupSummary {
    evltAmt: number;
    purAmt: number;
    evltPl: number;
    prftRt: string;
    cash: number;
    ratio: string;
    holdings: UnifiedHoldingItem[];
}

export interface UnifiedHoldingItem {
    stkCd: string;
    stkNm: string;
    curPrc: string;
    purAmt: number;
    evltAmt: number;
    evltPl: number;
    prftRt: string;
    possRt: string;
    brokerName: string;
}

import type {RealizedPnlDashboardItem} from './RealizedPnlType.ts';
import type {InvestmentGoalRes} from './GoalType.ts';

export interface AssetDashboardRes {
    totalAsset: number;
    totalEvltAmt: number;
    totalPurAmt: number;
    totalEvltPl: number;
    totalPrftRt: string;
    totalCash: number;
    stockSummary: AssetGroupSummary;
    cryptoSummary: AssetGroupSummary;
    brokerSummaries: BrokerSummaryItem[];
    realizedPnl?: RealizedPnlDashboardItem;
    goals?: InvestmentGoalRes[];
}

export interface BrokerSummaryItem {
    brokerName: string;
    market: string;
    type: string;
    evltAmt: number;
    purAmt: number;
    evltPl: number;
    prftRt: string;
    cash: number;
    holdingCount: number;
    holdings: BrokerHoldingItem[];
}

export interface BrokerHoldingItem {
    stkCd: string;
    curPrc: string;
    purAmt: number;
    quantity: number;
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

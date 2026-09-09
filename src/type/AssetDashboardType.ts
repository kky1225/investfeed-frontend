import type {RealizedPnlDashboardItem} from './RealizedPnlType.ts';
import type {InvestmentGoalRes} from './GoalType.ts';

export interface AssetDashboardRes {
    totalAsset: number;
    totalEvltAmt: number;
    totalPurAmt: number;
    totalEvltPl: number;
    totalPrftRt: string;
    totalCash: number;
    totalCashKrw: number;
    totalCashUsd?: string | null;
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
    cash: number;        // 원화 + 달러(원화 환산). 계산용
    cashKrw: number;     // 원화분만 — 표시용
    cashUsd?: string | null; // 달러분(달러 단위) — 표시용
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
    cash: number;        // 원화 + 달러(원화 환산). 계산용
    cashKrw: number;     // 원화분만 — 표시용
    cashUsd?: string | null; // 달러분(달러 단위) — 표시용
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

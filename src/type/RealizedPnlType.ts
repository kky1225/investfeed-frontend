// Request
export interface ManualRealizedPnlCreateReq {
    brokerId: number;
    year: number;
    month: number;
    realizedPnl: number;
}

export interface ManualRealizedPnlUpdateReq {
    realizedPnl: number;
}

export interface RealizedPnlSyncReq {
    year?: number;
    month?: number;
}

// Response
export interface RealizedPnlItem {
    id: number;
    brokerName: string;
    brokerId: number;
    market: string;
    year: number;
    month: number;
    realizedPnl: number;
    totalBuyAmt: number | null;
    totalSellAmt: number | null;
    tradeFee: number | null;
    tradeTax: number | null;
    source: string;
}

export interface RealizedPnlListRes {
    items: RealizedPnlItem[];
    totalRealizedPnl: number;
}

export interface RealizedPnlDashboardItem {
    currentMonthPnl: number;
    ytdPnl: number;
    allTimePnl: number;
    brokerPnlList: BrokerRealizedPnlItem[];
}

export interface BrokerRealizedPnlItem {
    brokerName: string;
    brokerId: number;
    market: string;
    currentMonthPnl: number;
    ytdPnl: number;
    allTimePnl: number;
}

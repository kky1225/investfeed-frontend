export interface MarketIndexRes {
    type: string;
    name: string;
    price: string;
    changeAmount: string;
    changeRate: string;
    delayStatus: string;
    updatedAt: string;
}

export interface MarketIndexDashboardRes {
    indices: MarketIndexRes[];
    fearGreed?: {
        current: { value: number; classification: string; date: string };
        history: { value: number; classification: string; date: string }[];
    } | null;
    bitcoin?: {
        price: string;
        changeAmount: string;
        changeRate: string;
        trend: string;
    } | null;
}

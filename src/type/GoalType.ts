export type GoalType = 'TOTAL_ASSET' | 'MONTHLY_REALIZED_PNL' | 'YEARLY_REALIZED_PNL';

export interface InvestmentGoalCreateReq {
    type: GoalType;
    targetAmount: number;
}

export interface InvestmentGoalUpdateReq {
    targetAmount: number;
}

export interface InvestmentGoalRes {
    id: number;
    type: GoalType;
    targetAmount: number;
    currentAmount: number;
    achievementRate: number;
    isAchieved: boolean;
    createdAt: string;
}

export const goalTypeLabel: Record<GoalType, string> = {
    TOTAL_ASSET: '총 자산 목표',
    MONTHLY_REALIZED_PNL: '월간 실현손익 목표',
    YEARLY_REALIZED_PNL: '연간 실현손익 목표',
};

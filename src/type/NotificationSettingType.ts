export interface NotificationSettingReq {
    priceUpEnabled: boolean;
    priceDownEnabled: boolean;
    high52wEnabled: boolean;
    low52wEnabled: boolean;
    upperLimitEnabled: boolean;
    lowerLimitEnabled: boolean;
    goalEnabled: boolean;
    rebalancingEnabled: boolean;
    apiKeyEnabled: boolean;
}

export interface NotificationSettingRes {
    priceUpEnabled: boolean;
    priceDownEnabled: boolean;
    high52wEnabled: boolean;
    low52wEnabled: boolean;
    upperLimitEnabled: boolean;
    lowerLimitEnabled: boolean;
    goalEnabled: boolean;
    rebalancingEnabled: boolean;
    apiKeyEnabled: boolean;
}

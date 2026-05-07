import {useCallback, useRef} from "react";
import {fetchMarketInfo, getServerNow, getServerOffset} from "../../lib/serverTime.ts";
import {MarketType} from "../../type/timeType.ts";

interface MarketTimeInfo {
    isMarketOpen: boolean;
    time: number;
    startMarketTime: number;
    marketType: string;
}

export function useMarketTime(marketType: MarketType) {
    const chartTimer = useRef(0);
    const marketTimer = useRef(0);

    const checkMarketTime = useCallback(async (): Promise<MarketTimeInfo | undefined> => {
        const info = await fetchMarketInfo(marketType);
        if (!info) return;
        if (info.marketType !== marketType) return;

        chartTimer.current = getServerOffset();

        if (!info.isMarketOpen) {
            marketTimer.current = info.startMarketTime - getServerNow();
        }

        return {
            isMarketOpen: info.isMarketOpen,
            time: info.time,
            startMarketTime: info.startMarketTime,
            marketType: info.marketType,
        };
    }, [marketType]);

    return {checkMarketTime, chartTimer, marketTimer};
}

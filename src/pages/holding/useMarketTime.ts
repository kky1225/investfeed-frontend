import {useCallback, useRef} from "react";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";

export interface MarketTimeInfo {
    isMarketOpen: boolean;
    time: number;
    startMarketTime: number;
    marketType: string;
}

export function useMarketTime() {
    const chartTimer = useRef(0);
    const marketTimer = useRef(0);

    const checkMarketTime = useCallback(async (): Promise<MarketTimeInfo | undefined> => {
        try {
            const startTime = Date.now();
            const data = await fetchTimeNow({marketType: MarketType.STOCK});

            if (data.code !== "0000") throw new Error(data.msg);

            const {time, isMarketOpen, startMarketTime, marketType} = data.result;

            if (marketType !== MarketType.STOCK) throw new Error(data.msg);

            const endTime = Date.now();
            const delayTime = endTime - startTime;
            const revisionServerTime = time + delayTime / 2;

            chartTimer.current = revisionServerTime - endTime;

            if (!isMarketOpen) {
                marketTimer.current = startMarketTime - revisionServerTime;
            }

            return data.result;
        } catch (error) {
            console.error(error);
        }
    }, []);

    return {checkMarketTime, chartTimer, marketTimer};
}

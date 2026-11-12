import {Candle} from "./types.ts";

/** 종가 단순 이동평균. 캔들과 같은 길이로 돌려주고, 기간이 아직 안 찬 앞부분은 null */
export const movingAverage = (candles: Candle[], period: number): (number | null)[] => {
    let sum = 0;
    return candles.map((candle, index) => {
        sum += candle.close;
        if (index >= period) sum -= candles[index - period].close;
        return index >= period - 1 ? sum / period : null;
    });
};

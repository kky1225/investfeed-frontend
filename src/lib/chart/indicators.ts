import {Candle} from "./types.ts";

/** 캔들과 같은 길이의 지표 값. 아직 계산할 수 없는 앞부분은 null */
export type Series = (number | null)[];

export interface MacdSeries {
    macd: Series,       // 단기 지수평균 - 장기 지수평균
    signal: Series,     // macd 의 지수평균
    histogram: Series,  // macd - signal (오실레이터)
}

const emptySeries = (length: number): Series => new Array<number | null>(length).fill(null);

/** 종가 단순 이동평균 */
export const movingAverage = (candles: Candle[], period: number): Series => {
    let sum = 0;
    return candles.map((candle, index) => {
        sum += candle.close;
        if (index >= period) sum -= candles[index - period].close;
        return index >= period - 1 ? sum / period : null;
    });
};

/** 지수 이동평균. 처음 period 개의 단순 평균에서 시작한다. null 은 건너뛴다. */
const exponentialAverage = (values: Series, period: number): Series => {
    const result = emptySeries(values.length);
    const weight = 2 / (period + 1);
    let previous: number | null = null;
    let seedSum = 0;
    let seedCount = 0;
    values.forEach((value, index) => {
        if (value === null) return;
        if (previous === null) {
            seedSum += value;
            seedCount += 1;
            if (seedCount < period) return;
            previous = seedSum / period;
        } else {
            previous = value * weight + previous * (1 - weight);
        }
        result[index] = previous;
    });
    return result;
};

/** RSI (와일더 평활). 0~100 */
export const relativeStrength = (candles: Candle[], period: number): Series => {
    const result = emptySeries(candles.length);
    let averageGain = 0;
    let averageLoss = 0;
    for (let index = 1; index < candles.length; index++) {
        const change = candles[index].close - candles[index - 1].close;
        const gain = Math.max(change, 0);
        const loss = Math.max(-change, 0);
        if (index <= period) {
            // 처음 period 개는 단순 평균
            averageGain += gain / period;
            averageLoss += loss / period;
            if (index < period) continue;
        } else {
            averageGain = (averageGain * (period - 1) + gain) / period;
            averageLoss = (averageLoss * (period - 1) + loss) / period;
        }
        result[index] = averageLoss === 0
            ? (averageGain === 0 ? 50 : 100)
            : 100 - 100 / (1 + averageGain / averageLoss);
    }
    return result;
};

/** MACD. 종가 기준 */
export const macd = (candles: Candle[], fastPeriod: number, slowPeriod: number, signalPeriod: number): MacdSeries => {
    const closes: Series = candles.map(candle => candle.close);
    const fast = exponentialAverage(closes, fastPeriod);
    const slow = exponentialAverage(closes, slowPeriod);
    const line: Series = closes.map((_, index) => {
        const fastValue = fast[index];
        const slowValue = slow[index];
        return fastValue === null || slowValue === null ? null : fastValue - slowValue;
    });
    const signal = exponentialAverage(line, signalPeriod);
    const histogram: Series = line.map((value, index) => {
        const signalValue = signal[index];
        return value === null || signalValue === null ? null : value - signalValue;
    });
    return {macd: line, signal, histogram};
};

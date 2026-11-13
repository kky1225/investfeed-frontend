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

/** 값들의 단순 이동평균. 구간 안에 null 이 하나라도 있으면 null */
export const simpleAverage = (values: Series, period: number): Series => {
    let sum = 0;
    let count = 0;  // 구간 안의 null 아닌 값의 수
    return values.map((value, index) => {
        if (value !== null) {
            sum += value;
            count += 1;
        }
        const leaving = index >= period ? values[index - period] : null;
        if (leaving !== null) {
            sum -= leaving;
            count -= 1;
        }
        return count === period ? sum / period : null;
    });
};

export interface BandSeries {
    upper: Series,      // 중심선 + 표준편차 × 배수
    middle: Series,     // 종가 단순 이동평균
    lower: Series,      // 중심선 - 표준편차 × 배수
}

/** 볼린저밴드. 표준편차는 구간 전체 기준(모표준편차) */
export const bollinger = (candles: Candle[], period: number, multiplier: number): BandSeries => {
    const upper = emptySeries(candles.length);
    const middle = emptySeries(candles.length);
    const lower = emptySeries(candles.length);
    let sum = 0;
    let squareSum = 0;
    candles.forEach((candle, index) => {
        sum += candle.close;
        squareSum += candle.close * candle.close;
        if (index >= period) {
            const leaving = candles[index - period].close;
            sum -= leaving;
            squareSum -= leaving * leaving;
        }
        if (index < period - 1) return;
        const mean = sum / period;
        const width = Math.sqrt(Math.max(0, squareSum / period - mean * mean)) * multiplier;
        upper[index] = mean + width;
        middle[index] = mean;
        lower[index] = mean - width;
    });
    return {upper, middle, lower};
};

export interface StochasticSeries {
    k: Series,  // %K: 구간 고저 안에서 종가의 위치(0~100)를 smoothK 로 평균한 값
    d: Series,  // %D: %K 의 이동평균
}

/** 스토캐스틱 (슬로우). 구간의 고가와 저가가 같으면 50 */
export const stochastic = (candles: Candle[], period: number, smoothK: number, smoothD: number): StochasticSeries => {
    const raw: Series = candles.map((candle, index) => {
        if (index < period - 1) return null;
        let highest = -Infinity;
        let lowest = Infinity;
        for (let offset = index - period + 1; offset <= index; offset++) {
            highest = Math.max(highest, candles[offset].high);
            lowest = Math.min(lowest, candles[offset].low);
        }
        return highest === lowest ? 50 : (candle.close - lowest) / (highest - lowest) * 100;
    });
    const k = simpleAverage(raw, smoothK);
    return {k, d: simpleAverage(k, smoothD)};
};

/** 거래량 단순 이동평균 */
export const volumeAverage = (candles: Candle[], period: number): Series =>
    simpleAverage(candles.map(candle => candle.volume), period);

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

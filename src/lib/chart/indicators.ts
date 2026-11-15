import {Candle} from "./types.ts";

/**
 * 캔들과 같은 순번의 지표 값. 아직 계산할 수 없는 앞부분은 null.
 * 앞으로 밀어 그리는 지표(일목균형표의 선행스팬)는 캔들보다 길어, 마지막 캔들 뒤의 순번까지 값이 있다.
 */
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

/**
 * 하이킨아시: 평균값으로 다시 만든 캔들. 잔 움직임이 줄어 추세가 매끄럽게 보인다.
 * 종가 = 시고저종 평균, 시가 = 앞 하이킨아시 캔들의 시가·종가 평균. 거래량과 시각은 그대로다.
 */
export const heikinAshi = (candles: Candle[]): Candle[] => {
    const result: Candle[] = [];
    candles.forEach((candle, index) => {
        const close = (candle.open + candle.high + candle.low + candle.close) / 4;
        const previous = result[index - 1];
        const open = previous ? (previous.open + previous.close) / 2 : (candle.open + candle.close) / 2;
        result.push({
            ...candle,
            open,
            close,
            high: Math.max(candle.high, open, close),
            low: Math.min(candle.low, open, close),
        });
    });
    return result;
};

/** 거래량 단순 이동평균 */
export const volumeAverage = (candles: Candle[], period: number): Series =>
    simpleAverage(candles.map(candle => candle.volume), period);

/** 종가 지수 이동평균. 최근 값에 더 큰 비중을 준다. 처음 period 개의 단순 평균에서 시작한다. */
export const exponentialMovingAverage = (candles: Candle[], period: number): Series =>
    exponentialAverage(candles.map(candle => candle.close), period);

export interface IchimokuSeries {
    conversion: Series,     // 전환선: 최근 conversionPeriod 개의 (최고가 + 최저가) / 2
    base: Series,           // 기준선: 최근 basePeriod 개의 (최고가 + 최저가) / 2
    spanA: Series,          // 선행스팬1: (전환선 + 기준선) / 2 를 shift 칸 앞으로. 캔들보다 shift 만큼 길다
    spanB: Series,          // 선행스팬2: 최근 spanPeriod 개의 (최고가 + 최저가) / 2 를 shift 칸 앞으로. 캔들보다 shift 만큼 길다
    lagging: Series,        // 후행스팬: 종가를 shift 칸 뒤로
    shift: number,          // 밀어 그리는 칸 수. 당일을 포함해 basePeriod 번째라 basePeriod - 1
}

/** 최근 period 개 캔들의 최고가와 최저가의 가운데 */
const midpoint = (candles: Candle[], period: number): Series => candles.map((_, index) => {
    if (index < period - 1) return null;
    let highest = -Infinity;
    let lowest = Infinity;
    for (let offset = index - period + 1; offset <= index; offset++) {
        highest = Math.max(highest, candles[offset].high);
        lowest = Math.min(lowest, candles[offset].low);
    }
    return (highest + lowest) / 2;
});

/** 일목균형표. 선행스팬은 마지막 캔들 뒤(미래 구간)까지 이어진다. */
export const ichimoku = (
    candles: Candle[], conversionPeriod: number, basePeriod: number, spanPeriod: number,
): IchimokuSeries => {
    const shift = basePeriod - 1;
    const conversion = midpoint(candles, conversionPeriod);
    const base = midpoint(candles, basePeriod);
    const longMiddle = midpoint(candles, spanPeriod);
    const spanA = emptySeries(candles.length + shift);
    const spanB = emptySeries(candles.length + shift);
    const lagging = emptySeries(candles.length);
    candles.forEach((candle, index) => {
        const conversionValue = conversion[index];
        const baseValue = base[index];
        if (conversionValue !== null && baseValue !== null) spanA[index + shift] = (conversionValue + baseValue) / 2;
        spanB[index + shift] = longMiddle[index];
        if (index >= shift) lagging[index - shift] = candle.close;
    });
    return {conversion, base, spanA, spanB, lagging, shift};
};

/**
 * VWAP(거래량 가중 평균가): 그날 처음부터의 (대표가 × 거래량) 합 / 거래량 합. 대표가 = (고가 + 저가 + 종가) / 3.
 * 날짜(브라우저 시간대)가 바뀌면 새로 시작한다. 하루가 캔들 여러 개로 나뉘는 분봉에서만 뜻이 있다.
 */
export const volumeWeightedAverage = (candles: Candle[]): Series => {
    let day = '';
    let amount = 0;
    let volume = 0;
    return candles.map(candle => {
        const candleDay = new Date(candle.time).toDateString();
        if (candleDay !== day) {
            day = candleDay;
            amount = 0;
            volume = 0;
        }
        amount += (candle.high + candle.low + candle.close) / 3 * candle.volume;
        volume += candle.volume;
        return volume > 0 ? amount / volume : null;
    });
};

/** OBV: 종가가 오른 캔들의 거래량은 더하고 내린 캔들의 거래량은 빼서 쌓은 값. 첫 캔들은 0 */
export const onBalanceVolume = (candles: Candle[]): Series => {
    let total = 0;
    return candles.map((candle, index) => {
        const previous = candles[index - 1];
        if (previous) total += Math.sign(candle.close - previous.close) * candle.volume;
        return total;
    });
};

/**
 * ATR(평균 변동 폭, 와일더 평활). 한 캔들의 변동 폭은 고가-저가, |고가-전 종가|, |저가-전 종가| 중 가장 큰 값이다.
 * 처음 period 개의 단순 평균에서 시작한다.
 */
export const averageTrueRange = (candles: Candle[], period: number): Series => {
    const result = emptySeries(candles.length);
    let average = 0;
    candles.forEach((candle, index) => {
        const previous = candles[index - 1];
        const range = previous
            ? Math.max(candle.high - candle.low, Math.abs(candle.high - previous.close), Math.abs(candle.low - previous.close))
            : candle.high - candle.low;
        if (index < period) {
            average += range / period;
            if (index < period - 1) return;
        } else {
            average = (average * (period - 1) + range) / period;
        }
        result[index] = average;
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

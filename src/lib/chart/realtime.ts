import {Candle, CandleInterval, Tick} from "./types.ts";

const MINUTE_MS = 60_000;

/** time 이 속한 캔들 기간의 시작 시각 (기기 현지 시각 기준) */
export const bucketStart = (time: number, interval: CandleInterval): number => {
    const date = new Date(time);
    switch (interval.unit) {
        case 'minute': {
            const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
            const size = interval.count * MINUTE_MS;
            return midnight + Math.floor((time - midnight) / size) * size;
        }
        case 'day':
            return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        case 'week': {
            // 월요일 시작
            const daysFromMonday = (date.getDay() + 6) % 7;
            return new Date(date.getFullYear(), date.getMonth(), date.getDate() - daysFromMonday).getTime();
        }
        case 'month':
            return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
        case 'year':
            return new Date(date.getFullYear(), 0, 1).getTime();
    }
};

/**
 * 체결 한 건을 캔들 목록에 반영한 새 목록을 돌려준다. (원본은 바꾸지 않는다)
 * - 마지막 캔들과 같은 기간이면 종가·고가·저가·거래량을 갱신한다.
 * - 더 뒤 기간이면 새 캔들을 붙인다.
 * - 마지막 캔들보다 앞 기간의 체결은 버린다.
 */
export const applyTick = (candles: Candle[], tick: Tick, interval: CandleInterval): Candle[] => {
    const bucket = bucketStart(tick.time, interval);
    const last = candles[candles.length - 1];
    const lastBucket = last ? bucketStart(last.time, interval) : -Infinity;

    if (bucket < lastBucket) return candles;

    if (last && bucket === lastBucket) {
        return [...candles.slice(0, -1), {
            ...last,
            high: Math.max(last.high, tick.price),
            low: Math.min(last.low, tick.price),
            close: tick.price,
            volume: last.volume + tick.volume,
        }];
    }

    return [...candles, {
        time: bucket,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        volume: tick.volume,
    }];
};

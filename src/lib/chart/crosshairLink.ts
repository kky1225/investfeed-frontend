import {Candle, CandleInterval} from "./types.ts";
import {bucketStart} from "./realtime.ts";

// 여러 차트의 십자선 연동(멀티 화면). 한 차트에서 가리킨 캔들의 기간을 알리면, 다른 차트는 그 기간에 맞는 자기 캔들을 가리킨다.
// - 분봉에서 가리키면 실제 시각(epoch ms)으로 맞춘다. 캔들 시각이 그 시장의 벽시계 시각이면(미국 종목) 차트마다 바꿔 준다.
// - 일봉 이상에서 가리키면 날짜로 맞춘다. 시장마다 하루가 시작하는 시각이 달라도(코인은 오전 9시) 같은 날짜끼리 맞춘다.

/** 십자선이 가리키는 자리. 엔진이 알리고 받는 값이다 */
export interface CrosshairPoint {
    time: number,           // 가리킨 캔들의 시각
    price: number | null,   // 가리킨 가격. 가격 영역 밖이면 null
}

/** 차트 하나가 알린 십자선. from~to 는 가리킨 캔들의 기간이다 */
export interface CrosshairLink {
    source: symbol,         // 알린 차트
    assetKey: string,       // 알린 차트의 자산. 같은 자산이면 가로선도 같은 가격에 긋는다
    kind: 'moment' | 'date',    // moment: 실제 시각(epoch ms), date: 브라우저 시간대의 날짜 경계
    from: number,
    to: number,
    price: number | null,
}

/** 캔들 시각(차트에 들어 있는 값)과 실제 시각 사이의 변환. 캔들 시각이 이미 실제 시각이면 주지 않는다 */
export interface MomentConversion {
    toMoment: (time: number) => number,
    fromMoment: (moment: number) => number,
}

/** 연동에 참여한 차트들 사이에서 십자선을 주고받는다. 화면 하나에 하나만 만든다 */
export class CrosshairSync {
    private current: CrosshairLink | null = null;
    private readonly listeners = new Set<(link: CrosshairLink | null) => void>();

    /** source 차트의 십자선을 알린다. null 이면 그 차트의 십자선이 사라진 것이고, 다른 차트가 알린 것은 지우지 않는다 */
    publish(source: symbol, link: CrosshairLink | null) {
        if (link === null && this.current?.source !== source) return;
        this.current = link;
        this.listeners.forEach(listener => listener(link));
    }

    subscribe(listener: (link: CrosshairLink | null) => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
}

/** 차트 한 개가 연동에 쓰는 통로. 차트 부품은 이것만 알고, 자산·주기에 따른 시각 맞추기는 만든 쪽이 맡는다 */
export interface ChartCrosshairLink {
    publish: (point: CrosshairPoint | null) => void,     // 이 차트의 십자선이 바뀌면 부른다
    subscribe: (show: (point: CrosshairPoint | null) => void) => () => void,   // 다른 차트의 십자선을 이 차트 기준으로 받는다
}

/** 연동할 때 쓰는 차트의 지금 상태. 캔들·주기가 바뀌어도 통로를 새로 만들지 않도록 부를 때마다 읽는다 */
export interface LinkTarget {
    candles: Candle[],
    interval: CandleInterval,
    assetKey: string,
    conversion?: MomentConversion,
}

/** sync 에 참여하는 차트 하나의 통로를 만든다 */
export const createChartLink = (sync: CrosshairSync, target: () => LinkTarget): ChartCrosshairLink => {
    const source = Symbol('chart');
    return {
        publish: point => {
            const current = target();
            sync.publish(source, point && linkOf(source, current.assetKey, point, current.interval, current.conversion));
        },
        subscribe: show => sync.subscribe(link => {
            if (!link || link.source === source) {
                show(null);
                return;
            }
            const current = target();
            const time = linkedCandleTime(current.candles, current.interval, link, current.conversion);
            // 가로선은 같은 자산일 때만 같은 가격에 긋는다.
            show(time === null ? null : {time, price: link.assetKey === current.assetKey ? link.price : null});
        }),
    };
};

/** 기간 start(bucketStart 로 맞춘 값)가 끝나는 시각. 일봉 이상은 다음 날·주·달·해의 시작이다 */
export const periodEnd = (start: number, interval: CandleInterval): number => {
    const date = new Date(start);
    switch (interval.unit) {
        case 'minute':
            return start + interval.count * 60_000;
        case 'day':
            return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
        case 'week':
            return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7).getTime();
        case 'month':
            return new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
        case 'year':
            return new Date(date.getFullYear() + 1, 0, 1).getTime();
    }
};

/** 차트에서 가리킨 캔들을 다른 차트에 알릴 값으로 바꾼다 */
export const linkOf = (
    source: symbol, assetKey: string, point: CrosshairPoint, interval: CandleInterval, conversion?: MomentConversion,
): CrosshairLink => {
    const start = bucketStart(point.time, interval);
    const end = periodEnd(start, interval);
    if (interval.unit !== 'minute') return {source, assetKey, kind: 'date', from: start, to: end, price: point.price};
    const toMoment = conversion?.toMoment ?? ((time: number) => time);
    return {source, assetKey, kind: 'moment', from: toMoment(start), to: toMoment(end), price: point.price};
};

/**
 * 다른 차트가 알린 기간에 맞는 이 차트의 캔들 시각. 맞는 캔들이 없으면(장이 쉬는 시각 등) null.
 * 기간 안에서 시작하는 캔들이 있으면 그 첫 캔들(이 차트가 더 잘게 나뉜 주기), 없으면 기간의 시작을 담은 캔들이다.
 */
export const linkedCandleTime = (
    candles: Candle[], interval: CandleInterval, link: CrosshairLink, conversion?: MomentConversion,
): number | null => {
    if (candles.length === 0) return null;
    const fromMoment = link.kind === 'moment' && conversion ? conversion.fromMoment : (time: number) => time;
    const from = fromMoment(link.from);
    const to = fromMoment(link.to);
    const startOf = (index: number) => bucketStart(candles[index].time, interval);
    // 기간이 from 이상인 첫 캔들
    let low = 0;
    let high = candles.length;
    while (low < high) {
        const middle = (low + high) >> 1;
        if (startOf(middle) < from) low = middle + 1;
        else high = middle;
    }
    if (low < candles.length && startOf(low) < to) return candles[low].time;
    const before = low - 1;
    if (before >= 0 && periodEnd(startOf(before), interval) > from) return candles[before].time;
    return null;
};

// 시간대별 날짜·시각 읽기. 만들기가 무거워 시간대마다 하나만 만든다.
const formatters = new Map<string, Intl.DateTimeFormat>();

const wallClockOf = (moment: number, timeZone: string): number[] => {
    let formatter = formatters.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone, hourCycle: 'h23',
            year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
        });
        formatters.set(timeZone, formatter);
    }
    const parts = formatter.formatToParts(moment);
    const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value ?? 0);
    return [value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second')];
};

/** 그 시각에 timeZone 이 UTC 보다 몇 ms 앞서는지 (서머타임 반영) */
const offsetOf = (moment: number, timeZone: string): number => {
    const [year, month, day, hour, minute, second] = wallClockOf(moment, timeZone);
    return Date.UTC(year, month, day, hour, minute, second) - Math.floor(moment / 1000) * 1000;
};

/**
 * 캔들 시각이 timeZone 의 벽시계 시각을 브라우저 시간대로 읽은 값일 때(미국 종목은 미국 동부 시각)의 변환.
 * 서머타임이 바뀌는 날의 없는 시각·겹치는 시각은 바뀌기 전의 오프셋으로 본다.
 */
export const wallClockConversion = (timeZone: string): MomentConversion => ({
    toMoment: time => {
        const local = new Date(time);
        const asUtc = Date.UTC(
            local.getFullYear(), local.getMonth(), local.getDate(), local.getHours(), local.getMinutes(), local.getSeconds(),
            local.getMilliseconds(),
        );
        const guess = asUtc - offsetOf(asUtc, timeZone);
        return asUtc - offsetOf(guess, timeZone);
    },
    fromMoment: moment => {
        const [year, month, day, hour, minute, second] = wallClockOf(moment, timeZone);
        return new Date(year, month, day, hour, minute, second, moment % 1000).getTime();
    },
});

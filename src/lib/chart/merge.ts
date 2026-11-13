import {Candle} from "./types.ts";

/**
 * 과거 구간(older)과 최근 구간(newer)을 하나로 잇는다. 둘 다 오래된 순.
 * 겹치는 구간은 newer 를 쓴다(최근 구간이 실시간으로 갱신되는 쪽이기 때문).
 */
export const mergeCandles = (older: Candle[], newer: Candle[]): Candle[] => {
    if (older.length === 0) return newer;
    if (newer.length === 0) return older;
    const firstNewer = newer[0].time;
    let count = 0;
    while (count < older.length && older[count].time < firstNewer) count++;
    return count === 0 ? newer : [...older.slice(0, count), ...newer];
};

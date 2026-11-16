import {Candle} from "./types.ts";
import {Series} from "./indicators.ts";
import {isNumber, VisibleRange} from "./layout.ts";

// 종목 비교: 다른 종목의 종가를 주 종목의 캔들 자리에 맞추고, 등락률이 같은 높이에 오도록 주 종목의 가격으로 바꾼다.

/**
 * 비교 종목의 종가를 주 종목의 캔들 순번에 맞춘다.
 * 같은 시각의 캔들이 없으면(거래가 없던 날, 아직 다시 받지 않은 최근 캔들) 바로 앞 캔들의 종가를 쓴다.
 * 비교 종목의 첫 캔들보다 앞선 자리는 null 이다(상장 전이거나 아직 받지 않은 과거).
 */
export const alignCloses = (main: Candle[], other: Candle[]): Series => {
    let next = 0;   // other 에서 아직 지나지 않은 첫 캔들
    return main.map(candle => {
        while (next < other.length && other[next].time <= candle.time) next++;
        return next > 0 ? other[next - 1].close : null;
    });
};

/** 화면에 그릴 비교 선 하나 */
export interface ComparisonLine {
    values: Series,         // 주 종목의 가격으로 바꾼 값. 그리지 않는 자리는 null
    base: number | null,    // 0% 로 삼은 비교 종목의 종가. 보이는 구간에 값이 없으면 null
    last: number | null,    // 보이는 구간의 마지막 값 (가격축 라벨의 자리)
}

/**
 * 보이는 구간에서 비교 종목의 첫 종가를 0% 로 놓고, 그 뒤의 등락률을 주 종목의 가격으로 바꾼다.
 * anchorPrice: 주 종목의 0% 가격(보이는 첫 캔들의 종가). 비교 종목이 5% 올랐으면 anchorPrice 의 1.05 배 자리에 놓인다.
 */
export const scaleComparison = (closes: Series, range: VisibleRange, anchorPrice: number): ComparisonLine => {
    const end = Math.min(closes.length, range.from + range.count);
    let baseIndex = range.from;
    while (baseIndex < end && !(isNumber(closes[baseIndex]) && closes[baseIndex]! > 0)) baseIndex++;
    const empty: ComparisonLine = {values: [], base: null, last: null};
    if (baseIndex >= end || anchorPrice <= 0) return empty;

    const base = closes[baseIndex]!;
    const values: Series = new Array(closes.length).fill(null);
    let last: number | null = null;
    // 선이 오른쪽 가장자리에서 끊겨 보이지 않게 한 칸 더 잡는다.
    const drawEnd = Math.min(closes.length, end + 1);
    for (let index = baseIndex; index < drawEnd; index++) {
        const close = closes[index];
        if (!isNumber(close)) continue;
        values[index] = anchorPrice * close / base;
        if (index < end) last = values[index];
    }
    return {values, base, last};
};

/** index 번째 캔들에서 비교 종목의 등락률(%). 값이 없으면 null */
export const comparisonPercent = (closes: Series, base: number | null, index: number): number | null => {
    const close = closes[index];
    return base !== null && isNumber(close) ? (close / base - 1) * 100 : null;
};

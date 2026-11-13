import {TimeUnit} from "./types.ts";

/** 값 → 세로 위치. min 이 bottom, max 가 top 에 놓인다. */
export const createLinearScale = (min: number, max: number, top: number, bottom: number) => {
    const range = max - min || 1;
    return (value: number) => bottom - ((value - min) / range) * (bottom - top);
};

/** 세로 위치 → 값. createLinearScale 의 반대 방향. */
export const createInverseScale = (min: number, max: number, top: number, bottom: number) => {
    const span = bottom - top || 1;
    return (y: number) => min + ((bottom - y) / span) * (max - min);
};

export interface Ticks {
    values: number[],
    decimals: number,   // 눈금 간격에 맞는 소수 자릿수
}

/** min~max 안에서 1·2·5 배수 간격의 보기 좋은 눈금을 최대 maxCount 개 안팎으로 만든다. */
export const niceTicks = (min: number, max: number, maxCount: number): Ticks => {
    const range = max - min;
    if (!(range > 0) || maxCount < 1) return {values: [], decimals: 0};

    // 1·2·5·10 배수 가운데, 눈금 수가 maxCount 를 넘지 않는 가장 촘촘한 간격을 고른다.
    // (범위 ÷ maxCount 를 올림하면 5 를 조금 넘는 값이 10 으로 뛰어 눈금이 절반으로 줄어든다.)
    const magnitude = 10 ** Math.floor(Math.log10(range / maxCount));
    const countOf = (candidate: number) => Math.floor(max / candidate) - Math.ceil(min / candidate) + 1;
    const step = [1, 2, 5, 10].map(multiple => multiple * magnitude).find(candidate => countOf(candidate) <= maxCount)
        ?? magnitude * 10;
    const decimals = Math.max(0, -Math.floor(Math.log10(step)));

    const first = Math.ceil(min / step);
    const last = Math.floor(max / step);
    const values: number[] = [];
    for (let n = first; n <= last; n++) {
        values.push(Number((n * step).toFixed(decimals)));
    }
    return {values, decimals};
};

const pad2 = (value: number) => String(value).padStart(2, '0');

/** withDate: 분봉에서 시각 앞에 월.일을 붙인다 (여러 날에 걸친 분봉에서 날짜가 바뀌는 자리, 십자선 라벨) */
export const formatTime = (time: number, unit: TimeUnit, withDate = false): string => {
    const date = new Date(time);
    const year = date.getFullYear();
    const month = pad2(date.getMonth() + 1);
    switch (unit) {
        case 'minute': {
            const clock = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
            return withDate ? `${month}.${pad2(date.getDate())} ${clock}` : clock;
        }
        case 'day':
            return `${year}.${month}.${pad2(date.getDate())}`;
        case 'month':
            return `${year}.${month}`;
        case 'year':
            return `${year}`;
    }
};

const compactFormatter = new Intl.NumberFormat('ko-KR', {notation: 'compact', maximumFractionDigits: 1});

export const formatVolume = (value: number): string => compactFormatter.format(value);

export const formatPrice = (value: number, decimals: number): string =>
    value.toLocaleString('ko-KR', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});

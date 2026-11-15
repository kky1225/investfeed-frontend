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

// 로그 축: 같은 비율(등락률)이 같은 높이를 차지한다. 0 이하의 값은 축 아래로 한참 벗어난 자리로 보낸다.
const safeLog = (value: number) => Math.log(Math.max(value, Number.MIN_VALUE));

/** 값 → 세로 위치 (로그 축). min, max 는 0 보다 커야 한다. */
export const createLogScale = (min: number, max: number, top: number, bottom: number) => {
    const low = safeLog(min);
    const range = safeLog(max) - low || 1;
    return (value: number) => bottom - ((safeLog(value) - low) / range) * (bottom - top);
};

/** 세로 위치 → 값 (로그 축). createLogScale 의 반대 방향. */
export const createInverseLogScale = (min: number, max: number, top: number, bottom: number) => {
    const low = safeLog(min);
    const range = safeLog(max) - low;
    const span = bottom - top || 1;
    return (y: number) => Math.exp(low + ((bottom - y) / span) * range);
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

const LOG_TICK_MULTIPLES = [1, 2, 3, 5];
const MIN_LOG_TICKS = 3;

/**
 * 로그 축의 눈금 후보: min~max 안의 1·2·3·5 × 10ⁿ. 자리가 좁아 겹치는 것은 그리는 쪽에서 거른다.
 * 범위가 좁아 후보가 몇 개 안 나오면(한 자릿수 안에서 움직이는 경우) 일정 간격 눈금으로 대신한다.
 */
export const logTicks = (min: number, max: number, maxCount: number): Ticks => {
    if (!(min > 0) || !(max > min)) return {values: [], decimals: 0};
    const values: number[] = [];
    for (let exponent = Math.floor(Math.log10(min)); exponent <= Math.ceil(Math.log10(max)); exponent++) {
        LOG_TICK_MULTIPLES.forEach(multiple => {
            const decimals = Math.max(0, -exponent);
            const value = Number((multiple * 10 ** exponent).toFixed(decimals));
            if (value >= min && value <= max) values.push(value);
        });
    }
    if (values.length < MIN_LOG_TICKS) return niceTicks(min, max, maxCount);
    return {values, decimals: Math.max(0, -Math.floor(Math.log10(values[0])))};
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

const MAX_PRICE_DECIMALS = 8;

/** 값을 그대로 적는 데 필요한 소수 자릿수 (최대 8). 정수면 0 */
export const decimalsOf = (value: number): number => {
    for (let decimals = 0; decimals < MAX_PRICE_DECIMALS; decimals++) {
        const scaled = value * 10 ** decimals;
        if (Math.abs(scaled - Math.round(scaled)) < 1e-7) return decimals;
    }
    return MAX_PRICE_DECIMALS;
};

const compactFormatter = new Intl.NumberFormat('ko-KR', {notation: 'compact', maximumFractionDigits: 1});

export const formatVolume = (value: number): string => compactFormatter.format(value);

export const formatPrice = (value: number, decimals: number): string =>
    value.toLocaleString('ko-KR', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});

/** 등락률 표기. 0 보다 크면 + 를 붙인다 (예: +1.25%, -0.50%, 0.00%) */
export const formatPercent = (value: number, decimals: number): string => {
    const text = value.toLocaleString('ko-KR', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
    // 반올림해서 0 이 된 음수(-0.00)는 부호 없이 적는다.
    const zero = Number(value.toFixed(decimals)) === 0;
    return `${zero ? text.replace('-', '') : value > 0 ? `+${text}` : text}%`;
};

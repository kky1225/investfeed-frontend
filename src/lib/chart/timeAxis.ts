import {Candle, TimeUnit} from "./types.ts";
import {VisibleRange} from "./layout.ts";

// 날짜 눈금이 놓일 자리. 캔들 몇 개마다가 아니라 달력의 경계(날·달·분기·해가 바뀌는 첫 캔들)에 놓는다.
// 날짜는 브라우저 시간대로 본다.

/** 날짜 눈금 하나 */
export interface TimeTick {
    index: number,  // 전체 캔들 기준 순번
    label: string,
    rank: number,   // 경계의 크기. 클수록 큰 경계(해 > 분기 > 달). 0 은 경계 사이를 채우는 눈금
}

/**
 * 주기별 경계의 크기. 캔들이 앞 캔들과 어느 단위에서 달라졌는지로 정한다.
 * 분봉: 4 날 / 3 시 / 2 30분 / 1 10분, 일봉·주봉: 3 해 / 2 분기 / 1 달, 월봉: 2 해 / 1 분기, 연봉: 없음
 */
const TOP_RANK: Record<TimeUnit, number> = {minute: 4, day: 3, month: 2, year: 0};

const HOUR_STEPS = [2, 3, 4, 6, 12];    // 분봉에서 시 눈금을 솎을 때의 간격(시간)

const pad2 = (value: number) => String(value).padStart(2, '0');

const rankOf = (unit: TimeUnit, previous: Date, current: Date): number => {
    const yearChanged = previous.getFullYear() !== current.getFullYear();
    const monthChanged = yearChanged || previous.getMonth() !== current.getMonth();
    const quarterChanged = yearChanged || Math.floor(previous.getMonth() / 3) !== Math.floor(current.getMonth() / 3);
    switch (unit) {
        case 'minute': {
            const dayChanged = monthChanged || previous.getDate() !== current.getDate();
            if (dayChanged) return 4;
            if (previous.getHours() !== current.getHours()) return 3;
            if (Math.floor(previous.getMinutes() / 30) !== Math.floor(current.getMinutes() / 30)) return 2;
            return Math.floor(previous.getMinutes() / 10) !== Math.floor(current.getMinutes() / 10) ? 1 : 0;
        }
        case 'day':
            return yearChanged ? 3 : quarterChanged ? 2 : monthChanged ? 1 : 0;
        case 'month':
            return yearChanged ? 2 : quarterChanged ? 1 : 0;
        case 'year':
            return 0;
    }
};

/** 경계 눈금의 글자. 가장 큰 경계는 해(분봉은 날짜)를 적고, 그 아래는 달(분봉은 시각)을 적는다. */
const boundaryLabel = (unit: TimeUnit, rank: number, date: Date): string => {
    if (unit === 'minute') {
        return rank === TOP_RANK.minute
            ? `${pad2(date.getMonth() + 1)}.${pad2(date.getDate())}`
            : `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    }
    return rank === TOP_RANK[unit] ? String(date.getFullYear()) : `${date.getMonth() + 1}월`;
};

/** 경계 사이를 채우는 눈금의 글자 */
const fillerLabel = (unit: TimeUnit, date: Date): string => {
    switch (unit) {
        case 'minute':
            return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
        case 'day':
            return String(date.getDate());
        case 'month':
            return `${date.getMonth() + 1}월`;
        case 'year':
            return String(date.getFullYear());
    }
};

/** 가장 큰 경계가 너무 촘촘할 때 몇 개에 하나만 남기기 위한 번호: 해, 또는 날짜의 일련번호 */
const serialOf = (unit: TimeUnit, date: Date): number => unit === 'minute'
    ? Math.round(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86_400_000)
    : date.getFullYear();

interface RankTable {
    unit: TimeUnit,
    ranks: Uint8Array,      // 캔들마다의 경계 크기
    counts: number[],       // counts[rank]: 경계 크기가 rank 이상인 캔들의 수
}

// 캔들 배열마다 한 번만 계산해 둔다. 화면을 움직이는 동안에는 같은 배열이라 다시 계산하지 않는다.
const tables = new WeakMap<Candle[], RankTable>();

const tableOf = (candles: Candle[], unit: TimeUnit): RankTable => {
    const cached = tables.get(candles);
    if (cached && cached.unit === unit) return cached;
    const ranks = new Uint8Array(candles.length);
    const counts = new Array<number>(TOP_RANK[unit] + 1).fill(0);
    let previous = candles.length > 0 ? new Date(candles[0].time) : null;
    for (let index = 1; index < candles.length; index++) {
        const current = new Date(candles[index].time);
        const rank = previous ? rankOf(unit, previous, current) : 0;
        ranks[index] = rank;
        for (let level = 1; level <= rank; level++) counts[level]++;
        previous = current;
    }
    const table = {unit, ranks, counts};
    tables.set(candles, table);
    return table;
};

/**
 * 보이는 구간의 날짜 눈금. minGap 은 눈금 사이의 최소 간격(CSS px).
 * 어느 크기의 경계까지 쓸지는 받아 둔 캔들 전체의 평균 간격으로 정해서, 화면을 움직여도 눈금이 바뀌지 않는다.
 * 가장 작은 경계도 듬성듬성하면(확대했을 때) 그 사이를 일정 간격의 눈금으로 채운다.
 */
export const timeTicks = (candles: Candle[], range: VisibleRange, unit: TimeUnit, minGap: number): TimeTick[] => {
    const {ranks, counts} = tableOf(candles, unit);
    const top = TOP_RANK[unit];
    const step = Math.max(1, Math.ceil(minGap / range.spacing));    // 눈금 사이에 있어야 하는 캔들 수
    // 경계 크기가 rank 이상인 눈금들의 평균 간격(캔들 수)
    const intervalOf = (rank: number) => counts[rank] > 0 ? candles.length / counts[rank] : Infinity;

    // 간격이 충분한 가장 작은 경계를 고른다. 가장 큰 경계도 촘촘하면 몇 개에 하나만 남긴다.
    let chosen = 1;
    while (chosen < top && intervalOf(chosen) < step) chosen++;
    const skip = top > 0 && intervalOf(top) < step ? Math.ceil(step / intervalOf(top)) : 1;
    // 가장 작은 경계를 골랐는데도 간격이 넓으면 사이를 채운다. 경계가 없는 주기(연봉)는 채우는 눈금만 쓴다.
    const fill = top === 0 || (chosen === 1 && intervalOf(1) >= step * 2);

    // 분봉은 시와 날 사이가 멀다(하루가 24시간인 코인은 더). 날만 남기면 눈금이 너무 드물어지므로,
    // 그럴 때는 몇 시간에 하나씩(2·3·4·6·12시간, 정시 기준) 시 눈금을 함께 둔다.
    const hourRank = TOP_RANK.minute - 1;
    const hourEvery = unit === 'minute' && chosen === top && skip === 1 && intervalOf(top) >= step * 2
        ? HOUR_STEPS.find(hours => intervalOf(hourRank) * hours >= step) ?? 0
        : 0;

    const ticks: TimeTick[] = [];
    const end = range.from + range.count;
    const boundaries = new Set<number>();
    if (top > 0) {
        for (let index = range.from; index < end; index++) {
            const rank = ranks[index];
            if (rank === 0) continue;
            const date = new Date(candles[index].time);
            if (rank < chosen && !(hourEvery > 0 && rank === hourRank && date.getHours() % hourEvery === 0)) continue;
            if (skip > 1 && (rank < top || serialOf(unit, date) % skip !== 0)) continue;
            boundaries.add(index);
            ticks.push({index, label: boundaryLabel(unit, rank, date), rank});
        }
    }
    if (fill) {
        // 경계 눈금에 너무 붙는 자리는 건너뛴다.
        const clearance = Math.ceil(step / 2);
        for (let index = Math.ceil(range.from / step) * step; index < end; index += step) {
            let crowded = false;
            for (let offset = -clearance; offset <= clearance && !crowded; offset++) crowded = boundaries.has(index + offset);
            if (!crowded) ticks.push({index, label: fillerLabel(unit, new Date(candles[index].time)), rank: 0});
        }
    }
    return ticks;
};

import {Candle, TimeUnit} from "./types.ts";

// 마지막 캔들 뒤(미래 구간)의 칸이 어느 시각인지 어림한다. 십자선·수직선의 시각 라벨과, 미래 구간에 그린 점의 자리 찾기에 쓴다.
// 시장 정보를 따로 받지 않고 받아 둔 캔들에서 읽어 낸다.
// - 주말에 캔들이 있었으면 주말에도 열리는 시장(코인), 없었으면 주말을 건너뛴다.
// - 분봉은 날마다 첫 캔들과 마지막 캔들의 시각에서 장 시작·끝을 읽고, 장이 끝나면 다음 날 장 시작으로 넘어간다.
// 공휴일은 알 수 없어 평일로 본다.

const SAMPLE_SIZE = 400;        // 규칙을 읽어 낼 최근 캔들 수
const MINUTE_SAMPLE_SIZE = 2000;    // 분봉은 이틀 이상이 들어가야 장 시작을 읽을 수 있어 더 많이 본다 (1분봉 코인도 하루가 넘는 수)
const MULTI_DAY_GAP_MS = 3 * 24 * 60 * 60 * 1000;   // 캔들 간격이 이보다 길면 주봉
const DAY_MINUTES = 24 * 60;
const MINUTE_MS = 60_000;
// 미래 구간에서 한 칸씩 시각을 구하는 칸 수의 상한. 이보다 먼 칸은 마지막 몇 칸의 평균 간격으로 늘려 계산한다
// (분봉에서 몇 달 뒤 날짜를 볼 때 등). 캔들이 바뀔 때마다 다시 구하므로 크게 잡지 않는다
const MAX_FUTURE_STEPS = 5_000;
const AVERAGE_SPAN_STEPS = 1_000;   // 상한 너머를 늘릴 때 평균 간격을 잴 칸 수 (장이 쉬는 시간이 고르게 섞이도록 넉넉히)

/** 마지막 캔들 뒤의 칸과 시각 사이의 변환. 캔들이 2개보다 적어 어림할 수 없으면 둘 다 null */
export interface FutureTimeline {
    /** 마지막 캔들에서 steps 칸 뒤(1 이상)의 캔들 시각 */
    timeAt: (steps: number) => number | null,
    /**
     * 시각 time 이 마지막 캔들에서 몇 칸 뒤인지. 그 시각을 담은 칸(시작 시각이 time 이하인 마지막 칸)이고,
     * 그 칸이 다른 날이면 같은 날의 첫 칸(장이 쉬는 0시 등을 다음 장 시작에 둔다). 첫 칸보다 앞이면 0(마지막 캔들).
     * timeAt 과 서로 반대라, timeAt 으로 구한 시각은 같은 칸으로 돌아온다
     */
    stepsAt: (time: number) => number | null,
}

const minuteOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();
const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;
const dayKey = (date: Date) => date.getFullYear() * 10_000 + date.getMonth() * 100 + date.getDate();

/** 캔들 간격의 중간값 (ms) */
const medianGap = (candles: Candle[]): number => {
    const gaps = candles.slice(1).map((candle, order) => candle.time - candles[order].time).sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)];
};

/** date 다음 날(주말에 쉬는 시장이면 다음 평일)의 0시 */
const nextTradingDay = (date: Date, weekendOpen: boolean): Date => {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    while (!weekendOpen && isWeekend(next)) next.setDate(next.getDate() + 1);
    return next;
};

/** 한 칸의 시각에서 다음 칸의 시각을 구하는 함수 */
type Step = (date: Date) => Date;

/**
 * candles 로 미래 구간의 칸과 시각 사이 변환을 만든다. 구한 시각은 모아 두고 다시 쓴다.
 * 캔들의 시각 구성(개수·마지막 시각·주기)이 바뀌면 다시 만든다
 */
export const createFutureTimeline = (candles: Candle[], timeUnit: TimeUnit): FutureTimeline => {
    if (candles.length < 2) return {timeAt: () => null, stepsAt: () => null};
    const step = stepOf(candles, timeUnit);
    const times: number[] = [];     // times[n] = 마지막 캔들에서 n+1 칸 뒤의 시각
    const lastTime = candles[candles.length - 1].time;
    let date = new Date(lastTime);
    const extendTo = (count: number) => {
        while (times.length < Math.min(count, MAX_FUTURE_STEPS)) {
            date = step(date);
            times.push(date.getTime());
        }
    };
    // 상한 너머의 한 칸 길이: 상한 앞 칸들의 평균 간격
    const averageGap = () => {
        extendTo(MAX_FUTURE_STEPS);
        const from = times[MAX_FUTURE_STEPS - 1 - AVERAGE_SPAN_STEPS];
        return (times[MAX_FUTURE_STEPS - 1] - from) / AVERAGE_SPAN_STEPS;
    };
    return {
        timeAt: steps => {
            if (steps < 1) return null;
            if (steps > MAX_FUTURE_STEPS) return Math.round(times[MAX_FUTURE_STEPS - 1] + (steps - MAX_FUTURE_STEPS) * averageGap());
            extendTo(steps);
            return times[steps - 1];
        },
        stepsAt: time => {
            // time 보다 늦은 칸이 나올 때까지 늘린다.
            while (times.length < MAX_FUTURE_STEPS && (times.length === 0 || times[times.length - 1] <= time)) {
                extendTo(times.length + 1);
            }
            if (times.length === MAX_FUTURE_STEPS && time >= times[MAX_FUTURE_STEPS - 1]) {
                return MAX_FUTURE_STEPS + Math.floor((time - times[MAX_FUTURE_STEPS - 1]) / averageGap() + 1e-9);
            }
            // 시작 시각이 time 이하인 칸의 수
            let low = 0;
            let high = times.length;
            while (low < high) {
                const middle = (low + high) >> 1;
                if (times[middle] <= time) low = middle + 1;
                else high = middle;
            }
            // 그 칸이 다른 날이고 다음 칸이 time 과 같은 날이면 다음 칸으로 한다. 일봉에서 그은 월요일 0시 선이 분봉에서
            // 금요일 마지막 캔들이 아니라 월요일 첫 캔들에 놓이게 한다.
            const before = low === 0 ? lastTime : times[low - 1];
            const sameDay = (other: number) => dayKey(new Date(other)) === dayKey(new Date(time));
            if (low < times.length && !sameDay(before) && sameDay(times[low])) return low + 1;
            return low;
        },
    };
};

const stepOf = (candles: Candle[], timeUnit: TimeUnit): Step => {
    const recent = candles.slice(-SAMPLE_SIZE);
    switch (timeUnit) {
        case 'year':
            return date => new Date(date.getFullYear() + 1, 0, 1);
        case 'month':
            return date => new Date(date.getFullYear(), date.getMonth() + 1, 1);
        case 'day': {
            if (medianGap(recent) > MULTI_DAY_GAP_MS) {
                // 주봉: 한 주씩
                return date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
            }
            const weekendOpen = recent.some(candle => isWeekend(new Date(candle.time)));
            return date => nextTradingDay(date, weekendOpen);
        }
        case 'minute':
            return minuteStep(candles.slice(-MINUTE_SAMPLE_SIZE));
    }
};

/** 분봉: 캔들 간격씩 나아가고, 장 마지막 캔들 뒤면 다음 거래일의 장 시작으로 넘어간다 */
const minuteStep = (recent: Candle[]): Step => {
    const step = Math.max(1, Math.round(medianGap(recent) / MINUTE_MS));
    const last = new Date(recent[recent.length - 1].time);

    // 날마다 첫 캔들과 마지막 캔들의 시각(하루 중 몇 분째). 가장 이른 시작과 가장 늦은 끝을 장 시간으로 본다.
    // 쉬는 시간 없이 하루 내내 열리는 시장(코인)은 0시~자정 직전이 되어, 날짜가 바뀔 때만 다음 날 0시로 넘어간다.
    // 최근 캔들만 보므로 맨 앞 날은 중간부터 잘려 있을 수 있다. 다른 날이 있으면 그날의 첫 캔들은 장 시작으로 보지 않는다.
    const firstDay = dayKey(new Date(recent[0].time));
    const singleDay = dayKey(last) === firstDay;
    let open = DAY_MINUTES;
    let close = 0;
    let previousDay: number | null = null;
    recent.forEach(candle => {
        const date = new Date(candle.time);
        const minute = minuteOfDay(date);
        const day = dayKey(date);
        if (day !== previousDay && (singleDay || day !== firstDay)) open = Math.min(open, minute);
        close = Math.max(close, minute);
        previousDay = day;
    });
    // 하루 내내 열리는 시장(0시부터 자정 직전까지 캔들이 있음)은 주말에도 연다. 분봉은 며칠치만 보므로 주말 캔들이
    // 받아 둔 범위에 없을 수 있어(평일 저녁의 1분봉 코인) 캔들로만 판단하지 않는다.
    const allDay = open === 0 && close >= DAY_MINUTES - step;
    const weekendOpen = allDay || recent.some(candle => isWeekend(new Date(candle.time)));
    // 하루치뿐이면 마지막 캔들이 장 끝인지 알 수 없어(장중일 수 있음) 날짜가 바뀔 때만 다음 날로 넘어간다.
    const closeKnown = !singleDay;

    return date => {
        const next = new Date(date.getTime() + step * MINUTE_MS);
        // 장 마지막 캔들을 넘었거나 날짜가 바뀌면 다음 거래일의 장 시작
        if ((closeKnown && minuteOfDay(next) > close) || dayKey(next) !== dayKey(date)) {
            const day = nextTradingDay(date, weekendOpen);
            return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(open / 60), open % 60);
        }
        return next;
    };
};

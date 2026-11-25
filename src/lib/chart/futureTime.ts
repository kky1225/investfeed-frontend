import {Candle, TimeUnit} from "./types.ts";

// 마지막 캔들 뒤(미래 구간)의 칸이 어느 시각인지 어림한다. 십자선의 아래 시각 라벨에 쓴다.
// 시장 정보를 따로 받지 않고 받아 둔 캔들에서 읽어 낸다.
// - 주말에 캔들이 있었으면 주말에도 열리는 시장(코인), 없었으면 주말을 건너뛴다.
// - 분봉은 날마다 첫 캔들과 마지막 캔들의 시각에서 장 시작·끝을 읽고, 장이 끝나면 다음 날 장 시작으로 넘어간다.
// 공휴일은 알 수 없어 평일로 본다.

const SAMPLE_SIZE = 400;        // 규칙을 읽어 낼 최근 캔들 수
const MINUTE_SAMPLE_SIZE = 2000;    // 분봉은 이틀 이상이 들어가야 장 시작을 읽을 수 있어 더 많이 본다 (1분봉 코인도 하루가 넘는 수)
const MULTI_DAY_GAP_MS = 3 * 24 * 60 * 60 * 1000;   // 캔들 간격이 이보다 길면 주봉
const DAY_MINUTES = 24 * 60;
const MINUTE_MS = 60_000;

/** 마지막 캔들에서 steps 칸 뒤(1 이상)의 캔들 시각. 캔들이 2개보다 적어 어림할 수 없으면 null */
export type FutureClock = (steps: number) => number | null;

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

/** candles 로 미래 구간의 시각을 어림하는 함수를 만든다. 캔들이 바뀌면 다시 만든다 */
export const createFutureClock = (candles: Candle[], timeUnit: TimeUnit): FutureClock => {
    if (candles.length < 2) return () => null;
    const recent = candles.slice(-SAMPLE_SIZE);
    const last = new Date(candles[candles.length - 1].time);

    switch (timeUnit) {
        case 'year':
            return steps => new Date(last.getFullYear() + steps, 0, 1).getTime();
        case 'month':
            return steps => new Date(last.getFullYear(), last.getMonth() + steps, 1).getTime();
        case 'day': {
            if (medianGap(recent) > MULTI_DAY_GAP_MS) {
                // 주봉: 한 주씩
                return steps => new Date(last.getFullYear(), last.getMonth(), last.getDate() + steps * 7).getTime();
            }
            const weekendOpen = recent.some(candle => isWeekend(new Date(candle.time)));
            return steps => {
                let date = last;
                for (let step = 0; step < steps; step++) date = nextTradingDay(date, weekendOpen);
                return date.getTime();
            };
        }
        case 'minute':
            return minuteClock(candles.slice(-MINUTE_SAMPLE_SIZE), last);
    }
};

/** 분봉: 캔들 간격씩 나아가고, 장 마지막 캔들 뒤면 다음 거래일의 장 시작으로 넘어간다 */
const minuteClock = (recent: Candle[], last: Date): FutureClock => {
    const step = Math.max(1, Math.round(medianGap(recent) / MINUTE_MS));

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

    return steps => {
        let date = last;
        for (let count = 0; count < steps; count++) {
            const next = new Date(date.getTime() + step * MINUTE_MS);
            // 장 마지막 캔들을 넘었거나 날짜가 바뀌면 다음 거래일의 장 시작
            if ((closeKnown && minuteOfDay(next) > close) || dayKey(next) !== dayKey(date)) {
                const day = nextTradingDay(date, weekendOpen);
                date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(open / 60), open % 60);
            } else {
                date = next;
            }
        }
        return date.getTime();
    };
};

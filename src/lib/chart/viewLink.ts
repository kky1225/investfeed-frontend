import {Candle, CandleInterval} from "./types.ts";
import {bucketStart} from "./realtime.ts";
import {LinkTarget, periodEnd} from "./crosshairLink.ts";

// 여러 차트의 보는 구간 연동(멀티 화면의 기간 연동). 한 차트를 확대·이동하면 다른 차트도 같은 기간을 보여 준다.
// 캔들 개수가 아니라 시각으로 맞추므로 주기가 달라도 같은 기간이 된다(5분봉에서 5일을 보면 1시간봉도 그 5일).
// 시각을 맞추는 규칙은 십자선 연동과 같다: 분봉이 알리면 실제 시각으로, 일봉 이상이 알리면 날짜로 맞춘다.

/** 보이는 구간의 한쪽 끝. time 은 기준 캔들의 시각, offset 은 그 캔들의 처음에서 몇 칸 떨어졌는지(소수, 받아 둔 캔들 밖이면 0 미만·1 이상) */
export interface ViewEdge {
    time: number,
    offset: number,
}

/**
 * 차트 화면의 왼쪽 끝과 오른쪽 끝.
 * latest 는 화면이 가장 최근 캔들까지 보여 주는지(오른쪽 끝이 마지막 캔들에 닿았거나 그 뒤)이고, blank 는 그때 마지막 캔들 뒤로
 * 비어 있는 부분이 화면 너비에서 차지하는 비율(0 이상 1 미만)이다. latest 면 오른쪽 끝은 시각이 아니라 "마지막 캔들 + 같은 비율의
 * 빈칸"으로 맞춘다. 시각으로 맞추면 마지막 캔들 기간의 끝(일봉이면 오늘 자정 = 분봉의 밤사이)만큼 빈칸이 생기거나,
 * 반대로 더 긴 주기의 마지막 캔들(오늘 일봉)이 잘린다.
 */
export interface ViewSpan {
    left: ViewEdge,
    right: ViewEdge,
    latest: boolean,
    blank: number,
}

/** 차트 하나가 알린 보는 구간 */
interface ViewLink {
    source: symbol,         // 알린 차트
    kind: 'moment' | 'date',    // moment: 실제 시각(epoch ms), date: 브라우저 시간대의 날짜·시각
    from: number,
    to: number,
    latest: boolean,        // ViewSpan.latest
    blank: number,          // ViewSpan.blank
}

/** 연동에 참여한 차트들 사이에서 보는 구간을 주고받는다. 화면 하나에 하나만 만든다 */
export class ViewSync {
    private readonly listeners = new Set<(link: ViewLink) => void>();

    publish(link: ViewLink) {
        this.listeners.forEach(listener => listener(link));
    }

    subscribe(listener: (link: ViewLink) => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
}

/** 차트 한 개가 기간 연동에 쓰는 통로 */
export interface ChartViewLink {
    publish: (span: ViewSpan) => void,      // 사용자가 이 차트를 확대·이동하면 부른다
    subscribe: (apply: (span: ViewSpan) => void) => () => void,     // 다른 차트의 구간을 이 차트 기준으로 받는다
}

const same = (time: number) => time;

/** sync 에 참여하는 차트 하나의 통로를 만든다. 캔들·주기는 부를 때마다 target 에서 읽는다 */
export const createViewLink = (sync: ViewSync, target: () => LinkTarget): ChartViewLink => {
    const source = Symbol('chart');
    return {
        publish: span => {
            const {interval, conversion} = target();
            const minute = interval.unit === 'minute';
            const toShared = minute && conversion ? conversion.toMoment : same;
            sync.publish({
                source,
                kind: minute ? 'moment' : 'date',
                from: toShared(timeOfEdge(span.left, interval)),
                to: toShared(timeOfEdge(span.right, interval)),
                latest: span.latest,
                blank: span.blank,
            });
        },
        subscribe: apply => sync.subscribe(link => {
            if (link.source === source) return;
            const {candles, interval, conversion} = target();
            if (candles.length === 0) return;
            const fromShared = link.kind === 'moment' && conversion ? conversion.fromMoment : same;
            apply({
                left: edgeAt(candles, interval, fromShared(link.from)),
                right: edgeAt(candles, interval, fromShared(link.to)),
                latest: link.latest,
                blank: link.blank,
            });
        }),
    };
};

/** 구간 끝을 시각으로 바꾼다. 캔들 안의 위치는 그 캔들 기간 안에서 비례로, 캔들 밖은 그 캔들 길이만큼씩 늘려 계산한다 */
const timeOfEdge = (edge: ViewEdge, interval: CandleInterval): number => {
    const start = bucketStart(edge.time, interval);
    return start + edge.offset * (periodEnd(start, interval) - start);
};

/**
 * 시각을 이 차트의 구간 끝으로 바꾼다 (timeOfEdge 의 반대).
 * 캔들이 없는 시각(장이 쉬는 동안)은 다음 캔들의 처음, 첫 캔들보다 앞이나 마지막 캔들보다 뒤는 그 캔들 길이로 늘려 계산한다.
 */
const edgeAt = (candles: Candle[], interval: CandleInterval, time: number): ViewEdge => {
    const startOf = (index: number) => bucketStart(candles[index].time, interval);
    // 기간이 time 이하에서 시작하는 마지막 캔들
    let low = 0;
    let high = candles.length;
    while (low < high) {
        const middle = (low + high) >> 1;
        if (startOf(middle) <= time) low = middle + 1;
        else high = middle;
    }
    const index = Math.max(0, low - 1);
    const start = startOf(index);
    const end = periodEnd(start, interval);
    const inside = low === 0 || time < end || index === candles.length - 1;
    return inside
        ? {time: candles[index].time, offset: (time - start) / (end - start)}
        : {time: candles[index + 1].time, offset: 0};
};

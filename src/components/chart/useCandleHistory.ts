import {useCallback, useLayoutEffect, useRef, useState} from "react";
import type {Candle} from "../../lib/chart/types.ts";
import {mergeCandles} from "../../lib/chart/merge.ts";

/** 과거 구간 한 페이지. candles 는 오래된 순 */
export interface CandlePage {
    candles: Candle[],
    nextCursor: string | null,  // 이 값으로 다시 조회하면 그 이전 구간. null 이면 더 받을 과거가 없다
}

interface HistoryState {
    key: string,
    candles: Candle[],      // 지금까지 받은 과거 구간 (오래된 순)
    cursor: string | null,
    done: boolean,          // 더 받을 과거가 없음
}

const RETRY_DELAY_MS = 5000;    // 조회에 실패하면 이만큼 지난 뒤에야 다시 시도한다

/**
 * 차트의 과거 구간을 이어 받아 쌓아 둔다. seriesKey(종목 + 주기)가 바뀌면 처음부터 다시 받는다.
 * loadOlder 는 여러 번 불러도 한 번에 한 요청만 보내고, 더 받을 것이 없으면 아무것도 하지 않는다.
 * 돌려주는 값은 그 요청이 끝나면 한 페이지를 받았는지(true)를 알린다. 요청 중에 부르면 그 요청의 결과를 같이 받는다.
 * 더 받을 것이 없거나, 실패한 지 얼마 안 되었거나, 실패하면 false 다.
 */
export const useCandleHistory = (seriesKey: string, fetchPage: (cursor: string | null) => Promise<CandlePage>) => {
    const [state, setState] = useState<HistoryState>({key: seriesKey, candles: [], cursor: null, done: false});
    if (state.key !== seriesKey) {
        setState({key: seriesKey, candles: [], cursor: null, done: false});
    }

    const stateRef = useRef(state);
    const fetchPageRef = useRef(fetchPage);
    // 자식(차트)의 effect 가 같은 커밋에서 loadOlder 를 부르면 새 cursor 를 읽어야 하므로, 모든 effect 보다 먼저 도는 layout effect 로 맞춘다.
    useLayoutEffect(() => {
        stateRef.current = state;
        fetchPageRef.current = fetchPage;
    });

    // 요청 중인 seriesKey 와 그 요청이 끝나면 풀리는 결과
    const loading = useRef<{ key: string, result: Promise<boolean> } | null>(null);
    const failedAt = useRef(0);

    const loadOlder = useCallback((): Promise<boolean> => {
        const current = stateRef.current;
        if (current.key !== seriesKey || current.done) return Promise.resolve(false);
        if (loading.current?.key === seriesKey) return loading.current.result;
        if (Date.now() - failedAt.current < RETRY_DELAY_MS) return Promise.resolve(false);

        const result = fetchPageRef.current(current.cursor)
            .then(page => {
                // 그사이 종목이나 주기가 바뀌었으면 버린다.
                setState(previous => previous.key !== seriesKey ? previous : {
                    key: seriesKey,
                    candles: mergeCandles(page.candles, previous.candles),
                    cursor: page.nextCursor,
                    done: page.nextCursor === null,
                });
                return true;
            })
            .catch(error => {
                console.error(error);
                failedAt.current = Date.now();
                return false;
            })
            .finally(() => {
                if (loading.current?.result === result) loading.current = null;
            });
        loading.current = {key: seriesKey, result};
        return result;
    }, [seriesKey]);

    const current = state.key === seriesKey;
    // done: 더 받을 과거가 없는지 (끝까지 받았음)
    return {history: current ? state.candles : [], loadOlder, done: current && state.done};
};

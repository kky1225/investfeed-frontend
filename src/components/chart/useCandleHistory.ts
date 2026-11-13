import {useCallback, useEffect, useRef, useState} from "react";
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
 */
export const useCandleHistory = (seriesKey: string, fetchPage: (cursor: string | null) => Promise<CandlePage>) => {
    const [state, setState] = useState<HistoryState>({key: seriesKey, candles: [], cursor: null, done: false});
    if (state.key !== seriesKey) {
        setState({key: seriesKey, candles: [], cursor: null, done: false});
    }

    const stateRef = useRef(state);
    const fetchPageRef = useRef(fetchPage);
    useEffect(() => {
        stateRef.current = state;
        fetchPageRef.current = fetchPage;
    });

    const loadingKey = useRef<string | null>(null);     // 요청 중인 seriesKey
    const failedAt = useRef(0);

    const loadOlder = useCallback(() => {
        const current = stateRef.current;
        if (current.key !== seriesKey || current.done || loadingKey.current === seriesKey) return;
        if (Date.now() - failedAt.current < RETRY_DELAY_MS) return;

        loadingKey.current = seriesKey;
        fetchPageRef.current(current.cursor)
            .then(page => {
                // 그사이 종목이나 주기가 바뀌었으면 버린다.
                setState(previous => previous.key !== seriesKey ? previous : {
                    key: seriesKey,
                    candles: mergeCandles(page.candles, previous.candles),
                    cursor: page.nextCursor,
                    done: page.nextCursor === null,
                });
            })
            .catch(error => {
                console.error(error);
                failedAt.current = Date.now();
            })
            .finally(() => {
                if (loadingKey.current === seriesKey) loadingKey.current = null;
            });
    }, [seriesKey]);

    return {history: state.key === seriesKey ? state.candles : [], loadOlder};
};

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {Candle, Comparison} from "../../lib/chart/types.ts";
import type {ComparisonAlign} from "../../lib/chart/comparison.ts";
import {mergeCandles} from "../../lib/chart/merge.ts";
import type {CandlePage} from "./useCandleHistory.ts";

/** 비교할 수 있는 종목의 종류 */
export type ComparisonMarket = 'STOCK' | 'US_STOCK' | 'CRYPTO';

export const COMPARISON_MARKETS: ComparisonMarket[] = ['STOCK', 'US_STOCK', 'CRYPTO'];
export const COMPARISON_MARKET_LABELS: Record<ComparisonMarket, string> = {
    STOCK: '국내', US_STOCK: '미국', CRYPTO: '코인',
};

/** 비교할 수 있는 종목 하나 */
export interface ComparisonTarget {
    market: ComparisonMarket,
    code: string,
    name: string,
    exchange?: string,  // 미국 주식의 거래소 구분. 캔들을 조회할 때 필요하다
}

/** 종류가 달라도 코드가 겹치지 않게, 비교 종목을 가리는 값 */
export const comparisonKey = (market: ComparisonMarket, code: string) => `${market}:${code}`;

/**
 * 종목 비교에 쓸 조회 함수. 차트는 어떤 자산인지 모르므로 화면이 넘겨준다.
 * 그릴 때마다 새로 만들지 말고, 주기가 바뀔 때만 바뀌는 값(useMemo)을 넘길 것
 */
export interface ChartComparisonSource {
    market: ComparisonMarket,   // 보고 있는 화면의 종류
    // 지금 주기에서 다른 종류의 종목도 비교할 수 있는지. 분봉은 거래 시간이 달라 같은 종류끼리만 비교한다
    mixed: boolean,
    align: ComparisonAlign,     // 두 종목의 캔들을 무엇으로 맞출지
    /** 이름이나 코드로 종목을 찾는다. */
    search: (market: ComparisonMarket, keyword: string) => Promise<ComparisonTarget[]>,
    /** 지금 차트와 같은 주기의 캔들 한 페이지. cursor 가 null 이면 가장 최근 구간, 받은 nextCursor 를 넣으면 그 이전 구간 */
    fetchPage: (target: ComparisonTarget, cursor: string | null) => Promise<CandlePage>,
}

/** 더해 둔 비교 종목 */
export interface ComparisonItem extends ComparisonTarget {
    key: string,
    color: number,      // 차트의 선 색 목록에서의 순번
    shown: boolean,     // 지금 주기에서 차트에 그리는지. 분봉에서는 다른 종류의 종목을 그리지 않는다
}

type Picked = Omit<ComparisonItem, 'shown'>;

interface Loaded {
    candles: Candle[],      // 지금까지 받은 구간 (오래된 순)
    cursor: string | null,
    done: boolean,          // 더 받을 과거가 없음
}

type RequestKind = 'first' | 'older' | 'refresh';

export const MAX_COMPARISONS = 3;
// 비교 선의 색 순번(글자색 · 보조색 · 정보색). 이동평균선이 앞쪽 색을 쓰므로 되도록 겹치지 않는 것부터 쓴다
const COMPARISON_COLORS = [4, 2, 5];
const REFRESH_MS = 60_000;      // 비교 종목의 최근 구간을 다시 받는 간격 (비교 종목은 실시간으로 갱신하지 않는다)
const RETRY_DELAY_MS = 5000;    // 조회에 실패하면 이만큼 지난 뒤에야 다시 시도한다
const NO_CANDLES: Candle[] = [];
const NO_PICKED: Picked[] = [];
const NOTHING_LOADED: Record<string, Loaded> = {};

/**
 * 비교 종목 목록과 그 캔들을 들고 있는다. 계정에 저장하지 않고 화면을 여는 동안만 유지한다.
 * assetKey(종목)가 바뀌면 목록을 비우고, seriesKey(종목 + 주기)가 바뀌면 캔들을 새 주기로 다시 받는다.
 * firstTime: 주 종목이 받아 둔 첫 캔들의 시각. 비교 종목이 그보다 짧으면 과거 구간을 이어 받는다.
 */
export const useChartComparisons = (
    assetKey: string, seriesKey: string, source: ChartComparisonSource | undefined, firstTime: number | null,
) => {
    const [picked, setPicked] = useState<{ key: string, items: Picked[] }>({key: assetKey, items: []});
    if (picked.key !== assetKey) setPicked({key: assetKey, items: []});
    const pickedItems = picked.key === assetKey ? picked.items : NO_PICKED;

    // 분봉에서는 보고 있는 종목과 같은 종류만 그린다. 목록에는 남겨 두어, 일봉으로 돌아오면 다시 나타난다.
    const items = useMemo<ComparisonItem[]>(() => pickedItems.map(item => ({
        ...item,
        shown: !source || source.mixed || item.market === source.market,
    })), [pickedItems, source]);

    const [loaded, setLoaded] = useState<{ key: string, byKey: Record<string, Loaded> }>({key: seriesKey, byKey: {}});
    if (loaded.key !== seriesKey) setLoaded({key: seriesKey, byKey: {}});
    const byKey = loaded.key === seriesKey ? loaded.byKey : NOTHING_LOADED;

    const requesting = useRef(new Set<string>());       // 요청 중인 "seriesKey|종목"
    const failedAt = useRef(new Map<string, number>());

    const request = useCallback((
        fetchPage: ChartComparisonSource['fetchPage'], target: ComparisonItem, cursor: string | null, kind: RequestKind,
    ) => {
        const requestKey = `${seriesKey}|${target.key}`;
        if (requesting.current.has(requestKey)) return;
        if (Date.now() - (failedAt.current.get(requestKey) ?? 0) < RETRY_DELAY_MS) return;

        requesting.current.add(requestKey);
        fetchPage(target, cursor)
            .then(page => {
                // 받은 것을 반영하면 곧바로 다음 구간을 요청할 수 있으므로, 반영하기 전에 요청 중 표시를 먼저 지운다.
                requesting.current.delete(requestKey);
                // 그사이 종목이나 주기가 바뀌었으면 버린다.
                setLoaded(previous => {
                    if (previous.key !== seriesKey) return previous;
                    const before = previous.byKey[target.key];
                    const next: Loaded = kind === 'refresh' && before
                        // 최근 구간만 새로 받은 것으로 덮는다. 이어 받던 과거 구간과 그 위치는 그대로 둔다.
                        ? {...before, candles: mergeCandles(before.candles, page.candles)}
                        : kind === 'older' && before
                            ? {
                                candles: mergeCandles(page.candles, before.candles),
                                cursor: page.nextCursor,
                                done: page.nextCursor === null,
                            }
                            : {candles: page.candles, cursor: page.nextCursor, done: page.nextCursor === null};
                    return {key: seriesKey, byKey: {...previous.byKey, [target.key]: next}};
                });
            })
            .catch(error => {
                console.error(error);
                requesting.current.delete(requestKey);
                failedAt.current.set(requestKey, Date.now());
            });
    }, [seriesKey]);

    // 아직 받지 않은 비교 종목은 최근 구간을 받고, 주 종목보다 짧은 비교 종목은 과거 구간을 이어 받는다.
    useEffect(() => {
        if (!source) return;
        items.filter(item => item.shown).forEach(item => {
            const data = byKey[item.key];
            if (!data) {
                request(source.fetchPage, item, null, 'first');
            } else if (firstTime !== null && !data.done && (data.candles.length === 0 || data.candles[0].time > firstTime)) {
                request(source.fetchPage, item, data.cursor, 'older');
            }
        });
    }, [items, byKey, firstTime, source, request]);

    // 최근 구간을 주기적으로 다시 받는다. 처음 조회에 실패한 종목도 이때 다시 시도한다.
    const refresh = useRef(() => {});
    useEffect(() => {
        refresh.current = () => {
            if (!source) return;
            items.filter(item => item.shown).forEach(item => (
                request(source.fetchPage, item, null, byKey[item.key] ? 'refresh' : 'first')
            ));
        };
    });
    const active = items.some(item => item.shown);
    useEffect(() => {
        if (!active) return;
        const timer = window.setInterval(() => refresh.current(), REFRESH_MS);
        return () => window.clearInterval(timer);
    }, [active]);

    const add = (target: ComparisonTarget) => {
        const key = comparisonKey(target.market, target.code);
        setPicked(previous => {
            if (previous.key !== assetKey) return previous;
            if (previous.items.length >= MAX_COMPARISONS || previous.items.some(item => item.key === key)) {
                return previous;
            }
            const used = previous.items.map(item => item.color);
            const color = COMPARISON_COLORS.find(candidate => !used.includes(candidate)) ?? COMPARISON_COLORS[0];
            return {key: assetKey, items: [...previous.items, {...target, key, color}]};
        });
    };
    const remove = (key: string) => {
        setPicked(previous => ({...previous, items: previous.items.filter(item => item.key !== key)}));
    };

    // 엔진에 넘길 것
    const comparisons = useMemo<Comparison[]>(() => items.filter(item => item.shown).map(item => ({
        key: item.key,
        name: item.name,
        color: item.color,
        candles: byKey[item.key]?.candles ?? NO_CANDLES,
    })), [items, byKey]);

    return {items, add, remove, comparisons};
};

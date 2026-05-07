import {fetchTimeNow} from '../api/time/TimeApi';
import {MarketType} from '../type/timeType';

const RESYNC_INTERVAL_MS = 5 * 60_000; // 5분
const SYNC_MARKET_TYPE = MarketType.STOCK; // 백그라운드 offset 동기화용 기본 marketType

export interface MarketInfo {
    time: number;
    isMarketOpen: boolean;
    startMarketTime: number;
    marketType: MarketType;
}

let offset = 0;            // serverTime - clientTime (ms)
let autoSyncSetup = false; // 자동 동기화 셋업 여부

const marketInfoCache = new Map<MarketType, MarketInfo>();
const inflight = new Map<MarketType, Promise<MarketInfo | null>>();

export async function fetchMarketInfo(marketType: MarketType): Promise<MarketInfo | null> {
    const existing = inflight.get(marketType);
    if (existing) return existing;

    const promise = (async (): Promise<MarketInfo | null> => {
        try {
            const t0 = Date.now();
            const res = await fetchTimeNow({marketType});
            const t1 = Date.now();

            if (res?.code !== '0000' || !res?.result) return null;

            const rtt = t1 - t0;
            const serverTimeAtT1 = res.result.time + rtt / 2;

            offset = serverTimeAtT1 - t1;

            const info: MarketInfo = {
                time: serverTimeAtT1,
                isMarketOpen: res.result.isMarketOpen,
                startMarketTime: res.result.startMarketTime,
                marketType: res.result.marketType,
            };
            marketInfoCache.set(marketType, info);
            return info;
        } catch (error) {
            console.error('[serverTime] fetchMarketInfo failed', error);
            return null;
        } finally {
            inflight.delete(marketType);
        }
    })();

    inflight.set(marketType, promise);
    return promise;
}

export function getCachedMarketInfo(marketType: MarketType): MarketInfo | null {
    return marketInfoCache.get(marketType) ?? null;
}

export async function syncServerTime(): Promise<void> {
    await fetchMarketInfo(SYNC_MARKET_TYPE);
}

export function getServerNow(): number {
    if (!autoSyncSetup) {
        autoSyncSetup = true;
        setupAutoSync();
    }
    return Date.now() + offset;
}

export function getServerOffset(): number {
    return offset;
}

/**
 * 자동 동기화: 5분 주기 setInterval + 탭 가시성 변경 시 즉시 sync.
 * 백그라운드 탭에서는 타이머 정지 (배터리 절약 + 서버 부하 절감).
 */
function setupAutoSync(): void {
    if (typeof document === 'undefined') return;

    let intervalId: number | null = null;

    const start = () => {
        if (intervalId !== null) return;
        intervalId = window.setInterval(() => {
            void syncServerTime();
        }, RESYNC_INTERVAL_MS);
    };

    const stop = () => {
        if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
        }
    };

    if (document.visibilityState === 'visible') {
        start();
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            void syncServerTime();
            start();
        } else {
            stop();
        }
    });
}

import {useEffect, useRef} from "react";
import {MarketType} from "../../type/timeType.ts";
import {useMarketTime} from "../holding/useMarketTime.ts";

interface UseMarketWebSocketOptions {
    /** 장 시각 기준 marketType (STOCK / INDEX / COMMODITY) */
    marketType: MarketType;
    /** 구독 키 — 변경 시 재연결 (예: stkCd, indsCd). 빈 값이면 연결 시도 X. */
    subscriptionKey: string | undefined;
    /** subscribe 메시지 송신 (실패 시 throw 가능) */
    streamFn: () => Promise<unknown>;
    /** WebSocket onmessage 핸들러 — 본문에서 setState 수행 */
    onMessage: (event: MessageEvent) => void;
    /** 외부 게이팅 — false 면 연결 시도 X (기본 true) */
    enabled?: boolean;
}

/**
 * 종목 상세 페이지 WebSocket lifecycle 커스텀 훅.
 *
 * 책임:
 * - marketType 기준 장 시각 확인 (useMarketTime)
 * - 장 열림 → streamFn() 으로 subscribe 메시지 전송 후 WebSocket open
 * - 장 닫힘 → 다음 개장 시각까지 setTimeout 으로 대기 후 재시도
 * - subscriptionKey 변경 시 재연결, 언마운트 시 정리
 *
 * onMessage / streamFn 은 latest-ref 로 처리 → caller 가 useCallback 강제 안 됨.
 *
 * 24h 거래 (crypto) 는 useCryptoWebSocket 별도 훅 사용.
 */
export function useMarketWebSocket(opts: UseMarketWebSocketOptions): void {
    const {marketType, subscriptionKey, enabled = true} = opts;
    const {checkMarketTime, marketTimer} = useMarketTime(marketType);

    // latest-ref: caller 가 useCallback 안 써도 매 렌더 최신 콜백 호출
    const streamFnRef = useRef(opts.streamFn);
    const onMessageRef = useRef(opts.onMessage);
    streamFnRef.current = opts.streamFn;
    onMessageRef.current = opts.onMessage;

    useEffect(() => {
        if (!enabled || !subscriptionKey) return;

        let socket: WebSocket | undefined;
        let socketTimeout: ReturnType<typeof setTimeout> | undefined;
        let cancelled = false;

        const openSocket = () => {
            const ws = new WebSocket("ws://localhost:8080/ws");
            ws.onmessage = (event) => onMessageRef.current(event);
            return ws;
        };

        const connectSocket = async () => {
            await streamFnRef.current();
            if (cancelled) return;
            socket = openSocket();
        };

        (async () => {
            const marketInfo = await checkMarketTime();
            if (cancelled) return;

            if (marketInfo?.isMarketOpen) {
                await connectSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();
                    const again = await checkMarketTime();
                    if (cancelled) return;
                    if (again?.isMarketOpen) {
                        await connectSocket();
                    }
                }, marketTimer.current + 200);
            }
        })();

        return () => {
            cancelled = true;
            socket?.close();
            if (socketTimeout) clearTimeout(socketTimeout);
        };
    }, [marketType, subscriptionKey, enabled, checkMarketTime, marketTimer]);
}

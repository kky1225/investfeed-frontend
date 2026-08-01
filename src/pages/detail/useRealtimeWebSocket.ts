import {useEffect, useRef} from "react";

interface UseRealtimeWebSocketOptions {
    /** 구독 키 — 변경 시 재연결 (예: market id). 빈 값이면 연결 시도 X. */
    subscriptionKey: string | undefined;
    /** subscribe 메시지 송신 (실패 시 throw 가능) */
    streamFn: () => Promise<unknown>;
    /** WebSocket onmessage 핸들러 — 본문에서 setState 수행 */
    onMessage: (event: MessageEvent) => void;
    /** 외부 게이팅 — false 면 연결 시도 X (기본 true) */
    enabled?: boolean;
}

export function useRealtimeWebSocket(opts: UseRealtimeWebSocketOptions): void {
    const {subscriptionKey, enabled = true} = opts;

    const streamFnRef = useRef(opts.streamFn);
    const onMessageRef = useRef(opts.onMessage);
    streamFnRef.current = opts.streamFn;
    onMessageRef.current = opts.onMessage;

    useEffect(() => {
        if (!enabled || !subscriptionKey) return;

        let socket: WebSocket | undefined;
        let cancelled = false;

        const openSocket = () => {
            const ws = new WebSocket("ws://localhost:8080/ws");
            ws.onmessage = (event) => onMessageRef.current(event);
            return ws;
        };

        (async () => {
            try {
                await streamFnRef.current();
                if (cancelled) return;
                socket = openSocket();
            } catch (err) {
                console.error(err);
            }
        })();

        return () => {
            cancelled = true;
            socket?.close();
        };
    }, [subscriptionKey, enabled]);
}

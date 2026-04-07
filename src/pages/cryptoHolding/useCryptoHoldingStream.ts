import {useEffect, useRef} from "react";
import {fetchCryptoHoldingStream} from "../../api/cryptoHolding/CryptoHoldingApi.ts";

export interface CryptoHoldingBuffer {
    curPrc?: string;
}

export function useCryptoHoldingStream(
    markets: string[],
    onUpdate: (bufferMap: Map<string, CryptoHoldingBuffer>) => void,
) {
    const bufferMapRef = useRef<Map<string, CryptoHoldingBuffer>>(new Map());

    useEffect(() => {
        if (markets.length === 0) return;

        let socket: WebSocket;
        let displayInterval: ReturnType<typeof setInterval>;
        let cancelled = false;

        const openSocket = () => {
            const ws = new WebSocket("ws://localhost:8080/ws");
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.trnm === "REAL" && Array.isArray(data.data)) {
                    data.data.forEach((res: { type: string; item: string; values: Record<string, string> }) => {
                        if (res.type === "CRYPTO_TICKER") {
                            const market = res.item;
                            const prev = bufferMapRef.current.get(market) ?? {};
                            bufferMapRef.current.set(market, {
                                ...prev,
                                curPrc: res.values["trade_price"] ?? prev.curPrc,
                            });
                        }
                    });
                }
            };
            return ws;
        };

        const startDisplay = () => {
            displayInterval = setInterval(() => {
                if (bufferMapRef.current.size === 0) return;
                onUpdate(new Map(bufferMapRef.current));
                bufferMapRef.current.clear();
            }, 500);
        };

        const connectSocket = async () => {
            if (cancelled) return;
            await fetchCryptoHoldingStream({items: markets});
            socket = openSocket();
            startDisplay();
        };

        // 코인은 24시간 거래이므로 장시간 체크 없이 바로 연결
        connectSocket();

        return () => {
            cancelled = true;
            socket?.close();
            clearInterval(displayInterval);
        };
    }, [markets, onUpdate]);
}

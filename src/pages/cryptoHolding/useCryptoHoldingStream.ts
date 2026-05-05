import {useEffect, useRef} from "react";
import {HoldingStreamReq} from "../../type/HoldingType.ts";
import {CryptoHoldingBuffer} from "../../type/CryptoType.ts";

export function useCryptoHoldingStream(
    markets: string[],
    onUpdate: (bufferMap: Map<string, CryptoHoldingBuffer>) => void,
    fetcher: (req: HoldingStreamReq) => Promise<unknown>,
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

                if (data.type === "CRYPTO_TICKER" && data.data) {
                    const ticker = data.data;
                    const market: string = ticker.market;
                    if (!market) return;
                    const prev = bufferMapRef.current.get(market) ?? {};
                    bufferMapRef.current.set(market, {
                        ...prev,
                        curPrc: ticker.tradePrice != null ? String(ticker.tradePrice) : prev.curPrc,
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
            await fetcher({items: markets});
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
    }, [markets, onUpdate, fetcher]);
}

import {useEffect, useRef} from "react";
import {HoldingStreamReq} from "../../type/HoldingType.ts";
import {CryptoHoldingBuffer} from "../../type/CryptoType.ts";
import {openReconnectingSocket} from "../../lib/reconnectingSocket.ts";

export function useCryptoHoldingStream(
    markets: string[],
    onUpdate: (bufferMap: Map<string, CryptoHoldingBuffer>) => void,
    fetcher: (req: HoldingStreamReq) => Promise<unknown>,
) {
    const bufferMapRef = useRef<Map<string, CryptoHoldingBuffer>>(new Map());

    useEffect(() => {
        if (markets.length === 0) return;

        let displayInterval: ReturnType<typeof setInterval>;

        const openSocket = () => openReconnectingSocket({
            register: () => fetcher({items: markets}),
            onMessage: (event) => {
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
            },
        });

        const startDisplay = () => {
            displayInterval = setInterval(() => {
                if (bufferMapRef.current.size === 0) return;
                onUpdate(new Map(bufferMapRef.current));
                bufferMapRef.current.clear();
            }, 200);
        };

        const socket = openSocket();
        startDisplay();

        return () => {
            socket.close();
            clearInterval(displayInterval);
        };
    }, [markets, onUpdate, fetcher]);
}

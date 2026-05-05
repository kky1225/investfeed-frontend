import {useEffect, useRef} from "react";
import {HoldingBuffer, HoldingStreamReq, HoldingStreamRes} from "../../type/HoldingType.ts";
import {MarketType} from "../../type/timeType.ts";
import {useMarketTime} from "./useMarketTime.ts";

export function useHoldingStream(
    stkCds: string[],
    onUpdate: (bufferMap: Map<string, HoldingBuffer>) => void,
    fetcher: (req: HoldingStreamReq) => Promise<unknown>,
) {
    const {checkMarketTime, marketTimer} = useMarketTime(MarketType.STOCK);
    const bufferMapRef = useRef<Map<string, HoldingBuffer>>(new Map());

    useEffect(() => {
        if (stkCds.length === 0) return;

        let socket: WebSocket;
        let socketTimeout: ReturnType<typeof setTimeout>;
        let displayInterval: ReturnType<typeof setInterval>;
        let cancelled = false;

        const openSocket = () => {
            const ws = new WebSocket("ws://localhost:8080/ws");
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.trnm === "REAL" && Array.isArray(data.data)) {
                    data.data.forEach((res: HoldingStreamRes) => {
                        const values = res.values;

                        if (res.type === "0B") {
                            const stkCd = res.item;
                            const prev = bufferMapRef.current.get(stkCd) ?? {};
                            bufferMapRef.current.set(stkCd, {
                                ...prev,
                                curPrc: String(values["10"]).replace(/^[+-]/, ''),
                            });
                        }

                        if (res.type === "04") {
                            const rawCd = values["9001"];
                            if (!rawCd) return;
                            const stkCd = rawCd.replace(/^A/, '') + "_AL";
                            const prev = bufferMapRef.current.get(stkCd) ?? {};
                            bufferMapRef.current.set(stkCd, {
                                ...prev,
                                curPrc: values["10"] ? String(values["10"]).replace(/^[+-]/, '') : prev.curPrc,
                                rmndQty: values["930"] ?? prev.rmndQty,
                                purPric: values["931"] ?? prev.purPric,
                            });
                        }
                    });
                }
            };
            return ws;
        };

        const startDisplay = () => {
            if (displayInterval) return;
            displayInterval = setInterval(() => {
                if (bufferMapRef.current.size === 0) return;
                onUpdate(new Map(bufferMapRef.current));
                bufferMapRef.current.clear();
            }, 500);
        };

        const connectSocket = async () => {
            await fetcher({items: stkCds});
            socket = openSocket();
            startDisplay();
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
                    if (again?.isMarketOpen) {
                        await connectSocket();
                    }
                }, marketTimer.current + 200);
            }
        })();

        return () => {
            cancelled = true;
            socket?.close();
            clearTimeout(socketTimeout);
            clearInterval(displayInterval);
        };
    }, [stkCds, onUpdate, fetcher, checkMarketTime, marketTimer]);
}

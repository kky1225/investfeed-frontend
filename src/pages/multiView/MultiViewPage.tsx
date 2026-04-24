import {useEffect, useMemo, useRef, useState} from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import MultiViewPanel, {type StreamUpdate} from "./MultiViewPanel.tsx";
import MultiViewSearchDialog, {type SelectedAsset} from "./MultiViewSearchDialog.tsx";
import ChartDetailDialog from "./ChartDetailDialog.tsx";
import {fetchStockStream} from "../../api/stock/StockApi.ts";
import {fetchCryptoHoldingStream} from "../../api/cryptoHolding/CryptoHoldingApi.ts";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";

const STORAGE_KEY = 'multiView_panels';
const MAX_PANELS = 4;

export default function MultiViewPage() {
    const [panels, setPanels] = useState<SelectedAsset[]>([]);
    const [searchPanelIndex, setSearchPanelIndex] = useState<number | null>(null);
    const [chartTarget, setChartTarget] = useState<{type: SelectedAsset['type']; code: string; name: string} | null>(null);
    const [streamUpdates, setStreamUpdates] = useState<Map<string, StreamUpdate>>(new Map());
    const stockBufferRef = useRef<Map<string, StreamUpdate>>(new Map());
    const cryptoBufferRef = useRef<Map<string, StreamUpdate>>(new Map());
    const [reloadKey, setReloadKey] = useState(0);

    // 1분마다 데이터 갱신 (정각 기준)
    useEffect(() => {
        const now = Date.now();
        const waitTime = 60_000 - (now % 60_000);

        const timeout = setTimeout(() => {
            setReloadKey(k => k + 1);
            const interval = setInterval(() => {
                setReloadKey(k => k + 1);
            }, 60_000);
            return () => clearInterval(interval);
        }, waitTime + 200);

        return () => clearTimeout(timeout);
    }, []);

    // localStorage에서 복원
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setPanels(parsed.filter((p: SelectedAsset | null) => p !== null));
                }
            }
        } catch (error) {
            console.error(error);
        }
    }, []);

    // localStorage에 저장
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(panels));
    }, [panels]);

    // 주식 종목 코드 목록
    const stockCodes = useMemo(() =>
        panels.filter(p => p.type === 'STOCK').map(p => p.code),
        [panels]
    );

    // 코인 종목 코드 목록
    const cryptoCodes = useMemo(() =>
        panels.filter(p => p.type === 'CRYPTO').map(p => p.code),
        [panels]
    );

    const trendColor = (preSig: string): 'up' | 'down' | 'neutral' => {
        const sig = Number(preSig);
        if (sig === 2 || sig === 1) return 'up';
        if (sig === 4 || sig === 5) return 'down';
        return 'neutral';
    };

    // 주식 WebSocket
    useEffect(() => {
        if (stockCodes.length === 0) return;

        let socket: WebSocket;
        let displayInterval: ReturnType<typeof setInterval>;
        let socketTimeout: ReturnType<typeof setTimeout>;

        const openSocket = () => {
            const ws = new WebSocket("ws://localhost:8080/ws");
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.trnm === "REAL" && Array.isArray(data.data)) {
                    data.data.forEach((res: {type: string; item: string; values: Record<string, string>}) => {
                        const values = res.values;
                        stockBufferRef.current.set(res.item, {
                            value: String(values["10"]).replace(/^[+-]/, ''),
                            fluRt: String(values["12"]),
                            predPre: String(values["11"]),
                            trend: trendColor(String(values["25"])),
                        });
                    });
                }
            };
            return ws;
        };

        const startDisplay = () => {
            displayInterval = setInterval(() => {
                if (stockBufferRef.current.size === 0) return;
                setStreamUpdates(prev => {
                    const next = new Map(prev);
                    stockBufferRef.current.forEach((val, key) => next.set(key, val));
                    return next;
                });
                stockBufferRef.current.clear();
            }, 500);
        };

        const connectSocket = async () => {
            await fetchStockStream({items: stockCodes});
            socket = openSocket();
            startDisplay();
        };

        (async () => {
            try {
                const marketInfo = await fetchTimeNow({marketType: MarketType.STOCK});
                if (marketInfo.result?.isMarketOpen) {
                    await connectSocket();
                } else {
                    const waitMs = marketInfo.result?.marketOpenRemainingMs ?? 0;
                    if (waitMs > 0) {
                        socketTimeout = setTimeout(async () => {
                            const again = await fetchTimeNow({marketType: MarketType.STOCK});
                            if (again.result?.isMarketOpen) {
                                await connectSocket();
                            }
                        }, waitMs + 200);
                    }
                }
            } catch (err) {
                console.error('Stock socket error:', err);
            }
        })();

        return () => {
            socket?.close();
            clearInterval(displayInterval);
            clearTimeout(socketTimeout);
        };
    }, [stockCodes.join(',')]);

    // 코인 WebSocket (24시간 거래이므로 장시간 체크 불필요)
    useEffect(() => {
        if (cryptoCodes.length === 0) return;

        let socket: WebSocket;
        let displayInterval: ReturnType<typeof setInterval>;

        const openSocket = () => {
            const ws = new WebSocket("ws://localhost:8080/ws");
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === "CRYPTO_TICKER" && data.data) {
                    const ticker = data.data;
                    const market: string = ticker.market;
                    if (!market) return;
                    const tradePrice = ticker.tradePrice != null ? String(ticker.tradePrice) : '0';
                    const changeRate = ticker.signedChangeRate != null ? Number(ticker.signedChangeRate) : 0;
                    const changePrice = ticker.signedChangePrice != null ? String(ticker.signedChangePrice) : '0';
                    const rate = changeRate * 100;
                    cryptoBufferRef.current.set(market, {
                        value: tradePrice,
                        fluRt: rate.toFixed(2),
                        predPre: changePrice,
                        trend: rate > 0 ? 'up' : rate < 0 ? 'down' : 'neutral',
                    });
                }
            };
            return ws;
        };

        const startDisplay = () => {
            displayInterval = setInterval(() => {
                if (cryptoBufferRef.current.size === 0) return;
                setStreamUpdates(prev => {
                    const next = new Map(prev);
                    cryptoBufferRef.current.forEach((val, key) => next.set(key, val));
                    return next;
                });
                cryptoBufferRef.current.clear();
            }, 500);
        };

        (async () => {
            try {
                await fetchCryptoHoldingStream({items: cryptoCodes});
                socket = openSocket();
                startDisplay();
            } catch (err) {
                console.error('Crypto socket error:', err);
            }
        })();

        return () => {
            socket?.close();
            clearInterval(displayInterval);
        };
    }, [cryptoCodes.join(',')]);

    const handleSelect = (asset: SelectedAsset) => {
        if (searchPanelIndex === null) return;
        if (searchPanelIndex === panels.length) {
            setPanels(prev => [...prev, asset]);
        } else {
            setPanels(prev => {
                const next = [...prev];
                next[searchPanelIndex] = asset;
                return next;
            });
        }
        setSearchPanelIndex(null);
    };

    const handleRemove = (index: number) => {
        setPanels(prev => prev.filter((_, i) => i !== index));
    };

    const handleChartExpand = (index: number) => {
        const asset = panels[index];
        if (!asset) return;
        setChartTarget({type: asset.type, code: asset.code, name: asset.name});
    };

    const totalVisible = panels.length + (panels.length < MAX_PANELS ? 1 : 0);
    const getGridSize = () => {
        if (totalVisible === 1) return {xs: 12, md: 12};
        return {xs: 12, md: 6};
    };
    const gridSize = getGridSize();

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Typography component="h2" variant="h6" sx={{mb: 2}}>
                멀티 화면
            </Typography>

            <Grid container spacing={2}>
                {panels.map((asset, index) => (
                    <Grid key={`panel-${index}`} size={gridSize}>
                        <MultiViewPanel
                            asset={asset}
                            onSearch={() => setSearchPanelIndex(index)}
                            onChartExpand={() => handleChartExpand(index)}
                            onRemove={() => handleRemove(index)}
                            streamUpdate={streamUpdates.get(asset.code) ?? null}
                            reloadKey={reloadKey}
                        />
                    </Grid>
                ))}
                {panels.length < MAX_PANELS && (
                    <Grid key="add" size={gridSize}>
                        <MultiViewPanel
                            asset={null}
                            onSearch={() => setSearchPanelIndex(panels.length)}
                            onChartExpand={() => {}}
                            onRemove={() => {}}
                        />
                    </Grid>
                )}
            </Grid>

            <MultiViewSearchDialog
                open={searchPanelIndex !== null}
                onClose={() => setSearchPanelIndex(null)}
                onSelect={handleSelect}
            />

            <ChartDetailDialog
                open={Boolean(chartTarget)}
                onClose={() => setChartTarget(null)}
                assetType={chartTarget?.type ?? null}
                code={chartTarget?.code ?? ''}
                name={chartTarget?.name ?? ''}
            />
        </Box>
    );
}

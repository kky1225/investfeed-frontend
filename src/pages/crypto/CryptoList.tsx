import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import CryptoLineChart, {CryptoLineChartProps} from "../../components/CryptoLineChart.tsx";
import FearGreedGauge from "../../components/FearGreedGauge.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {fetchCryptoList, fetchCryptoStream} from "../../api/crypto/CryptoApi.ts";
import {useEffect, useMemo, useRef, useState} from "react";
import {CryptoChartMinute, CryptoListItem, CryptoListRes, FearGreedItem} from "../../type/CryptoType.ts";
import {usePollingQuery} from "../../lib/pollingQuery.ts";
import {parseTradeStamp} from "../../lib/tradeStamp.ts";

interface CryptoTickerData {
    market: string;
    tradePrice: number;
    change: string;
    signedChangeRate: number;
    signedChangePrice: number;
    changeRate: number;
    changePrice: number;
    accTradePrice24h: number;
    accTradeVolume24h: number;
    tradeDateTimeKst: string;
}

interface LiveCryptoUpdate {
    value: string;
    changeRate: string;
    changePrice: number;
    trend: 'up' | 'down' | 'neutral';
    interval: string;
    accTradePrice24h: string;
    stamp: number;
}

const trendColor = (change: string): 'up' | 'down' | 'neutral' => {
    if (change === 'RISE') return 'up';
    if (change === 'FALL') return 'down';
    return 'neutral';
};

const chartColor = (change: string) => {
    if (change === 'RISE') return 'red';
    if (change === 'FALL') return 'blue';
    return 'grey';
};

const cryptoDateFormat = (dateTime: string) => {
    if (!dateTime) return '';
    if (dateTime.includes('T')) {
        return dateTime.replace(/-/g, '.').replace('T', ' ').substring(0, 16);
    }
    const cleaned = dateTime.replace(/\s+/g, '');
    if (cleaned.length >= 12) {
        return `${cleaned.substring(0, 4)}.${cleaned.substring(4, 6)}.${cleaned.substring(6, 8)} ${cleaned.substring(8, 10)}:${cleaned.substring(10, 12)}`;
    }
    return dateTime;
};

const formatTradePrice = (price: number) => {
    if (price >= 1_000_000_000_000) {
        return (price / 1_000_000_000_000).toFixed(1) + '조';
    } else if (price >= 100_000_000) {
        return (price / 100_000_000).toFixed(0) + '억';
    } else if (price >= 10_000) {
        return (price / 10_000).toFixed(0) + '만';
    }
    return price.toLocaleString();
};

const CryptoList = () => {
    const [liveOverlay, setLiveOverlay] = useState<Map<string, LiveCryptoUpdate>>(new Map());
    const updateIfNewer = (market: string, incoming: LiveCryptoUpdate) => {
        setLiveOverlay(prev => {
            const cur = prev.get(market);
            if (cur && cur.stamp >= incoming.stamp) return prev;
            const next = new Map(prev);
            next.set(market, incoming);
            return next;
        });
    };
    const subscribedMarketsRef = useRef<string>('');

    const {data: result, isLoading, lastUpdated, pollError} = usePollingQuery<CryptoListRes>(
        ['cryptoList'],
        (config) => fetchCryptoList(config),
    );

    // 폴링 결과 + 실시간 overlay 합산
    const cryptoDataList: CryptoLineChartProps[] = useMemo(() => {
        if (!result) return [];
        const list: CryptoListItem[] = result.cryptoList ?? [];

        return list.map((item: CryptoListItem) => {
            const live = liveOverlay.get(item.market);
            const dateList = item.chartMinuteList.map((chart: CryptoChartMinute) =>
                cryptoDateFormat(chart.candleDateTimeKst)
            );
            const changeRatePercent = (item.signedChangeRate * 100).toFixed(2);

            return {
                market: item.market,
                title: item.koreanName,
                value: live?.value ?? item.tradePrice.toLocaleString(),
                changeRate: live?.changeRate ?? changeRatePercent,
                changePrice: live?.changePrice ?? item.signedChangePrice,
                trend: live?.trend ?? trendColor(item.change),
                interval: live?.interval ?? cryptoDateFormat(item.tradeDateTimeKst),
                accTradePrice24h: live?.accTradePrice24h ?? formatTradePrice(item.accTradePrice24h),
                seriesData: [
                    {
                        id: item.market,
                        showMark: false,
                        curve: 'linear' as const,
                        area: true,
                        stackOrder: 'ascending' as const,
                        color: chartColor(item.change),
                        data: item.chartMinuteList.map((chart: CryptoChartMinute) => chart.tradePrice),
                    }
                ],
                dateList: dateList,
            };
        });
    }, [result, liveOverlay]);

    const fearGreedCurrent: FearGreedItem = result?.fearGreed?.current ?? {value: 0, classification: '', date: ''};
    const fearGreedHistory: FearGreedItem[] = result?.fearGreed?.history ?? [];
    const loading = isLoading;

    const cryptoListStream = async (markets: string[]) => {
        try {
            const data = await fetchCryptoStream(markets);
            if (data.code !== "0000") {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "CRYPTO_TICKER" && data.data) {
                const ticker: CryptoTickerData = data.data;
                updateIfNewer(ticker.market, {
                    value: ticker.tradePrice.toLocaleString(),
                    changeRate: (ticker.signedChangeRate * 100).toFixed(2),
                    changePrice: ticker.signedChangePrice,
                    trend: trendColor(ticker.change),
                    interval: cryptoDateFormat(ticker.tradeDateTimeKst),
                    accTradePrice24h: formatTradePrice(ticker.accTradePrice24h),
                    stamp: parseTradeStamp(ticker.tradeDateTimeKst),
                });
            }
        };

        return socket;
    };

    // 폴링 결과 → 각 자산별 updateIfNewer (stamp 비교)
    useEffect(() => {
        if (!result?.cryptoList) return;
        (result.cryptoList as CryptoListItem[]).forEach((item) => {
            updateIfNewer(item.market, {
                value: item.tradePrice.toLocaleString(),
                changeRate: (item.signedChangeRate * 100).toFixed(2),
                changePrice: item.signedChangePrice,
                trend: trendColor(item.change),
                interval: cryptoDateFormat(item.tradeDateTimeKst),
                accTradePrice24h: formatTradePrice(item.accTradePrice24h),
                stamp: parseTradeStamp(item.tradeDateTimeKst),
            });
        });
    }, [result]);

    // 폴링 결과로 markets 가 도출되면 그 시점에 stream 등록 + WebSocket 연결.
    // 24시간 거래라 시장 시간 체크 불필요.
    useEffect(() => {
        if (!result?.cryptoList) return;
        const markets = (result.cryptoList as CryptoListItem[]).map((c) => c.market);
        if (markets.length === 0) return;

        const key = markets.join(',');
        // 같은 마켓 셋에 이미 구독돼 있으면 재구독 skip
        if (subscribedMarketsRef.current === key) return;
        subscribedMarketsRef.current = key;

        let socket: WebSocket | undefined;
        (async () => {
            await cryptoListStream(markets);
            socket = openSocket();
        })();

        return () => {
            socket?.close();
        };
    }, [result]);

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', mb: 2, gap: 2}}>
                <Typography component="h2" variant="h6">
                    암호화폐
                </Typography>
                <Box sx={{flex: 1}}/>
                <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>
            </Box>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{mb: (theme) => theme.spacing(2)}}
            >
                {loading ? (
                    Array.from({length: 2}).map((_, index) => (
                        <Grid key={index} size={{xs: 12, md: 6}}>
                            <Card variant="outlined" sx={{width: '100%'}}>
                                <CardContent>
                                    <Skeleton width={120} height={28}/>
                                    <Stack direction="row" sx={{justifyContent: 'space-between', alignItems: 'center', mt: 1, mb: 1}}>
                                        <Skeleton width={140} height={40}/>
                                        <Stack direction="row" spacing={1}>
                                            <Skeleton variant="rounded" width={60} height={24}/>
                                            <Skeleton variant="rounded" width={80} height={24}/>
                                        </Stack>
                                    </Stack>
                                    <Skeleton width={180}/>
                                    <Skeleton variant="rectangular" height={220} sx={{mt: 1.5, borderRadius: 1}}/>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))
                ) : (
                    cryptoDataList.map((value, index) => (
                        <Grid key={index} size={{xs: 12, md: 6}}>
                            <CryptoLineChart {...value} />
                        </Grid>
                    ))
                )}
            </Grid>
            <Typography component="h2" variant="h6" sx={{mb: 2}}>
                시장 심리
            </Typography>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{mb: (theme) => theme.spacing(2)}}
            >
                <Grid size={{xs: 12, md: 6}}>
                    {loading ? (
                        <Card variant="outlined" sx={{width: '100%'}}>
                            <CardContent>
                                <Skeleton width={100} height={28}/>
                                <Box sx={{display: 'flex', justifyContent: 'center', py: 2}}>
                                    <Skeleton variant="circular" width={180} height={180}/>
                                </Box>
                                <Skeleton variant="rectangular" height={80} sx={{mt: 1, borderRadius: 1}}/>
                            </CardContent>
                        </Card>
                    ) : (
                        <FearGreedGauge current={fearGreedCurrent} history={fearGreedHistory}/>
                    )}
                </Grid>
            </Grid>
        </Box>
    );
};

export default CryptoList;

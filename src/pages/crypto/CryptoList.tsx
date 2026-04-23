import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import CryptoLineChart, {CryptoLineChartProps} from "../../components/CryptoLineChart.tsx";
import FearGreedGauge from "../../components/FearGreedGauge.tsx";
import {fetchCryptoList, fetchCryptoListStream} from "../../api/crypto/CryptoApi.ts";
import {useEffect, useState} from "react";
import {CryptoChartMinute, CryptoListItem, FearGreedItem} from "../../type/CryptoType.ts";

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

const CryptoList = () => {
    const [cryptoDataList, setCryptoDataList] = useState<CryptoLineChartProps[]>([]);
    const [fearGreedCurrent, setFearGreedCurrent] = useState<FearGreedItem>({value: 0, classification: '', date: ''});
    const [fearGreedHistory, setFearGreedHistory] = useState<FearGreedItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        (async () => {
            await cryptoList();

            // 실시간 스트림 시작 요청
            await cryptoListStream();
            socket = openSocket();

            // 차트 데이터는 60초마다 갱신 (캔들 데이터는 WebSocket으로 안 오므로)
            interval = setInterval(() => {
                cryptoList();
            }, 60 * 1000);
        })();

        return () => {
            socket?.close();
            clearInterval(interval);
        }
    }, []);

    const cryptoList = async () => {
        try {
            const data = await fetchCryptoList();

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }

            const {cryptoList, fearGreed} = data.result;

            setFearGreedCurrent(fearGreed.current);
            setFearGreedHistory(fearGreed.history);

            const newCryptoDataList: CryptoLineChartProps[] = cryptoList.map((item: CryptoListItem) => {
                const dateList = item.chartMinuteList.map((chart: CryptoChartMinute) =>
                    cryptoDateFormat(chart.candleDateTimeKst)
                );

                const changeRatePercent = (item.signedChangeRate * 100).toFixed(2);

                return {
                    market: item.market,
                    title: item.koreanName,
                    value: item.tradePrice.toLocaleString(),
                    changeRate: changeRatePercent,
                    changePrice: item.signedChangePrice,
                    trend: trendColor(item.change),
                    interval: cryptoDateFormat(item.tradeDateTimeKst),
                    accTradePrice24h: formatTradePrice(item.accTradePrice24h),
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

            setCryptoDataList(newCryptoDataList);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const cryptoListStream = async () => {
        try {
            const data = await fetchCryptoListStream();

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }
        } catch (error) {
            console.error(error);
        }
    }

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "CRYPTO_TICKER" && data.data) {
                const ticker: CryptoTickerData = data.data;

                setCryptoDataList((prevList) => {
                    return prevList.map((item) => {
                        if (item.market === ticker.market) {
                            return {
                                ...item,
                                value: ticker.tradePrice.toLocaleString(),
                                changeRate: (ticker.signedChangeRate * 100).toFixed(2),
                                changePrice: ticker.signedChangePrice,
                                trend: trendColor(ticker.change),
                                interval: cryptoDateFormat(ticker.tradeDateTimeKst),
                                accTradePrice24h: formatTradePrice(ticker.accTradePrice24h),
                            };
                        }
                        return item;
                    });
                });
            }
        };

        return socket;
    }

    const trendColor = (change: string): 'up' | 'down' | 'neutral' => {
        if (change === 'RISE') return 'up';
        if (change === 'FALL') return 'down';
        return 'neutral';
    }

    const chartColor = (change: string) => {
        if (change === 'RISE') return 'red';
        if (change === 'FALL') return 'blue';
        return 'grey';
    }

    const cryptoDateFormat = (dateTime: string) => {
        if (!dateTime) return '';
        // "2026-03-17T14:30:00" -> "2026.03.17 14:30"
        // "20260317 143000" -> "2026.03.17 14:30"
        if (dateTime.includes('T')) {
            return dateTime.replace(/-/g, '.').replace('T', ' ').substring(0, 16);
        }
        // WebSocket에서 오는 "20260318 143000" 포맷 처리
        const cleaned = dateTime.replace(/\s+/g, '');
        if (cleaned.length >= 12) {
            return `${cleaned.substring(0, 4)}.${cleaned.substring(4, 6)}.${cleaned.substring(6, 8)} ${cleaned.substring(8, 10)}:${cleaned.substring(10, 12)}`;
        }
        return dateTime;
    }

    const formatTradePrice = (price: number) => {
        if (price >= 1_000_000_000_000) {
            return (price / 1_000_000_000_000).toFixed(1) + '조';
        } else if (price >= 100_000_000) {
            return (price / 100_000_000).toFixed(0) + '억';
        } else if (price >= 10_000) {
            return (price / 10_000).toFixed(0) + '만';
        }
        return price.toLocaleString();
    }

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Typography component="h2" variant="h6" sx={{mb: 2}}>
                암호화폐
            </Typography>
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
                        <FearGreedGauge current={fearGreedCurrent} history={fearGreedHistory} />
                    )}
                </Grid>
            </Grid>
        </Box>
    )
}

export default CryptoList;

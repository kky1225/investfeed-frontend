import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import Skeleton from "@mui/material/Skeleton";
import {ReactElement, useEffect, useMemo, useState} from "react";
import {Slider, Tooltip} from "@mui/material";
import {CryptoDetailLineChartProps} from "../../components/CryptoDetailLineChart.tsx";
import AssetChart from "../detail/AssetChart.tsx";
import {cryptoCandles as toCandles} from "../detail/chartCandles.ts";
import {fetchCryptoDetail, fetchCryptoStream} from "../../api/crypto/CryptoApi.ts";
import {useRealtimeWebSocket} from "../detail/useRealtimeWebSocket.ts";
import {CryptoChart, CryptoChartType, CryptoDetailReq, CryptoDetailRes} from "../../type/CryptoType.ts";
import {useParams} from "react-router-dom";
import {renderChangeAmount} from "../../components/CustomRender.tsx";
import IconButton from "@mui/material/IconButton";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import PriceTargetDialog from "../../components/PriceTargetDialog.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
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

interface CryptoRangeProps {
    value: number;
    label: ReactElement;
}

interface CryptoInfoProps {
    openingPrice: number;
    highPrice: number;
    lowPrice: number;
    tradePrice: number;
    prevClosingPrice: number;
    accTradeVolume24h: number;
    accTradePrice24h: number;
}

// 순수 헬퍼들 — 모듈 레벨로 끌어올려 useMemo 의 TDZ 회피.
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

const cryptoDateFormat = (dateTime: string, showTime: boolean) => {
    if (!dateTime) return '';
    // "2026-03-17T14:30:00" 포맷
    if (dateTime.includes('T')) {
        const formatted = dateTime.replace(/-/g, '.').replace('T', ' ');
        return showTime ? formatted.substring(0, 16) : formatted.substring(0, 10);
    }
    // WebSocket "20260318 143000" 포맷
    const cleaned = dateTime.replace(/\s+/g, '');
    if (cleaned.length >= 8) {
        const date = `${cleaned.substring(0, 4)}.${cleaned.substring(4, 6)}.${cleaned.substring(6, 8)}`;
        if (showTime && cleaned.length >= 12) {
            return `${date} ${cleaned.substring(8, 10)}:${cleaned.substring(10, 12)}`;
        }
        return date;
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

const INITIAL_CHART_DATA: CryptoDetailLineChartProps = {
    id: '-',
    title: '-',
    value: '-',
    changeRate: '0',
    changePrice: 0,
    interval: '-',
    trend: 'neutral',
    seriesData: [
        {
            id: 'crypto',
            showMark: false,
            curve: 'linear',
            area: true,
            stackOrder: 'ascending',
            color: 'grey',
            data: []
        }
    ],
    barDataList: [],
    dateList: []
};

const INITIAL_INFO: CryptoInfoProps = {
    openingPrice: 0,
    highPrice: 0,
    lowPrice: 0,
    tradePrice: 0,
    prevClosingPrice: 0,
    accTradeVolume24h: 0,
    accTradePrice24h: 0,
};

const CryptoDetail = () => {
    const { id } = useParams();
    const market = id || "";

    const [req, setReq] = useState<CryptoDetailReq>({
        chartType: CryptoChartType.DAY
    });

    const [priceTargetOpen, setPriceTargetOpen] = useState(false);

    const {data: result, isLoading, lastUpdated, pollError} = usePollingQuery<CryptoDetailRes>(
        ['cryptoDetail', market, req.chartType],
        (config) => fetchCryptoDetail(market, req, config),
    );
    const loading = isLoading;

    type LivePrice = {
        tradePrice: number;
        signedChangeRate: number;
        signedChangePrice: number;
        change: string;
        accTradeVolume24h: number;
        accTradePrice24h: number;
        tradeDateTimeKst: string;
        stamp: number;
    };
    const [livePrice, setLivePrice] = useState<LivePrice | null>(null);
    const updateIfNewer = (incoming: LivePrice) =>
        setLivePrice(prev => (!prev || incoming.stamp > prev.stamp) ? incoming : prev);

    const [prevMarket, setPrevMarket] = useState(market);
    if (market !== prevMarket) {
        setPrevMarket(market);
        setLivePrice(null);
    }

    useEffect(() => {
        if (!result?.cryptoInfo) return;
        const c = result.cryptoInfo;
        updateIfNewer({
            tradePrice: c.tradePrice,
            signedChangeRate: c.signedChangeRate,
            signedChangePrice: c.signedChangePrice,
            change: c.change,
            accTradeVolume24h: c.accTradeVolume24h,
            accTradePrice24h: c.accTradePrice24h,
            tradeDateTimeKst: c.tradeDateTimeKst,
            stamp: parseTradeStamp(c.tradeDateTimeKst),
        });
    }, [result]);

    // 폴링 결과 → base chartData (useMemo)
    const baseChartData = useMemo<CryptoDetailLineChartProps>(() => {
        if (!result) return INITIAL_CHART_DATA;
        try {
            const {cryptoInfo, chartList} = result;

            let dateList: string[];
            let lineData: number[];
            let barDataList: number[];

            switch (req.chartType) {
                case CryptoChartType.MINUTE_1:
                case CryptoChartType.MINUTE_3:
                case CryptoChartType.MINUTE_5:
                case CryptoChartType.MINUTE_10:
                case CryptoChartType.MINUTE_30: {
                    dateList = chartList.map((item: CryptoChart) => cryptoDateFormat(item.dt, true));
                    lineData = chartList.map((item: CryptoChart) => item.tradePrice);
                    barDataList = chartList.map((item: CryptoChart) => item.candleAccTradeVolume);
                    break;
                }
                case CryptoChartType.DAY:
                case CryptoChartType.WEEK:
                case CryptoChartType.MONTH:
                case CryptoChartType.YEAR: {
                    dateList = chartList.map((item: CryptoChart) => cryptoDateFormat(item.dt, false));
                    lineData = chartList.map((item: CryptoChart) => item.tradePrice);
                    barDataList = chartList.map((item: CryptoChart) => item.candleAccTradeVolume);
                    break;
                }
                default:
                    return INITIAL_CHART_DATA;
            }

            const today = cryptoDateFormat(cryptoInfo.tradeDateTimeKst, true);

            return {
                id: cryptoInfo.market,
                title: cryptoInfo.koreanName,
                value: cryptoInfo.tradePrice.toLocaleString(),
                changeRate: (cryptoInfo.signedChangeRate * 100).toFixed(2),
                changePrice: cryptoInfo.signedChangePrice,
                interval: today,
                trend: trendColor(cryptoInfo.change),
                seriesData: [
                    {
                        id: cryptoInfo.market,
                        showMark: false,
                        curve: 'linear',
                        area: true,
                        stackOrder: 'ascending',
                        color: chartColor(cryptoInfo.change),
                        data: lineData,
                    }
                ],
                barDataList: barDataList,
                dateList: dateList
            } as CryptoDetailLineChartProps;
        } catch (error) {
            console.error(error);
            return INITIAL_CHART_DATA;
        }
    }, [result, req.chartType]);

    // 폴링 결과 → base info
    const baseInfo = useMemo<CryptoInfoProps>(() => {
        if (!result) return INITIAL_INFO;
        const {cryptoInfo} = result;
        return {
            openingPrice: cryptoInfo.openingPrice,
            highPrice: cryptoInfo.highPrice,
            lowPrice: cryptoInfo.lowPrice,
            tradePrice: cryptoInfo.tradePrice,
            prevClosingPrice: cryptoInfo.prevClosingPrice,
            accTradeVolume24h: cryptoInfo.accTradeVolume24h,
            accTradePrice24h: cryptoInfo.accTradePrice24h,
        };
    }, [result]);

    // dayRange — WS 갱신 없음, 단순 useMemo
    const dayRange = useMemo<CryptoRangeProps[]>(() => {
        if (!result) {
            return [
                {value: 0, label: <p>당일 최저가 <br />0</p>},
                {value: 0, label: <p>당일 최고가 <br />0</p>},
            ];
        }
        const {cryptoInfo} = result;
        return [
            {
                value: cryptoInfo.lowPrice,
                label: <p>당일 최저가 <br />{cryptoInfo.lowPrice.toLocaleString()}</p>
            },
            {
                value: cryptoInfo.highPrice,
                label: <p>당일 최고가 <br />{cryptoInfo.highPrice.toLocaleString()}</p>
            }
        ];
    }, [result]);

    // yearRange — WS 갱신 없음, 단순 useMemo
    const yearRange = useMemo<CryptoRangeProps[]>(() => {
        if (!result) {
            return [
                {value: 0, label: <p>52주 최저가 <br />0</p>},
                {value: 0, label: <p>52주 최고가 <br />0</p>},
            ];
        }
        const {cryptoInfo} = result;
        return [
            {
                value: cryptoInfo.lowest52WeekPrice,
                label: <p>52주 최저가 <br />{cryptoInfo.lowest52WeekPrice.toLocaleString()}</p>
            },
            {
                value: cryptoInfo.highest52WeekPrice,
                label: <p>52주 최고가 <br />{cryptoInfo.highest52WeekPrice.toLocaleString()}</p>
            }
        ];
    }, [result]);

    // 최종 chartData / info = base (chart series 등) + livePrice (실시간 헤더 필드) 머지
    const chartData = useMemo<CryptoDetailLineChartProps>(() => {
        if (!livePrice) return baseChartData;
        return {
            ...baseChartData,
            value: livePrice.tradePrice.toLocaleString(),
            changeRate: (livePrice.signedChangeRate * 100).toFixed(2),
            changePrice: livePrice.signedChangePrice,
            trend: trendColor(livePrice.change),
            interval: cryptoDateFormat(livePrice.tradeDateTimeKst, true),
        };
    }, [baseChartData, livePrice]);

    const info = useMemo<CryptoInfoProps>(() => {
        if (!livePrice) return baseInfo;
        return {
            ...baseInfo,
            tradePrice: livePrice.tradePrice,
            accTradeVolume24h: livePrice.accTradeVolume24h,
            accTradePrice24h: livePrice.accTradePrice24h,
        };
    }, [baseInfo, livePrice]);

    // WebSocket 라이프사이클 — 24시간 거래라 시장 시간 체크 불필요. useRealtimeWebSocket 훅이 연결/정리 처리.
    useRealtimeWebSocket({
        subscriptionKey: market,
        streamFn: () => fetchCryptoStream([market]),
        onMessage: (event) => {
            const data = JSON.parse(event.data);
            if (data.type !== "CRYPTO_TICKER" || !data.data) return;

            const ticker: CryptoTickerData = data.data;
            // 현재 상세 페이지의 코인만 업데이트
            if (ticker.market !== id) return;

            updateIfNewer({
                tradePrice: ticker.tradePrice,
                signedChangeRate: ticker.signedChangeRate,
                signedChangePrice: ticker.signedChangePrice,
                change: ticker.change,
                accTradeVolume24h: ticker.accTradeVolume24h,
                accTradePrice24h: ticker.accTradePrice24h,
                tradeDateTimeKst: ticker.tradeDateTimeKst,
                stamp: parseTradeStamp(ticker.tradeDateTimeKst),
            });
        },
    });

    // 차트 캔들. 실시간 체결가는 차트(AssetChart)가 마지막 캔들에만 반영하고, 새 캔들은 주기적 조회로 받는다.
    // (코인 캔들은 거래소가 정한 시각에 나뉘므로, 화면에서 새 캔들을 직접 만들지 않는다.)
    const candleList = useMemo(() => toCandles(result?.chartList ?? []), [result]);

    const labelColors = {
        up: 'error' as const,
        down: 'info' as const,
        neutral: 'default' as const,
    };

    const color = labelColors[chartData.trend];
    const trendValues = {
        up: `+${chartData.changeRate}%`,
        down: `${chartData.changeRate}%`,
        neutral: `${chartData.changeRate}%`
    };

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: 'var(--page-max-width)' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                <Typography component="h2" variant="h6">
                    암호화폐 상세
                </Typography>
                <Box sx={{ flex: 1 }}/>
                {/* 날짜·시각은 여기 한 곳에만 표시한다. 마지막 체결 시각 + "기준" */}
                <FreshnessIndicator
                    lastUpdated={lastUpdated}
                    error={pollError}
                    label={loading || !chartData.interval || chartData.interval === '-' ? undefined : chartData.interval}
                />
            </Box>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{ mb: (theme) => theme.spacing(2) }}
            >
                <Grid size={{ xs: 12, md: 12 }}>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                                <Typography component="h2" variant="subtitle2" gutterBottom>
                                    {loading ? <Skeleton width={120}/> : chartData.title}
                                </Typography>
                                <Tooltip title="목표가 알림">
                                    <IconButton size="small" onClick={() => setPriceTargetOpen(true)} sx={{mb: "3px"}}>
                                        <NotificationsActiveIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                            <Stack sx={{ justifyContent: 'space-between' }}>
                                <Stack
                                    direction="row"
                                    sx={{
                                        alignContent: { xs: 'center', sm: 'flex-start' },
                                        alignItems: 'center',
                                        gap: 1,
                                    }}
                                >
                                    <Typography variant="h4" component="p">
                                        {loading ? <Skeleton width={160}/> : chartData.value}
                                    </Typography>
                                    {loading ? <Skeleton width={80}/> : renderChangeAmount(chartData.changePrice)}
                                    {loading
                                        ? <Skeleton variant="rounded" width={60} height={24}/>
                                        : <Chip size="small" color={color} label={trendValues[chartData.trend]} />}
                                </Stack>
                            </Stack>
                        </CardContent>
                        <AssetChart
                            market="CRYPTO"
                            code={market}
                            chartType={req.chartType}
                            onChartTypeChange={chartType => setReq({...req, chartType: chartType as CryptoChartType})}
                            candles={candleList}
                            livePrice={livePrice?.tradePrice}
                            liveStamp={livePrice?.stamp}
                            loading={loading}
                        />
                    </Card>
                </Grid>
            </Grid>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{ mb: (theme) => theme.spacing(2) }}
            >
                <Grid size={{ xs: 12, md: 8 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        상세 정보
                    </Typography>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            <Grid container spacing={2}>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom fontWeight={600}>
                                        시가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.openingPrice.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom fontWeight={600}>
                                        현재가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.tradePrice.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom fontWeight={600}>
                                        고가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.highPrice.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom fontWeight={600}>
                                        저가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.lowPrice.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom fontWeight={600}>
                                        전일 종가
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.prevClosingPrice.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom fontWeight={600}>
                                        거래량 (24h)
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : info.accTradeVolume24h.toLocaleString()}
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h2" variant="subtitle2" gutterBottom fontWeight={600}>
                                        거래대금 (24h)
                                    </Typography>
                                </Grid>
                                <Grid size={{xs: 12, md: 3}}>
                                    <Typography component="h3" variant="subtitle2" gutterBottom>
                                        {loading ? <Skeleton width={100}/> : formatTradePrice(info.accTradePrice24h)}
                                    </Typography>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        시세 범위
                    </Typography>
                    <Card variant="outlined" sx={{ width: '100%', overflow: 'visible' }}>
                        {loading ? (
                            <>
                                <CardContent sx={{ px: 5, height: 100 }}>
                                    <Skeleton variant="rectangular" height={40} sx={{mt: 3, borderRadius: 1}}/>
                                </CardContent>
                                <CardContent sx={{ px: 5, height: 100 }}>
                                    <Skeleton variant="rectangular" height={40} sx={{mt: 3, borderRadius: 1}}/>
                                </CardContent>
                            </>
                        ) : (
                            <>
                                <CardContent sx={{ overflow: 'visible', px: 5, height: 100 }}>
                                    <Slider
                                        aria-label="Custom marks"
                                        track={false}
                                        value={info.tradePrice}
                                        valueLabelDisplay="auto"
                                        disabled
                                        max={dayRange[1].value}
                                        min={dayRange[0].value}
                                        marks={dayRange}
                                    />
                                </CardContent>
                                <CardContent sx={{ overflow: 'visible', px: 5, height: 100 }}>
                                    <Slider
                                        aria-label="Custom marks"
                                        track={false}
                                        value={info.tradePrice}
                                        valueLabelDisplay="auto"
                                        disabled
                                        max={yearRange[1].value}
                                        min={yearRange[0].value}
                                        marks={yearRange}
                                    />
                                </CardContent>
                            </>
                        )}
                    </Card>
                </Grid>
            </Grid>
            <PriceTargetDialog
                open={priceTargetOpen}
                onClose={() => setPriceTargetOpen(false)}
                assetType="CRYPTO"
                assetCode={id ?? ""}
                assetName={chartData.title}
                currentPrice={chartData.value.replace(/,/g, '')}
            />
        </Box>
    )
}

export default CryptoDetail;

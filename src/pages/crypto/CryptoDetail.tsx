import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import Skeleton from "@mui/material/Skeleton";
import {MouseEvent, ReactElement, useEffect, useRef, useState} from "react";
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart';
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup, {toggleButtonGroupClasses,} from '@mui/material/ToggleButtonGroup';
import {styled} from "@mui/material/styles";
import {Select, SelectChangeEvent, Slider, Tooltip} from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import CryptoDetailLineChart, {CryptoDetailLineChartProps} from "../../components/CryptoDetailLineChart.tsx";
import {fetchCryptoDetail, fetchCryptoDetailStream} from "../../api/crypto/CryptoApi.ts";
import {CryptoChart, CryptoChartType, CryptoDetailReq} from "../../type/CryptoType.ts";
import {useParams} from "react-router-dom";
import {renderChangeAmount} from "../../components/CustomRender.tsx";
import IconButton from "@mui/material/IconButton";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import PriceTargetDialog from "../../components/PriceTargetDialog.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";

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

const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
    border: 'none',
    boxShadow: 'none',
    [`& .${toggleButtonGroupClasses.grouped}`]: {
        border: 0,
        borderRadius: theme.shape.borderRadius,
        [`&.${toggleButtonGroupClasses.disabled}`]: {
            border: 0,
        },
    },
    [`& .${toggleButtonGroupClasses.middleButton},& .${toggleButtonGroupClasses.lastButton}`]:
        {
            marginLeft: -1,
            borderLeft: '1px solid transparent',
        },
}));

interface CryptoRangeProps {
    value: number;
    label: ReactElement;
}

const CryptoDetail = () => {
    const { id } = useParams();

    const [req, setReq] = useState<CryptoDetailReq>({
        market: id || "",
        chartType: CryptoChartType.DAY
    });

    const [priceTargetOpen, setPriceTargetOpen] = useState(false);
    const [chartData, setChartData] = useState<CryptoDetailLineChartProps>({
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
    });

    interface CryptoInfoProps {
        openingPrice: number;
        highPrice: number;
        lowPrice: number;
        tradePrice: number;
        prevClosingPrice: number;
        accTradeVolume24h: number;
        accTradePrice24h: number;
    }

    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [pollError, setPollError] = useState(false);

    const [info, setInfo] = useState<CryptoInfoProps>({
        openingPrice: 0,
        highPrice: 0,
        lowPrice: 0,
        tradePrice: 0,
        prevClosingPrice: 0,
        accTradeVolume24h: 0,
        accTradePrice24h: 0,
    });

    const [dayRange, setDayRange] = useState<CryptoRangeProps[]>([
        {
            value: 0,
            label: <p>당일 최저가 <br />0</p>
        },
        {
            value: 0,
            label: <p>당일 최고가 <br />0</p>,
        }
    ]);

    const [yearRange, setYearRange] = useState<CryptoRangeProps[]>([
        {
            value: 0,
            label: <p>52주 최저가 <br />0</p>,
        },
        {
            value: 0,
            label: <p>52주 최고가 <br />0</p>,
        }
    ]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        setLoading(true);

        (async () => {
            await cryptoDetail(req);

            // 해당 코인만 실시간 스트림 시작 + WebSocket 연결
            await cryptoDetailStream();
            socket = openSocket();

            // 차트 데이터는 60초마다 갱신
            interval = setInterval(() => {
                cryptoDetail(req, true);
            }, 60 * 1000);
        })();

        return () => {
            socket?.close();
            clearInterval(interval);
        }
    }, [req]);

    const cryptoDetail = async (req: CryptoDetailReq, silent: boolean = false) => {
        try {
            const data = await fetchCryptoDetail(req, silent ? { skipGlobalError: true } : undefined);

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }

            const { cryptoInfo, chartList } = data.result;

            let dateList: string[];
            let lineData: number[];
            let barDataList: number[];

            switch (req.chartType) {
                case CryptoChartType.MINUTE_1:
                case CryptoChartType.MINUTE_3:
                case CryptoChartType.MINUTE_5:
                case CryptoChartType.MINUTE_10:
                case CryptoChartType.MINUTE_30: {
                    dateList = chartList.map((item: CryptoChart) =>
                        cryptoDateFormat(item.dt, true)
                    );
                    lineData = chartList.map((item: CryptoChart) => item.tradePrice);
                    barDataList = chartList.map((item: CryptoChart) => item.candleAccTradeVolume);
                    break;
                }
                case CryptoChartType.DAY:
                case CryptoChartType.WEEK:
                case CryptoChartType.MONTH:
                case CryptoChartType.YEAR: {
                    dateList = chartList.map((item: CryptoChart) =>
                        cryptoDateFormat(item.dt, false)
                    );
                    lineData = chartList.map((item: CryptoChart) => item.tradePrice);
                    barDataList = chartList.map((item: CryptoChart) => item.candleAccTradeVolume);
                    break;
                }
            }

            const today = cryptoDateFormat(cryptoInfo.tradeDateTimeKst, true);

            setChartData({
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
            });

            setInfo({
                openingPrice: cryptoInfo.openingPrice,
                highPrice: cryptoInfo.highPrice,
                lowPrice: cryptoInfo.lowPrice,
                tradePrice: cryptoInfo.tradePrice,
                prevClosingPrice: cryptoInfo.prevClosingPrice,
                accTradeVolume24h: cryptoInfo.accTradeVolume24h,
                accTradePrice24h: cryptoInfo.accTradePrice24h,
            });

            setDayRange([
                {
                    value: cryptoInfo.lowPrice,
                    label: <p>당일 최저가 <br />{cryptoInfo.lowPrice.toLocaleString()}</p>
                },
                {
                    value: cryptoInfo.highPrice,
                    label: <p>당일 최고가 <br />{cryptoInfo.highPrice.toLocaleString()}</p>
                }
            ]);

            setYearRange([
                {
                    value: cryptoInfo.lowest52WeekPrice,
                    label: <p>52주 최저가 <br />{cryptoInfo.lowest52WeekPrice.toLocaleString()}</p>
                },
                {
                    value: cryptoInfo.highest52WeekPrice,
                    label: <p>52주 최고가 <br />{cryptoInfo.highest52WeekPrice.toLocaleString()}</p>
                }
            ]);
            setLastUpdated(new Date());
            setPollError(false);

        } catch (error) {
            console.error(error);
            if (silent) setPollError(true);
        } finally {
            setLoading(false);
        }
    }

    const cryptoDetailStream = async () => {
        try {
            if (!id) return;
            const data = await fetchCryptoDetailStream(id);
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

                // 현재 상세 페이지의 코인만 업데이트
                if (ticker.market !== id) return;

                const tradeDateTimeKst = cryptoDateFormat(ticker.tradeDateTimeKst, true);

                setChartData((prev) => ({
                    ...prev,
                    value: ticker.tradePrice.toLocaleString(),
                    changeRate: (ticker.signedChangeRate * 100).toFixed(2),
                    changePrice: ticker.signedChangePrice,
                    trend: trendColor(ticker.change),
                    interval: tradeDateTimeKst,
                }));

                setInfo((prev) => ({
                    ...prev,
                    tradePrice: ticker.tradePrice,
                    accTradeVolume24h: ticker.accTradeVolume24h,
                    accTradePrice24h: ticker.accTradePrice24h,
                }));
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

    const [toggle, setToggle] = useState('DAY');
    const [formats, setFormats] = useState('line');
    const minute = useRef('3');

    const handleFormat = (
        _event: MouseEvent<HTMLElement>,
        newFormats: string,
    ) => {
        if (newFormats !== null) {
            setFormats(newFormats);
        }
    };

    const handleAlignment = (
        _event: MouseEvent<HTMLElement>,
        newAlignment: string,
    ) => {
        if (newAlignment !== null) {
            setToggle(newAlignment);

            if (newAlignment === 'MINUTE') {
                newAlignment = newAlignment + '_' + minute.current;
            }

            setReq({
                ...req,
                chartType: newAlignment as CryptoChartType
            })
        }
    };

    function handleOptionChange(event: SelectChangeEvent) {
        minute.current = event.target.value as string;

        const value = 'MINUTE_' + event.target.value;

        setReq({
            ...req,
            chartType: value as CryptoChartType
        })
    }

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
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                <Typography component="h2" variant="h6">
                    암호화폐 상세
                </Typography>
                <Box sx={{ flex: 1 }}/>
                <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>
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
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {loading ? <Skeleton width={140}/> : chartData.interval}
                                </Typography>
                            </Stack>
                        </CardContent>
                        <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                            <Box sx={{ minWidth: 1200 }}>
                                {loading ? (
                                    <Skeleton variant="rectangular" height={400} sx={{mx: 2, mb: 2, borderRadius: 1}}/>
                                ) : (
                                    <CryptoDetailLineChart {...chartData} />
                                )}
                            </Box>
                        </Box>
                        <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            flexWrap="wrap"
                        >
                            <StyledToggleButtonGroup
                                size="small"
                                value={toggle}
                                exclusive
                                onChange={handleAlignment}
                                aria-label="text alignment"
                            >
                                <ToggleButton
                                    value="MINUTE"
                                    key="MINUTE"
                                    aria-label="MINUTE"
                                    sx={{
                                        padding: 1
                                    }}
                                >
                                    <Select
                                        size="small"
                                        value={minute.current}
                                        onChange={handleOptionChange}
                                        variant="standard"
                                        disableUnderline
                                        sx={{
                                            boxShadow: 'none',
                                            width: 55,
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            padding: '0 8px',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <MenuItem value="1">1분</MenuItem>
                                        <MenuItem value="3">3분</MenuItem>
                                        <MenuItem value="5">5분</MenuItem>
                                        <MenuItem value="10">10분</MenuItem>
                                        <MenuItem value="30">30분</MenuItem>
                                    </Select>
                                </ToggleButton>
                                <ToggleButton value="DAY" key="DAY" aria-label="DAY">일</ToggleButton>
                                <ToggleButton value="WEEK" key="WEEK" aria-label="WEEK">주</ToggleButton>
                                <ToggleButton value="MONTH" key="MONTH" aria-label="MONTH">월</ToggleButton>
                                <ToggleButton value="YEAR" key="YEAR" aria-label="YEAR">연</ToggleButton>
                            </StyledToggleButtonGroup>

                            <StyledToggleButtonGroup
                                size="small"
                                value={formats}
                                exclusive
                                onChange={handleFormat}
                                aria-label="text formatting"
                            >
                                <ToggleButton value="candle" key="candle" aria-label="candle" disabled>
                                    <CandlestickChartIcon />
                                </ToggleButton>
                                <ToggleButton value="line" key="line" aria-label="line">
                                    <StackedLineChartIcon />
                                </ToggleButton>
                            </StyledToggleButtonGroup>
                        </Box>
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

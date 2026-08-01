import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import Skeleton from "@mui/material/Skeleton";
import {MouseEvent, ReactElement, SyntheticEvent, useEffect, useMemo, useRef, useState} from "react";
import CandlestickChartIcon from '@mui/icons-material/CandlestickChart';
import StackedLineChartIcon from '@mui/icons-material/StackedLineChart';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup, {toggleButtonGroupClasses,} from '@mui/material/ToggleButtonGroup';
import {styled} from "@mui/material/styles";
import {Select, SelectChangeEvent, Slider, Tabs, Tab} from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import CryptoDetailLineChart, {CryptoDetailLineChartProps} from "../../components/CryptoDetailLineChart.tsx";
import {fetchUsStockDetail, fetchUsStockDetailStream} from "../../api/usStock/UsStockApi.ts";
import {fetchNews} from "../../api/news/NewsApi.ts";
import {requireOk} from "../../lib/apiResponse.ts";
import {useRealtimeWebSocket} from "../detail/useRealtimeWebSocket.ts";
import {UsStockChart, UsStockChartType, UsStockDetailRes} from "../../type/UsStockType.ts";
import {StockStreamRes} from "../../type/StockType.ts";
import {useParams} from "react-router-dom";
import {renderChangeAmount} from "../../components/CustomRender.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {usePollingQuery} from "../../lib/pollingQuery.ts";
import {EXCHANGE_LABEL} from "../../lib/exchange.ts";

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

interface UsStockRangeProps {
    value: number;
    label: ReactElement;
}

const num = (raw: string | null | undefined): number => {
    if (!raw) return 0;
    const n = Number(String(raw).replace(/^[+-]/, ''));
    return Number.isFinite(n) ? n : 0;
};

const usdFormat = (n: number) =>
    n.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 4});

const usdText = (raw: string | null | undefined): string =>
    raw ? `$${usdFormat(num(raw))}` : '-';

const trendFromSig = (sig: string | null | undefined): 'up' | 'down' | 'neutral' => {
    if (sig === '1' || sig === '2') return 'up';
    if (sig === '4' || sig === '5') return 'down';
    return 'neutral';
};

const chartColorFromTrend = (trend: 'up' | 'down' | 'neutral') => {
    if (trend === 'up') return 'red';
    if (trend === 'down') return 'blue';
    return 'grey';
};

const usDateFormat = (raw: string | null | undefined, showTime: boolean) => {
    if (!raw) return '';
    const cleaned = raw.replace(/\s+/g, '');
    if (cleaned.length < 8) return raw;
    if (showTime && cleaned.length >= 12) {
        return `${cleaned.substring(4, 6)}.${cleaned.substring(6, 8)} ${cleaned.substring(8, 10)}:${cleaned.substring(10, 12)}`;
    }
    return `${cleaned.substring(0, 4)}.${cleaned.substring(4, 6)}.${cleaned.substring(6, 8)}`;
};

const formatMac = (macThousandUsd: number) => {
    const usd = macThousandUsd * 1_000;
    if (usd >= 1_000_000_000_000) return (usd / 1_000_000_000_000).toFixed(1) + '조 달러';
    if (usd >= 100_000_000) return (usd / 100_000_000).toFixed(0).toLocaleString() + '억 달러';
    return usd.toLocaleString() + ' 달러';
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
            id: 'usStock',
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

const MINUTE_TYPES = [
    UsStockChartType.MINUTE_1,
    UsStockChartType.MINUTE_3,
    UsStockChartType.MINUTE_5,
    UsStockChartType.MINUTE_10,
    UsStockChartType.MINUTE_30,
];

const UsStockDetail = () => {
    const { stexTp: stexTpParam, stkCd: stkCdParam } = useParams();
    const stexTp = stexTpParam || "";
    const stkCd = stkCdParam || "";

    const [chartType, setChartType] = useState<UsStockChartType>(UsStockChartType.DAY);

    const {data: result, isLoading, lastUpdated, pollError} = usePollingQuery<UsStockDetailRes>(
        ['usStockDetail', stexTp, stkCd, chartType],
        (config) => fetchUsStockDetail(stkCd, {stexTp, chartType}, config),
    );
    const loading = isLoading;

    type LivePrice = {
        curPrc: number;
        predPre: number;
        fluRt: string;
        trend: 'up' | 'down' | 'neutral';
        stamp: number;
    };
    const [livePrice, setLivePrice] = useState<LivePrice | null>(null);
    const updateIfNewer = (incoming: LivePrice) =>
        setLivePrice(prev => (!prev || incoming.stamp > prev.stamp) ? incoming : prev);

    const subscriptionKey = `${stexTp}|${stkCd}`;
    const [prevKey, setPrevKey] = useState(subscriptionKey);
    if (subscriptionKey !== prevKey) {
        setPrevKey(subscriptionKey);
        setLivePrice(null);
    }

    useEffect(() => {
        if (!result?.usStockInfo) return;
        const s = result.usStockInfo;
        const predPre = Number(String(s.predPre ?? '0'));
        updateIfNewer({
            curPrc: num(s.curPrc),
            predPre: Number.isFinite(predPre) ? predPre : 0,
            fluRt: s.fluRt ?? '0',
            trend: trendFromSig(s.predPreSig),
            stamp: lastUpdated?.getTime() ?? 0,
        });
    }, [result, lastUpdated]);

    useRealtimeWebSocket({
        subscriptionKey,
        streamFn: () => fetchUsStockDetailStream({stkCd, stexTp}),
        onMessage: (event) => {
            const data = JSON.parse(event.data);
            if (data.trnm !== "REAL" || !Array.isArray(data.data)) return;

            data.data.forEach((res: StockStreamRes) => {
                if (res.item !== stkCd) return;
                const values = res.values;
                const predPre = Number(String(values["11"] ?? '0'));

                updateIfNewer({
                    curPrc: num(values["10"]),
                    predPre: Number.isFinite(predPre) ? predPre : 0,
                    fluRt: values["12"] ?? '0',
                    trend: trendFromSig((values["25"] ?? '3').replace(/^[+-]/, '')),
                    stamp: Date.now(),
                });
            });
        },
    });

    const baseChartData = useMemo<CryptoDetailLineChartProps>(() => {
        if (!result) return INITIAL_CHART_DATA;
        try {
            const {usStockInfo, chartList} = result;
            const isMinute = MINUTE_TYPES.includes(chartType);

            const dateList = chartList.map((item: UsStockChart) => usDateFormat(item.dt, isMinute));
            const lineData = chartList.map((item: UsStockChart) => num(item.curPrc));
            const barDataList = chartList.map((item: UsStockChart) => num(item.trdeQty));

            const trend = trendFromSig(usStockInfo.predPreSig);
            const predPre = Number(String(usStockInfo.predPre ?? '0'));

            return {
                id: usStockInfo.stkCd ?? '-',
                title: `${usStockInfo.stkNm ?? usStockInfo.stkEnm ?? ''} (${usStockInfo.stkCd ?? ''})`,
                value: usdFormat(num(usStockInfo.curPrc)),
                changeRate: (usStockInfo.fluRt ?? '0').replace(/^\+/, ''),
                changePrice: Number.isFinite(predPre) ? predPre : 0,
                interval: '',
                trend,
                seriesData: [
                    {
                        id: usStockInfo.stkCd ?? 'usStock',
                        showMark: false,
                        curve: 'linear',
                        area: true,
                        stackOrder: 'ascending',
                        color: chartColorFromTrend(trend),
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
    }, [result, chartType]);

    const chartData = useMemo<CryptoDetailLineChartProps>(() => {
        if (!livePrice) return baseChartData;
        return {
            ...baseChartData,
            value: usdFormat(livePrice.curPrc),
            changeRate: livePrice.fluRt.replace(/^\+/, ''),
            changePrice: livePrice.predPre,
            trend: livePrice.trend,
        };
    }, [baseChartData, livePrice]);

    const info = result?.usStockInfo;
    const curPrcNum = livePrice?.curPrc ?? num(info?.curPrc);

    const krwPrice = useMemo(() => {
        const exrt = num(info?.baseExrt);
        if (!exrt || !curPrcNum) return null;
        return Math.round(curPrcNum * exrt);
    }, [info, curPrcNum]);

    const dayRange = useMemo<{marks: UsStockRangeProps[]; label: string}>(() => {
        const useToday = !!info?.highPric && !!info?.lowPric;
        const high = num(useToday ? info?.highPric : info?.preHighPric);
        const low = num(useToday ? info?.lowPric : info?.preLowPric);
        const label = useToday ? '당일' : '전일';
        return {
            label,
            marks: [
                {value: low, label: <p>{label} 최저가 <br />${usdFormat(low)}</p>},
                {value: high, label: <p>{label} 최고가 <br />${usdFormat(high)}</p>},
            ],
        };
    }, [info]);

    const yearRange = useMemo<UsStockRangeProps[]>(() => {
        const high = num(info?.wk52HgstPric);
        const low = num(info?.wk52LwstPric);
        return [
            {
                value: low,
                label: <p>52주 최저가 <br />${usdFormat(low)}<br />{usDateFormat(info?.wk52LwstPricDt, false)}</p>
            },
            {
                value: high,
                label: <p>52주 최고가 <br />${usdFormat(high)}<br />{usDateFormat(info?.wk52HgstPricDt, false)}</p>
            }
        ];
    }, [info]);

    const dailyColumns: GridColDef[] = useMemo(() => [
        {field: 'dt', headerName: '날짜', flex: 1, minWidth: 100},
        {field: 'curPrc', headerName: '종가', flex: 1, minWidth: 90, align: 'right', headerAlign: 'right'},
        {
            field: 'fluRt', headerName: '등락률', flex: 1, minWidth: 80, align: 'right', headerAlign: 'right',
            renderCell: (params) => {
                const v = String(params.value ?? '');
                const color = v.startsWith('-') ? 'info.main' : (num(v) > 0 ? 'error.main' : 'text.primary');
                return <Typography variant="body2" sx={{color}} component="span">{v ? `${v}%` : '-'}</Typography>;
            }
        },
        {field: 'openPric', headerName: '시가', flex: 1, minWidth: 90, align: 'right', headerAlign: 'right'},
        {field: 'highPric', headerName: '고가', flex: 1, minWidth: 90, align: 'right', headerAlign: 'right'},
        {field: 'lowPric', headerName: '저가', flex: 1, minWidth: 90, align: 'right', headerAlign: 'right'},
        {field: 'accTrdeQty', headerName: '거래량', flex: 1, minWidth: 110, align: 'right', headerAlign: 'right'},
    ], []);

    const dailyRows = useMemo(() => {
        return (result?.dailyPriceList ?? []).map((d, idx) => ({
            id: d.dt ?? String(idx),
            dt: usDateFormat(d.dt, false),
            curPrc: usdText(d.curPrc),
            fluRt: (d.fluRt ?? '').replace(/^\+/, '+'),
            openPric: usdText(d.openPric),
            highPric: usdText(d.highPric),
            lowPric: usdText(d.lowPric),
            accTrdeQty: num(d.accTrdeQty).toLocaleString(),
        }));
    }, [result]);

    const [tabValue, setTabValue] = useState<'daily' | 'news'>('daily');
    const [newsItems, setNewsItems] = useState<{title: string; link: string; description: string; pubDate: string}[]>([]);
    const [newsPage, setNewsPage] = useState(1);
    const [newsTotal, setNewsTotal] = useState(0);
    const [newsLoaded, setNewsLoaded] = useState(false);

    const newsQuery = info?.stkNm || info?.stkEnm || stkCd;

    const loadNews = async (query: string, page: number) => {
        try {
            const res = await fetchNews({query, page});
            const data = requireOk(res, {items: [], total: 0} as {items: {title: string; link: string; description: string; pubDate: string}[]; total: number});
            if (page === 1) {
                setNewsItems(data.items ?? []);
            } else {
                setNewsItems(prev => [...prev, ...(data.items ?? [])]);
            }
            setNewsTotal(data.total ?? 0);
            setNewsPage(page);
            setNewsLoaded(true);
        } catch (e) {
            console.error(e);
        }
    };

    const handleTabChange = (_event: SyntheticEvent, newValue: 'daily' | 'news') => {
        setTabValue(newValue);
        if (newValue === 'news' && !newsLoaded && info) {
            loadNews(newsQuery, 1);
        }
    };

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

            setChartType(newAlignment as UsStockChartType);
        }
    };

    function handleOptionChange(event: SelectChangeEvent) {
        minute.current = event.target.value as string;
        setChartType(('MINUTE_' + event.target.value) as UsStockChartType);
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

    const infoRows: { label: string; value: string }[] = useMemo(() => {
        if (!info) return [];
        const industry = [info.lgIndsCd, info.smIndsCd].filter(Boolean).join(' / ');
        const openPric = info.openPric || info.preOpenPric;
        const highPric = info.highPric || info.preHighPric;
        const lowPric = info.lowPric || info.preLowPric;
        return [
            {label: '거래소', value: EXCHANGE_LABEL[stexTp] ?? stexTp},
            {label: '시가', value: usdText(openPric)},
            {label: '고가', value: usdText(highPric)},
            {label: '저가', value: usdText(lowPric)},
            {label: '전일 종가', value: usdText(info.baseClosePric)},
            {label: '거래량', value: num(info.accTrdeQty).toLocaleString()},
            {label: '시가총액', value: info.mac ? formatMac(num(info.mac)) : '-'},
            {label: '상장주식수', value: info.stkCnt ? num(info.stkCnt).toLocaleString() : '-'},
            {label: '업종', value: industry || '-'},
            {label: '환율', value: info.baseExrt ? num(info.baseExrt).toLocaleString() : '-'},
            {label: '거래 상태', value: info.trdSuspTp === '0' ? '정상' : (info.trdSuspTp ? '거래정지' : '-')},
        ];
    }, [info]);

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                <Typography component="h2" variant="h6">
                    미국 주식 상세
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
                            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                <Typography component="h2" variant="subtitle2" gutterBottom>
                                    {loading ? <Skeleton width={120}/> : chartData.title}
                                </Typography>
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
                                        {loading ? <Skeleton width={160}/> : `$${chartData.value}`}
                                    </Typography>
                                    {loading ? <Skeleton width={80}/> : renderChangeAmount(chartData.changePrice)}
                                    {loading
                                        ? <Skeleton variant="rounded" width={60} height={24}/>
                                        : <Chip size="small" color={color} label={trendValues[chartData.trend]} />}
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {loading
                                        ? <Skeleton width={140}/>
                                        : (krwPrice ? `약 ${krwPrice.toLocaleString()}원` : '')}
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
                                aria-label="chart period"
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
                                <ToggleButton value="YEAR" key="YEAR" aria-label="YEAR">년</ToggleButton>
                            </StyledToggleButtonGroup>

                            <StyledToggleButtonGroup
                                size="small"
                                value={formats}
                                exclusive
                                onChange={handleFormat}
                                aria-label="chart format"
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
                                {loading ? (
                                    Array.from({length: 10}).map((_, idx) => (
                                        <Grid size={{xs: 12, md: 6}} key={idx}>
                                            <Skeleton width="80%"/>
                                        </Grid>
                                    ))
                                ) : (
                                    infoRows.map((row) => (
                                        <Grid size={{xs: 12, md: 6}} key={row.label} container>
                                            <Grid size={{xs: 6, md: 6}}>
                                                <Typography component="h2" variant="subtitle2" gutterBottom fontWeight={600}>
                                                    {row.label}
                                                </Typography>
                                            </Grid>
                                            <Grid size={{xs: 6, md: 6}}>
                                                <Typography component="h3" variant="subtitle2" gutterBottom>
                                                    {row.value}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    ))
                                )}
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
                                        aria-label="day range"
                                        track={false}
                                        value={curPrcNum}
                                        valueLabelDisplay="auto"
                                        disabled
                                        max={dayRange.marks[1].value}
                                        min={dayRange.marks[0].value}
                                        marks={dayRange.marks}
                                    />
                                </CardContent>
                                <CardContent sx={{ overflow: 'visible', px: 5, height: 120 }}>
                                    <Slider
                                        aria-label="52 week range"
                                        track={false}
                                        value={curPrcNum}
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
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{ mb: (theme) => theme.spacing(2) }}
            >
                <Grid size={{ xs: 12, md: 12 }}>
                    <Box sx={{borderBottom: 1, borderColor: 'divider', mb: 2}}>
                        <Tabs value={tabValue} onChange={handleTabChange} aria-label="us stock detail tabs">
                            <Tab label="일별 시세" value='daily' />
                            <Tab label="뉴스" value='news' />
                        </Tabs>
                    </Box>
                    {tabValue === 'daily' ? (
                        <DataGrid
                            rows={dailyRows}
                            columns={dailyColumns}
                            getRowClassName={(params) =>
                                params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd'
                            }
                            initialState={{
                                pagination: { paginationModel: { pageSize: 20 } },
                            }}
                            pageSizeOptions={[10, 20, 50, 100]}
                            disableColumnResize
                            density="compact"
                            autoHeight
                            loading={loading}
                            slotProps={{
                                loadingOverlay: {
                                    variant: 'skeleton',
                                    noRowsVariant: 'skeleton',
                                },
                            }}
                        />
                    ) : (
                        <Box sx={{mt: 2}}>
                            {newsItems.length > 0 ? (
                                <>
                                    {newsItems.map((item, index) => (
                                        <Box key={index} sx={{py: 1.5, borderBottom: '1px solid', borderColor: 'divider', cursor: 'pointer', '&:hover': {bgcolor: 'action.hover'}}}
                                            onClick={() => window.open(item.link, '_blank')}>
                                            <Typography variant="body2" sx={{fontWeight: 600, mb: 0.5}}>{item.title}</Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
                                                {item.description}
                                            </Typography>
                                            <Typography variant="caption" color="text.disabled" sx={{display: 'block', mt: 0.5}}>
                                                {item.pubDate}
                                            </Typography>
                                        </Box>
                                    ))}
                                    {newsItems.length < newsTotal && (
                                        <Box sx={{textAlign: 'center', mt: 2}}>
                                            <Button size="small" onClick={() => loadNews(newsQuery, newsPage + 1)}>
                                                더보기
                                            </Button>
                                        </Box>
                                    )}
                                </>
                            ) : newsLoaded ? (
                                <Typography variant="body2" color="text.secondary" sx={{py: 2, textAlign: 'center'}}>
                                    관련 뉴스가 없습니다.
                                </Typography>
                            ) : null}
                        </Box>
                    )}
                </Grid>
            </Grid>
        </Box>
    )
}

export default UsStockDetail;

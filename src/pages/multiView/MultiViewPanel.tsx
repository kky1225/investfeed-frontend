import {type MouseEvent, useMemo, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {unwrapResponse} from "../../lib/apiResponse.ts";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup, {toggleButtonGroupClasses} from "@mui/material/ToggleButtonGroup";
import MenuItem from "@mui/material/MenuItem";
import {Select, type SelectChangeEvent} from "@mui/material";
import {styled} from "@mui/material/styles";
import Skeleton from "@mui/material/Skeleton";
import AddIcon from "@mui/icons-material/Add";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CandlestickChartIcon from "@mui/icons-material/CandlestickChart";
import StackedLineChartIcon from "@mui/icons-material/StackedLineChart";
import StockDetailLineChart, {type CustomStockDetailLineChartProps} from "../../components/StockDetailLineChart.tsx";
import CryptoDetailLineChart, {type CryptoDetailLineChartProps} from "../../components/CryptoDetailLineChart.tsx";
import CommodityDetailLineChart, {type CommodityDetailLineChartProps} from "../../components/CommodityDetailLineChart.tsx";
import {
    fetchMultiViewStockChart,
    fetchMultiViewCryptoDetail,
    fetchMultiViewCommodityDetail,
} from "../../api/multiView/MultiViewApi.ts";
import {StockChartType} from "../../type/StockType.ts";
import {CryptoChartType} from "../../type/CryptoType.ts";
import {CommodityChartType} from "../../type/CommodityType.ts";
import {renderChangeAmount} from "../../components/CustomRender.tsx";
import type {MultiViewAssetType, SelectedAsset, StreamUpdate} from "../../type/MultiViewType.ts";
import {useNavigate} from "react-router-dom";

const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({theme}) => ({
    border: 'none',
    boxShadow: 'none',
    [`& .${toggleButtonGroupClasses.grouped}`]: {
        border: 0,
        borderRadius: theme.shape.borderRadius,
        [`&.${toggleButtonGroupClasses.disabled}`]: {border: 0},
    },
    [`& .${toggleButtonGroupClasses.middleButton},& .${toggleButtonGroupClasses.lastButton}`]: {
        marginLeft: -1,
        borderLeft: '1px solid transparent',
    },
}));

interface MultiViewPanelProps {
    asset: SelectedAsset | null;
    onSearch: () => void;
    onChartExpand: () => void;
    onRemove: () => void;
    streamUpdate?: StreamUpdate | null;
    reloadKey?: number;
}

const labelColors = {
    up: 'error' as const,
    down: 'info' as const,
    neutral: 'default' as const,
};

const trendColor = (preSig: string): 'up' | 'down' | 'neutral' => {
    const sig = Number(preSig);
    if (sig === 2 || sig === 1) return 'up';
    if (sig === 4 || sig === 5) return 'down';
    return 'neutral';
};

// CryptoDetail 와 동일: dt 가 ISO(`2026-03-17T14:30:00`) 또는 compact(`20260318143000`) 둘 다 가능
const cryptoDateFormat = (dateTime: string, showTime: boolean): string => {
    if (!dateTime) return '';
    if (dateTime.includes('T')) {
        const f = dateTime.replace(/-/g, '.').replace('T', ' ');
        return showTime ? f.substring(0, 16) : f.substring(0, 10);
    }
    const cleaned = dateTime.replace(/\s+/g, '');
    if (cleaned.length >= 8) {
        const date = `${cleaned.substring(0, 4)}.${cleaned.substring(4, 6)}.${cleaned.substring(6, 8)}`;
        if (showTime && cleaned.length >= 12) return `${date} ${cleaned.substring(8, 10)}:${cleaned.substring(10, 12)}`;
        return date;
    }
    return dateTime;
};

export default function MultiViewPanel({asset, onSearch, onChartExpand, onRemove, streamUpdate, reloadKey}: MultiViewPanelProps) {
    const navigate = useNavigate();
    const [toggle, setToggle] = useState('DAY');
    const [formats, setFormats] = useState('line');
    const [minuteUnit, setMinuteUnit] = useState('1');
    const chartType = toggle.startsWith('MINUTE') ? `MINUTE_${minuteUnit}` : toggle;

    // WebSocket overlay (streamUpdate prop 으로부터 들어오는 실시간 가격 갱신)
    const [liveOverlay, setLiveOverlay] = useState<Partial<{
        value: string;
        fluRt: string;
        predPre: string;
        changeRate: string;
        changePrice: number;
        trend: 'up' | 'down' | 'neutral';
    }>>({});

    // streamUpdate prop 이 바뀔 때마다 overlay 업데이트 — "reset state during render" 패턴
    const [prevStream, setPrevStream] = useState<StreamUpdate | null | undefined>(undefined);
    if (streamUpdate !== prevStream) {
        setPrevStream(streamUpdate);
        if (streamUpdate && asset) {
            if (asset.type === 'STOCK' || asset.type === 'COMMODITY') {
                setLiveOverlay({
                    value: Number(streamUpdate.value).toLocaleString(),
                    fluRt: streamUpdate.fluRt,
                    predPre: streamUpdate.predPre,
                    trend: streamUpdate.trend,
                });
            } else if (asset.type === 'CRYPTO') {
                setLiveOverlay({
                    value: Number(streamUpdate.value).toLocaleString(),
                    changeRate: streamUpdate.fluRt,
                    changePrice: Number(streamUpdate.predPre),
                    trend: streamUpdate.trend,
                });
            }
        }
    }

    // asset / chartType / reloadKey 변경 시 자동 fetch (queryKey 에 모두 포함)
    const {data: queryData} = useQuery({
        queryKey: ['multiViewPanel', asset?.type, asset?.code, chartType, reloadKey ?? 0],
        queryFn: async ({signal}) => {
            if (!asset) return null;
            if (asset.type === 'STOCK') {
                const stockChartType = chartType as StockChartType;
                return unwrapResponse(await fetchMultiViewStockChart(asset.code, {chartType: stockChartType}, {signal, skipGlobalError: true}), null);
            }
            if (asset.type === 'CRYPTO') {
                const cryptoChartType = chartType as CryptoChartType;
                return unwrapResponse(await fetchMultiViewCryptoDetail(asset.code, {chartType: cryptoChartType}, {signal, skipGlobalError: true}), null);
            }
            if (asset.type === 'COMMODITY') {
                const commodityChartType = chartType as CommodityChartType;
                return unwrapResponse(await fetchMultiViewCommodityDetail(asset.code, {chartType: commodityChartType}, {signal, skipGlobalError: true}), null);
            }
            return null;
        },
        enabled: !!asset,
        retry: 2,
        retryDelay: (count) => 1000 * (count + 1),
    });

    // queryData → 화면 prop 변환 (자산 타입별 분기)
    const baseChartData = useMemo<CustomStockDetailLineChartProps | CryptoDetailLineChartProps | CommodityDetailLineChartProps | null>(() => {
        if (!queryData || !asset) return null;
        const isMinute = chartType.startsWith('MINUTE');
        try {
            if (asset.type === 'STOCK') {
                const {stockInfo, stockChartList} = (queryData as any) ?? {};
                if (!stockInfo || !stockChartList) return null;

                let dateList: string[];
                let lineData: any[];
                if (isMinute) {
                    dateList = stockChartList.map((item: {dt: string}) =>
                        `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)} ${item.dt.slice(8, 10)}:${item.dt.slice(10, 12)}`
                    ).reverse();
                    lineData = stockChartList.map((item: {curPrc: string}) => Number(item.curPrc.replace(/^[+-]/, ''))).reverse();
                } else {
                    dateList = stockChartList.map((item: {dt: string}) =>
                        `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)}`
                    ).reverse();
                    lineData = stockChartList.map((item: {curPrc: string}) => item.curPrc).reverse();
                }
                const barDataList: number[] = stockChartList.map((item: {trdeQty: string}) => Number(item.trdeQty)).reverse();

                const tm = stockInfo.tm;
                const year = tm.substring(0, 4), month = tm.substring(4, 6), day = tm.substring(6, 8);
                const hour = tm.substring(8, 10), min = tm.substring(10, 12);
                const interval = (Number(hour) >= 20 || Number(hour) < 8)
                    ? `${year}.${month}.${day} 장마감` : `${year}.${month}.${day} ${hour}:${min}`;

                return {
                    id: stockInfo.stkCd, title: stockInfo.stkNm,
                    orderWarning: stockInfo.orderWarning ?? '',
                    value: Number(stockInfo.curPrc.replace(/^[+-]/, '')).toLocaleString(),
                    fluRt: stockInfo.fluRt, predPre: stockInfo.predPre || '0',
                    openPric: parseFloat(stockInfo.openPric), interval,
                    trend: trendColor(stockInfo.preSig), nxtEnable: stockInfo.nxtEnable ?? 'N',
                    seriesData: [{id: asset.code, showMark: false, curve: 'linear', area: true, stackOrder: 'ascending', color: 'grey', data: lineData}],
                    barDataList, dateList,
                } as CustomStockDetailLineChartProps;
            }
            if (asset.type === 'CRYPTO') {
                const r = queryData as any;
                if (!r?.chartList || !r?.cryptoInfo) return null;

                const dateList = r.chartList.map((item: {dt: string}) => cryptoDateFormat(item.dt, isMinute));
                const lineData = r.chartList.map((item: {tradePrice: number}) => item.tradePrice);
                const barDataList = r.chartList.map((item: {candleAccTradeVolume: number}) => item.candleAccTradeVolume);

                const info = r.cryptoInfo;
                const trend: 'up' | 'down' | 'neutral' = info.change === 'RISE' ? 'up' : info.change === 'FALL' ? 'down' : 'neutral';
                const interval = cryptoDateFormat(info.tradeDateTimeKst ?? '', true);

                return {
                    id: asset.code, title: info.koreanName ?? asset.name,
                    value: Number(info.tradePrice ?? 0).toLocaleString(),
                    changeRate: ((info.signedChangeRate ?? 0) * 100).toFixed(2),
                    changePrice: Number(info.signedChangePrice ?? 0),
                    interval, trend,
                    seriesData: [{id: asset.code, showMark: false, curve: 'linear', area: true, stackOrder: 'ascending', color: trend === 'up' ? 'red' : trend === 'down' ? 'blue' : 'grey', data: lineData}],
                    barDataList, dateList,
                } as CryptoDetailLineChartProps;
            }
            if (asset.type === 'COMMODITY') {
                const {commodityInfo, commodityChartList} = (queryData as any) ?? {};
                if (!commodityInfo || !commodityChartList) return null;

                const dateList = commodityChartList.map((item: {dt: string}) =>
                    isMinute ? `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)} ${item.dt.slice(8, 10)}:${item.dt.slice(10, 12)}`
                        : `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)}`
                ).reverse();
                const lineData = commodityChartList.map((item: {curPrc: string}) => isMinute ? item.curPrc.replace(/^[+-]/, '') : item.curPrc).reverse();
                const barDataList = commodityChartList.map((item: {trdeQty: string}) => Number(item.trdeQty)).reverse();

                const tm = commodityInfo.tm ?? '';
                const year = tm.substring(0, 4), month = tm.substring(4, 6), day = tm.substring(6, 8);
                const hour = tm.substring(8, 10), min = tm.substring(10, 12);
                const interval = tm ? ((Number(hour) >= 20 || Number(hour) < 8)
                    ? `${year}.${month}.${day} 장마감` : `${year}.${month}.${day} ${hour}:${min}`) : '';

                return {
                    id: asset.code, title: commodityInfo.stkNm, orderWarning: '',
                    value: Number(String(commodityInfo.curPrc).replace(/^[+-]/, '')).toLocaleString(),
                    fluRt: commodityInfo.fluRt ?? '0', predPre: commodityInfo.predPre ?? '0',
                    openPric: parseFloat(commodityInfo.openPric ?? '0'), interval,
                    trend: trendColor(commodityInfo.preSig ?? '3'), nxtEnable: 'N',
                    seriesData: [{id: asset.code, showMark: false, curve: 'linear', area: true, stackOrder: 'ascending', color: 'grey', data: lineData}],
                    barDataList, dateList,
                } as CommodityDetailLineChartProps;
            }
        } catch (err) {
            console.error(err);
        }
        return null;
    }, [queryData, asset, chartType]);

    // 최종 chartData = base + WS overlay 머지
    const chartData = useMemo<CustomStockDetailLineChartProps | CryptoDetailLineChartProps | CommodityDetailLineChartProps | null>(() => {
        if (!baseChartData) return null;
        return {...baseChartData, ...liveOverlay} as typeof baseChartData;
    }, [baseChartData, liveOverlay]);

    const handleAlignment = (_event: MouseEvent<HTMLElement>, newAlignment: string) => {
        if (newAlignment !== null && asset) {
            setToggle(newAlignment);
            // queryKey 가 chartType 포함 → 자동 재요청
        }
    };

    const handleOptionChange = (event: SelectChangeEvent) => {
        const newMinute = event.target.value as string;
        setMinuteUnit(newMinute);
        setToggle('MINUTE');
    };

    const handleFormat = (_event: MouseEvent<HTMLElement>, newFormats: string) => {
        if (newFormats !== null) setFormats(newFormats);
    };

    const handleNavigate = () => {
        if (!asset) return;
        const pathMap: Record<MultiViewAssetType, string> = {
            STOCK: `/stock/detail/${asset.code}`,
            CRYPTO: `/crypto/detail/${asset.code}`,
            COMMODITY: `/commodity/detail/${asset.code}`,
        };
        navigate(pathMap[asset.type]);
    };

    if (!asset) {
        return (
            <Card variant="outlined" onClick={onSearch}
                sx={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400,
                    cursor: 'pointer', '&:hover': {bgcolor: 'action.hover'}}}>
                <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, color: 'text.secondary'}}>
                    <AddIcon sx={{fontSize: 40}}/>
                    <Typography variant="body2">종목 추가</Typography>
                </Box>
            </Card>
        );
    }

    if (!chartData) {
        return (
            <Card variant="outlined" sx={{width: '100%'}}>
                <CardContent>
                    <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Skeleton width={140}/>
                        <Stack direction="row" spacing={0.5}>
                            <Skeleton variant="circular" width={28} height={28}/>
                            <Skeleton variant="circular" width={28} height={28}/>
                            <Skeleton variant="circular" width={28} height={28}/>
                            <Skeleton variant="circular" width={28} height={28}/>
                        </Stack>
                    </Box>
                    <Stack direction="row" sx={{alignItems: 'center', gap: 1, mt: 1}}>
                        <Skeleton width={140} height={40}/>
                        <Skeleton width={60}/>
                        <Skeleton variant="rounded" width={60} height={24}/>
                    </Stack>
                    <Skeleton width={160}/>
                </CardContent>
                <Box sx={{overflowX: 'auto'}}>
                    <Box sx={{minWidth: 600}}>
                        <Skeleton variant="rectangular" height={300} sx={{mx: 2, mb: 2, borderRadius: 1}}/>
                    </Box>
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" sx={{px: 2, pb: 2}}>
                    <Skeleton variant="rounded" width={260} height={32}/>
                    <Skeleton variant="rounded" width={80} height={32}/>
                </Box>
            </Card>
        );
    }

    const trend = chartData.trend;
    const color = labelColors[trend];
    const fluRt = 'fluRt' in chartData ? chartData.fluRt : ('changeRate' in chartData ? chartData.changeRate : '0');
    const predPre = 'predPre' in chartData ? chartData.predPre : String('changePrice' in chartData ? chartData.changePrice : '0');
    const trendValues = {up: `${fluRt}%`, down: `${fluRt}%`, neutral: `${fluRt}%`};

    return (
        <Card variant="outlined" sx={{width: '100%'}}>
            <CardContent>
                <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <Typography component="h2" variant="subtitle2" gutterBottom>
                        {chartData.title}
                    </Typography>
                    <Stack direction="row" alignItems="center" gap={0.5}>
                        <IconButton size="small" onClick={onSearch} title="종목 변경"><SwapHorizIcon fontSize="small"/></IconButton>
                        <IconButton size="small" onClick={onChartExpand} title="차트 자세히 보기"><OpenInFullIcon fontSize="small"/></IconButton>
                        <IconButton size="small" onClick={handleNavigate} title="상세 페이지"><OpenInNewIcon fontSize="small"/></IconButton>
                        <IconButton size="small" onClick={onRemove} title="제거"><CloseIcon fontSize="small"/></IconButton>
                    </Stack>
                </Box>
                <Stack sx={{justifyContent: 'space-between'}}>
                    <Stack direction="row" sx={{alignContent: {xs: 'center', sm: 'flex-start'}, alignItems: 'center', gap: 1}}>
                        <Typography variant="h4" component="p">{chartData.value}</Typography>
                        {renderChangeAmount(predPre)}
                        <Chip size="small" color={color} label={trendValues[trend]}/>
                    </Stack>
                    <Typography variant="caption" sx={{color: 'text.secondary'}}>{chartData.interval}</Typography>
                </Stack>
            </CardContent>
            <Box sx={{overflowX: 'auto', WebkitOverflowScrolling: 'touch'}}>
                <Box sx={{minWidth: 600}}>
                    {asset.type === 'STOCK' && <StockDetailLineChart {...(chartData as CustomStockDetailLineChartProps)} />}
                    {asset.type === 'CRYPTO' && <CryptoDetailLineChart {...(chartData as CryptoDetailLineChartProps)} />}
                    {asset.type === 'COMMODITY' && <CommodityDetailLineChart {...(chartData as CommodityDetailLineChartProps)} />}
                </Box>
            </Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap">
                <StyledToggleButtonGroup size="small" value={toggle} exclusive onChange={handleAlignment}>
                    <ToggleButton value="MINUTE" sx={{padding: 1}}>
                        <Select size="small" value={minuteUnit} onChange={handleOptionChange}
                            variant="standard" disableUnderline
                            sx={{boxShadow: 'none', width: 55, backgroundColor: 'transparent', border: 'none', padding: '0 8px', justifyContent: 'center'}}>
                            <MenuItem value="1">1분</MenuItem>
                            <MenuItem value="3">3분</MenuItem>
                            <MenuItem value="5">5분</MenuItem>
                            <MenuItem value="30">30분</MenuItem>
                        </Select>
                    </ToggleButton>
                    <ToggleButton value="DAY">일</ToggleButton>
                    <ToggleButton value="WEEK">주</ToggleButton>
                    <ToggleButton value="MONTH">월</ToggleButton>
                    {asset.type !== 'COMMODITY' && <ToggleButton value="YEAR">년</ToggleButton>}
                </StyledToggleButtonGroup>
                <StyledToggleButtonGroup size="small" value={formats} exclusive onChange={handleFormat}>
                    <ToggleButton value="candle" disabled><CandlestickChartIcon/></ToggleButton>
                    <ToggleButton value="line"><StackedLineChartIcon/></ToggleButton>
                </StyledToggleButtonGroup>
            </Box>
        </Card>
    );
}

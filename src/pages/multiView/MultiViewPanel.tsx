import {type MouseEvent, useEffect, useRef, useState} from "react";
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
import {fetchStockChart} from "../../api/stock/StockApi.ts";
import {fetchCryptoDetail} from "../../api/crypto/CryptoApi.ts";
import {fetchCommodityDetail} from "../../api/commodity/CommodityApi.ts";
import {StockChartType} from "../../type/StockType.ts";
import {CryptoChartType} from "../../type/CryptoType.ts";
import {CommodityChartType} from "../../type/CommodityType.ts";
import {renderChangeAmount} from "../../components/CustomRender.tsx";
import type {AssetType, SelectedAsset} from "./MultiViewSearchDialog.tsx";
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

export interface StreamUpdate {
    value: string;
    fluRt: string;
    predPre: string;
    trend: 'up' | 'down' | 'neutral';
}

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

export default function MultiViewPanel({asset, onSearch, onChartExpand, onRemove, streamUpdate, reloadKey}: MultiViewPanelProps) {
    const navigate = useNavigate();
    const [chartData, setChartData] = useState<CustomStockDetailLineChartProps | CryptoDetailLineChartProps | CommodityDetailLineChartProps | null>(null);
    const [toggle, setToggle] = useState('DAY');
    const [formats, setFormats] = useState('line');
    const minute = useRef('1');

    useEffect(() => {
        if (!asset) {
            setChartData(null);
            return;
        }
        const chartType = toggle.startsWith('MINUTE') ? `MINUTE_${minute.current}` : toggle;
        loadData(asset, chartType, 0, false);
    }, [asset?.code, asset?.type]);

    const firstReloadRef = useRef(true);
    useEffect(() => {
        if (firstReloadRef.current) { firstReloadRef.current = false; return; }
        if (!asset) return;
        const chartType = toggle.startsWith('MINUTE') ? `MINUTE_${minute.current}` : toggle;
        loadData(asset, chartType, 0, true);
    }, [reloadKey]);

    useEffect(() => {
        if (!streamUpdate || !chartData) return;
        if (asset?.type === 'STOCK' || asset?.type === 'COMMODITY') {
            setChartData(old => old ? {
                ...old,
                value: Number(streamUpdate.value).toLocaleString(),
                fluRt: streamUpdate.fluRt,
                predPre: streamUpdate.predPre,
                trend: streamUpdate.trend,
            } as typeof old : null);
        } else if (asset?.type === 'CRYPTO') {
            setChartData(old => old ? {
                ...old,
                value: Number(streamUpdate.value).toLocaleString(),
                changeRate: streamUpdate.fluRt,
                changePrice: Number(streamUpdate.predPre),
                trend: streamUpdate.trend,
            } as typeof old : null);
        }
    }, [streamUpdate]);

    const trendColor = (preSig: string): 'up' | 'down' | 'neutral' => {
        const sig = Number(preSig);
        if (sig === 2 || sig === 1) return 'up';
        if (sig === 4 || sig === 5) return 'down';
        return 'neutral';
    };

    const loadData = async (a: SelectedAsset, chartType: string, retryCount = 0, silent: boolean = false) => {
        const cfg = silent ? { skipGlobalError: true } : undefined;
        try {
            if (a.type === 'STOCK') {
                const stockChartType = chartType.startsWith('MINUTE') ? chartType as StockChartType : `${chartType}` as StockChartType;
                const res = await fetchStockChart(a.code, {chartType: stockChartType}, cfg);
                const {stockInfo, stockChartList} = res.result ?? {};
                if (!stockInfo || !stockChartList) return;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let dateList: string[], lineData: any[], barDataList: number[];
                if (chartType.startsWith('MINUTE')) {
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
                barDataList = stockChartList.map((item: {trdeQty: string}) => Number(item.trdeQty)).reverse();

                const tm = stockInfo.tm;
                const year = tm.substring(0, 4), month = tm.substring(4, 6), day = tm.substring(6, 8);
                const hour = tm.substring(8, 10), min = tm.substring(10, 12);
                const interval = (Number(hour) >= 20 || Number(hour) < 8)
                    ? `${year}.${month}.${day} 장마감` : `${year}.${month}.${day} ${hour}:${min}`;

                setChartData({
                    id: stockInfo.stkCd, title: stockInfo.stkNm,
                    orderWarning: stockInfo.orderWarning ?? '',
                    value: Number(stockInfo.curPrc.replace(/^[+-]/, '')).toLocaleString(),
                    fluRt: stockInfo.fluRt, predPre: stockInfo.predPre || '0',
                    openPric: parseFloat(stockInfo.openPric), interval,
                    trend: trendColor(stockInfo.preSig), nxtEnable: stockInfo.nxtEnable ?? 'N',
                    seriesData: [{id: a.code, showMark: false, curve: 'linear', area: true, stackOrder: 'ascending', color: 'grey', data: lineData}],
                    barDataList, dateList,
                });
            } else if (a.type === 'CRYPTO') {
                const cryptoChartType = chartType.startsWith('MINUTE') ? chartType as CryptoChartType : `${chartType}` as CryptoChartType;
                const res = await fetchCryptoDetail(a.code, {chartType: cryptoChartType}, cfg);
                const r = res.result;
                if (!r?.chartList) return;

                const isMinute = chartType.startsWith('MINUTE');
                const dateList = r.chartList.map((item: {candle_date_time_kst: string}) =>
                    isMinute ? item.candle_date_time_kst?.substring(0, 16)?.replace('T', ' ') ?? ''
                        : item.candle_date_time_kst?.substring(0, 10) ?? ''
                ).reverse();
                const lineData = r.chartList.map((item: {trade_price: number}) => item.trade_price).reverse();
                const barDataList = r.chartList.map((item: {candle_acc_trade_volume: number}) => item.candle_acc_trade_volume).reverse();

                const changeRate = Number(r.signedChangeRate ?? 0) * 100;
                const now = new Date();
                const interval = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                setChartData({
                    id: a.code, title: r.koreanName ?? a.name,
                    value: Number(r.tradePrice ?? 0).toLocaleString(),
                    changeRate: changeRate.toFixed(2), changePrice: Number(r.signedChangePrice ?? 0),
                    interval, trend: changeRate > 0 ? 'up' : changeRate < 0 ? 'down' : 'neutral',
                    seriesData: [{id: a.code, showMark: false, curve: 'linear', area: true, stackOrder: 'ascending', color: 'grey', data: lineData}],
                    barDataList, dateList,
                } as CryptoDetailLineChartProps);
            } else if (a.type === 'COMMODITY') {
                const commodityChartType = chartType.startsWith('MINUTE') ? chartType as CommodityChartType : `${chartType}` as CommodityChartType;
                const res = await fetchCommodityDetail(a.code, {chartType: commodityChartType}, cfg);
                const {commodityInfo, commodityChartList} = res.result ?? {};
                if (!commodityInfo || !commodityChartList) return;

                const isMinute = chartType.startsWith('MINUTE');
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

                setChartData({
                    id: a.code, title: commodityInfo.stkNm, orderWarning: '',
                    value: Number(String(commodityInfo.curPrc).replace(/^[+-]/, '')).toLocaleString(),
                    fluRt: commodityInfo.fluRt ?? '0', predPre: commodityInfo.predPre ?? '0',
                    openPric: parseFloat(commodityInfo.openPric ?? '0'), interval,
                    trend: trendColor(commodityInfo.preSig ?? '3'), nxtEnable: 'N',
                    seriesData: [{id: a.code, showMark: false, curve: 'linear', area: true, stackOrder: 'ascending', color: 'grey', data: lineData}],
                    barDataList, dateList,
                } as CommodityDetailLineChartProps);
            }
        } catch (err) {
            if (retryCount < 2) {
                setTimeout(() => loadData(a, chartType, retryCount + 1, silent), 1000 * (retryCount + 1));
            } else {
                console.error(err);
            }
        }
    };

    const handleAlignment = (_event: MouseEvent<HTMLElement>, newAlignment: string) => {
        if (newAlignment !== null && asset) {
            setToggle(newAlignment);
            const chartType = newAlignment === 'MINUTE' ? `MINUTE_${minute.current}` : newAlignment;
            loadData(asset, chartType);
        }
    };

    const handleOptionChange = (event: SelectChangeEvent) => {
        minute.current = event.target.value as string;
        if (asset) loadData(asset, `MINUTE_${event.target.value}`);
    };

    const handleFormat = (_event: MouseEvent<HTMLElement>, newFormats: string) => {
        if (newFormats !== null) setFormats(newFormats);
    };

    const handleNavigate = () => {
        if (!asset) return;
        const pathMap: Record<AssetType, string> = {
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
                        <Select size="small" value={minute.current} onChange={handleOptionChange}
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

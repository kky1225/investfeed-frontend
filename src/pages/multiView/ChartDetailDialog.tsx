import {useMemo, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {unwrapResponse} from "../../lib/apiResponse.ts";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup, {toggleButtonGroupClasses} from "@mui/material/ToggleButtonGroup";
import MenuItem from "@mui/material/MenuItem";
import {Select, type SelectChangeEvent} from "@mui/material";
import {styled} from "@mui/material/styles";
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
import type {MultiViewAssetType} from "../../type/MultiViewType.ts";

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

const labelColors = {
    up: 'error' as const,
    down: 'info' as const,
    neutral: 'default' as const,
};

const CHART_HEIGHT = 550;

// 순수 헬퍼들 — 모듈 레벨 (useMemo TDZ 회피).
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

interface ChartDetailDialogProps {
    open: boolean;
    onClose: () => void;
    assetType: MultiViewAssetType | null;
    code: string;
    name: string;
}

export default function ChartDetailDialog({open, onClose, assetType, code, name}: ChartDetailDialogProps) {
    const [chartType, setChartType] = useState("DAY");
    const [minuteUnit, setMinuteUnit] = useState("1");

    // 다이얼로그 새로 열거나 다른 자산으로 바뀔 때 차트 타입 초기화 — render 중 비교 패턴
    const resetKey = `${open}|${code}|${assetType ?? 'none'}`;
    const [prevResetKey, setPrevResetKey] = useState('');
    if (resetKey !== prevResetKey) {
        setPrevResetKey(resetKey);
        if (open) {
            setChartType("DAY");
            setMinuteUnit("1");
        }
    }

    // 자산 타입별 fetch — useQuery 가 호출/캐시/취소(unmount 시 signal abort) 자동 관리.
    // chartType / minuteUnit 변경 시 queryKey 가 바뀌어 자동 재요청. handler 에서 직접 fetch 호출 불필요.
    const {data: queryData} = useQuery({
        queryKey: ['chartDetailDialog', assetType, code, chartType, minuteUnit],
        queryFn: async ({signal}) => {
            if (assetType === 'STOCK') {
                const chartTypeMap: Record<string, StockChartType> = {
                    MINUTE: `MINUTE_${minuteUnit}` as StockChartType,
                    DAY: StockChartType.DAY,
                    WEEK: StockChartType.WEEK,
                    MONTH: StockChartType.MONTH,
                    YEAR: StockChartType.YEAR,
                };
                return unwrapResponse(await fetchStockChart(code, {chartType: chartTypeMap[chartType] ?? StockChartType.DAY}, {signal, skipGlobalError: true}), null);
            }
            if (assetType === 'CRYPTO') {
                const chartTypeMap: Record<string, CryptoChartType> = {
                    MINUTE: `MINUTE_${minuteUnit}` as CryptoChartType,
                    DAY: CryptoChartType.DAY,
                    WEEK: CryptoChartType.WEEK,
                    MONTH: CryptoChartType.MONTH,
                    YEAR: CryptoChartType.YEAR,
                };
                return unwrapResponse(await fetchCryptoDetail(code, {chartType: chartTypeMap[chartType] ?? CryptoChartType.DAY}, {signal, skipGlobalError: true}), null);
            }
            if (assetType === 'COMMODITY') {
                const chartTypeMap: Record<string, CommodityChartType> = {
                    MINUTE: `MINUTE_${minuteUnit}` as CommodityChartType,
                    DAY: CommodityChartType.DAY,
                    WEEK: CommodityChartType.WEEK,
                    MONTH: CommodityChartType.MONTH,
                };
                return unwrapResponse(await fetchCommodityDetail(code, {chartType: chartTypeMap[chartType] ?? CommodityChartType.DAY}, {signal, skipGlobalError: true}), null);
            }
            return null;
        },
        enabled: open && !!code && !!assetType,
    });

    const chartData = useMemo<CustomStockDetailLineChartProps | CryptoDetailLineChartProps | CommodityDetailLineChartProps | null>(() => {
        if (!queryData) return null;
        const isMinute = chartType === 'MINUTE';
        try {
            if (assetType === 'STOCK') {
                const {stockInfo, stockChartList} = (queryData as any) ?? {};
                if (!stockInfo || !stockChartList) return null;

                const dateList: string[] = stockChartList.map((item: {dt: string}) =>
                    isMinute
                        ? `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)} ${item.dt.slice(8, 10)}:${item.dt.slice(10, 12)}`
                        : `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)}`
                ).reverse();
                const lineData = stockChartList.map((item: {curPrc: string}) =>
                    isMinute ? Number(item.curPrc.replace(/^[+-]/, '')) : item.curPrc
                ).reverse();
                const barDataList: number[] = stockChartList.map((item: {trdeQty: string}) => Number(item.trdeQty)).reverse();

                const tm = stockInfo.tm ?? '';
                const interval = tm
                    ? ((Number(tm.substring(8, 10)) >= 20 || Number(tm.substring(8, 10)) < 8)
                        ? `${tm.substring(0, 4)}.${tm.substring(4, 6)}.${tm.substring(6, 8)} 장마감`
                        : `${tm.substring(0, 4)}.${tm.substring(4, 6)}.${tm.substring(6, 8)} ${tm.substring(8, 10)}:${tm.substring(10, 12)}`)
                    : '';

                return {
                    id: stockInfo.stkCd, title: stockInfo.stkNm,
                    orderWarning: stockInfo.orderWarning ?? '',
                    value: Number(String(stockInfo.curPrc).replace(/^[+-]/, '')).toLocaleString(),
                    fluRt: stockInfo.fluRt, predPre: stockInfo.predPre || '0',
                    openPric: parseFloat(stockInfo.openPric), interval,
                    trend: trendColor(stockInfo.preSig), nxtEnable: stockInfo.nxtEnable ?? 'N',
                    seriesData: [{id: code, showMark: false, curve: 'linear', area: true, stackOrder: 'ascending', color: 'grey', data: lineData}],
                    barDataList, dateList,
                } as CustomStockDetailLineChartProps;
            }

            if (assetType === 'CRYPTO') {
                const r = queryData as any;
                if (!r?.chartList || !r?.cryptoInfo) return null;

                // 코인 chartList 는 시간순 정렬되어 있어 reverse 불필요
                const dateList: string[] = r.chartList.map((item: {dt: string}) => cryptoDateFormat(item.dt, isMinute));
                const lineData = r.chartList.map((item: {tradePrice: number}) => item.tradePrice);
                const barDataList: number[] = r.chartList.map((item: {candleAccTradeVolume: number}) => item.candleAccTradeVolume);

                const info = r.cryptoInfo;
                const trend: 'up' | 'down' | 'neutral' = info.change === 'RISE' ? 'up' : info.change === 'FALL' ? 'down' : 'neutral';
                const interval = cryptoDateFormat(info.tradeDateTimeKst ?? '', true);

                return {
                    id: code, title: info.koreanName ?? name,
                    value: Number(info.tradePrice ?? 0).toLocaleString(),
                    changeRate: ((info.signedChangeRate ?? 0) * 100).toFixed(2),
                    changePrice: Number(info.signedChangePrice ?? 0),
                    interval, trend,
                    seriesData: [{id: code, showMark: false, curve: 'linear', area: true, stackOrder: 'ascending', color: trend === 'up' ? 'red' : trend === 'down' ? 'blue' : 'grey', data: lineData}],
                    barDataList, dateList,
                } as CryptoDetailLineChartProps;
            }

            if (assetType === 'COMMODITY') {
                const {commodityInfo, commodityChartList} = (queryData as any) ?? {};
                if (!commodityInfo || !commodityChartList) return null;

                const dateList: string[] = commodityChartList.map((item: {dt: string}) =>
                    isMinute
                        ? `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)} ${item.dt.slice(8, 10)}:${item.dt.slice(10, 12)}`
                        : `${item.dt.slice(0, 4)}.${item.dt.slice(4, 6)}.${item.dt.slice(6, 8)}`
                ).reverse();
                const lineData = commodityChartList.map((item: {curPrc: string}) =>
                    isMinute ? item.curPrc.replace(/^[+-]/, '') : item.curPrc
                ).reverse();
                const barDataList: number[] = commodityChartList.map((item: {trdeQty: string}) => Number(item.trdeQty)).reverse();

                const tm = commodityInfo.tm ?? '';
                const interval = tm
                    ? ((Number(tm.substring(8, 10)) >= 20 || Number(tm.substring(8, 10)) < 8)
                        ? `${tm.substring(0, 4)}.${tm.substring(4, 6)}.${tm.substring(6, 8)} 장마감`
                        : `${tm.substring(0, 4)}.${tm.substring(4, 6)}.${tm.substring(6, 8)} ${tm.substring(8, 10)}:${tm.substring(10, 12)}`)
                    : '';

                return {
                    id: code, title: commodityInfo.stkNm, orderWarning: '',
                    value: Number(String(commodityInfo.curPrc).replace(/^[+-]/, '')).toLocaleString(),
                    fluRt: commodityInfo.fluRt ?? '0', predPre: commodityInfo.predPre ?? '0',
                    openPric: parseFloat(commodityInfo.openPric ?? '0'), interval,
                    trend: trendColor(commodityInfo.preSig ?? '3'), nxtEnable: 'N',
                    seriesData: [{id: code, showMark: false, curve: 'linear', area: true, stackOrder: 'ascending', color: 'grey', data: lineData}],
                    barDataList, dateList,
                } as CommodityDetailLineChartProps;
            }
        } catch (err) {
            console.error(err);
        }
        return null;
    }, [queryData, assetType, chartType, code, name]);

    const handleChartTypeChange = (_: unknown, value: string | null) => {
        if (!value) return;
        setChartType(value);
        // 직접 fetch 호출 안 함 — queryKey 변경으로 useQuery 자동 재요청
    };

    const handleMinuteChange = (e: SelectChangeEvent) => {
        setMinuteUnit(e.target.value);
        setChartType("MINUTE");
    };

    const trend = chartData?.trend ?? 'neutral';
    const color = labelColors[trend];
    const fluRt = chartData
        ? ('fluRt' in chartData ? chartData.fluRt : ('changeRate' in chartData ? chartData.changeRate : '0'))
        : '0';
    const predPre = chartData
        ? ('predPre' in chartData ? chartData.predPre : String('changePrice' in chartData ? chartData.changePrice : '0'))
        : '0';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="lg"
            slotProps={{
                paper: {
                    elevation: 0,
                    sx: {
                        bgcolor: 'background.default',
                        backgroundImage: 'none',
                        boxShadow: 'none',
                        borderRadius: 2,
                    },
                },
            }}
        >
            <DialogContent sx={{p: 3}}>
                <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                    <Typography component="h2" variant="subtitle1">
                        {chartData?.title ?? name}
                    </Typography>
                    <IconButton size="small" onClick={onClose} title="닫기"><CloseIcon fontSize="small"/></IconButton>
                </Box>

                {chartData ? (
                    <Stack sx={{justifyContent: 'space-between', mb: 2}}>
                        <Stack direction="row" sx={{alignItems: 'center', gap: 1}}>
                            <Typography variant="h4" component="p">{chartData.value}</Typography>
                            {renderChangeAmount(predPre)}
                            <Chip size="small" color={color} label={`${fluRt}%`}/>
                        </Stack>
                        <Typography variant="caption" sx={{color: 'text.secondary'}}>{chartData.interval}</Typography>
                    </Stack>
                ) : (
                    <Stack sx={{justifyContent: 'space-between', mb: 2}}>
                        <Stack direction="row" sx={{alignItems: 'center', gap: 1}}>
                            <Skeleton width={160} height={40}/>
                            <Skeleton width={60}/>
                            <Skeleton variant="rounded" width={60} height={24}/>
                        </Stack>
                        <Skeleton width={160}/>
                    </Stack>
                )}

                <Box sx={{minWidth: 600}}>
                    {!chartData ? (
                        <Skeleton variant="rectangular" height={CHART_HEIGHT} sx={{borderRadius: 1}}/>
                    ) : (
                        <>
                            {assetType === 'STOCK' && (
                                <StockDetailLineChart {...(chartData as CustomStockDetailLineChartProps)} height={CHART_HEIGHT}/>
                            )}
                            {assetType === 'CRYPTO' && (
                                <CryptoDetailLineChart {...(chartData as CryptoDetailLineChartProps)} height={CHART_HEIGHT}/>
                            )}
                            {assetType === 'COMMODITY' && (
                                <CommodityDetailLineChart {...(chartData as CommodityDetailLineChartProps)} height={CHART_HEIGHT}/>
                            )}
                        </>
                    )}
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" sx={{mt: 1}}>
                    <StyledToggleButtonGroup size="small" value={chartType} exclusive onChange={handleChartTypeChange}>
                        <ToggleButton value="MINUTE" sx={{padding: 1}}>
                            <Select size="small" value={minuteUnit} onChange={handleMinuteChange}
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
                        {assetType !== 'COMMODITY' && <ToggleButton value="YEAR">년</ToggleButton>}
                    </StyledToggleButtonGroup>
                </Box>
            </DialogContent>
        </Dialog>
    );
}

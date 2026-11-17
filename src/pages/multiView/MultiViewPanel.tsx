import {type MouseEvent, useMemo, useState} from "react";
import {usePollingQuery, type PollingFetchConfig} from "../../lib/pollingQuery.ts";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import MenuItem from "@mui/material/MenuItem";
import {Select, type SelectChangeEvent} from "@mui/material";
import Skeleton from "@mui/material/Skeleton";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CandleChart from "../../components/chart/CandleChart.tsx";
import {ChartToolbarGroup} from "../../components/chart/ChartToolbarControls.tsx";
import {renderChangeAmount, signedRate} from "../../components/CustomRender.tsx";
import type {MultiViewAssetType, SelectedAsset, StreamUpdate} from "../../type/MultiViewType.ts";
import {useNavigate} from "react-router-dom";
import {
    candlesOf, chartStorageOf, chartTypeOf, comparisonOf, fetchMultiViewChart, intervalOf, type MultiViewChartRes,
    summaryOf, timeUnitOf, withLivePrice, withStream,
} from "./multiViewChart.ts";

interface MultiViewPanelProps {
    asset: SelectedAsset | null;
    onSearch: () => void;
    onChartExpand: () => void;
    onRemove: () => void;
    streamUpdate?: StreamUpdate | null;
}

const labelColors = {
    up: 'error' as const,
    down: 'info' as const,
    neutral: 'default' as const,
};

const CHART_HEIGHT = 300;   // 패널의 가격+거래량 영역 높이

export default function MultiViewPanel({asset, onSearch, onChartExpand, onRemove, streamUpdate}: MultiViewPanelProps) {
    const navigate = useNavigate();
    const [toggle, setToggle] = useState('DAY');
    const [minuteUnit, setMinuteUnit] = useState('1');
    const chartType = chartTypeOf(toggle, minuteUnit);

    const {data: queryData, lastUpdated, pollError} = usePollingQuery<MultiViewChartRes>(
        ['multiViewPanel', asset?.type, asset?.code, chartType],
        (config: PollingFetchConfig) => {
            if (!asset) return Promise.reject(new Error('no asset'));
            return fetchMultiViewChart(asset, chartType, config);
        },
        {
            enabled: !!asset,
            retry: 2,
            retryDelay: (count) => 1000 * (count + 1),
        },
    );

    // 머리(이름·가격·등락): 조회 결과에 실시간 값을 덮어쓴다.
    const summary = useMemo(() => {
        if (!queryData || !asset) return null;
        try {
            const base = summaryOf(asset, queryData);
            return base && withStream(asset, base, streamUpdate);
        } catch (err) {
            console.error(err);
            return null;
        }
    }, [queryData, asset, streamUpdate]);

    // 차트 캔들. 상세 화면과 같은 차트를 쓰고, 그린 선도 상세 화면과 같은 기준으로 저장한다.
    const candleList = useMemo(() => (queryData && asset ? candlesOf(asset, queryData) : []), [queryData, asset]);
    const candles = useMemo(
        () => (asset ? withLivePrice(asset, chartType, candleList, streamUpdate) : candleList),
        [asset, chartType, candleList, streamUpdate],
    );
    const comparison = useMemo(() => (asset ? comparisonOf(asset, chartType) : undefined), [asset, chartType]);

    const handleAlignment = (_event: MouseEvent<HTMLElement>, newAlignment: string) => {
        if (newAlignment !== null && asset) {
            setToggle(newAlignment);
        }
    };

    const handleOptionChange = (event: SelectChangeEvent) => {
        const newMinute = event.target.value as string;
        setMinuteUnit(newMinute);
        setToggle('MINUTE');
    };

    const handleNavigate = () => {
        if (!asset) return;
        const pathMap: Record<MultiViewAssetType, string> = {
            STOCK: `/stock/detail/${asset.code}`,
            US_STOCK: `/us-stock/detail/${asset.stexTp}/${asset.code}`,
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

    if (!summary) {
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
                <Skeleton variant="rectangular" height={CHART_HEIGHT} sx={{mx: 2, mb: 2, borderRadius: 1}}/>
                <Box display="flex" justifyContent="space-between" alignItems="center" sx={{px: 2, pb: 2}}>
                    <Skeleton variant="rounded" width={260} height={32}/>
                </Box>
            </Card>
        );
    }

    const storage = chartStorageOf(asset);

    return (
        <Card variant="outlined" sx={{width: '100%'}}>
            <CardContent>
                <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <Typography component="h2" variant="subtitle2" gutterBottom>
                        {summary.title}
                    </Typography>
                    <Stack direction="row" alignItems="center" gap={0.5}>
                        <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>
                        <IconButton size="small" onClick={onSearch} title="종목 변경"><SwapHorizIcon fontSize="small"/></IconButton>
                        <IconButton size="small" onClick={onChartExpand} title="차트 자세히 보기"><OpenInFullIcon fontSize="small"/></IconButton>
                        <IconButton size="small" onClick={handleNavigate} title="상세 페이지"><OpenInNewIcon fontSize="small"/></IconButton>
                        <IconButton size="small" onClick={onRemove} title="제거"><CloseIcon fontSize="small"/></IconButton>
                    </Stack>
                </Box>
                <Stack sx={{justifyContent: 'space-between'}}>
                    <Stack direction="row" sx={{alignContent: {xs: 'center', sm: 'flex-start'}, alignItems: 'center', gap: 1}}>
                        <Typography variant="h4" component="p">{summary.value}</Typography>
                        {renderChangeAmount(summary.change, asset.type === 'US_STOCK' ? '달러' : '원')}
                        <Chip size="small" color={labelColors[summary.trend]} label={signedRate(summary.rate)}/>
                    </Stack>
                    <Typography variant="caption" sx={{color: 'text.secondary'}}>{summary.interval}</Typography>
                </Stack>
            </CardContent>
            {/* 차트는 스스로 이동·확대하므로 패널 너비에 맞춘다. 패널이 좁아 주기 버튼은 차트 아래에 둔다. */}
            <CandleChart
                candles={candles}
                timeUnit={timeUnitOf(chartType)}
                interval={intervalOf(asset, chartType)}
                seriesKey={`${asset.type}-${asset.code}-${chartType}`}
                assetType={storage.assetType}
                assetCode={storage.assetCode}
                comparison={comparison}
                height={CHART_HEIGHT}
            />
            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap">
                <ChartToolbarGroup size="small" value={toggle} exclusive onChange={handleAlignment} aria-label="차트 주기">
                    <ToggleButton value="MINUTE" aria-label="MINUTE">
                        {/* 버튼 안의 선택 상자는 글자 크기·색을 버튼에서 물려받고, 화살표는 작은 아래 화살표 하나만 둔다. */}
                        <Select
                            size="small"
                            value={minuteUnit}
                            onChange={handleOptionChange}
                            variant="standard"
                            disableUnderline
                            IconComponent={ArrowDropDownIcon}
                            sx={{
                                boxShadow: 'none',
                                backgroundColor: 'transparent',
                                border: 'none',
                                padding: 0,
                                font: 'inherit',
                                color: 'inherit',
                                '& .MuiSelect-select': {py: 0, pl: 0, minHeight: 0},
                                '& .MuiSelect-icon': {color: 'inherit'},
                            }}
                        >
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
                </ChartToolbarGroup>
            </Box>
        </Card>
    );
}

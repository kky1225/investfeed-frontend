import {useMemo, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {requireOk} from "../../lib/apiResponse.ts";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import MenuItem from "@mui/material/MenuItem";
import {Select, type SelectChangeEvent} from "@mui/material";
import CandleChart from "../../components/chart/CandleChart.tsx";
import {ChartToolbarGroup} from "../../components/chart/ChartToolbarControls.tsx";
import {renderChangeAmount, signedRate} from "../../components/CustomRender.tsx";
import type {MultiViewAssetType, SelectedAsset} from "../../type/MultiViewType.ts";
import {
    candlesOf, chartStorageOf, chartTypeOf, comparisonOf, fetchMultiViewChart, intervalOf, type MultiViewChartRes,
    summaryOf, timeUnitOf,
} from "./multiViewChart.ts";

const labelColors = {
    up: 'error' as const,
    down: 'info' as const,
    neutral: 'default' as const,
};

const CHART_HEIGHT = 550;

interface ChartDetailDialogProps {
    open: boolean;
    onClose: () => void;
    assetType: MultiViewAssetType | null;
    code: string;
    name: string;
    stexTp?: string;
}

export default function ChartDetailDialog({open, onClose, assetType, code, name, stexTp}: ChartDetailDialogProps) {
    const [toggle, setToggle] = useState("DAY");
    const [minuteUnit, setMinuteUnit] = useState("1");
    const chartType = chartTypeOf(toggle, minuteUnit);

    const resetKey = `${open}|${code}|${assetType ?? 'none'}`;
    const [prevResetKey, setPrevResetKey] = useState('');
    if (resetKey !== prevResetKey) {
        setPrevResetKey(resetKey);
        if (open) {
            setToggle("DAY");
            setMinuteUnit("1");
        }
    }

    const asset = useMemo<SelectedAsset | null>(
        () => (assetType && code ? {type: assetType, code, name, stexTp} : null),
        [assetType, code, name, stexTp],
    );

    const {data: queryData} = useQuery({
        queryKey: ['chartDetailDialog', assetType, code, chartType],
        queryFn: async ({signal}) => {
            if (!asset) return null;
            return requireOk<MultiViewChartRes | null>(
                await fetchMultiViewChart(asset, chartType, {signal, skipGlobalError: true}), null,
            );
        },
        enabled: open && !!asset,
    });

    const summary = useMemo(() => {
        if (!queryData || !asset) return null;
        try {
            return summaryOf(asset, queryData);
        } catch (err) {
            console.error(err);
            return null;
        }
    }, [queryData, asset]);

    const candles = useMemo(() => (queryData && asset ? candlesOf(asset, queryData) : []), [queryData, asset]);
    const comparison = useMemo(() => (asset ? comparisonOf(asset, chartType) : undefined), [asset, chartType]);
    const storage = asset ? chartStorageOf(asset) : null;

    const handleChartTypeChange = (_: unknown, value: string | null) => {
        if (!value) return;
        setToggle(value);
        // 직접 fetch 호출 안 함 — queryKey 변경으로 useQuery 자동 재요청
    };

    const handleMinuteChange = (e: SelectChangeEvent) => {
        setMinuteUnit(e.target.value);
        setToggle("MINUTE");
    };

    // 주기(분·일·주·월·년) 버튼. 차트 위쪽 줄 맨 앞에 놓는다.
    const chartControls = (
        <ChartToolbarGroup size="small" value={toggle} exclusive onChange={handleChartTypeChange} aria-label="차트 주기">
            <ToggleButton value="MINUTE" aria-label="MINUTE">
                {/* 버튼 안의 선택 상자는 글자 크기·색을 버튼에서 물려받고, 화살표는 작은 아래 화살표 하나만 둔다. */}
                <Select
                    size="small"
                    value={minuteUnit}
                    onChange={handleMinuteChange}
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
            {assetType !== 'COMMODITY' && <ToggleButton value="YEAR">년</ToggleButton>}
        </ChartToolbarGroup>
    );

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
                        {summary?.title ?? name}
                    </Typography>
                    <IconButton size="small" onClick={onClose} title="닫기"><CloseIcon fontSize="small"/></IconButton>
                </Box>

                {summary ? (
                    <Stack sx={{justifyContent: 'space-between', mb: 2}}>
                        <Stack direction="row" sx={{alignItems: 'center', gap: 1}}>
                            <Typography variant="h4" component="p">{summary.value}</Typography>
                            {renderChangeAmount(summary.change, assetType === 'US_STOCK' ? '달러' : '원')}
                            <Chip size="small" color={labelColors[summary.trend]} label={signedRate(summary.rate)}/>
                        </Stack>
                        <Typography variant="caption" sx={{color: 'text.secondary'}}>{summary.interval}</Typography>
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

                {/* 상세 화면과 같은 차트. 창의 여백 안에 맞게 차트의 좌우 여백만큼 당긴다. */}
                {!summary || !asset || !storage ? (
                    <Skeleton variant="rectangular" height={CHART_HEIGHT} sx={{borderRadius: 1}}/>
                ) : (
                    <Box sx={{mx: -2}}>
                        <CandleChart
                            candles={candles}
                            timeUnit={timeUnitOf(chartType)}
                            interval={intervalOf(asset, chartType)}
                            seriesKey={`${asset.type}-${asset.code}-${chartType}`}
                            assetType={storage.assetType}
                            assetCode={storage.assetCode}
                            comparison={comparison}
                            toolbarStart={chartControls}
                            height={CHART_HEIGHT}
                        />
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}

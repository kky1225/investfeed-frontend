import {useMemo, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {requireOk} from "../../lib/apiResponse.ts";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import AssetChart from "../detail/AssetChart.tsx";
import {renderChangeAmount, signedRate} from "../../components/CustomRender.tsx";
import type {MultiViewAssetType, SelectedAsset} from "../../type/MultiViewType.ts";
import {candlesOf, fetchMultiViewChart, type MultiViewChartRes, summaryOf} from "./multiViewChart.ts";

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
    const [chartType, setChartType] = useState("DAY");

    const resetKey = `${open}|${code}|${assetType ?? 'none'}`;
    const [prevResetKey, setPrevResetKey] = useState('');
    if (resetKey !== prevResetKey) {
        setPrevResetKey(resetKey);
        if (open) {
            setChartType("DAY");
        }
    }

    const asset = useMemo<SelectedAsset | null>(
        () => (assetType && code ? {type: assetType, code, name, stexTp} : null),
        [assetType, code, name, stexTp],
    );

    const {data: queryData, isPlaceholderData} = useQuery({
        queryKey: ['chartDetailDialog', assetType, code, chartType],
        queryFn: async ({signal}) => {
            if (!asset) return null;
            return requireOk<MultiViewChartRes | null>(
                await fetchMultiViewChart(asset, chartType, {signal, skipGlobalError: true}), null,
            );
        },
        enabled: open && !!asset,
        // 주기를 바꾸는 동안에는 직전 주기의 결과를 남겨 차트를 내리지 않는다. 다른 종목으로 바꾸면 남기지 않는다.
        placeholderData: (previous, previousQuery) => (
            previousQuery?.queryKey[1] === assetType && previousQuery?.queryKey[2] === code ? previous : undefined
        ),
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
                {!summary || !asset ? (
                    <Skeleton variant="rectangular" height={CHART_HEIGHT} sx={{borderRadius: 1}}/>
                ) : (
                    <Box sx={{mx: -2}}>
                        <AssetChart
                            market={asset.type}
                            code={asset.code}
                            exchange={asset.stexTp}
                            chartType={chartType}
                            onChartTypeChange={setChartType}
                            candles={candles}
                            loading={isPlaceholderData}
                            height={CHART_HEIGHT}
                        />
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}

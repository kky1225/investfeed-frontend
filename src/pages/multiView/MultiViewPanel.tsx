import {useMemo, useState} from "react";
import {usePollingQuery, type PollingFetchConfig} from "../../lib/pollingQuery.ts";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import AddIcon from "@mui/icons-material/Add";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AssetChart from "../detail/AssetChart.tsx";
import {renderChangeAmount, signedRate} from "../../components/CustomRender.tsx";
import type {MultiViewAssetType, SelectedAsset, StreamUpdate} from "../../type/MultiViewType.ts";
import {useNavigate} from "react-router-dom";
import {
    candlesOf, fetchMultiViewChart, livePriceOf, type MultiViewChartRes, summaryOf, withStream,
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

const CHART_HEIGHT = 480;  // 차트를 기다리는 동안 보이는 자리의 높이 (차트의 기본 높이와 같다)

export default function MultiViewPanel({asset, onSearch, onChartExpand, onRemove, streamUpdate}: MultiViewPanelProps) {
    const navigate = useNavigate();
    const [chartType, setChartType] = useState('DAY');

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

    // 차트 캔들. 차트는 상세 화면과 같은 부품(AssetChart)이라 주기 버튼·그린 선·목표가 선·종목 비교가 상세 화면과 같다.
    const candleList = useMemo(() => (queryData && asset ? candlesOf(asset, queryData) : []), [queryData, asset]);

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
            </Card>
        );
    }

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
            <AssetChart
                market={asset.type}
                code={asset.code}
                chartType={chartType}
                onChartTypeChange={setChartType}
                candles={candleList}
                livePrice={livePriceOf(asset, chartType, streamUpdate)}
            />
        </Card>
    );
}

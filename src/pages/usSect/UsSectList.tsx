import {Box} from "@mui/material";
import Typography from "@mui/material/Typography";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import {type MouseEvent, useMemo, useState} from "react";
import {UsSectListItem, UsSectListRes} from "../../type/UsSectType.ts";
import {fetchUsSectList} from "../../api/usSect/UsSectApi.ts";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import SectorHeatmap, {HeatmapLegend, HeatmapTile} from "../../components/SectorHeatmap.tsx";
import {usePollingQuery} from "../../lib/pollingQuery.ts";

type PerfPeriod = 'perf1d' | 'perf5d' | 'perf1m' | 'perf3m' | 'perf6m' | 'perfYtd' | 'perf1y';

const PERIODS: {key: PerfPeriod; label: string}[] = [
    {key: 'perf1d', label: '당일'},
    {key: 'perf5d', label: '5일'},
    {key: 'perf1m', label: '1개월'},
    {key: 'perf3m', label: '3개월'},
    {key: 'perf6m', label: '6개월'},
    {key: 'perfYtd', label: '연중'},
    {key: 'perf1y', label: '1년'},
];

const perfNum = (raw: string | undefined): number => {
    const n = Number(String(raw ?? '').replace(/^\+/, ''));
    return Number.isFinite(n) ? n : 0;
};

const perfText = (raw: string | undefined): string => {
    const n = perfNum(raw);
    return n > 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`;
};

const UsSectList = () => {
    const [period, setPeriod] = useState<PerfPeriod>('perf1d');

    const {data: result, isLoading, lastUpdated, pollError} = usePollingQuery<UsSectListRes>(
        ['usSectList'],
        (config) => fetchUsSectList(config),
    );

    const tiles: HeatmapTile[] = useMemo(() => {
        if (!result) return [];
        return [...(result.sectList ?? [])]
            .sort((a, b) => perfNum(b[period]) - perfNum(a[period]))
            .map((sect: UsSectListItem) => ({
                key: sect.indsCd,
                name: sect.indsNm,
                rate: perfNum(sect[period]),
                link: `/us-stock/sect/${sect.indsCd}/list`,
                tooltip: PERIODS.map(({key, label}) => [label, perfText(sect[key])] as [string, string]),
            }));
    }, [result, period]);

    const handlePeriodChange = (_event: MouseEvent<HTMLElement>, newPeriod: PerfPeriod | null) => {
        if (newPeriod !== null) setPeriod(newPeriod);
    };

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', mb: 2, gap: 2}}>
                <Typography component="h2" variant="h6">
                    미국 업종 목록
                </Typography>
                <Box sx={{flex: 1}}/>
                <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>
            </Box>
            <Box sx={{mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap'}}>
                <ToggleButtonGroup size="small" value={period} exclusive onChange={handlePeriodChange}>
                    {PERIODS.map(({key, label}) => (
                        <ToggleButton key={key} value={key}>{label}</ToggleButton>
                    ))}
                </ToggleButtonGroup>
                <HeatmapLegend palette="us"/>
            </Box>
            <SectorHeatmap tiles={tiles} palette="us" loading={isLoading} skeletonCount={41}/>
        </Box>
    );
};

export default UsSectList;

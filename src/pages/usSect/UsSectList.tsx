import {Box, Tooltip} from "@mui/material";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import {type MouseEvent, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {UsSectListItem, UsSectListRes} from "../../type/UsSectType.ts";
import {fetchUsSectList} from "../../api/usSect/UsSectApi.ts";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
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

// 수익률 크기 → 배경 강도, ±3%에서 최대 채도.
// 히트맵은 해당 시장의 관례 색을 따름 — 미국장이므로 상승 녹색/하락 빨강 (Finviz·미장 히트맵 표준)
const tileColor = (perf: number): string => {
    const intensity = Math.min(Math.abs(perf) / 3, 1);
    if (perf > 0) return `rgba(46, 125, 50, ${0.15 + intensity * 0.75})`;
    if (perf < 0) return `rgba(211, 47, 47, ${0.15 + intensity * 0.75})`;
    return 'rgba(128, 128, 128, 0.15)';
};

const perfText = (raw: string | undefined): string => {
    const n = perfNum(raw);
    return n > 0 ? `+${n.toFixed(2)}%` : `${n.toFixed(2)}%`;
};

const UsSectList = () => {
    const navigate = useNavigate();
    const [period, setPeriod] = useState<PerfPeriod>('perf1d');

    const {data: result, isLoading, lastUpdated, pollError} = usePollingQuery<UsSectListRes>(
        ['usSectList'],
        (config) => fetchUsSectList(config),
    );

    // 선택 기간 수익률 내림차순 배치 — 왼쪽 위가 가장 강한 업종
    const sectList: UsSectListItem[] = useMemo(() => {
        if (!result) return [];
        return [...(result.sectList ?? [])].sort((a, b) => perfNum(b[period]) - perfNum(a[period]));
    }, [result, period]);

    const loading = isLoading;

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
                <Stack direction="row" spacing={1.5} sx={{alignItems: 'center'}}>
                    <Stack direction="row" spacing={0.5} sx={{alignItems: 'center'}}>
                        <Box sx={{width: 10, height: 10, borderRadius: 0.5, backgroundColor: 'rgba(46, 125, 50, 0.9)'}}/>
                        <Typography variant="caption" color="text.secondary">상승</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} sx={{alignItems: 'center'}}>
                        <Box sx={{width: 10, height: 10, borderRadius: 0.5, backgroundColor: 'rgba(211, 47, 47, 0.9)'}}/>
                        <Typography variant="caption" color="text.secondary">하락</Typography>
                    </Stack>
                </Stack>
            </Box>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: 1,
                }}
            >
                {loading ? (
                    Array.from({length: 41}).map((_, index) => (
                        <Skeleton key={index} variant="rounded" height={92}/>
                    ))
                ) : (
                    sectList.map((sect) => (
                        <Tooltip
                            key={sect.indsCd}
                            arrow
                            title={
                                <Stack spacing={0.25} sx={{p: 0.5}}>
                                    {PERIODS.map(({key, label}) => (
                                        <Stack key={key} direction="row" sx={{justifyContent: 'space-between', gap: 2}}>
                                            <Typography variant="caption">{label}</Typography>
                                            <Typography variant="caption">{perfText(sect[key])}</Typography>
                                        </Stack>
                                    ))}
                                </Stack>
                            }
                        >
                            <Box
                                onClick={() => navigate(`/us-stock/sect/${sect.indsCd}/list`)}
                                sx={{
                                    minHeight: 92,
                                    p: 1.5,
                                    borderRadius: 1,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    backgroundColor: tileColor(perfNum(sect[period])),
                                    transition: 'filter 0.15s',
                                    '&:hover': {filter: 'brightness(1.15)', outline: '1px solid', outlineColor: 'divider'},
                                }}
                            >
                                <Typography variant="body2" sx={{fontWeight: 600, lineHeight: 1.3}}>
                                    {sect.indsNm}
                                </Typography>
                                <Typography variant="h6" component="p">
                                    {perfText(sect[period])}
                                </Typography>
                            </Box>
                        </Tooltip>
                    ))
                )}
            </Box>
        </Box>
    );
};

export default UsSectList;

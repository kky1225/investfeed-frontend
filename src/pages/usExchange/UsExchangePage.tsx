import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import InputAdornment from "@mui/material/InputAdornment";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {useTheme} from "@mui/material/styles";
import {LineChart} from "@mui/x-charts/LineChart";
import {useQuery} from "@tanstack/react-query";
import {useEffect, useState} from "react";
import {fetchUsExchangeHistory, fetchUsExchangeRate} from "../../api/usExchange/UsExchangeApi.ts";
import {getTrend, TREND_COLORS, TrendIcon} from "../../components/CustomRender.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {requireOk} from "../../lib/apiResponse.ts";
import {usePollingQuery} from "../../lib/pollingQuery.ts";
import type {IndicatorHistoryRes} from "../../type/EconomicCalendarType.ts";
import type {UsExchangeRateItem, UsExchangeRateRes} from "../../type/UsExchangeType.ts";

type Side = 'KRW' | 'USD';

const toNum = (raw: string | null | undefined): number => {
    const n = Number(String(raw ?? '').replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
};

// 환율 표기는 소수점 둘째 자리까지 (키움 응답이 aplc_exrt 만 여섯째 자리까지 내려줌)
const formatRate = (raw: string | null | undefined): string => {
    const n = toNum(raw);
    if (n <= 0) return '-';
    return n.toLocaleString('ko-KR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
};

const formatPercent = (raw: string | null | undefined): string => {
    const n = toNum(raw);
    return `${n.toFixed(2)}%`;
};

interface RateCardProps {
    title: string;
    caption: string;
    item: UsExchangeRateItem | null | undefined;
    loading: boolean;
}

const RateCard = ({title, caption, item, loading}: RateCardProps) => {
    if (loading) {
        return <Skeleton variant="rounded" height={196}/>;
    }

    const rows: {label: string; value: string}[] = [
        {label: '매수적용환율', value: formatRate(item?.buyAplcExrt)},
        {label: '매도적용환율', value: formatRate(item?.sellAplcExrt)},
        {label: '우대율 적용 전', value: formatRate(item?.spclBfExrt)},
        {label: '환율우대율', value: formatPercent(item?.exrtSpclRt)},
    ];

    return (
        <Card variant="outlined" sx={{height: '100%'}}>
            <CardContent>
                <Stack direction="row" sx={{alignItems: 'center', gap: 1, mb: 0.5}}>
                    <Typography variant="subtitle2">{title}</Typography>
                    {item?.exrtTpNm && (
                        <Chip
                            size="small"
                            label={item.exrtTpNm}
                            variant="outlined"
                            sx={{fontSize: '0.65rem', height: 20}}
                        />
                    )}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                    {caption}
                </Typography>
                <Typography variant="h4" component="p" sx={{mt: 1.5, mb: 2}}>
                    {formatRate(item?.aplcExrt)}
                    <Typography component="span" variant="body2" color="text.secondary" sx={{ml: 0.5}}>
                        원
                    </Typography>
                </Typography>
                <Divider sx={{mb: 1.5}}/>
                <Stack spacing={0.75}>
                    {rows.map(({label, value}) => (
                        <Stack key={label} direction="row" sx={{justifyContent: 'space-between'}}>
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                            <Typography variant="caption">{value}</Typography>
                        </Stack>
                    ))}
                </Stack>
            </CardContent>
        </Card>
    );
};

const UsExchangePage = () => {
    const theme = useTheme();

    const {data: rate, isLoading, lastUpdated, pollError} = usePollingQuery<UsExchangeRateRes>(
        ['usExchangeRate'],
        (config) => fetchUsExchangeRate(config),
    );

    // 5년 일별 시계열은 하루 한 번만 바뀌므로 폴링에서 제외 (약 1,250 포인트)
    const {data: history, isLoading: chartLoading} = useQuery<IndicatorHistoryRes | null>({
        queryKey: ['usdKrwHistory'],
        queryFn: async ({signal}) => requireOk<IndicatorHistoryRes | null>(
            await fetchUsExchangeHistory({signal, skipGlobalError: true}), null,
        ),
        staleTime: 60 * 60 * 1000,
    });

    const buyRate = toNum(rate?.krwToUsd?.aplcExrt);   // 원화 -> 달러
    const sellRate = toNum(rate?.usdToKrw?.aplcExrt);  // 달러 -> 원화

    const [krw, setKrw] = useState('');
    const [usd, setUsd] = useState('');
    // 마지막으로 사용자가 직접 입력한 쪽. 파생 필드 한쪽만 재계산해 왕복 입력 시 값이 흔들리는 것을 막는다.
    const [lastEdited, setLastEdited] = useState<Side>('KRW');

    const handleKrwChange = (raw: string) => {
        setKrw(raw);
        setLastEdited('KRW');
        const amount = toNum(raw);
        setUsd(raw === '' || amount <= 0 || buyRate <= 0 ? '' : (amount / buyRate).toFixed(2));
    };

    const handleUsdChange = (raw: string) => {
        setUsd(raw);
        setLastEdited('USD');
        const amount = toNum(raw);
        setKrw(raw === '' || amount <= 0 || sellRate <= 0 ? '' : Math.round(amount * sellRate).toString());
    };

    // 폴링으로 환율이 갱신되면 사용자가 입력한 쪽은 그대로 두고 파생 필드만 다시 계산
    useEffect(() => {
        if (lastEdited === 'KRW') {
            const amount = toNum(krw);
            if (krw === '' || amount <= 0 || buyRate <= 0) return;
            setUsd((amount / buyRate).toFixed(2));
        } else {
            const amount = toNum(usd);
            if (usd === '' || amount <= 0 || sellRate <= 0) return;
            setKrw(Math.round(amount * sellRate).toString());
        }
        // krw/usd 는 의도적으로 의존성에서 제외 — 입력 핸들러가 이미 처리하므로 재계산 루프를 만들지 않는다
    }, [buyRate, sellRate, lastEdited]);

    const marketIndex = rate?.marketIndex;
    const trend = getTrend(marketIndex?.changeRate);

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', mb: 2, gap: 2}}>
                <Typography component="h2" variant="h6">
                    환율
                </Typography>
                <Box sx={{flex: 1}}/>
                <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>
            </Box>

            {/* 시장 USD/KRW 시세 (네이버) */}
            <Card variant="outlined" sx={{mb: 2}}>
                <CardContent>
                    {isLoading ? (
                        <Skeleton variant="text" height={48}/>
                    ) : marketIndex ? (
                        <Stack direction="row" sx={{alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
                            <Typography variant="subtitle2" color="text.secondary">
                                시장 환율 (USD/KRW)
                            </Typography>
                            <Typography variant="h5" component="p" sx={{fontWeight: 700}}>
                                {marketIndex.price}
                            </Typography>
                            <Stack direction="row" sx={{alignItems: 'center'}}>
                                <TrendIcon trend={trend}/>
                                <Typography variant="body2" sx={{color: TREND_COLORS[trend], fontWeight: 600}} noWrap>
                                    {marketIndex.changeAmount}
                                </Typography>
                            </Stack>
                            <Chip
                                size="small"
                                label={marketIndex.changeRate}
                                color={trend === 'up' ? 'error' : trend === 'down' ? 'info' : 'default'}
                                sx={{fontWeight: 600, minWidth: 65}}
                            />
                            {marketIndex.delayStatus && (
                                <Chip
                                    size="small"
                                    label={marketIndex.delayStatus}
                                    variant="outlined"
                                    color={marketIndex.delayStatus === '실시간' ? 'success' : 'default'}
                                    sx={{fontSize: '0.65rem', height: 20}}
                                />
                            )}
                        </Stack>
                    ) : (
                        <Typography variant="body2" color="text.secondary">
                            시장 환율을 불러오지 못했습니다.
                        </Typography>
                    )}
                </CardContent>
            </Card>

            {/* 환전 적용환율 */}
            <Grid container spacing={2} sx={{mb: 2}}>
                <Grid size={{xs: 12, md: 6}}>
                    <RateCard
                        title="원화 → 달러"
                        caption="원화를 달러로 환전할 때 적용"
                        item={rate?.krwToUsd}
                        loading={isLoading}
                    />
                </Grid>
                <Grid size={{xs: 12, md: 6}}>
                    <RateCard
                        title="달러 → 원화"
                        caption="달러를 원화로 환전할 때 적용"
                        item={rate?.usdToKrw}
                        loading={isLoading}
                    />
                </Grid>
            </Grid>

            {/* 환전 계산기 */}
            <Card variant="outlined" sx={{mb: 2}}>
                <CardContent>
                    <Typography variant="subtitle2" sx={{mb: 2}}>
                        환전 계산기
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid size={{xs: 12, md: 6}}>
                            <TextField
                                fullWidth
                                size="small"
                                label="원화"
                                value={krw}
                                onChange={(e) => handleKrwChange(e.target.value.replace(/[^0-9.]/g, ''))}
                                disabled={isLoading || buyRate <= 0}
                                placeholder="1000000"
                                slotProps={{
                                    inputLabel: {shrink: true},
                                    input: {
                                        endAdornment: <InputAdornment position="end">원</InputAdornment>,
                                    },
                                }}
                                helperText={buyRate > 0 ? `적용환율 ${formatRate(rate?.krwToUsd?.aplcExrt)}원` : ' '}
                            />
                        </Grid>
                        <Grid size={{xs: 12, md: 6}}>
                            <TextField
                                fullWidth
                                size="small"
                                label="달러"
                                value={usd}
                                onChange={(e) => handleUsdChange(e.target.value.replace(/[^0-9.]/g, ''))}
                                disabled={isLoading || sellRate <= 0}
                                placeholder="1000"
                                slotProps={{
                                    inputLabel: {shrink: true},
                                    input: {
                                        endAdornment: <InputAdornment position="end">USD</InputAdornment>,
                                    },
                                }}
                                helperText={sellRate > 0 ? `적용환율 ${formatRate(rate?.usdToKrw?.aplcExrt)}원` : ' '}
                            />
                        </Grid>
                    </Grid>
                    <Typography variant="caption" color="text.secondary">
                        키움증권 고시 적용환율 기준 예상 금액이며 실제 환전 금액과 다를 수 있습니다.
                    </Typography>
                </CardContent>
            </Card>

            {/* 원/달러 5년 추이 (한국은행 ECOS) */}
            <Card variant="outlined">
                <CardContent>
                    <Stack direction="row" sx={{alignItems: 'center', gap: 1, mb: 2}}>
                        <Typography variant="subtitle2">원/달러 환율 추이</Typography>
                        <Typography variant="caption" color="text.secondary">최근 5년 · 일별</Typography>
                    </Stack>
                    {chartLoading ? (
                        <Skeleton variant="rectangular" height={300} sx={{borderRadius: 1}}/>
                    ) : history && history.data.length > 0 ? (
                        <Box sx={{overflowX: 'auto'}}>
                            <Box sx={{minWidth: 600, height: 300}}>
                                <LineChart
                                    xAxis={[{
                                        data: history.data.map((_, i) => i),
                                        scaleType: 'point',
                                        tickLabelStyle: {fontSize: 11},
                                        valueFormatter: (i: number, ctx) => {
                                            const date = history.data[i]?.date ?? '';
                                            const yyyy = date.substring(0, 4);
                                            const mm = date.includes('-') ? date.substring(5, 7) : date.substring(4, 6);
                                            const dd = date.includes('-') ? date.substring(8, 10) : date.substring(6, 8);

                                            if (ctx.location === 'tooltip') {
                                                return `${yyyy}.${mm}.${dd}`;
                                            }
                                            // 1,250 포인트라 라벨이 겹침 — 연초만 노출
                                            if (history.data.length > 100) {
                                                return mm === '01' && dd <= '03' ? `${yyyy}.01` : '';
                                            }
                                            return `${yyyy.substring(2)}.${mm}`;
                                        },
                                    }]}
                                    yAxis={[(() => {
                                        const values = history.data.map(d => Number(d.value) || 0);
                                        // 환율은 0 기준선이 무의미하므로 데이터 범위로 축을 잡는다
                                        return {min: Math.min(...values), max: Math.max(...values)};
                                    })()]}
                                    series={[{
                                        data: history.data.map(d => Number(d.value) || 0),
                                        showMark: false,
                                        curve: 'linear',
                                        area: true,
                                        color: theme.palette.primary.main,
                                        valueFormatter: (v) => v == null ? '' : `${v.toLocaleString('ko-KR')}원`,
                                    }]}
                                    height={300}
                                />
                            </Box>
                        </Box>
                    ) : (
                        <Typography variant="body2" color="text.secondary" sx={{py: 2, textAlign: 'center'}}>
                            데이터가 없습니다.
                        </Typography>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
};

export default UsExchangePage;

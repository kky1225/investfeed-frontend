import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import Skeleton from "@mui/material/Skeleton";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import RemoveIcon from "@mui/icons-material/Remove";
import {MarketIndexRes, CryptoSummary} from "../../type/MarketIndexType.ts";
import {fetchMarketIndexAll} from "../../api/marketindex/MarketIndexApi.ts";
import FearGreedGauge from "../../components/FearGreedGauge.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {usePollingQuery} from "../../lib/pollingQuery.ts";

// 상단 티커 바에 표시할 핵심 지수
const TICKER_TYPES = ['KOSPI', 'KOSDAQ', 'NASDAQ', 'USD_KRW'];

// 테이블 섹션 정의
const TABLE_SECTIONS = [
    {title: '미국 증시', types: ['NASDAQ', 'SP500', 'VIX', 'PHILADELPHIA_SEMICONDUCTOR']},
    {title: '국내 증시', types: ['KOSPI', 'KOSDAQ']},
    {title: '환율 · 지수', types: ['USD_KRW', 'DOLLAR_INDEX']},
    {title: '원자재', types: ['GOLD_INTERNATIONAL', 'WTI']},
];

const getTrend = (changeRate: string): 'up' | 'down' | 'neutral' => {
    if (changeRate.startsWith('+')) return 'up';
    if (changeRate.startsWith('-')) return 'down';
    return 'neutral';
};

const trendColor = {up: '#d32f2f', down: '#0288d1', neutral: 'inherit'};

function TrendIcon({trend}: {trend: 'up' | 'down' | 'neutral'}) {
    if (trend === 'up') return <ArrowDropUpIcon sx={{color: trendColor.up, fontSize: 20}}/>;
    if (trend === 'down') return <ArrowDropDownIcon sx={{color: trendColor.down, fontSize: 20}}/>;
    return <RemoveIcon sx={{color: 'text.disabled', fontSize: 14}}/>;
}

// 암호화폐 요약 카드 — BTC/ETH 공용 (Upbit 실시간)
function CryptoSummaryCard({title, data, loading}: {title: string; data: CryptoSummary | null; loading: boolean}) {
    const trend: 'up' | 'down' | 'neutral' = data?.trend === 'UP' ? 'up' : data?.trend === 'DOWN' ? 'down' : 'neutral';
    const color = trendColor[trend];
    return (
        <Card variant="outlined">
            <CardContent>
                <Stack direction="row" sx={{justifyContent: 'space-between', alignItems: 'center', mb: 1}}>
                    <Typography variant="subtitle2">{title}</Typography>
                    {loading ? (
                        <Skeleton variant="rounded" width={50} height={20}/>
                    ) : (
                        <Chip size="small" label="실시간" variant="outlined" color="success" sx={{fontSize: '0.65rem', height: 20}}/>
                    )}
                </Stack>
                <Typography variant="h5" sx={{fontWeight: 700, mb: 1}}>
                    {loading ? <Skeleton width="60%"/> : `${Number(data!.price).toLocaleString()}원`}
                </Typography>
                <Stack direction="row" sx={{alignItems: 'center', gap: 0.5}}>
                    {!loading && data && <TrendIcon trend={trend}/>}
                    <Typography variant="body2" sx={{fontWeight: 600, color: data ? color : 'inherit'}}>
                        {loading ? <Skeleton width={120}/> : `${Number(data!.changeAmount) > 0 ? '+' : ''}${Number(data!.changeAmount).toLocaleString()}원`}
                    </Typography>
                    {loading ? (
                        <Skeleton variant="rounded" width={60} height={24}/>
                    ) : (
                        <Chip
                            size="small"
                            label={`${Number(data!.changeRate) > 0 ? '+' : ''}${data!.changeRate}%`}
                            color={trend === 'up' ? 'error' : trend === 'down' ? 'info' : 'default'}
                            sx={{fontWeight: 600}}
                        />
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}

// 공포탐욕 게이지 스켈레톤 (SVG + Chart 포함이라 별도 처리)
function FearGreedSkeleton() {
    return (
        <Card variant="outlined" sx={{width: '100%', height: '100%'}}>
            <CardContent>
                <Skeleton variant="text" width={100} height={24}/>
                <Box sx={{display: 'flex', justifyContent: 'center', mt: 1}}>
                    <Skeleton variant="circular" width={180} height={100}/>
                </Box>
                <Skeleton variant="text" width={80} sx={{mt: 2}}/>
                <Skeleton variant="rectangular" height={150} sx={{mt: 1, borderRadius: 1}}/>
            </CardContent>
        </Card>
    );
}

export default function MarketIndexList() {
    const {data: result, isLoading: loading, lastUpdated, pollError} = usePollingQuery(
        ['marketIndexAll'],
        (config) => fetchMarketIndexAll(config),
    );

    const data: MarketIndexRes[] = result?.indices ?? [];
    const fearGreedCurrent = result?.fearGreed?.current ?? null;
    const fearGreedHistory = result?.fearGreed?.history ?? [];
    const bitcoin: CryptoSummary | null = result?.bitcoin ?? null;
    const ethereum: CryptoSummary | null = result?.ethereum ?? null;

    const indexMap = Object.fromEntries(data.map(item => [item.type, item]));

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3}}>
                <Typography variant="h6" sx={{fontWeight: 600}}>
                    주요 지수
                </Typography>
                {!loading && <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>}
            </Box>

            {/* 상단 티커 바 */}
            <Card variant="outlined" sx={{mb: 3}}>
                <CardContent sx={{py: 1.5, '&:last-child': {pb: 1.5}}}>
                    <Stack direction="row" sx={{justifyContent: 'space-around', flexWrap: 'wrap', gap: 1}}>
                        {TICKER_TYPES.map(type => {
                            const item = loading ? null : indexMap[type];
                            const trend = item ? getTrend(item.changeRate) : 'neutral';
                            return (
                                <Stack key={type} direction="row" sx={{alignItems: 'center', gap: 0.5}}>
                                    <Typography variant="body2" sx={{fontWeight: 600, color: 'text.secondary'}}>
                                        {loading ? <Skeleton variant="text" width={60}/> : item?.name}
                                    </Typography>
                                    <Typography variant="body2" sx={{fontWeight: 700}}>
                                        {loading ? <Skeleton variant="text" width={70}/> : item?.price}
                                    </Typography>
                                    {!loading && <TrendIcon trend={trend}/>}
                                    <Typography variant="body2" sx={{color: trendColor[trend], fontWeight: 600}}>
                                        {loading ? <Skeleton variant="text" width={50}/> : item?.changeRate}
                                    </Typography>
                                </Stack>
                            );
                        })}
                    </Stack>
                </CardContent>
            </Card>

            {/* 메인 컨텐츠: 테이블 + 공포탐욕 */}
            <Grid container spacing={3}>
                {/* 좌측: 시장 지수 테이블 */}
                <Grid size={{xs: 12, md: 8}}>
                    <Stack spacing={3}>
                        {TABLE_SECTIONS.map(section => {
                            // 로딩 중에는 stub 배열로 레이아웃 유지, 로드 후엔 실제 데이터
                            const items: (MarketIndexRes | null)[] = loading
                                ? section.types.map(() => null)
                                : section.types.map(type => indexMap[type]).filter(Boolean);
                            if (items.length === 0) return null;

                            return (
                                <Card variant="outlined" key={section.title}>
                                    <CardContent sx={{pb: '16px !important'}}>
                                        <Typography variant="body2" sx={{fontWeight: 600, color: 'text.secondary', mb: 1}}>
                                            {section.title}
                                        </Typography>
                                        <TableContainer>
                                            <Table size="small" sx={{tableLayout: 'fixed'}}>
                                                <colgroup>
                                                    <col style={{width: '30%'}}/>
                                                    <col style={{width: '22%'}}/>
                                                    <col style={{width: '18%'}}/>
                                                    <col style={{width: '15%'}}/>
                                                    <col style={{width: '15%'}}/>
                                                </colgroup>
                                                <TableBody>
                                                    {items.map((item, i) => {
                                                        const trend = item ? getTrend(item.changeRate) : 'neutral';
                                                        const color = trendColor[trend];
                                                        return (
                                                            <TableRow key={item?.type ?? i} sx={{'&:last-child td': {borderBottom: 0}}}>
                                                                <TableCell>
                                                                    <Typography variant="body2" sx={{fontWeight: 600}} noWrap>
                                                                        {item ? item.name : <Skeleton width="70%"/>}
                                                                    </Typography>
                                                                </TableCell>
                                                                <TableCell align="right">
                                                                    <Typography variant="body2" sx={{fontWeight: 700}} noWrap>
                                                                        {item ? item.price : <Skeleton width={80} sx={{ml: 'auto'}}/>}
                                                                    </Typography>
                                                                </TableCell>
                                                                <TableCell align="right">
                                                                    <Stack direction="row" sx={{alignItems: 'center', justifyContent: 'flex-end'}}>
                                                                        {item && <TrendIcon trend={trend}/>}
                                                                        <Typography variant="body2" sx={{color, fontWeight: 600}} noWrap>
                                                                            {item ? item.changeAmount : <Skeleton width={70}/>}
                                                                        </Typography>
                                                                    </Stack>
                                                                </TableCell>
                                                                <TableCell align="right">
                                                                    {item ? (
                                                                        <Chip
                                                                            size="small"
                                                                            label={item.changeRate}
                                                                            color={trend === 'up' ? 'error' : trend === 'down' ? 'info' : 'default'}
                                                                            sx={{fontWeight: 600, minWidth: 65}}
                                                                        />
                                                                    ) : (
                                                                        <Skeleton variant="rounded" width={65} height={24} sx={{ml: 'auto'}}/>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell align="right">
                                                                    {item ? (
                                                                        <Chip
                                                                            size="small"
                                                                            label={item.delayStatus}
                                                                            variant="outlined"
                                                                            color={item.delayStatus === '실시간' ? 'success' : 'default'}
                                                                            sx={{fontSize: '0.65rem', height: 20}}
                                                                        />
                                                                    ) : (
                                                                        <Skeleton variant="rounded" width={50} height={20} sx={{ml: 'auto'}}/>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </Stack>
                </Grid>

                {/* 우측: 공포 & 탐욕 지수 + BTC + ETH */}
                {(loading || fearGreedCurrent || bitcoin || ethereum) && (
                    <Grid size={{xs: 12, md: 4}}>
                        <Stack spacing={3}>
                            {loading ? (
                                <FearGreedSkeleton/>
                            ) : fearGreedCurrent && (
                                <FearGreedGauge current={fearGreedCurrent} history={fearGreedHistory}/>
                            )}
                            {(loading || bitcoin) && (
                                <CryptoSummaryCard title="비트코인 (BTC)" data={bitcoin} loading={loading}/>
                            )}
                            {(loading || ethereum) && (
                                <CryptoSummaryCard title="이더리움 (ETH)" data={ethereum} loading={loading}/>
                            )}
                        </Stack>
                    </Grid>
                )}
            </Grid>
        </Box>
    );
}

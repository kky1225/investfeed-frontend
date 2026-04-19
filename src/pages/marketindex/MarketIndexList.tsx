import {useEffect, useRef, useState} from "react";
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
import CircularProgress from "@mui/material/CircularProgress";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import RemoveIcon from "@mui/icons-material/Remove";
import {MarketIndexRes} from "../../type/MarketIndexType.ts";
import {fetchMarketIndexAll} from "../../api/marketindex/MarketIndexApi.ts";
import FearGreedGauge from "../../components/FearGreedGauge.tsx";
import type {FearGreedItem} from "../../type/CryptoType.ts";

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

export default function MarketIndexList() {
    const [data, setData] = useState<MarketIndexRes[]>([]);
    const [fearGreedCurrent, setFearGreedCurrent] = useState<FearGreedItem | null>(null);
    const [fearGreedHistory, setFearGreedHistory] = useState<FearGreedItem[]>([]);
    const [bitcoin, setBitcoin] = useState<{price: string; changeAmount: string; changeRate: string; trend: string} | null>(null);
    const [loading, setLoading] = useState(true);

    const chartTimer = useRef<number>(0);

    const loadData = async () => {
        try {
            const result = await fetchMarketIndexAll();
            setData(result.indices);
            if (result.fearGreed) {
                setFearGreedCurrent(result.fearGreed.current);
                setFearGreedHistory(result.fearGreed.history);
            }
            setBitcoin(result.bitcoin ?? null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let chartTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;

        (async () => {
            await loadData();

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            chartTimeout = setTimeout(() => {
                loadData();
                interval = setInterval(() => {
                    loadData();
                }, 60 * 1000);
            }, waitTime + 2000);
        })();

        return () => {
            clearTimeout(chartTimeout);
            clearInterval(interval);
        };
    }, []);

    if (loading) {
        return (
            <Box sx={{display: 'flex', justifyContent: 'center', mt: 8}}>
                <CircularProgress/>
            </Box>
        );
    }

    const indexMap = Object.fromEntries(data.map(item => [item.type, item]));

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3}}>
                <Typography variant="h6" sx={{fontWeight: 600}}>
                    주요 지수
                </Typography>
                {data.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                        {new Date(data[0].updatedAt).toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})} 기준
                    </Typography>
                )}
            </Box>

            {/* 상단 티커 바 */}
            <Card variant="outlined" sx={{mb: 3}}>
                <CardContent sx={{py: 1.5, '&:last-child': {pb: 1.5}}}>
                    <Stack direction="row" sx={{justifyContent: 'space-around', flexWrap: 'wrap', gap: 1}}>
                        {TICKER_TYPES.map(type => {
                            const item = indexMap[type];
                            if (!item) return null;
                            const trend = getTrend(item.changeRate);
                            return (
                                <Stack key={type} direction="row" sx={{alignItems: 'center', gap: 0.5}}>
                                    <Typography variant="body2" sx={{fontWeight: 600, color: 'text.secondary'}}>
                                        {item.name}
                                    </Typography>
                                    <Typography variant="body2" sx={{fontWeight: 700}}>
                                        {item.price}
                                    </Typography>
                                    <TrendIcon trend={trend}/>
                                    <Typography variant="body2" sx={{color: trendColor[trend], fontWeight: 600}}>
                                        {item.changeRate}
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
                <Grid size={{xs: 12, md: fearGreedCurrent ? 8 : 12}}>
                    <Stack spacing={3}>
                        {TABLE_SECTIONS.map(section => {
                            const items = section.types.map(type => indexMap[type]).filter(Boolean);
                            if (items.length === 0) return null;

                            return (
                                <Card variant="outlined" key={section.title}>
                                    <CardContent sx={{pb: '16px !important'}}>
                                        <Typography variant="body2" sx={{fontWeight: 600, color: 'text.secondary', mb: 1}}>
                                            {section.title}
                                        </Typography>
                                        <TableContainer>
                                            <Table size="small">
                                                <TableBody>
                                                    {items.map(item => {
                                                        const trend = getTrend(item.changeRate);
                                                        const color = trendColor[trend];
                                                        return (
                                                            <TableRow key={item.type} sx={{'&:last-child td': {borderBottom: 0}}}>
                                                                <TableCell>
                                                                    <Typography variant="body2" sx={{fontWeight: 600}}>
                                                                        {item.name}
                                                                    </Typography>
                                                                </TableCell>
                                                                <TableCell align="right">
                                                                    <Typography variant="body2" sx={{fontWeight: 700}}>
                                                                        {item.price}
                                                                    </Typography>
                                                                </TableCell>
                                                                <TableCell align="right">
                                                                    <Stack direction="row" sx={{alignItems: 'center', justifyContent: 'flex-end'}}>
                                                                        <TrendIcon trend={trend}/>
                                                                        <Typography variant="body2" sx={{color, fontWeight: 600}}>
                                                                            {item.changeAmount}
                                                                        </Typography>
                                                                    </Stack>
                                                                </TableCell>
                                                                <TableCell align="right">
                                                                    <Chip
                                                                        size="small"
                                                                        label={item.changeRate}
                                                                        color={trend === 'up' ? 'error' : trend === 'down' ? 'info' : 'default'}
                                                                        sx={{fontWeight: 600, minWidth: 65}}
                                                                    />
                                                                </TableCell>
                                                                <TableCell align="right">
                                                                    <Chip
                                                                        size="small"
                                                                        label={item.delayStatus}
                                                                        variant="outlined"
                                                                        color={item.delayStatus === '실시간' ? 'success' : 'default'}
                                                                        sx={{fontSize: '0.65rem', height: 20}}
                                                                    />
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

                {/* 우측: 공포 & 탐욕 지수 + 비트코인 */}
                {(fearGreedCurrent || bitcoin) && (
                    <Grid size={{xs: 12, md: 4}}>
                        <Stack spacing={3}>
                            {fearGreedCurrent && (
                                <FearGreedGauge current={fearGreedCurrent} history={fearGreedHistory}/>
                            )}
                            {bitcoin && (
                                <Card variant="outlined">
                                    <CardContent>
                                        <Stack direction="row" sx={{justifyContent: 'space-between', alignItems: 'center', mb: 1}}>
                                            <Typography variant="subtitle2">
                                                비트코인 (BTC)
                                            </Typography>
                                            <Chip size="small" label="실시간" variant="outlined" color="success" sx={{fontSize: '0.65rem', height: 20}}/>
                                        </Stack>
                                        <Typography variant="h5" sx={{fontWeight: 700, mb: 1}}>
                                            {Number(bitcoin.price).toLocaleString()}원
                                        </Typography>
                                        <Stack direction="row" sx={{alignItems: 'center', gap: 0.5}}>
                                            <TrendIcon trend={bitcoin.trend === 'UP' ? 'up' : bitcoin.trend === 'DOWN' ? 'down' : 'neutral'}/>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontWeight: 600,
                                                    color: bitcoin.trend === 'UP' ? trendColor.up : bitcoin.trend === 'DOWN' ? trendColor.down : 'inherit'
                                                }}
                                            >
                                                {Number(bitcoin.changeAmount) > 0 ? '+' : ''}{Number(bitcoin.changeAmount).toLocaleString()}원
                                            </Typography>
                                            <Chip
                                                size="small"
                                                label={`${Number(bitcoin.changeRate) > 0 ? '+' : ''}${bitcoin.changeRate}%`}
                                                color={bitcoin.trend === 'UP' ? 'error' : bitcoin.trend === 'DOWN' ? 'info' : 'default'}
                                                sx={{fontWeight: 600}}
                                            />
                                        </Stack>
                                    </CardContent>
                                </Card>
                            )}
                        </Stack>
                    </Grid>
                )}
            </Grid>
        </Box>
    );
}

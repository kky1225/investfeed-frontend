import {useEffect, useRef, useState} from "react";
import {useNavigate} from "react-router-dom";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import {MarketIndexRes} from "../../type/MarketIndexType.ts";
import {fetchMarketIndexAll} from "../../api/marketindex/MarketIndexApi.ts";

// 타입별 카테고리 섹션 정의
const SECTIONS = [
    {
        title: '미국 증시',
        types: ['NASDAQ', 'SP500', 'VIX', 'PHILADELPHIA_SEMICONDUCTOR'],
        linkable: false,
        gridSize: {xs: 12, sm: 6, md: 3},
    },
    {
        title: '환율 · 지수',
        types: ['USD_KRW', 'DOLLAR_INDEX'],
        linkable: false,
        gridSize: {xs: 12, sm: 6, md: 6},
    },
    {
        title: '원자재',
        types: ['GOLD_INTERNATIONAL', 'WTI'],
        linkable: false,
        gridSize: {xs: 12, sm: 6, md: 6},
    },
    {
        title: '국내 증시',
        types: ['KOSPI', 'KOSDAQ'],
        linkable: false,
        gridSize: {xs: 12, sm: 6, md: 6},
    },
];

interface MarketIndexCardProps {
    item: MarketIndexRes;
    linkable: boolean;
    linkUrl?: string;
}

const getTrend = (changeRate: string): 'up' | 'down' | 'neutral' => {
    if (changeRate.startsWith('+')) return 'up';
    if (changeRate.startsWith('-')) return 'down';
    return 'neutral';
};

const trendChipColor = {
    up: 'error' as const,
    down: 'info' as const,
    neutral: 'default' as const,
};

function MarketIndexCard({item, linkable, linkUrl}: MarketIndexCardProps) {
    const navigate = useNavigate();
    const trend = getTrend(item.changeRate);
    const chipColor = trendChipColor[trend];

    const updatedTime = new Date(item.updatedAt).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
    });

    const cardContent = (
        <CardContent sx={{p: 3, '&:last-child': {pb: 3}}}>
            <Stack direction="row" sx={{justifyContent: 'space-between', alignItems: 'flex-start', mb: 1}}>
                <Typography component="h2" variant="body1" sx={{fontWeight: 600}}>
                    {item.name}
                </Typography>
                <Chip
                    size="small"
                    label={item.delayStatus}
                    variant="outlined"
                    color={item.delayStatus === '실시간' ? 'success' : 'default'}
                    sx={{fontSize: '0.65rem', height: 20}}
                />
            </Stack>

            <Typography variant="h4" component="p" sx={{fontWeight: 700, mb: 1}}>
                {item.price}
            </Typography>

            <Stack direction="row" sx={{alignItems: 'center', gap: 1, mb: 1}}>
                <Chip size="small" color={chipColor} label={item.changeRate}/>
                <Typography variant="body2" sx={{color: 'text.secondary'}}>
                    {item.changeAmount}
                </Typography>
            </Stack>

            <Typography variant="caption" sx={{color: 'text.disabled', display: 'block'}}>
                {updatedTime} 기준
            </Typography>
        </CardContent>
    );

    if (linkable && linkUrl) {
        return (
            <Card variant="outlined" sx={{height: '100%'}}>
                <CardActionArea onClick={() => navigate(linkUrl)} sx={{height: '100%'}}>
                    {cardContent}
                </CardActionArea>
            </Card>
        );
    }

    return (
        <Card variant="outlined" sx={{height: '100%'}}>
            {cardContent}
        </Card>
    );
}

export default function MarketIndexList() {
    const [data, setData] = useState<MarketIndexRes[]>([]);
    const [loading, setLoading] = useState(true);

    const chartTimer = useRef<number>(0);

    const loadData = async () => {
        try {
            const result = await fetchMarketIndexAll();
            setData(result);
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
            }, waitTime + 6000);
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
            <Typography variant="h6" sx={{mb: 3, fontWeight: 600}}>
                주요 지수
            </Typography>

            <Stack spacing={4}>
                {SECTIONS.map(section => {
                    const items = section.types
                        .map(type => indexMap[type])
                        .filter(Boolean);

                    if (items.length === 0) return null;

                    return (
                        <Box key={section.title}>
                            <Typography
                                variant="subtitle2"
                                sx={{mb: 1.5, color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5}}
                            >
                                {section.title}
                            </Typography>
                            <Grid container spacing={3}>
                                {items.map(item => (
                                    <Grid key={item.type} size={section.gridSize}>
                                        <MarketIndexCard
                                            item={item}
                                            linkable={section.linkable}
                                        />
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    );
                })}
            </Stack>
        </Box>
    );
}

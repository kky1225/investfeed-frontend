import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import {CardActionArea} from "@mui/material";
import {useNavigate} from "react-router-dom";
import {renderChangeAmount} from "./CustomRender.tsx";
import MiniChart from "./chart/MiniChart.tsx";
import type {MiniChartMode} from "../lib/chart/MiniChart.ts";
import type {Candle} from "../lib/chart/types.ts";

export interface CryptoLineChartProps {
    market: string,
    title: string,
    value: string,
    changeRate: string,
    changePrice: number,
    trend: 'up' | 'down' | 'neutral',
    interval: string,
    accTradePrice24h: string,
    candles: Candle[],          // 최근 24시간의 분봉 (오래된 순)
    chartMode: MiniChartMode,   // 선 / 캔들
}

const CryptoLineChart = (
    {market, title, value, changeRate, changePrice, trend, interval, accTradePrice24h, candles, chartMode}: CryptoLineChartProps,
) => {
    const navigate = useNavigate();

    const onClick = (market: string) => {
        navigate(`/crypto/detail/${market}`);
    }

    const labelColors = {
        up: 'error' as const,
        down: 'info' as const,
        neutral: 'default' as const,
    };

    const color = labelColors[trend];
    const trendValues = {up: `+${changeRate}%`, down: `${changeRate}%`, neutral: `${changeRate}%`};

    return (
        <CardActionArea
            onClick={() => onClick(market)}
            sx={{
                height: '100%',
                '&[tabIndex="0"]': {
                    borderRadius: 'calc(8px - 1px)',
                },
            }}
        >
        <Card variant="outlined" sx={{width: '100%'}}>
            <CardContent>
                <Typography component="h2" variant="subtitle2" gutterBottom>
                    {title}
                </Typography>
                <Stack sx={{justifyContent: 'space-between'}}>
                    <Stack
                        direction="row"
                        sx={{
                            alignContent: {xs: 'center', sm: 'flex-start'},
                            alignItems: 'center',
                            gap: 1,
                        }}
                    >
                        <Typography variant="h4" component="p">
                            {value}
                        </Typography>
                        {renderChangeAmount(changePrice)}
                        <Chip size="small" color={color} label={trendValues[trend]}/>
                    </Stack>
                    <Stack
                        direction="row"
                        sx={{
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <Typography variant="caption" sx={{color: 'text.secondary'}}>
                            {interval}
                        </Typography>
                        <Typography variant="caption" sx={{color: 'text.secondary'}}>
                            거래대금(24h) {accTradePrice24h}
                        </Typography>
                    </Stack>
                </Stack>
            </CardContent>
            {/* 최근 24시간의 흐름 */}
            <MiniChart candles={candles} mode={chartMode} trend={trend}/>
        </Card>
        </CardActionArea>
    )
}

export default CryptoLineChart;

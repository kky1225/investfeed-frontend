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

export interface IndexLineChartProps {
    id: string,
    title: string,
    value: string,
    fluRt: string,
    predPre: string,
    openPric: number,
    trend: 'up' | 'down' | 'neutral',
    candles: Candle[],          // 당일 분봉 (오래된 순)
    chartMode: MiniChartMode,   // 선 / 캔들
}

const IndexLineChart = (
    { id, title, value, fluRt, predPre, openPric, trend, candles, chartMode }: IndexLineChartProps,
) => {
    const navigate = useNavigate();

    const labelColors = {
        up: 'error' as const,
        down: 'info' as const,
        neutral: 'default' as const,
    };

    const color = labelColors[trend];
    const trendValues = { up: `${fluRt}%`, down: `${fluRt}%`, neutral: `${fluRt}%` };

    const onClick = (id: string) => {
        navigate(`/stock/index/detail/${id}`);
    }

    return (
        <CardActionArea
            onClick={() => onClick(id)}
            sx={{
                height: '100%',
                '&[data-active]': {
                    backgroundColor: 'action.selected',
                    '&:hover': {
                        backgroundColor: 'action.selectedHover',
                    },
                },
            }}
        >
            <Card variant="outlined" sx={{ width: '100%' }}>
                <CardContent>
                    <Typography component="h2" variant="subtitle2" gutterBottom>
                        {title}
                    </Typography>
                    <Stack sx={{ justifyContent: 'space-between' }}>
                        <Stack
                            direction="row"
                            sx={{
                                alignContent: { xs: 'center', sm: 'flex-start' },
                                alignItems: 'center',
                                gap: 1,
                            }}
                        >
                            <Typography variant="h4" component="p">
                                {value}
                            </Typography>
                            {renderChangeAmount(predPre, '')}
                            <Chip size="small" color={color} label={trendValues[trend]} />
                        </Stack>
                    </Stack>
                </CardContent>
                {/* 당일 흐름. 점선은 시가 */}
                <MiniChart candles={candles} mode={chartMode} trend={trend} baseline={openPric}/>
            </Card>
        </CardActionArea>
    )
}

export default IndexLineChart;

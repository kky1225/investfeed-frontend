import {useTheme} from "@mui/material/styles";
import {LineChart, LineSeriesType} from "@mui/x-charts";
import {MakeOptional} from '@mui/x-internals/types';
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import {lineClasses} from "@mui/x-charts/LineChart";
import {CardActionArea} from "@mui/material";
import {useNavigate} from "react-router-dom";
import {renderChangeAmount} from "./CustomRender.tsx";

export interface CryptoLineChartProps {
    market: string,
    title: string,
    value: string,
    changeRate: string,
    changePrice: number,
    trend: 'up' | 'down' | 'neutral',
    interval: string,
    accTradePrice24h: string,
    seriesData: MakeOptional<LineSeriesType, 'type'>[],
    dateList: string[],
}

const CryptoLineChart = (
    {market, title, value, changeRate, changePrice, trend, interval, accTradePrice24h, seriesData, dateList}: CryptoLineChartProps,
) => {
    const theme = useTheme();
    const navigate = useNavigate();

    const onClick = (market: string) => {
        navigate(`/crypto/detail/${market}`);
    }

    const numericDates = seriesData[0].data ? seriesData[0].data.map(Number) : [];

    const minY = numericDates.length > 0 ? Math.min(...numericDates) : 0;
    const maxY = numericDates.length > 0 ? Math.max(...numericDates) : 0;
    const padding = (maxY - minY) * 0.05;

    const colorPalette = [
        theme.palette.primary.light,
        theme.palette.primary.main,
        theme.palette.primary.dark,
    ];

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
            <LineChart
                colors={colorPalette}
                xAxis={[
                    {
                        scaleType: 'point',
                        data: dateList,
                        tickLabelStyle: {
                            display: 'none'
                        },
                        tickInterval: (i: number) => i % 80 === 0,
                    },
                ]}
                yAxis={[
                    {
                        valueFormatter: (value: number) => value.toLocaleString(),
                        width: 80,
                        min: minY - padding,
                        max: maxY + padding,
                    },
                ]}
                series={seriesData}
                margin={{left: 10, right: 20, top: 20, bottom: 20}}
                grid={{horizontal: true}}
                sx={{
                    [`& .${lineClasses.area}`]: {
                        fill: 'url(#switch-color-id-1)',
                        filter: 'none',
                    },
                    height: {
                        xs: 250,
                        sm: 250,
                        md: 310
                    }
                }}
            />
        </Card>
        </CardActionArea>
    )
}

export default CryptoLineChart;

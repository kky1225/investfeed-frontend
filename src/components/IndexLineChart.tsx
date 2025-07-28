import {useTheme} from "@mui/material/styles";
import {ChartsReferenceLine, LineChart, LineSeriesType} from "@mui/x-charts";
import { MakeOptional } from '@mui/x-internals/types';
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import {areaElementClasses} from "@mui/x-charts/LineChart";
import {CardActionArea} from "@mui/material";
import {useNavigate} from "react-router-dom";

export interface CustomLineChartProps {
    id: string,
    title: string,
    value: string,
    fluRt: string,
    openPric: number,
    interval: string,
    trend: 'up' | 'down' | 'neutral',
    seriesData: MakeOptional<LineSeriesType, 'type'>[],
    dateList: string[]
}

const IndexLineChart = (
    { id, title, value, fluRt, openPric, interval, trend, seriesData, dateList }: CustomLineChartProps,
) => {
    const theme = useTheme();

    const navigate = useNavigate();

    const numericDates = seriesData[0].data ? seriesData[0].data.map(Number) : [];

    const minY = numericDates.length > 0 ?  Math.min(...numericDates, openPric) : 0;
    const maxY = numericDates.length > 0 ? Math.max(...numericDates, openPric) : 0;

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
    const trendValues = { up: `${fluRt}%`, down: `${fluRt}%`, neutral: `${fluRt}%` };

    const onClick = (id: string) => {
        navigate(`/index/${id}`);
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
                            <Chip size="small" color={color} label={trendValues[trend]} />
                        </Stack>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {interval}
                        </Typography>
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
                            tickInterval: (_index: any, i: number) => i % 5 === 0 //i % 30 === 0,
                        },
                    ]}
                    yAxis={[
                        {
                            valueFormatter: (value: any) => value.toLocaleString(),
                            width: 60,
                            min: minY,
                            max: maxY,
                        },
                    ]}
                    series={seriesData}
                    margin={{ left:10, right: 20, top: 20, bottom: 20 }}
                    grid={{ horizontal: true }}
                    sx={{
                        [`& .${areaElementClasses.root}`]: {
                            fill: 'url(#switch-color-id-1)',
                            filter: 'none',
                        },
                        height: {
                            xs: 250,
                            sm: 250,
                            md: 310
                        }
                    }}
                >
                    <ChartsReferenceLine
                        y={openPric}
                        label={String(openPric)}
                        lineStyle={{ stroke: 'grey', strokeWidth: 2, strokeDasharray: '4 4' }}
                    />
                </LineChart>
            </Card>
        </CardActionArea>
    )
}

export default IndexLineChart;
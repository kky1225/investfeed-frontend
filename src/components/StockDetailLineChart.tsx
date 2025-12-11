import {
    BarPlot,
    ChartContainer, ChartsAxisHighlight, ChartsGrid,
    ChartsTooltip,
    ChartsXAxis,
    ChartsYAxis, LineHighlightPlot,
    LinePlot, LineSeriesType,
} from "@mui/x-charts";
import { MakeOptional } from '@mui/x-internals/types';
import {useTheme} from "@mui/material/styles";

export interface CustomStockDetailLineChartProps {
    id: string,
    title: string,
    value: string,
    fluRt: string,
    openPric: number,
    interval: string,
    trend: 'up' | 'down' | 'neutral',
    seriesData: MakeOptional<LineSeriesType, 'type'>[],
    barDataList: number[],
    dateList: string[]
}

const IndexDetailLineChart = (
    { trend, seriesData, barDataList, dateList }: CustomStockDetailLineChartProps,
) => {
    const theme = useTheme();

    const numericDates = seriesData[0].data ? seriesData[0].data.map(Number) : [];

    const lineMinY = numericDates.length > 0 ?  Math.min(...numericDates) - 5 : 0;
    const lineMaxY = numericDates.length > 0 ? Math.max(...numericDates) + 5 : 0;

    const colorPalette = [
        theme.palette.primary.light,
        theme.palette.primary.main,
        theme.palette.primary.dark,
    ];

    const labelColors = {
        up: 'red' as const,
        down: 'blue' as const,
        neutral: 'grey' as const,
    };

    const color = labelColors[trend];

    const barMaxY = Math.max(...barDataList) * 10;

    return (
        <ChartContainer
            colors={colorPalette}
            margin={{ left:10, right: 20, top: 20, bottom: 20 }}
            xAxis={[
                {
                    id: 'x-line',
                    scaleType: 'band',
                    data: dateList,
                    position: 'bottom',
                    tickLabelStyle: {
                        display: 'none'
                    },
                    tickInterval: (_index: any, i: number) => i % 5 === 0,
                },
                {
                    id: 'x-bar',
                    scaleType: 'band',
                    categoryGapRatio: 0.5,
                    data: dateList,
                },
            ]}
            yAxis={[
                {
                    id: 'y-line',
                    valueFormatter: (value: any) => value.toLocaleString(),
                    min: lineMinY,
                    max: lineMaxY,
                    position: 'left',
                    width: 60,
                },
                {
                    id: 'y-bar',
                    valueFormatter: (value: any) => value.toLocaleString(),
                    min: 0,
                    max: barMaxY,
                    width: 60,
                },
            ]}
            series={[
                {
                    id: 'line',
                    type: 'line',
                    showMark: false,
                    curve: 'linear',
                    area: true,
                    stackOrder: 'ascending',
                    color: color,
                    data: numericDates || [],
                    xAxisId: 'x-line',
                    yAxisId: 'y-line'
                },
                {
                    type: 'bar',
                    id: 'bar',
                    data: barDataList || [],
                    stack: 'B',
                    xAxisId: 'x-bar',
                    yAxisId: 'y-bar',
                    color: 'skyblue'
                }
            ]}
            sx={{
                '& .MuiAreaElement-series-organic': {
                    fill: "url('#organic')",
                },
                '& .MuiAreaElement-series-referral': {
                    fill: "url('#referral')",
                },
                '& .MuiAreaElement-series-direct': {
                    fill: "url('#direct')",
                },
                height: {
                    xs: 250,
                    sm: 250,
                    md: 310
                }
            }}
        >
            <ChartsXAxis axisId="x-line" />
            <ChartsYAxis axisId="y-line" />

            <LinePlot />
            <BarPlot />

            <ChartsTooltip />
            <ChartsAxisHighlight x="line" />
            <LineHighlightPlot />
            <ChartsGrid horizontal />
        </ChartContainer>
    )
}

export default IndexDetailLineChart;
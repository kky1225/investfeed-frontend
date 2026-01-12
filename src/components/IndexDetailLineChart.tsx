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

export interface CustomIndexDetailLineChartProps {
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
    { trend, seriesData, barDataList, dateList }: CustomIndexDetailLineChartProps,
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

    const barMaxY = Math.max(...barDataList) * 5;

    return (
        <ChartContainer
            colors={colorPalette}
            margin={{ left:10, right: 10, top: 20, bottom: 20 }}
            xAxis={[
                {
                    id: 'x-line',
                    scaleType: 'band',
                    data: dateList,
                    position: 'bottom',
                    tickLabelStyle: {
                        display: 'none'
                    },
                    tickInterval: (_index: number, i: number) => i % 5 === 0,
                }
            ]}
            yAxis={[
                {
                    id: 'y-line',
                    min: lineMinY,
                    max: lineMaxY,
                    position: 'left',
                    width: 60,
                },
                {
                    id: 'y-bar',
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
                    xAxisId: 'x-line',
                    yAxisId: 'y-bar',
                    color: 'skyblue',
                    valueFormatter: (value: number | null) => value === null ? "" : value.toLocaleString()
                }
            ]}
            sx={{
                height: {
                    xs: 250,
                    sm: 250,
                    md: 310
                }
            }}
        >
            <ChartsXAxis axisId="x-line" />
            <ChartsYAxis axisId="y-line" />

            <BarPlot />
            <LinePlot />

            <ChartsTooltip />
            <ChartsAxisHighlight x="line" />
            <LineHighlightPlot />
            <ChartsGrid horizontal />
        </ChartContainer>
    )
}

export default IndexDetailLineChart;
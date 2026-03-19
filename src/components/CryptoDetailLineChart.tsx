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

export interface CryptoDetailLineChartProps {
    id: string,
    title: string,
    value: string,
    changeRate: string,
    interval: string,
    trend: 'up' | 'down' | 'neutral',
    seriesData: MakeOptional<LineSeriesType, 'type'>[],
    barDataList: number[],
    dateList: string[]
}

const CryptoDetailLineChart = (
    { trend, seriesData, barDataList, dateList }: CryptoDetailLineChartProps,
) => {
    const theme = useTheme();

    const numericDates = seriesData[0].data ? seriesData[0].data.map(Number) : [];

    const lineMinY = numericDates.length > 0 ? Math.min(...numericDates) : 0;
    const lineMaxY = numericDates.length > 0 ? Math.max(...numericDates) : 0;
    const padding = (lineMaxY - lineMinY) * 0.05;

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

    const barMaxY = barDataList.length > 0 ? Math.max(...barDataList) * 5 : 1;

    return (
        <ChartContainer
            colors={colorPalette}
            margin={{ left: 10, right: 10, top: 20, bottom: 20 }}
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
                    min: lineMinY - padding,
                    max: lineMaxY + padding,
                    position: 'left',
                    width: 80,
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

export default CryptoDetailLineChart;

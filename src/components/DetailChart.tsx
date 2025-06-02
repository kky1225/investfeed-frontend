import {
    BarPlot,
    ChartContainer, ChartsAxisHighlight, ChartsGrid,
    ChartsTooltip,
    ChartsXAxis,
    ChartsYAxis, LineHighlightPlot,
    LinePlot,
} from "@mui/x-charts";
import {useTheme} from "@mui/material/styles";

const DetailChart = () => {
    const theme = useTheme();

    const colorPalette = [
        theme.palette.primary.light,
        theme.palette.primary.main,
        theme.palette.primary.dark,
    ];

    function getDaysInMonth(month: number, year: number) {
        const date = new Date(year, month, 0);
        const monthName = date.toLocaleDateString('en-US', {
            month: 'short',
        });
        const daysInMonth = date.getDate();
        const days = [];
        let i = 1;
        while (days.length < daysInMonth) {
            days.push(`${monthName} ${i}`);
            i += 1;
        }
        return days;
    }

    const lineMinY = 2700;
    const lineMaxY = 2550;

    const barMaxY = 2700;

    return (
        <ChartContainer
            colors={colorPalette}
            margin={{ left:10, right: 20, top: 20, bottom: 20 }}
            xAxis={[
                {
                    id: 'x-line',
                    scaleType: 'band',
                    data: getDaysInMonth(2024, 5),
                    position: 'bottom',
                    tickInterval: (_index: any, i: number) => i % 5 === 0,
                },
                {
                    id: 'x-bar',
                    scaleType: 'band',
                    categoryGapRatio: 0.5,
                    data: getDaysInMonth(2024, 5),
                },
            ]}
            yAxis={[
                {
                    id: 'y-line',
                    valueFormatter: (value: any) => value.toLocaleString(),
                    min: lineMaxY,
                    max: lineMinY,
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
                    color: 'red',
                    data: [
                        2644.4, 2634.4, 2604.7, 2601.2, 2600.3, 2612.4, 2603.4, 2591.5, 2594.8, 2591.2,
                        2589.9, 2593.4, 2599.4, 2604.4, 2614.3, 2619.6, 2621.3, 2626.3, 2633.9, 2635.5,
                        2635.9, 2644.4, 2649.3, 2653.5, 2655.7, 2661.4, 2666.6, 2669.1, 2670.4, 2673.4, 2680.8
                    ],
                    xAxisId: 'x-line',
                    yAxisId: 'y-line'
                },
                {
                    type: 'bar',
                    id: 'bar',
                    data: [
                        100.00, 10.00, 10.00, 13.10, 12.00, 9.00, 10.00, 10.00, 10.00, 10.00,
                        100.00, 10.00, 10.00, 13.10, 12.00, 9.00, 10.00, 10.00, 10.00, 10.00,
                        100.00, 10.00, 10.00, 13.10, 12.00, 9.00, 10.00, 10.00, 10.00, 10.00, 30.00
                    ],
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

export default DetailChart;
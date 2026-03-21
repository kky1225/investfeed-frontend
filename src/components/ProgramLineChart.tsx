import {useTheme} from "@mui/material/styles";
import {LineChart, LineSeriesType} from "@mui/x-charts";
import {MakeOptional} from '@mui/x-internals/types';

export interface CustomLineChartProps {
    seriesData: MakeOptional<LineSeriesType, 'type'>[],
    date: string[],
}

const ProgoramLineChart = (
    { seriesData, date }: CustomLineChartProps
) => {
    const theme = useTheme();

    const colorPalette = [
        theme.palette.primary.light,
        theme.palette.primary.main,
        theme.palette.primary.dark,
    ];

    const AreaGradient = ({ color, id }: { color: string; id: string })=> {
        return (
            <defs>
                <linearGradient id={id} x1="50%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
        );
    }

    return (
        <LineChart
            colors={colorPalette}
            xAxis={[
                {
                    scaleType: 'point',
                    data: date,
                    tickInterval: (_index: any, i: number) => i % 60 === 0,
                    valueFormatter: (value: string) => `${value.substring(0, 2)}:${value.substring(2, 4)}`
                },
            ]}
            yAxis={[
                {
                    valueFormatter: (value: any) => value.toLocaleString(),
                    width: 50,
                },
            ]}
            series={seriesData}
            height={310}
            margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
            grid={{ horizontal: true }}
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
            }}
        >
            <AreaGradient color={theme.palette.primary.dark} id="organic" />
            <AreaGradient color={theme.palette.primary.main} id="referral" />
            <AreaGradient color={theme.palette.primary.light} id="direct" />
        </LineChart>
    )
}

export default ProgoramLineChart;
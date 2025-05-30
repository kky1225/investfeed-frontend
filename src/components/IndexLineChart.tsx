import {useTheme} from "@mui/material/styles";
import {LineChart, LineSeriesType} from "@mui/x-charts";
import { MakeOptional } from '@mui/x-internals/types';

interface CustomLineChartProps {
    seriesData: MakeOptional<LineSeriesType, 'type'>[]
}

const IndexLineChart = (
    { seriesData }: CustomLineChartProps
) => {

    const theme = useTheme();

    const minY = Math.min(...seriesData[0].data);
    const maxY = Math.max(...seriesData[0].data);

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

    function getMinuteTimes(
        startHour: number = 8,
        endHour: number = 20,
        // current: Date = new Date()
    ) {
        const times: string[] = [];

        //const nowHour = current.getHours();
        //const nowMinute = current.getMinutes();

        const nowHour = 8;
        const nowMinute = 30;

        for (let hour = startHour; hour <= endHour; hour++) {
            for (let minute = 0; minute < 60; minute++) {
                if (
                    hour > nowHour ||
                    (hour === nowHour && minute > nowMinute) ||
                    (hour === endHour && minute > 0)
                ) {
                    break;
                }

                const h = hour.toString().padStart(2, '0');
                const m = minute.toString().padStart(2, '0');
                times.push(`${h}:${m}`);
            }
        }

        return times;
    }

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
                    data: getDaysInMonth(2024, 5),
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
            <AreaGradient color={theme.palette.primary.dark} id="organic" />
            <AreaGradient color={theme.palette.primary.main} id="referral" />
            <AreaGradient color={theme.palette.primary.light} id="direct" />
        </LineChart>
    )
}

{/*<BarChart*/}
{/*    borderRadius={8}*/}
{/*    colors={colorPalette}*/}
{/*    xAxis={*/}
{/*        [*/}
{/*            {*/}
{/*                scaleType: 'band',*/}
{/*                data: time,*/}
{/*                categoryGapRatio: 0.5,*/}
{/*                tickInterval: (_index: any, i: number) => i % 30 === 0,*/}
{/*            },*/}
{/*        ]*/}
{/*    }*/}
{/*    yAxis={[*/}
{/*        {*/}
{/*            valueFormatter: (value: any) => value.toLocaleString(),*/}
{/*            width: 50,*/}
{/*        },*/}
{/*    ]}*/}
{/*    series={[*/}
{/*        {*/}
{/*            id: 'page-views',*/}
{/*            data: [2234, 3872, 2998, 4125, 3357, 2789, 2998],*/}
{/*            stack: 'A',*/}
{/*        }*/}
{/*    ]}*/}
{/*    height={250}*/}
{/*    margin={{ left: 50, right: 0, top: 20, bottom: 20 }}*/}
{/*    grid={{ horizontal: true }}*/}
{/*/>*/}

export default IndexLineChart;
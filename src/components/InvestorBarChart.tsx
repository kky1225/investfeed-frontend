import { BarChart } from "@mui/x-charts"
import {useTheme} from "@mui/material/styles";

const IndexBarChart = () => {
    const theme = useTheme()

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

    return (
        <BarChart
            borderRadius={8}
            colors={colorPalette}
            xAxis={
                [
                    {
                        scaleType: 'band',
                        data: ['개인', '기관', '외국인'],
                        categoryGapRatio: 0.6,
                    },
                ]
            }
            yAxis={[
                {
                    valueFormatter: (value: any) => value.toLocaleString(),
                    width: 50,
                },
            ]}
            series={[
                {
                    id: 'page-views',
                    data: [
                        -8000, +7500, +6800
                    ],
                    stack: 'A',
                }
            ]}
            height={278}
            margin={{ left: 10, right: 20, top: 20, bottom: 20 }}
            grid={{ horizontal: true }}
        />
    )
}

export default IndexBarChart;
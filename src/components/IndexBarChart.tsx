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
                        data: getDaysInMonth(2024, 5),
                        categoryGapRatio: 0.5,
                        tickInterval: (_index: any, i: number) => i % 5 === 0,
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
                        100.00, 10.00, 10.00, 13.10, 12.00, 9.00, 10.00, 10.00, 10.00, 10.00,
                        100.00, 10.00, 10.00, 13.10, 12.00, 9.00, 10.00, 10.00, 10.00, 10.00,
                        100.00, 10.00, 10.00, 13.10, 12.00, 9.00, 10.00, 10.00, 10.00, 10.00
                    ],
                    stack: 'A',
                }
            ]}
            height={250}
            margin={{ left: 50, right: 0, top: 20, bottom: 20 }}
            grid={{ horizontal: true }}
        />
    )
}

export default IndexBarChart;
import { BarChart } from "@mui/x-charts"
import {useTheme} from "@mui/material/styles";

export type IndexBarChartProps = {
    data: number[]
};

const ProgramBarChart = (
    {data}: IndexBarChartProps
) => {
    const theme = useTheme()

    const colorPalette = [
        theme.palette.primary.light,
        theme.palette.primary.main,
        theme.palette.primary.dark,
    ];

    return (
        <BarChart
            borderRadius={8}
            colors={colorPalette}
            xAxis={
                [
                    {
                        scaleType: 'band',
                        data: ['차익', '비차익', '전체'],
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
                    data: data,
                    stack: 'A',
                }
            ]}
            height={278}
            margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
            grid={{ horizontal: true }}
        />
    )
}

export default ProgramBarChart;
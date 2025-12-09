import { BarChart } from "@mui/x-charts"
import {useTheme} from "@mui/material/styles";

export type IndexBarChartProps = {
    data: string[]
};

const IndexBarChart = (
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

export default IndexBarChart;
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SparkLineChart } from '@mui/x-charts/SparkLineChart';
import { areaElementClasses } from '@mui/x-charts/LineChart';

export type StatCardProps = {
    title: string;
    value: string;
    interval: string;
    trend: 'up' | 'down' | 'neutral';
    data: number[],
    dateList: string[],
    fluRt: string
};

function AreaGradient({ color, id }: { color: string; id: string }) {
    return (
        <defs>
            <linearGradient id={id} x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
        </defs>
    );
}

export default function StatCard({
    title,
    value,
    interval,
    trend,
    data,
    dateList,
    fluRt
}: StatCardProps) {
    const theme = useTheme();

    const numericDates = data.map(Number);

    const min = Math.min(...numericDates);
    const max = Math.max(...numericDates);

    const trendColors = {
        up:
            theme.palette.mode === 'light'
                ? theme.palette.error.main
                : theme.palette.error.dark,
        down:
            theme.palette.mode === 'light'
                ? theme.palette.primary.main
                : theme.palette.primary.dark,
        neutral:
            theme.palette.mode === 'light'
                ? theme.palette.grey[400]
                : theme.palette.grey[700],
    };

    const labelColors = {
        up: 'error' as const,
        down: 'info' as const,
        neutral: 'default' as const,
    };

    const color = labelColors[trend];
    const chartColor = trendColors[trend];
    const trendValues = { up: `${fluRt}%`, down: `${fluRt}%`, neutral: `${fluRt}%` };

    return (
        <Card variant="outlined" sx={{ height: '100%', flexGrow: 1 }}>
            <CardContent>
                <Typography component="h2" variant="subtitle2" gutterBottom>
                    {title}
                </Typography>
                <Stack
                    direction="column"
                    sx={{ justifyContent: 'space-between', flexGrow: '1', gap: 1 }}
                >
                    <Stack sx={{ justifyContent: 'space-between' }}>
                        <Stack
                            direction="row"
                            sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <Typography variant="h4" component="p">
                                {value}
                            </Typography>
                            <Chip size="small" color={color} label={trendValues[trend]} />
                        </Stack>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {interval}
                        </Typography>
                    </Stack>
                    <Box sx={{ width: '100%', height: 50 }}>
                        <SparkLineChart
                            color={chartColor}
                            data={data}
                            area
                            showHighlight
                            showTooltip
                            xAxis={{
                                scaleType: 'band',
                                data: dateList,
                            }}
                            yAxis={{
                                min: min,
                                max: max
                            }}
                            sx={{
                                [`& .${areaElementClasses.root}`]: {
                                    fill: `url(#area-gradient-${value})`,
                                },
                            }}
                        >
                            <AreaGradient color={chartColor} id={`area-gradient-${value}`} />
                        </SparkLineChart>
                    </Box>
                </Stack>
            </CardContent>
        </Card>
    );
}
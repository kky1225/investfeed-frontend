import { PieChart } from '@mui/x-charts/PieChart';
import { useDrawingArea } from '@mui/x-charts/hooks';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import LinearProgress, { linearProgressClasses } from '@mui/material/LinearProgress';
import {Fragment} from "react";
import {useMediaQuery, useTheme} from "@mui/material";
import {HoldingStock} from "../type/HoldingType.ts";

interface CustomPieChartProps {
    holdings: Array<HoldingStock>;
    totalEvltAmt: string;
}

interface StyledTextProps {
    variant: 'primary' | 'secondary';
}

const StyledText = styled('text', {
    shouldForwardProp: (prop) => prop !== 'variant',
})<StyledTextProps>(({ theme }) => ({
    textAnchor: 'middle',
    dominantBaseline: 'central',
    fill: (theme.vars || theme).palette.text.secondary,
    variants: [
        {
            props: {
                variant: 'primary',
            },
            style: {
                fontSize: theme.typography.h5.fontSize,
            },
        },
        {
            props: ({ variant }) => variant !== 'primary',
            style: {
                fontSize: theme.typography.body2.fontSize,
            },
        },
        {
            props: {
                variant: 'primary',
            },
            style: {
                fontWeight: theme.typography.h5.fontWeight,
            },
        },
        {
            props: ({ variant }) => variant !== 'primary',
            style: {
                fontWeight: theme.typography.body2.fontWeight,
            },
        },
    ],
}));

interface PieCenterLabelProps {
    primaryText: string;
    secondaryText: string;
    small?: boolean;
}

function PieCenterLabel({ primaryText, secondaryText, small }: PieCenterLabelProps) {
    const { width, height, left, top } = useDrawingArea();
    const gap = small ? 18 : 24;
    const primaryY = top + height / 2 - (small ? 8 : 10);
    const secondaryY = primaryY + gap;

    return (
        <Fragment>
            <StyledText variant="primary" x={left + width / 2} y={primaryY} style={small ? { fontSize: '0.85rem' } : undefined}>
                {primaryText}
            </StyledText>
            <StyledText variant="secondary" x={left + width / 2} y={secondaryY} style={small ? { fontSize: '0.7rem' } : undefined}>
                {secondaryText}
            </StyledText>
        </Fragment>
    );
}

const colors = [
    'hsl(220, 100%, 70%)',
    'hsl(220, 80%, 70%)',
    'hsl(220, 60%, 70%)',
    'hsl(220, 45%, 70%)',
    'hsl(220, 30%, 70%)',
    'hsl(220, 15%, 70%)'
];

export default function CustomPieChart({ holdings, totalEvltAmt }: CustomPieChartProps) {
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

    const chartSize = isSmallScreen ? 200 : 280;
    const innerRadius = isSmallScreen ? 50 : 75;
    const outerRadius = isSmallScreen ? 70 : 100;
    const chartMargin = isSmallScreen
        ? { left: 30, right: 30, top: 40, bottom: 40 }
        : { left: 50, right: 80, top: 80, bottom: 80 };

    const pieData = holdings.map((stock) => ({
        label: stock.stkNm,
        value: Math.abs(Number(stock.evltAmt)),
    }));

    const progressData = holdings.map((stock, index) => ({
        name: stock.stkNm,
        value: Math.abs(Number(stock.possRt)),
        color: colors[index % colors.length],
    }));

    return (
        <Card
            variant="outlined"
            sx={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}
        >
            <CardContent>
                <Typography component="h2" variant="subtitle2">
                    보유 주식
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PieChart
                        colors={colors}
                        margin={chartMargin}
                        series={[
                            {
                                data: pieData,
                                innerRadius,
                                outerRadius,
                                paddingAngle: 0,
                                highlightScope: { fade: 'global', highlight: 'item' },
                            },
                        ]}
                        height={chartSize}
                        width={chartSize}
                    >
                        <PieCenterLabel primaryText={Number(totalEvltAmt).toLocaleString()} secondaryText="Total" small={isSmallScreen} />
                    </PieChart>
                </Box>
                {progressData.map((item, index) => (
                    <Stack
                        key={index}
                        direction="row"
                        sx={{ alignItems: 'center', gap: 2, pb: 2 }}
                    >
                        <Stack sx={{ gap: 1, flexGrow: 1 }}>
                            <Stack
                                direction="row"
                                sx={{
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 2,
                                }}
                            >
                                <Typography variant="body2" sx={{ fontWeight: '500' }}>
                                    {item.name}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    {item.value}%
                                </Typography>
                            </Stack>
                            <LinearProgress
                                variant="determinate"
                                aria-label="Number of users by country"
                                value={item.value}
                                sx={{
                                    [`& .${linearProgressClasses.bar}`]: {
                                        backgroundColor: item.color,
                                    },
                                }}
                            />
                        </Stack>
                    </Stack>
                ))}
            </CardContent>
        </Card>
    );
}

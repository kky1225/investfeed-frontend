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
import {useBlindMode} from "../context/BlindModeContext.tsx";

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
    const { isBlind } = useBlindMode();
    const gap = small ? 18 : 24;
    const primaryY = top + height / 2 - (small ? 8 : 10);
    const secondaryY = primaryY + gap;

    // primary(총 평가금액) 는 블라인드 대상. SVG text 도 CSS filter 를 지원.
    const primaryStyle = {
        ...(small ? { fontSize: '0.85rem' } : {}),
        ...(isBlind ? { filter: 'blur(8px)' } : {}),
    };

    return (
        <Fragment>
            <StyledText variant="primary" x={left + width / 2} y={primaryY} style={primaryStyle}>
                {primaryText}
            </StyledText>
            <StyledText variant="secondary" x={left + width / 2} y={secondaryY} style={small ? { fontSize: '0.7rem' } : undefined}>
                {secondaryText}
            </StyledText>
        </Fragment>
    );
}

const SERIES_LIGHT = [
    'hsl(220, 100%, 70%)',
    'hsl(220, 80%, 70%)',
    'hsl(220, 60%, 70%)',
    'hsl(220, 45%, 70%)',
    'hsl(220, 30%, 70%)',
];
const SERIES_DARK = SERIES_LIGHT;
const OTHER_LIGHT = 'hsl(220, 15%, 70%)';
const OTHER_DARK = OTHER_LIGHT;
const TOP_SLICES = 5;

export default function CustomPieChart({ holdings, totalEvltAmt }: CustomPieChartProps) {
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const { isBlind } = useBlindMode();

    const chartSize = isSmallScreen ? 200 : 280;
    const innerRadius = isSmallScreen ? 50 : 75;
    const outerRadius = isSmallScreen ? 70 : 100;
    const chartMargin = isSmallScreen
        ? { left: 30, right: 30, top: 40, bottom: 40 }
        : { left: 50, right: 80, top: 80, bottom: 80 };

    const isDark = theme.palette.mode === 'dark';
    const series = isDark ? SERIES_DARK : SERIES_LIGHT;
    const otherColor = isDark ? OTHER_DARK : OTHER_LIGHT;

    const sorted = [...holdings].sort((a, b) => Math.abs(Number(b.evltAmt)) - Math.abs(Number(a.evltAmt)));

    // 종목별 색: 상위 TOP_SLICES 만 고유색, 나머지는 "기타" 회색 — 아래 목록의 점과 도넛 조각이 같은 색으로 대응된다.
    const colorOf = (index: number) => (index < TOP_SLICES ? series[index] : otherColor);

    const head = sorted.slice(0, TOP_SLICES);
    const tail = sorted.slice(TOP_SLICES);
    const tailSum = tail.reduce((acc, s) => acc + Math.abs(Number(s.evltAmt)), 0);

    const pieData = [
        ...head.map((stock, i) => ({
            label: stock.stkNm,
            value: Math.abs(Number(stock.evltAmt)),
            color: series[i],
        })),
        ...(tail.length > 0
            ? [{label: `기타 ${tail.length}종목`, value: tailSum, color: otherColor}]
            : []),
    ];

    const progressData = sorted.map((stock, index) => ({
        name: stock.stkNm,
        value: Math.abs(Number(stock.possRt)),
        color: colorOf(index),
    }));
    const maxRatio = Math.max(...progressData.map(d => d.value), 1);

    if (pieData.length === 0 || pieData.every(d => d.value === 0)) {
        return (
            <Card
                variant="outlined"
                sx={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}
            >
                <CardContent>
                    <Typography component="h2" variant="subtitle2">
                        보유 종목
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                            보유 종목이 없습니다.
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card
            variant="outlined"
            sx={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}
        >
            <CardContent>
                <Typography component="h2" variant="subtitle2">
                    보유 종목
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PieChart
                        margin={chartMargin}
                        hideLegend
                        series={[
                            {
                                data: pieData,
                                innerRadius,
                                outerRadius,
                                paddingAngle: 2,
                                cornerRadius: 2,
                                highlightScope: { fade: 'global', highlight: 'item' },
                                valueFormatter: (item) => item.value.toLocaleString(),
                            },
                        ]}
                        slotProps={{
                            tooltip: { sx: isBlind ? { '.MuiChartsTooltip-valueCell': { filter: 'blur(6px)' } } : {} },
                        }}
                        height={chartSize}
                        width={chartSize}
                    >
                        <PieCenterLabel primaryText={Number(totalEvltAmt).toLocaleString()} secondaryText="Total" small={isSmallScreen} />
                    </PieChart>
                </Box>
                <Stack sx={{ mt: 1 }}>
                    {progressData.map((item, index) => (
                        <Stack
                            key={index}
                            direction="row"
                            sx={{ alignItems: 'center', gap: 1.5, py: 0.75 }}
                        >
                            <Box
                                sx={{
                                    width: 8, height: 8, borderRadius: '50%',
                                    backgroundColor: item.color, flexShrink: 0,
                                }}
                            />
                            <Typography
                                variant="body2"
                                sx={{
                                    fontWeight: 500, width: 130, flexShrink: 0,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}
                                title={item.name}
                            >
                                {item.name}
                            </Typography>
                            <LinearProgress
                                variant="determinate"
                                aria-label={`${item.name} 비중 ${item.value}%`}
                                value={Math.min((item.value / maxRatio) * 100, 100)}
                                sx={{
                                    flexGrow: 1, height: 6, borderRadius: 3,
                                    [`& .${linearProgressClasses.bar}`]: {
                                        backgroundColor: item.color,
                                        borderRadius: 3,
                                    },
                                }}
                            />
                            <Typography
                                variant="body2"
                                sx={{ color: 'text.secondary', width: 48, textAlign: 'right', flexShrink: 0 }}
                            >
                                {item.value}%
                            </Typography>
                        </Stack>
                    ))}
                </Stack>
            </CardContent>
        </Card>
    );
}

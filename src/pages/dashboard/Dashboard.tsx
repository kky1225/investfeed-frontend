import type {} from '@mui/x-date-pickers/themeAugmentation';
import type {} from '@mui/x-charts/themeAugmentation';
import type {} from '@mui/x-data-grid/themeAugmentation';
import type {} from '@mui/x-tree-view/themeAugmentation';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import AppTheme from "../../components/AppTheme.tsx";
import AppNavbar from "../../components/AppNavbar.tsx";
import SideMenu from "../../components/SideMenu.tsx";
import {alpha, styled, useTheme} from "@mui/material/styles";
import Stack from "@mui/material/Stack";
import Header from "../../components/Header.tsx";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import StatCard, {StatCardProps} from "../../components/StatCard.tsx";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import {LinearProgress, useMediaQuery} from "@mui/material";
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import {BarChart, LineChart, PieChart} from "@mui/x-charts";
import Chip from "@mui/material/Chip";
import {useDrawingArea} from "@mui/x-charts/hooks";
import {Fragment} from "react";
import {linearProgressClasses} from "@mui/material/LinearProgress";
import ChartUserByCountry from "../../components/ChartUserByCountry.tsx";


export default function Dashboard(props: { disableCustomTheme?: boolean }) {
    const indexData: StatCardProps[] = [
        {
            title: '코스피',
            value: '2,644.4',
            interval: 'Last 30 days',
            trend: 'up',
            data: [
                2644.4, 2621.1, 2643.9, 2621.1, 2583.4, 2551.1, 2593.9, 2621.1, 2644.4, 2621.1, 2643.9, 2621.1, 2583.4, 2551.1, 2593.9, 2621.1,
                2644.4, 2621.1, 2643.9, 2621.1, 2583.4, 2551.1, 2593.9, 2621.1, 2643.9, 2621.1, 2583.4, 2551.1, 2593.9, 2621.1
            ],
        },
        {
            title: '코스닥',
            value: '725.27',
            interval: 'Last 30 days',
            trend: 'down',
            data: [
                725.27, 721.27, 709.27, 685.27, 666.27, 641.27, 593.27, 551.27, 601.27, 630.27, 650.27, 690.27, 725.27, 756.27, 800.27,
                850.11, 821.39, 800.2, 750.85, 740.21, 760.57, 730.21, 740.55, 690.21, 635.32, 601.58, 593.54, 553.21, 503.21, 500.55,
            ],
        },
        {
            title: '달러',
            value: '1,368.05',
            interval: 'Last 30 days',
            trend: 'neutral',
            data: [
                500, 400, 510, 530, 520, 600, 530, 520, 510, 730, 520, 510, 530, 620, 510, 530,
                520, 410, 530, 520, 610, 530, 520, 610, 530, 420, 510, 430, 520, 510,
            ],
        },
    ];

    const theme = useTheme();

    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

    const time = getMinuteTimes();

    const colorPalette = [
        theme.palette.primary.light,
        theme.palette.primary.main,
        theme.palette.primary.dark,
    ];

    function AreaGradient({ color, id }: { color: string; id: string }) {
        return (
            <defs>
                <linearGradient id={id} x1="50%" y1="0%" x2="50%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
        );
    }

    function getMinuteTimes(
        startHour: number = 8,
        endHour: number = 20,
        current: Date = new Date()
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

    return (
        <AppTheme {...props}>
            <CssBaseline enableColorScheme />
            <Box sx={{ display: 'flex' }}>
                <SideMenu />
                <AppNavbar />
                <Box
                    component="main"
                    sx={(theme) => ({
                        flexGrow: 1,
                        backgroundColor: theme.vars
                            ? `rgba(${theme.vars.palette.background.defaultChannel} / 1)`
                            : alpha(theme.palette.background.default, 1),
                        overflow: 'auto',
                    })}
                >
                    <Stack
                        spacing={2}
                        sx={{
                            alignItems: 'center',
                            mx: 3,
                            pb: 5,
                            mt: { xs: 8, md: 0 },
                        }}
                    >
                        <Header />
                        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
                            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                                주요 지수
                            </Typography>
                            <Grid
                                container
                                spacing={2}
                                columns={12}
                                sx={{ mb: (theme) => theme.spacing(2) }}
                            >
                                {indexData.map((card, index) => (
                                    <Grid key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
                                        <StatCard {...card} />
                                    </Grid>
                                ))}
                                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                                    <Card sx={{ height: '100%' }}>
                                        <CardContent>
                                            <InsightsRoundedIcon />
                                            <Typography
                                                component="h2"
                                                variant="subtitle2"
                                                gutterBottom
                                                sx={{ fontWeight: '600' }}
                                            >
                                                Explore your data
                                            </Typography>
                                            <Typography sx={{ color: 'text.secondary', mb: '8px' }}>
                                                Uncover performance and visitor insights with our data wizardry.
                                            </Typography>
                                            <Button
                                                variant="contained"
                                                size="small"
                                                color="primary"
                                                endIcon={<ChevronRightRoundedIcon />}
                                                fullWidth={isSmallScreen}
                                            >
                                                Get insights
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                                        코스피
                                    </Typography>
                                    <Card variant="outlined" sx={{ width: '100%' }}>
                                        <CardContent>
                                            <Typography component="h2" variant="subtitle2" gutterBottom>
                                                투자자별 순매수 현황
                                            </Typography>
                                            <Stack sx={{ justifyContent: 'space-between' }}>
                                                <Stack
                                                    direction="row"
                                                    sx={{
                                                        alignContent: { xs: 'center', sm: 'flex-start' },
                                                        alignItems: 'center',
                                                        gap: 1,
                                                    }}
                                                >
                                                    <Typography variant="h4" component="p">
                                                        2,644.4
                                                    </Typography>
                                                    <Chip size="small" color="success" label="+35%" />
                                                </Stack>
                                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                    2025.05.26 08:30
                                                </Typography>
                                            </Stack>
                                            <LineChart
                                                colors={colorPalette}
                                                xAxis={[
                                                    {
                                                        scaleType: 'point',
                                                        data: time,
                                                        tickInterval: (_index: any, i: number) => i % 30 === 0,
                                                    },
                                                ]}
                                                yAxis={[
                                                    {
                                                        valueFormatter: (value: any) => value.toLocaleString(),
                                                        width: 50,
                                                    },
                                                ]}
                                                series={[
                                                    {
                                                        id: 'direct',
                                                        label: '개인',
                                                        showMark: false,
                                                        curve: 'linear',
                                                        area: true,
                                                        stackOrder: 'ascending',
                                                        color: 'green',
                                                        data: [
                                                            -300, -900, -600, -1200, -1500, -1800, -2400, -2100, -2700, -3000, -1800, -3300,
                                                            -3600, -3900, -4200, -4500, -3900, -4800, -5100, -5400, -4800, -5700, -6000,
                                                            -6300, -6600, -6900, -7200, -7500, -7800, -8100, -8000
                                                        ],
                                                    },
                                                    {
                                                        id: 'referral',
                                                        label: '기관',
                                                        showMark: false,
                                                        curve: 'linear',
                                                        area: true,
                                                        stackOrder: 'ascending',
                                                        color: 'blue',
                                                        data: [
                                                            500, 900, 700, 1400, 1100, 1700, 2300, 2000, 2600, 2900, 2300, 3200,
                                                            3500, 3800, 4100, 4400, 2900, 4700, 5000, 5300, 5600, 5900, 6200,
                                                            6500, 5600, 6800, 7100, 7400, 7700, 8000, 7500
                                                        ],
                                                    },
                                                    {
                                                        id: 'organic',
                                                        label: '외국인',
                                                        showMark: false,
                                                        curve: 'linear',
                                                        stackOrder: 'ascending',
                                                        color: 'red',
                                                        data: [
                                                            1000, 1500, 1200, 1700, 1300, 2000, 2400, 2200, 2600, 2800, 2500,
                                                            3000, 3400, 3700, 3200, 3900, 4100, 3500, 4300, 4500, 4000, 4700,
                                                            5000, 5200, 4800, 5400, 5600, 5900, 6100, 6300, 6800
                                                        ],
                                                        area: true,
                                                    },
                                                ]}
                                                height={250}
                                                margin={{ left: 50, right: 20, top: 20, bottom: 20 }}
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
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                                        코스닥
                                    </Typography>
                                    <Card variant="outlined" sx={{ width: '100%' }}>
                                        <CardContent>
                                            <Typography component="h2" variant="subtitle2" gutterBottom>
                                                투자자별 순매수 현황
                                            </Typography>
                                            <Stack sx={{ justifyContent: 'space-between' }}>
                                                <Stack
                                                    direction="row"
                                                    sx={{
                                                        alignContent: { xs: 'center', sm: 'flex-start' },
                                                        alignItems: 'center',
                                                        gap: 1,
                                                    }}
                                                >
                                                    <Typography variant="h4" component="p">
                                                        725.27
                                                    </Typography>
                                                    <Chip size="small" color="success" label="+35%" />
                                                </Stack>
                                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                    2025.05.26 08:30
                                                </Typography>
                                            </Stack>
                                            <LineChart
                                                colors={colorPalette}
                                                xAxis={[
                                                    {
                                                        scaleType: 'point',
                                                        data: time,
                                                        tickInterval: (_index: any, i: number) => i % 30 === 0,
                                                    },
                                                ]}
                                                yAxis={[
                                                    {
                                                        valueFormatter: (value: any) => value.toLocaleString(),
                                                        width: 50,
                                                    },
                                                ]}
                                                series={[
                                                    {
                                                        id: 'direct',
                                                        label: '개인',
                                                        showMark: false,
                                                        curve: 'linear',
                                                        area: true,
                                                        stackOrder: 'ascending',
                                                        color: 'green',
                                                        data: [
                                                            -300, -900, -600, -1200, -1500, -1800, -2400, -2100, -2700, -3000, -1800, -3300,
                                                            -3600, -3900, -4200, -4500, -3900, -4800, -5100, -5400, -4800, -5700, -6000,
                                                            -6300, -6600, -6900, -7200, -7500, -7800, -8100, -8000
                                                        ],
                                                    },
                                                    {
                                                        id: 'referral',
                                                        label: '기관',
                                                        showMark: false,
                                                        curve: 'linear',
                                                        area: true,
                                                        stackOrder: 'ascending',
                                                        color: 'blue',
                                                        data: [
                                                            500, 900, 700, 1400, 1100, 1700, 2300, 2000, 2600, 2900, 2300, 3200,
                                                            3500, 3800, 4100, 4400, 2900, 4700, 5000, 5300, 5600, 5900, 6200,
                                                            6500, 5600, 6800, 7100, 7400, 7700, 8000, 7500
                                                        ],
                                                    },
                                                    {
                                                        id: 'organic',
                                                        label: '외국인',
                                                        showMark: false,
                                                        curve: 'linear',
                                                        stackOrder: 'ascending',
                                                        color: 'red',
                                                        data: [
                                                            1000, 1500, 1200, 1700, 1300, 2000, 2400, 2200, 2600, 2800, 2500,
                                                            3000, 3400, 3700, 3200, 3900, 4100, 3500, 4300, 4500, 4000, 4700,
                                                            5000, 5200, 4800, 5400, 5600, 5900, 6100, 6300, 6800
                                                        ],
                                                        area: true,
                                                    },
                                                ]}
                                                height={250}
                                                margin={{ left: 50, right: 20, top: 20, bottom: 20 }}
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
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                                업종별 주가 상승 TOP 10
                            </Typography>
                            <Grid container spacing={2} columns={12}>
                                <Grid size={{ xs: 12, lg: 8 }}>

                                </Grid>
                                <Grid size={{ xs: 12, lg: 4 }}>
                                    <ChartUserByCountry />
                                </Grid>
                            </Grid>
                        </Box>
                    </Stack>
                </Box>
            </Box>
        </AppTheme>
    );
}
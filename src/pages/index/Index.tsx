import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import IndexLineChart from "../../components/IndexLineChart.tsx";
import type { CustomLineChartProps } from '../../components/InvestorLineChart.tsx';
import OptionTable from "../../components/OptionTable.tsx";
import {GridColDef, GridRowsProp} from "@mui/x-data-grid";

const Index = () => {
    const data: CustomLineChartProps = {
        seriesData: [
            {
                id: 'direct',
                showMark: false,
                curve: 'linear',
                area: true,
                stackOrder: 'ascending',
                color: 'red',
                data: [
                    2644.4, 2634.4, 2604.7, 2601.2, 2600.3, 2612.4, 2603.4, 2591.5, 2594.8, 2591.2, 2589.9, 2593.4,
                    2599.4, 2604.4, 2614.3, 2619.6, 2621.3, 2626.3, 2633.9, 2635.5, 2635.9, 2644.4, 2649.3,
                    2653.5, 2655.7, 2661.4, 2666.6, 2669.1, 2670.4, 2673.4, 2680.8
                ],
            },
        ]
    }

    const data2: CustomLineChartProps = {
        seriesData: [
            {
                id: 'direct',
                showMark: false,
                curve: 'linear',
                area: true,
                stackOrder: 'ascending',
                color: 'blue',
                data: [
                    740.21, 741.4, 742.3, 741.2, 740.9, 740.9, 740.4, 740.1, 739.8, 739.5, 739.9, 740.4,
                    739.6, 739.2, 739.0, 738.6, 738.3, 738.1, 737.9, 737.1, 736.9, 736.1, 735.3,
                    734.9, 734.0, 733.4, 731.6, 729.1, 729.4, 727.4, 725.27
                ],
            },
        ]
    }

    const data3: CustomLineChartProps = {
        seriesData: [
            {
                id: 'direct',
                showMark: false,
                curve: 'linear',
                area: true,
                stackOrder: 'ascending',
                color: 'grey',
                data: [
                    1368.05, 1368.05, 1368.05, 1368.05, 1368.05, 1368.05, 1368.05, 1368.05, 1368.05, 1368.05, 1368.05, 1368.05,
                    1368.05, 1368.05, 1368.05, 1368.05, 1368.05, 1368.05, 1368.05, 1368.05, 1368.05, 1368.05, 1368.05,
                    1368.05, 1368.05, 1368.05, 1368.05, 1368.05, 1368.05, 1368.05, 1368.05
                ],
            },
        ]
    }

    const columns: GridColDef[] = [
        {
            field: 'type',
            headerName: '구분',
            headerAlign: 'center',
            align: 'center',
            flex: 1,
            minWidth: 80,
        },
        {
            field: 'sell',
            headerName: '매도',
            headerAlign: 'center',
            align: 'center',
            flex: 1,
            minWidth: 80

        },
        {
            field: 'buy',
            headerName: '매수',
            flex: 1,
            headerAlign: 'center',
            align: 'center',
            minWidth: 80,
        },
        {
            field: 'buy2',
            headerName: '순매수',
            flex: 1,
            headerAlign: 'center',
            align: 'center',
            minWidth: 100,
        }
    ];

    const rows: GridRowsProp = [
        {
            id: 1,
            type: '기관',
            sell: 6,
            buy: 5,
            buy2: -1,
        },
        {
            id: 2,
            type: '외국인',
            sell: 212,
            buy: 212,
            buy2: 0,
        },
        {
            id: 3,
            type: '개인',
            sell: 72,
            buy: 74,
            buy2: 2,
        }
    ];

    return (
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
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            <Typography component="h2" variant="subtitle2" gutterBottom>
                                코스피
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
                                    <Chip size="small" color="error" label='+2.02%' />
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    2025.05.26 08:30
                                </Typography>
                            </Stack>
                        </CardContent>
                        <IndexLineChart seriesData={data.seriesData} />
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            <Typography component="h2" variant="subtitle2" gutterBottom>
                                코스닥
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
                                    <Chip size="small" color="info" label='-1.30%' />
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    2025.05.26 08:30
                                </Typography>
                            </Stack>
                        </CardContent>
                        <IndexLineChart seriesData={data2.seriesData} />
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            <Typography component="h2" variant="subtitle2" gutterBottom>
                                코스피200 선물
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
                                        3,299.60
                                    </Typography>
                                    <Chip size="small" color="info" label='-0.91%' />
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    2025.05.26 08:30
                                </Typography>
                            </Stack>
                        </CardContent>
                        <IndexLineChart seriesData={data2.seriesData} />
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined" sx={{ width: '100%', mb: 1}}>
                        <CardContent>
                            <Typography component="h2" variant="subtitle2" gutterBottom>
                                코스피200 옵션
                            </Typography>
                            <Stack sx={{ justifyContent: 'space-between' }}>
                                <OptionTable rows={rows} columns={columns} />
                            </Stack>
                        </CardContent>
                    </Card>
                    <Stack
                        direction="row"
                        sx={{
                            alignContent: { xs: 'center', sm: 'flex-start' },
                            alignItems: 'center',
                            gap: 1,
                        }}
                    >
                        <Card variant="outlined" sx={{ width: '100%' }}>
                            <CardContent>
                                <Typography component="h2" variant="subtitle2" gutterBottom>
                                    코스피200 위클리 옵션(월)
                                </Typography>
                                <Stack sx={{ justifyContent: 'space-between' }}>
                                    <OptionTable rows={rows} columns={columns} />
                                </Stack>
                            </CardContent>
                        </Card>
                        <Card variant="outlined" sx={{ width: '100%' }}>
                            <CardContent>
                                <Typography component="h2" variant="subtitle2" gutterBottom>
                                    코스피200 위클리 콜옵션(목)
                                </Typography>
                                <Stack sx={{ justifyContent: 'space-between' }}>
                                    <OptionTable rows={rows} columns={columns} />
                                </Stack>
                            </CardContent>
                        </Card>
                    </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            <Typography component="h2" variant="subtitle2" gutterBottom>
                                환율
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
                                        1,368.05
                                    </Typography>
                                    <Chip size="small" color="default" label='0%' />
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    2025.05.26 08:30
                                </Typography>
                            </Stack>
                        </CardContent>
                        <IndexLineChart seriesData={data3.seriesData} />
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            <Typography component="h2" variant="subtitle2" gutterBottom>
                                국제 금(USD/OZS)
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
                                        3,299.60
                                    </Typography>
                                    <Chip size="small" color="info" label='-0.53%' />
                                </Stack>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    2025.05.26 08:30
                                </Typography>
                            </Stack>
                        </CardContent>
                        <IndexLineChart seriesData={data2.seriesData} />
                    </Card>
                </Grid>
            </Grid>
        </Box>
    )
}

export default Index
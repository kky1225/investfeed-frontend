import type {} from '@mui/x-date-pickers/themeAugmentation';
import type {} from '@mui/x-charts/themeAugmentation';
import type {} from '@mui/x-data-grid/themeAugmentation';
import type {} from '@mui/x-tree-view/themeAugmentation';
import Box from '@mui/material/Box';
import {alpha, styled, useTheme} from "@mui/material/styles";
import Stack from "@mui/material/Stack";
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
import {Fragment, useEffect, useState} from "react";
import {linearProgressClasses} from "@mui/material/LinearProgress";
import CustomPieChart from "../../components/CustomPieChart.tsx";
import { DataGrid, GridCellParams, GridColDef, GridRowsProp } from '@mui/x-data-grid';
import InvestorLineChart from '../../components/InvestorLineChart.tsx'
import type { CustomLineChartProps } from '../../components/InvestorLineChart.tsx';
import CustomDataTable from "../../components/CustomDataTable.tsx";
import api from "../../axios.ts";
import {fetchIndexList} from "../../api/sect/sectApi.ts";
import {indexListReq, SectIndexListStream} from "../../type/sectType.ts";



export default function Dashboard() {
    const [req, setReq] = useState<indexListReq>({
        inds_cd: '001', // 업종코드 001:종합(KOSPI), 002:대형주, 003:중형주, 004:소형주 101:종합(KOSDAQ), 201:KOSPI200, 302:KOSTAR, 701: KRX100 나머지 ※ 업종코드 참고
        trnm: 'REG', // 서비스명 REG : 등록 , REMOVE : 해지
        grp_no: '1', // 그룹번호
        refresh: '1', // 기존등록유지여부 등록(REG)시 0:기존유지안함 1:기존유지(Default) 0일경우 기존등록한 item/type은 해지, 1일경우 기존등록한 item/type 유지 해지(REMOVE)시 값 불필요
        data: [
            {
                item: [
                    "001", "002", "003", "004", "005", "006", "007", "008", "009", "010", "011", "012",
                    "013", "014", "015", "016", "017", "018", "019", "020", "021", "024", "025", "026",
                    "027", "028", "029", "030", "603", "604", "605"
                ],
                type: [
                    '0J'
                ]
            }
        ] // 실시간 등록 리스트
    })

    const indexListData = async () => {
        try {
            const result = await fetchIndexList(req);

            console.log(result);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        indexListData()
    }, []);

    const socket = new WebSocket("ws://localhost:8080/ws");

    socket.onopen = () => {
        console.log("웹소켓 연결됨");
        socket.send("Hello Server!"); // 서버에 초기 메시지 전송 (선택)
    };

    socket.onmessage = (event) => {
        console.log("서버로부터 메시지 수신:", event.data);
        // 실시간 주식 데이터 처리
    };

    socket.onclose = () => {
        console.log("웹소켓 연결 종료됨");
    };

    socket.onerror = (error) => {
        console.error("웹소켓 에러:", error);
    };

    const indexData: StatCardProps[] = [
        {
            title: '코스피',
            value: '2,644.4',
            interval: '2025.05.26 08:30',
            trend: 'up',
            data: [
                2644.4, 2621.1, 2643.9, 2621.1, 2583.4, 2551.1, 2593.9, 2621.1, 2644.4, 2621.1, 2643.9, 2621.1, 2583.4, 2551.1, 2593.9, 2621.1,
                2644.4, 2621.1, 2643.9, 2621.1, 2583.4, 2551.1, 2593.9, 2621.1, 2643.9, 2621.1, 2583.4, 2551.1, 2593.9, 2621.1
            ],
        },
        {
            title: '코스닥',
            value: '725.27',
            interval: '2025.05.26 08:30',
            trend: 'down',
            data: [
                725.27, 721.27, 709.27, 685.27, 666.27, 641.27, 593.27, 551.27, 601.27, 630.27, 650.27, 690.27, 725.27, 756.27, 800.27,
                850.11, 821.39, 800.2, 750.85, 740.21, 760.57, 730.21, 740.55, 690.21, 635.32, 601.58, 593.54, 553.21, 503.21, 500.55,
            ],
        },
        {
            title: '달러',
            value: '1,368.05',
            interval: '2025.05.26 08:30',
            trend: 'neutral',
            data: [
                500, 400, 510, 530, 520, 600, 530, 520, 510, 730, 520, 510, 530, 620, 510, 530,
                520, 410, 530, 520, 610, 530, 520, 610, 530, 420, 510, 430, 520, 510,
            ],
        },
    ];

    const theme = useTheme();

    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

    const data: CustomLineChartProps = [
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
    ];

    function renderStatus(status: number) {
        const colors = status > 0 ? 'error' : 'info';

        return <Chip label={status > 0 ? `+${status}%` : `${status}%`} color={colors} />;
    }

    const columns: GridColDef[] = [
        {
            field: 'rank',
            headerName: '순위',
            headerAlign: 'center',
            align: 'center',
            flex: 1,
            maxWidth: 50,
        },
        { field: 'pageTitle', headerName: '이름', flex: 1.5, minWidth: 180 },
        {
            field: 'status',
            headerName: '주가',
            flex: 0.5,
            minWidth: 100,
            renderCell: (params) => renderStatus(params.value as any),
        },
        {
            field: 'users',
            headerName: '대표종목',
            flex: 1,
            minWidth: 200,
        },
        {
            field: 'eventCount',
            headerName: '거래량(억)',
            flex: 1,
            minWidth: 100,
        }
    ];

    const rows: GridRowsProp = [
        {
            id: 1,
            rank: 1,
            pageTitle: '이동통신사',
            status: 4.2,
            users: 'SK텔레콤',
            eventCount: 8345
        },
        {
            id: 2,
            rank: 1,
            pageTitle: '출판',
            status: 3.3,
            users: '알라딘',
            eventCount: 5653,
        },
        {
            id: 3,
            rank: 3,
            pageTitle: '돼지고기',
            status: 2.4,
            users: '하림',
            eventCount: 3455,
        },
        {
            id: 4,
            rank: 4,
            pageTitle: '호텔과 리조트',
            status: 2.0,
            users: '신라호텔',
            eventCount: 112543,
        },
        {
            id: 5,
            rank: 5,
            pageTitle: '전기설비',
            status: 1.8,
            eventCount: 3653,
            users: 172240
        },
        {
            id: 6,
            rank: 6,
            pageTitle: '종합반도체',
            status: 1.5,
            users: '삼성전자',
            eventCount: 106543,
        },
        {
            id: 7,
            rank: 7,
            pageTitle: '바이오',
            status: 0.9,
            users: '셀트리온 헬스케어',
            eventCount: 7853,
        },
        {
            id: 8,
            rank: 8,
            pageTitle: '게임',
            status: 0.1,
            eventCount: 8563,
            users: 48240
        },
        {
            rank: 9,
            id: 9,
            pageTitle: '주유소',
            status: 0.1,
            eventCount: 4563,
            users: 18240,
        },
        {
            id: 10,
            rank: 10,
            pageTitle: '통신',
            status: 0.1,
            eventCount: 9863,
            users: 28240
        },
        {
            id: 11,
            rank: 11,
            pageTitle: '철강',
            status: -0.1,
            eventCount: 6563,
            users: 24240
        },
        {
            id: 12,
            rank: 12,
            pageTitle: '무역',
            status: -0.1,
            eventCount: 12353,
            users: 38240
        },
        {
            id: 13,
            rank: 13,
            pageTitle: '건설사',
            status: -0.2,
            eventCount: 5863,
            users: 13240
        },
        {
            id: 14,
            rank: 14,
            pageTitle: '금융',
            status: -0.3,
            eventCount: 7853,
            users: 18240,
        },
        {
            id: 15,
            rank: 15,
            pageTitle: '술',
            status: -0.3,
            eventCount: 9563,
            users: 24240,
        },
        {
            id: 16,
            rank: 16,
            pageTitle: '음식점브랜드',
            status: -0.3,
            eventCount: 13423,
            users: 54230,
        },
        {
            id: 17,
            rank: 17,
            pageTitle: '통신장비',
            status: -0.3,
            eventCount: 4234,
            users: 19342
        },
        {
            id: 18,
            rank: 18,
            pageTitle: '금속',
            status: -0.3,
            eventCount: 8567,
            users: 34234
        },
        {
            id: 19,
            rank: 19,
            pageTitle: '식품첨가물',
            status: -0.3,
            eventCount: 3456,
            users: 19234
        },
        {
            id: 20,
            rank: 20,
            pageTitle: '화학',
            status: -0.3,
            eventCount: 6734,
            users: 27645
        },
        {
            id: 21,
            rank: 21,
            pageTitle: '건설',
            status: -0.7,
            eventCount: 4567,
            users: 19345
        },
        {
            id: 22,
            rank: 22,
            pageTitle: '의료기기',
            status: -1.5,
            eventCount: 7856,
            users: 34567
        },
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
                                지수 확인
                            </Typography>
                            <Typography sx={{ color: 'text.secondary', mb: '8px' }}>
                                주요 주가 지수를 확인하고 싶다면 더보기를 눌러주세요.
                            </Typography>
                            <Button
                                variant="contained"
                                size="small"
                                color="primary"
                                endIcon={<ChevronRightRoundedIcon />}
                                fullWidth={isSmallScreen}
                            >
                                더보기
                            </Button>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 12 }}>
                    <Typography component="h2" variant="h6">
                        투자자별 순매수 현황(억)
                    </Typography>
                </Grid>
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
                        <InvestorLineChart seriesData={data} />
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
                        <InvestorLineChart seriesData={data} />
                    </Card>
                </Grid>
            </Grid>
            <Grid container spacing={2} columns={12}>
                <Grid size={{ xs: 12, lg: 7 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        업종별 주가 순위
                    </Typography>
                </Grid>
                <Grid size={{ xs: 12, lg: 5 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        투자 비중
                    </Typography>
                </Grid>
            </Grid>
            <Grid container spacing={2} columns={12}>
                <Grid size={{ xs: 12, lg: 7 }}>
                    <CustomDataTable rows={rows} columns={columns} />
                </Grid>
                <Grid size={{ xs: 12, lg: 5 }}>
                    <Stack gap={2} direction={{ xs: 'column', sm: 'row', lg: 'column' }}>
                        <CustomPieChart />
                    </Stack>
                </Grid>
            </Grid>
        </Box>
    );
}
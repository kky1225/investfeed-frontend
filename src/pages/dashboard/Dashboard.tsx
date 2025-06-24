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
import Chip from "@mui/material/Chip";
import {Fragment, JSX, useEffect, useState} from "react";
import CustomPieChart from "../../components/CustomPieChart.tsx";
import { DataGrid, GridCellParams, GridColDef, GridRowsProp } from '@mui/x-data-grid';
import CustomDataTable from "../../components/CustomDataTable.tsx";
import {fetchDashboard} from "../../api/sect/sectApi.ts";
import {indexListReq, SectIndexListStream} from "../../type/sectType.ts";
import InvestorBarChart from "../../components/InvestorBarChart.tsx";
import CheckIcon from '@mui/icons-material/Check';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import RemoveIcon from '@mui/icons-material/Remove';
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb';

export default function Dashboard() {
    const [req, setReq] = useState<indexListReq>({
        inds_cd: "001",
        trnm: "REG",
        grp_no: "1",
        refresh: "0",
        data: [
            {
                item: ["001"],
                type: ["0J"]
            }
        ]
    });

    const [indexData, setIndexData] = useState<StatCardProps[]>([
        {
            title: '코스피',
            value: '0',
            interval: '-',
            trend: 'neutral',
            data: [],
            dateList: [],
            fluRt: "0"
        },
        {
            title: '코스닥',
            value: '0',
            interval: '-',
            trend: 'neutral',
            data: [],
            dateList: [],
            fluRt: "0"
        },
        {
            title: '달러',
            value: '0',
            interval: '-',
            trend: 'neutral',
            data: [],
            dateList: [],
            fluRt: "0"
        },
    ]);

    const [kospiBarData, setKospiBarData] = useState<Array<number>>([0, 0, 0]);
    const [kosdacBarData, setKosdacBarData] = useState<Array<number>>([0, 0, 0]);
    const [message, setMessage] = useState<object>({
        kospi: {
            icon: <RemoveIcon />,
            title: '-',
            message: '-'
        },
        kosdac: {
            icon: <RemoveIcon />,
            title: '-',
            message: '-'
        }
    });

    const [row, setRow] = useState<GridRowsProp[]>([]);

    const indexList = async (req: indexListReq) => {
        try {
            const data = await fetchDashboard(req);

            if(data.code !== "0000") {
                throw new Error(data.msg);
            }

            console.log(data);

            const {
                kospiPriceRes, kospiIndexDailyListRes, kospiInvestor,
                kosdacPriceRes, kosdacIndexDailyListRes, kosdacInvestor,
                kospi200PriceRes, kospi200IndexDailyListRes,
                investorTradeRankRes
            } = data.result;

            const year = kospiIndexDailyListRes.inds_cur_prc_daly_rept[0].dt_n.substring(0, 4);
            const month = kospiIndexDailyListRes.inds_cur_prc_daly_rept[0].dt_n.substring(4, 6);
            const day = kospiIndexDailyListRes.inds_cur_prc_daly_rept[0].dt_n.substring(6, 8);
            const minute = kospiPriceRes.inds_cur_prc_tm[0].tm_n.substring(0, 2);
            const second = kospiPriceRes.inds_cur_prc_tm[0].tm_n.substring(2, 4);

            let today;

            if(minute === '88' && second === '88') {
                today = `${year}.${month}.${day} 장마감`;
            }else {
                today = `${year}.${month}.${day} ${minute}:${second}`;
            }

            const todayKospiData = kospiIndexDailyListRes.inds_cur_prc_daly_rept.map(item => item.cur_prc_n.slice(1)).reverse();

            const todayKosdacData = kosdacIndexDailyListRes.inds_cur_prc_daly_rept.map(item => item.cur_prc_n.slice(1)).reverse();

            const todayKospi200Data = kospi200IndexDailyListRes.inds_cur_prc_daly_rept.map(item => item.cur_prc_n.slice(1)).reverse();

            const dateList = kospiIndexDailyListRes.inds_cur_prc_daly_rept.map(item => {
                return `${item.dt_n.slice(0, 4)}.${item.dt_n.slice(4, 6)}.${item.dt_n.slice(6, 8)}`
            }).reverse();

            setIndexData(
                [
                    {
                        title: 'KOSPI',
                        value: kospiPriceRes.cur_prc.replace(/^[+-]/, ''),
                        interval: today,
                        trend: kospiPriceRes.pred_pre_sig === '5' ? 'down' : kospiPriceRes.pred_pre_sig === '2' ? 'up' : 'neutral',
                        data: todayKospiData,
                        dateList: dateList,
                        fluRt: kospiPriceRes.flu_rt
                    },
                    {
                        title: 'KOSDAC',
                        value: kosdacPriceRes.cur_prc.replace(/^[+-]/, ''),
                        interval: today,
                        trend: kosdacPriceRes.pred_pre_sig === '5' ? 'down' : kosdacPriceRes.pred_pre_sig === '2' ? 'up' : 'neutral',
                        data: todayKosdacData,
                        dateList: dateList,
                        fluRt: kosdacPriceRes.flu_rt
                    },
                    {
                        title: 'KOSPI 200',
                        value: kospi200PriceRes.cur_prc.replace(/^[+-]/, ''),
                        interval: today,
                        trend: kospi200PriceRes.pred_pre_sig === '5' ? 'down' : kospi200PriceRes.pred_pre_sig === '2' ? 'up' : 'neutral',
                        data: todayKospi200Data,
                        dateList: dateList,
                        fluRt: kospi200PriceRes.flu_rt
                    },
                ]
            );

            setKospiBarData([kospiInvestor.inds_netprps[0].ind_netprps, kospiInvestor.inds_netprps[0].orgn_netprps, kospiInvestor.inds_netprps[0].frgnr_netprps])
            setKosdacBarData([kosdacInvestor.inds_netprps[0].ind_netprps, kosdacInvestor.inds_netprps[0].orgn_netprps, kosdacInvestor.inds_netprps[0].frgnr_netprps])

            let message = {
                kospi: {
                    ...checkInvestor('KOSPI', kospiInvestor.inds_netprps[0].orgn_netprps, kospiInvestor.inds_netprps[0].frgnr_netprps)
                 },
                kosdac: {
                    ...checkInvestor('KOSDAC', kosdacInvestor.inds_netprps[0].orgn_netprps, kosdacInvestor.inds_netprps[0].frgnr_netprps)
                }
            };

            setMessage(message);

            const mappingRow = investorTradeRankRes.orgn_frgnr_cont_trde_prst.map(item => {
                return {
                    id: item.stk_cd,
                    stkCd: item.stk_cd,
                    rank: item.rank,
                    stkNm: item.stk_nm,
                    pridStkpcFluRt: item.prid_stkpc_flu_rt,
                    nettrdeAmt: item.nettrde_amt,
                }
            });

            setRow(mappingRow);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        indexList(req)
    }, [req]);

    function checkInvestor(name: string, orgn: number, frgnr: number): object {
        let message: string;
        let title: string;
        let icon: JSX.Element;

        if(orgn > 0 && frgnr > 0) {
            message = '기관과 외국인이 매수 중입니다.'
            title = `${name} 투자 양호`
            icon = <CheckIcon color="success" />;
        }else if(orgn > 0 && frgnr < 0) {
            message = '기관 매수, 외국인 매도 중입니다.'
            title = `${name} 투자 주의`
            icon = <PriorityHighIcon color="warning" />
        }else if(orgn < 0 && frgnr > 0) {
            message = '기관 매도, 외국인 매수 중입니다.'
            title = `${name} 투자 주의`
            icon = <PriorityHighIcon color="warning" />
        }else {
            message = '기관과 외국인이 매도 중입니다.'
            title = `${name} 투자 위험`
            icon = <DoNotDisturbIcon color="error" />
        }

        return {
            message,
            title,
            icon,
        }
    }

    // const socket = new WebSocket("ws://localhost:8080/ws");
    //
    // socket.onopen = () => {
    //     console.log("웹소켓 연결됨");
    //     socket.send("Hello Server!"); // 서버에 초기 메시지 전송 (선택)
    // };
    //
    // socket.onmessage = (event) => {
    //     console.log("서버로부터 메시지 수신:", event.data);
    //     // 실시간 주식 데이터 처리
    // };
    //
    // socket.onclose = () => {
    //     console.log("웹소켓 연결 종료됨");
    // };
    //
    // socket.onerror = (error) => {
    //     console.error("웹소켓 에러:", error);
    // };

    const theme = useTheme();

    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

    function renderStatus(status: number) {
        const colors = status > 0 ? 'error' : 'info';

        return <Chip label={status > 0 ? `${status}%` : `${status}%`} color={colors} />;
    }

    const columns: GridColDef[] = [
        {
            field: 'rank',
            headerName: '순위',
            flex: 1,
            minWidth: 80,
            maxWidth: 80
        },
        { field: 'stkNm', headerName: '이름', flex: 1, minWidth: 150 },
        {
            field: 'pridStkpcFluRt',
            headerName: '상승률',
            flex: 1,
            minWidth: 100,
            renderCell: (params) => renderStatus(params.value as any),
        },

        {
            field: 'nettrdeAmt',
            headerName: '합계 순매수',
            flex: 1,
            minWidth: 100,
            valueFormatter: (value: any) => `${value.slice(0, -2).toLocaleString()}억`,
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
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            <Typography component="h2" variant="subtitle2" gutterBottom>
                                KOSPI
                            </Typography>
                            <InvestorBarChart data={kospiBarData} />
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            <Typography component="h2" variant="subtitle2" gutterBottom>
                                KOSDAC
                            </Typography>
                            <InvestorBarChart data={kosdacBarData} />
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card variant="outlined" sx={{ width: '100%', mb: 1 }}>
                        {message.kospi.icon}
                        <CardContent>
                            <Typography gutterBottom variant="h5" component="div">
                                {message.kospi.title}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                {message.kospi.message}
                            </Typography>
                        </CardContent>
                    </Card>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        {message.kosdac.icon}
                        <CardContent>
                            <Typography gutterBottom variant="h5" component="div">
                                {message.kosdac.title}
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                {message.kosdac.message}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
            <Grid container spacing={2} columns={12}>
                <Grid size={{ xs: 12, lg: 7 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        기관/외국인 매수 상위 순위
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
                    <CustomDataTable rows={row} columns={columns} />
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
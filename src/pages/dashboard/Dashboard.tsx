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
import {colors, LinearProgress, useMediaQuery} from "@mui/material";
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import Chip from "@mui/material/Chip";
import {Fragment, JSX, useEffect, useRef, useState} from "react";
import CustomPieChart from "../../components/CustomPieChart.tsx";
import { DataGrid, GridCellParams, GridColDef, GridRowsProp } from '@mui/x-data-grid';
import CustomDataTable from "../../components/CustomDataTable.tsx";
import {fetchDashboard, fetchDashboardStream} from "../../api/sect/sectApi.ts";
import {indexListReq, SectIndexListStream} from "../../type/sectType.ts";
import InvestorBarChart from "../../components/InvestorBarChart.tsx";
import CheckIcon from '@mui/icons-material/Check';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import RemoveIcon from '@mui/icons-material/Remove';
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb';
import {useNavigate} from "react-router-dom";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {DashboardStreamReq} from "../../type/dashboardType.ts";

export default function Dashboard() {
    const navigate = useNavigate();

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    const [req, setReq] = useState<DashboardStreamReq>({
        items: []
    });

    const [indexData, setIndexData] = useState<StatCardProps[]>([
        {
            id: '001',
            title: '종합(KOSPI)',
            value: '0',
            interval: '-',
            trend: 'neutral',
            data: [],
            dateList: [],
            fluRt: "0"
        },
        {
            id: '101',
            title: '종합(KOSDAQ)',
            value: '0',
            interval: '-',
            trend: 'neutral',
            data: [],
            dateList: [],
            fluRt: "0"
        },
        {
            id: '201',
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

    useEffect(() => {
        let chartTimeout: ReturnType<typeof setTimeout>;
        let socketTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        (async () => {
            const items = await dashboard();

            const marketInfo = await timeNow();

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            const req: DashboardStreamReq = {
                items: items,
            }

            if (marketInfo.isMarketOpen) {
                await dashboardStream(req);
                socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();

                    const again = await timeNow();
                    if (again.isMarketOpen) {
                        await dashboardStream(req);
                        socket = openSocket();
                    }
                }, marketTimer.current + 200);
            }

            chartTimeout = setTimeout(() => {
                dashboard();
                interval = setInterval(() => {
                    dashboard();
                }, (60 * 1000));
            }, waitTime + 200);
        })();

        return () => {
            socket?.close();
            clearInterval(socketTimeout);
            clearTimeout(chartTimeout);
            clearInterval(interval);
        }
    }, []);

    const timeNow = async () => {
        try {
            const startTime = Date.now();
            const data = await fetchTimeNow({
                marketType: MarketType.INDEX
            });

            if(data.code !== "0000") {
                throw new Error(data.msg);
            }

            const { time, isMarketOpen, startMarketTime, marketType } = data.result

            if(marketType !== MarketType.INDEX) {
                throw new Error(data.msg);
            }

            const endTime = Date.now();
            const delayTime = endTime - startTime;

            const revisionServerTime = time + delayTime / 2; // startTime과 endTime 사이에 API 응답을 받기 때문에 2를 나눠서 보정

            chartTimer.current = revisionServerTime - endTime;

            if(!isMarketOpen) {
                marketTimer.current = startMarketTime - revisionServerTime;
            }

            return {
                ...data.result
            }
        }catch (error) {
            console.error(error);
        }
    }

    const dashboard = async () => {
        try {
            const data = await fetchDashboard();

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

            if(minute === '88' && second === '88' || minute === '99' && second === '99') {
                today = `${year}.${month}.${day} 장마감`;
            } else if(minute === '' || second === '') {
                today = `${year}.${month}.${day}`;
            } else {
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
                        id: '001',
                        title: '종합(KOSPI)',
                        value: kospiPriceRes.cur_prc.replace(/^[+-]/, ''),
                        interval: today,
                        trend: kospiPriceRes.pred_pre_sig === '5' ? 'down' : kospiPriceRes.pred_pre_sig === '2' ? 'up' : 'neutral',
                        data: todayKospiData,
                        dateList: dateList,
                        fluRt: kospiPriceRes.flu_rt
                    },
                    {
                        id: '101',
                        title: '종합(KOSDAQ)',
                        value: kosdacPriceRes.cur_prc.replace(/^[+-]/, ''),
                        interval: today,
                        trend: kosdacPriceRes.pred_pre_sig === '5' ? 'down' : kosdacPriceRes.pred_pre_sig === '2' ? 'up' : 'neutral',
                        data: todayKosdacData,
                        dateList: dateList,
                        fluRt: kosdacPriceRes.flu_rt
                    },
                    {
                        id: '201',
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
                    ...checkInvestor('종합(KOSPI)', kospiInvestor.inds_netprps[0].orgn_netprps, kospiInvestor.inds_netprps[0].frgnr_netprps)
                 },
                kosdac: {
                    ...checkInvestor('종합(KOSDAQ)', kosdacInvestor.inds_netprps[0].orgn_netprps, kosdacInvestor.inds_netprps[0].frgnr_netprps)
                }
            };

            setMessage(message);

            const ranking = investorTradeRankRes.orgn_frgnr_cont_trde_prst.map(item => {
                return {
                    id: item.stk_cd,
                    stkCd: item.stk_cd,
                    rank: item.rank,
                    stkNm: item.stk_nm,
                    pridStkpcFluRt: item.prid_stkpc_flu_rt,
                    nettrdeAmt: item.nettrde_amt,
                }
            });

            setRow(ranking);

            return ranking.map(item => item.stkCd);
        } catch (err) {
            console.error(err);
        }
    };

    const dashboardStream = async (req: DashboardStreamReq) => {
        try {
            const data = await fetchDashboardStream(req);

            if(data.code !== "0000") {
                throw new Error(data.msg);
            }

            console.log(data);
        }catch (error) {
            console.log(error);
        }
    }

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === '0J') {
                if (data.trnm === "REAL" && Array.isArray(data.data)) {
                    let code;

                    const indexList = data.data.map((entry) => {
                        const values = entry.values;
                        code = entry.item;
                        return {
                            code: entry.item, // ex: "001"
                            value: values["10"], // 현재가
                            change: values["11"], // 전일 대비
                            fluRt: values["12"],   // 등락률
                            trend: values["25"],   // 등락기호
                        };
                    });

                    indexList.forEach((data) => {
                        setIndexData(index =>
                            index.map(item =>
                                code === item.id ?
                                    {
                                        ...item,
                                        value: data.value.replace(/^[+-]/, ''),
                                        fluRt: data.fluRt,
                                        trend: data.trend === '5' ? 'down' : data.trend === '2' ? 'up' : 'neutral',
                                    }
                                    : item
                            )
                        );
                    });
                }
            } else if (data.type === '0A') {
                if (data.trnm === "REAL" && Array.isArray(data.data)) {
                    let code;

                    const indexList = data.data.map((entry) => {
                        const values = entry.values;
                        code = entry.item;
                        return {
                            code: entry.item, // ex: "001"
                            value: values["10"], // 현재가
                            change: values["11"], // 전일 대비
                            fluRt: values["12"],   // 등락률
                            trend: values["25"],   // 등락기호
                        };
                    });

                    indexList.forEach((data) => {
                        setRow(stock =>
                            stock.map(item =>
                                code === item.id ?
                                    {
                                        ...item,
                                        pridStkpcFluRt: data.fluRt,
                                    }
                                    : item
                            )
                        );
                    });
                }
            }
        };

        return socket;
    }

    function checkInvestor(name: string, orgn: number, frgnr: number): object {
        let message: string;
        let title: string;
        let icon: JSX.Element;

        if (orgn == 0) {
            message = '기관 관망, '
        } else if (orgn > 0) {
            message = '기관 매수, '
        } else {
            message = '기관 매도, '
        }

        if (frgnr == 0) {
            message = message + '외국인 관망 중입니다.'
        } else if (frgnr > 0) {
            message = message + '외국인 매수 중입니다.'
        } else {
            message = message + '외국인 매도 중입니다.'
        }

        if (orgn > 0 && frgnr > 0) {
            title = `${name} 투자 양호`
            icon = <CheckIcon color="success" />;
        } else if(orgn > 0 || frgnr > 0) {
            title = `${name} 투자 주의`
            icon = <PriorityHighIcon color="warning" />
        } else {
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

    const onClick = () => {
        navigate('/index');
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
            valueFormatter: (value: any) => `${Number(value.slice(0, -2)).toLocaleString()}억`,
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
                                onClick={onClick}
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
                                종합(KOSPI)
                            </Typography>
                            <InvestorBarChart data={kospiBarData} />
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card variant="outlined" sx={{ width: '100%' }}>
                        <CardContent>
                            <Typography component="h2" variant="subtitle2" gutterBottom>
                                종합(KOSDAQ)
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
                    <CustomDataTable rows={row} columns={columns} pageSize={20} />
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
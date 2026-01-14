import Box from '@mui/material/Box';
import {useTheme} from "@mui/material/styles";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import StatCard, {StatCardProps} from "../../components/StatCard.tsx";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Button from "@mui/material/Button";
import {useMediaQuery} from "@mui/material";
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import Chip from "@mui/material/Chip";
import {JSX, useEffect, useRef, useState} from "react";
import CustomPieChart from "../../components/CustomPieChart.tsx";
import { GridColDef, GridRowsProp } from '@mui/x-data-grid';
import CustomDataTable from "../../components/CustomDataTable.tsx";
import InvestorBarChart from "../../components/InvestorBarChart.tsx";
import CheckIcon from '@mui/icons-material/Check';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import RemoveIcon from '@mui/icons-material/Remove';
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb';
import {useNavigate} from "react-router-dom";
import {ChartDay, DashboardIndexListItem, InvestorTradeRankList} from "../../type/DashboardType.ts";
import {fetchDashboard} from "../../api/dashboard/DashboardApi.ts";

export default function Dashboard() {
    const navigate = useNavigate();

    const chartTimer = useRef<number>(0);
    interface MessageProps {
        icon: JSX.Element,
        title: string,
        message: string
    }

    const DEFAULT_INDEX_DATA: StatCardProps = {
        id: '-',
        title: '-',
        value: '-',
        interval: '-',
        trend: 'neutral',
        data: [],
        dateList: [],
        fluRt: "0"
    }

    const [indexDataList, setIndexDataList] = useState<StatCardProps[]>(
        Array.from({ length: 3}, () => ({
            ...DEFAULT_INDEX_DATA,
        }))
    );

    const [kospiBarData, setKospiBarData] = useState<Array<number>>([0, 0, 0]);
    const [kosdacBarData, setKosdacBarData] = useState<Array<number>>([0, 0, 0]);
    const [message, setMessage] = useState<MessageProps[]>([
        {
            icon: <RemoveIcon />,
            title: '-',
            message: '-'
        },
        {
            icon: <RemoveIcon />,
            title: '-',
            message: '-'
        }
    ]);

    const [row, setRow] = useState<GridRowsProp[]>([]);

    useEffect(() => {
        let chartTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;

        (async () => {
            await dashboard();

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            chartTimeout = setTimeout(() => {
                dashboard();
                interval = setInterval(() => {
                    dashboard();
                }, (60 * 1000));
            }, waitTime + 200);
        })();

        return () => {
            clearTimeout(chartTimeout);
            clearInterval(interval);
        }
    }, []);

    const dashboard = async () => {
        try {
            const data = await fetchDashboard();

            if(data.code !== "0000") {
                throw new Error(data.msg);
            }

            console.log(data);

            const {
                indexList,
                investorTradeRankList
            } = data.result;

            const year = indexList[0].tm.substring(0, 4);
            const month = indexList[0].tm.substring(4, 6);
            const day = indexList[0].tm.substring(6, 8);
            const minute = indexList[0].tm.substring(8, 10);
            const second = indexList[0].tm.substring(10, 12);

            let today;

            if(minute === '88' && second === '88' || minute === '99' && second === '99') {
                today = `${year}.${month}.${day} 장마감`;
            } else if(minute === '' || second === '') {
                today = `${year}.${month}.${day}`;
            } else {
                today = `${year}.${month}.${day} ${minute}:${second}`;
            }

            const newDashboardIndexDataList: StatCardProps[] = indexList.map((indexItem: DashboardIndexListItem) => {
                const newDateList = indexItem.chartList.map((chart: ChartDay) => indexDateFormat(chart.dt)).reverse();
                const newData = indexItem.chartList.map((chart: ChartDay) => chart.curPrc.replace(/^[+-]/, '')).reverse();

                return {
                    id: indexItem.indsCd,
                    title: indexItem.indsNm,
                    value: indexItem.curPrc.replace(/^[+-]/, ''),
                    fluRt: indexItem.fluRt,
                    interval: today,
                    trend: indexItem.predPreSig === '5' ? 'down' : indexItem.predPreSig === '2' ? 'up' : 'neutral',
                    data: newData,
                    dateList: newDateList
                };
            });

            setIndexDataList(newDashboardIndexDataList);


            setKospiBarData([Number(indexList[0].ind), Number(indexList[0].frgnr), Number(indexList[0].orgn)]);
            setKosdacBarData([Number(indexList[1].ind), Number(indexList[1].frgnr), Number(indexList[1].orgn)])

            const message: MessageProps[] = [
                checkInvestor(indexList[0].indsNm, Number(indexList[0].frgnr), Number(indexList[0].orgn)),
                checkInvestor(indexList[1].indsNm, Number(indexList[1].frgnr), Number(indexList[1].orgn))
            ];

            setMessage(message);

            const ranking = investorTradeRankList.map((item: InvestorTradeRankList) => {
                return {
                    id: item.stkCd,
                    stkCd: item.stkCd,
                    rank: item.rank,
                    stkNm: item.stkNm,
                    pridStkpcFluRt: item.pridStkpcFluRt,
                    nettrdeAmt: item.nettrdeAmt,
                }
            });

            setRow(ranking);
        } catch (err) {
            console.error(err);
        }
    };

    function checkInvestor(name: string, frgnr: number, orgn: number): MessageProps {
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

        if (orgn == 0 && frgnr == 0) {
            title = `${name} 투자 중립`
            icon = <RemoveIcon />
        } else if (orgn > 0 && frgnr > 0) {
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

    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

    function renderStatus(status: number) {
        const colors = status > 0 ? 'error' : 'info';

        return <Chip label={status > 0 ? `${status}%` : `${status}%`} color={colors} />;
    }

    const onClick = () => {
        navigate('/index/list');
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
            renderCell: (params) => renderStatus(params.value as number),
        },
        {
            field: 'nettrdeAmt',
            headerName: '합계 순매수',
            flex: 1,
            minWidth: 100,
            valueFormatter: (value: string) => `${Number(value.slice(0, -2)).toLocaleString()}억`,
        }
    ];

    const indexDateFormat = (cntrTm: string) => {
        return `${cntrTm.slice(0, 4)}.${cntrTm.slice(4, 6)}.${cntrTm.slice(6, 8)}`;
    }

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
                {indexDataList.map((card, index) => (
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
                        당일 투자자별 순매수 현황(억)
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
                {
                    message.map((item: MessageProps, index: number) => (
                        <Card key={index} variant="outlined" sx={{ width: '100%', mb: 1 }}>
                            {item.icon}
                            <CardContent>
                                <Typography gutterBottom variant="h5" component="div">
                                    {item.title}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    {item.message}
                                </Typography>
                            </CardContent>
                        </Card>
                    ))
                }
                </Grid>
            </Grid>
            <Grid container spacing={2} columns={12}>
                <Grid size={{ xs: 12, lg: 7 }}>
                    <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                        월간 종합(KOSPI) 기관/외국인 매수 상위 순위
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
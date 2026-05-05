import Box from '@mui/material/Box';
import {useTheme} from "@mui/material/styles";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import StatCard, {StatCardProps} from "../../components/StatCard.tsx";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Skeleton from "@mui/material/Skeleton";
import {useMediaQuery} from "@mui/material";
import Chip from "@mui/material/Chip";
import {JSX, useEffect, useMemo, useRef, useState} from "react";
import {GridColDef, GridRowsProp} from '@mui/x-data-grid';
import CustomDataTable from "../../components/CustomDataTable.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import InvestorBarChart from "../../components/InvestorBarChart.tsx";
import ProgramBarChart from "../../components/ProgramBarChart.tsx";
import CheckIcon from '@mui/icons-material/Check';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import RemoveIcon from '@mui/icons-material/Remove';
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb';
import {useNavigate} from "react-router-dom";
import {ChartDay, DashboardIndexListItem, DashboardRes, InvestorTradeRankList} from "../../type/DashboardType.ts";
import {fetchDashboard, fetchDashboardStream} from "../../api/dashboard/DashboardApi.ts";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {IndexStream, IndexStreamRes} from "../../type/IndexType.ts";
import {usePollingQuery} from "../../lib/pollingQuery.ts";

interface MessageProps {
    icon: JSX.Element;
    title: string;
    message: string;
}

interface LiveIndexUpdate {
    value: string;
    fluRt: string;
    trend?: 'up' | 'down' | 'neutral';
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
};

const indexDateFormat = (cntrTm: string) =>
    `${cntrTm.slice(0, 4)}.${cntrTm.slice(4, 6)}.${cntrTm.slice(6, 8)}`;

export default function Dashboard() {
    const navigate = useNavigate();
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    const [liveOverlay, setLiveOverlay] = useState<Map<string, LiveIndexUpdate>>(new Map());

    const {data: result, isLoading, lastUpdated, pollError} = usePollingQuery<DashboardRes>(
        ['stockDashboard'],
        (config) => fetchDashboard(config),
    );

    // 폴링 결과 + 실시간 overlay 합산
    const indexDataList: StatCardProps[] = useMemo(() => {
        if (!result?.indexList || result.indexList.length === 0) {
            return Array.from({length: 4}, () => ({...DEFAULT_INDEX_DATA}));
        }
        const indexList = result.indexList as DashboardIndexListItem[];

        const year = indexList[0].tm.substring(0, 4);
        const month = indexList[0].tm.substring(4, 6);
        const day = indexList[0].tm.substring(6, 8);
        const minute = indexList[0].tm.substring(8, 10);
        const second = indexList[0].tm.substring(10, 12);

        let today: string;
        if ((minute === '88' && second === '88') || (minute === '99' && second === '99')) {
            today = `${year}.${month}.${day} 장마감`;
        } else if (minute === '' || second === '') {
            today = `${year}.${month}.${day}`;
        } else {
            today = `${year}.${month}.${day} ${minute}:${second}`;
        }

        return indexList.map((indexItem) => {
            const newDateList = indexItem.chartList.map((chart: ChartDay) => indexDateFormat(chart.dt)).reverse();
            const newData = indexItem.chartList.map((chart: ChartDay) => chart.curPrc.replace(/^[+-]/, '')).reverse();
            const baseTrend: 'up' | 'down' | 'neutral' =
                indexItem.predPreSig === '5' ? 'down' : indexItem.predPreSig === '2' ? 'up' : 'neutral';

            const live = liveOverlay.get(indexItem.indsCd);
            return {
                id: indexItem.indsCd,
                title: indexItem.indsNm,
                value: live?.value ?? indexItem.curPrc.replace(/^[+-]/, ''),
                fluRt: live?.fluRt ?? indexItem.fluRt,
                interval: today,
                trend: live?.trend ?? baseTrend,
                data: newData,
                dateList: newDateList,
            };
        });
    }, [result, liveOverlay]);

    const kospiBarData: number[] = useMemo(() => {
        if (!result?.indexList?.[0]) return [0, 0, 0];
        const i = result.indexList[0];
        return [Number(i.ind), Number(i.frgnr), Number(i.orgn)];
    }, [result]);

    const kosdacBarData: number[] = useMemo(() => {
        if (!result?.indexList?.[2]) return [0, 0, 0];
        const i = result.indexList[2];
        return [Number(i.ind), Number(i.frgnr), Number(i.orgn)];
    }, [result]);

    const kospiProgramData: number[] = useMemo(() => {
        if (!result?.indexList?.[0]) return [0, 0, 0];
        const i = result.indexList[0];
        return [
            Math.round(Number(i.dfrtTrdeNetprps) / 100),
            Math.round(Number(i.ndiffproTrdeNetprps) / 100),
            Math.round(Number(i.allNetprps) / 100),
        ];
    }, [result]);

    const kosdacProgramData: number[] = useMemo(() => {
        if (!result?.indexList?.[2]) return [0, 0, 0];
        const i = result.indexList[2];
        return [
            Math.round(Number(i.dfrtTrdeNetprps) / 100),
            Math.round(Number(i.ndiffproTrdeNetprps) / 100),
            Math.round(Number(i.allNetprps) / 100),
        ];
    }, [result]);

    const defaultMsg: MessageProps = {icon: <RemoveIcon/>, title: '-', message: '-'};

    const message: MessageProps[] = useMemo(() => {
        if (!result?.indexList?.[0] || !result.indexList[2]) return [defaultMsg, defaultMsg];
        return [
            checkInvestor(result.indexList[0].indsNm, Number(result.indexList[0].frgnr), Number(result.indexList[0].orgn)),
            checkInvestor(result.indexList[2].indsNm, Number(result.indexList[2].frgnr), Number(result.indexList[2].orgn)),
        ];
    }, [result]);

    const programMessage: MessageProps[] = useMemo(() => {
        if (!result?.indexList?.[0] || !result.indexList[2]) return [defaultMsg, defaultMsg];
        return [
            checkProgram(result.indexList[0].indsNm, Number(result.indexList[0].dfrtTrdeNetprps), Number(result.indexList[0].ndiffproTrdeNetprps)),
            checkProgram(result.indexList[2].indsNm, Number(result.indexList[2].dfrtTrdeNetprps), Number(result.indexList[2].ndiffproTrdeNetprps)),
        ];
    }, [result]);

    const row: GridRowsProp[] = useMemo(() => {
        if (!result?.investorTradeRankList) return [];
        return (result.investorTradeRankList as InvestorTradeRankList[]).map((item) => ({
            id: item.stkCd,
            stkCd: item.stkCd,
            rank: item.rank,
            stkNm: item.stkNm,
            pridStkpcFluRt: item.pridStkpcFluRt,
            nettrdeAmt: item.nettrdeAmt,
        })) as unknown as GridRowsProp[];
    }, [result]);

    const loading = isLoading;

    const timeNow = async () => {
        try {
            const startTime = Date.now();
            const data = await fetchTimeNow({marketType: MarketType.INDEX});

            if (data.code !== "0000") throw new Error(data.message);

            const {time, isMarketOpen, startMarketTime, marketType} = data.result;
            if (marketType !== MarketType.INDEX) throw new Error(data.message);

            const endTime = Date.now();
            const delayTime = endTime - startTime;
            const revisionServerTime = time + delayTime / 2;

            chartTimer.current = revisionServerTime - endTime;
            if (!isMarketOpen) marketTimer.current = startMarketTime - revisionServerTime;

            return {...data.result};
        } catch (error) {
            console.error(error);
        }
    };

    const indexListStream = async () => {
        try {
            const data = await fetchDashboardStream();
            if (data.code !== "0000") throw new Error(data.message);
        } catch (error) {
            console.error(error);
        }
    };

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.trnm === "REAL" && Array.isArray(data.data)) {
                const updates: IndexStream[] = data.data.map((entry: IndexStreamRes) => {
                    const values = entry.values;
                    return {
                        code: entry.item,
                        value: values["10"],
                        change: values["11"],
                        fluRt: values["12"],
                        trend: values["25"],
                    };
                });
                setLiveOverlay((prev) => {
                    const next = new Map(prev);
                    updates.forEach((u) => {
                        const trend: 'up' | 'down' | 'neutral' | undefined =
                            ["1", "2"].includes(u.trend) ? 'up' :
                                ["4", "5"].includes(u.trend) ? 'down' : undefined;
                        next.set(u.code, {
                            value: u.value.replace(/^[+-]/, ''),
                            fluRt: u.fluRt,
                            trend,
                        });
                    });
                    return next;
                });
            }
        };
        return socket;
    };

    // WebSocket 라이프사이클 — 폴링과 독립.
    useEffect(() => {
        let socketTimeout: ReturnType<typeof setTimeout>;
        let socket: WebSocket | undefined;

        (async () => {
            const marketInfo = await timeNow();

            if (marketInfo?.isMarketOpen) {
                await indexListStream();
                socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();
                    const again = await timeNow();
                    if (again?.isMarketOpen) {
                        await indexListStream();
                        socket = openSocket();
                    }
                }, marketTimer.current + 200);
            }
        })();

        return () => {
            socket?.close();
            clearTimeout(socketTimeout);
        };
    }, []);

    function checkInvestor(name: string, frgnr: number, orgn: number): MessageProps {
        let message: string;
        let title: string;
        let icon: JSX.Element;

        if (orgn == 0) message = '기관 관망, ';
        else if (orgn > 0) message = '기관 매수, ';
        else message = '기관 매도, ';

        if (frgnr == 0) message = message + '외국인 관망 중입니다.';
        else if (frgnr > 0) message = message + '외국인 매수 중입니다.';
        else message = message + '외국인 매도 중입니다.';

        if (orgn == 0 && frgnr == 0) {
            title = `${name} 투자 중립`;
            icon = <RemoveIcon/>;
        } else if (orgn > 0 && frgnr > 0) {
            title = `${name} 투자 양호`;
            icon = <CheckIcon color="success"/>;
        } else if (orgn > 0 || frgnr > 0) {
            title = `${name} 투자 주의`;
            icon = <PriorityHighIcon color="warning"/>;
        } else {
            title = `${name} 투자 위험`;
            icon = <DoNotDisturbIcon color="error"/>;
        }

        return {message, title, icon};
    }

    function checkProgram(name: string, dfrtTrdeNetprps: number, ndiffproTrdeNetprps: number): MessageProps {
        let message: string;
        let title: string;
        let icon: JSX.Element;

        if (dfrtTrdeNetprps == 0) message = '프로그램 차익 관망, ';
        else if (dfrtTrdeNetprps > 0) message = '프로그램 차익 매수, ';
        else message = '프로그램 차익 매도, ';

        if (ndiffproTrdeNetprps == 0) message = message + '비차익 관망 중입니다.';
        else if (ndiffproTrdeNetprps > 0) message = message + '비차익 매수 중입니다.';
        else message = message + '비차익 매도 중입니다.';

        if (dfrtTrdeNetprps == 0 && ndiffproTrdeNetprps == 0) {
            title = `${name} 프로그램 중립`;
            icon = <RemoveIcon/>;
        } else if (dfrtTrdeNetprps > 0 && ndiffproTrdeNetprps > 0) {
            title = `${name} 프로그램 양호`;
            icon = <CheckIcon color="success"/>;
        } else if (dfrtTrdeNetprps > 0 || ndiffproTrdeNetprps > 0) {
            title = `${name} 프로그램 주의`;
            icon = <PriorityHighIcon color="warning"/>;
        } else {
            title = `${name} 프로그램 위험`;
            icon = <DoNotDisturbIcon color="error"/>;
        }

        return {message, title, icon};
    }

    function renderStatus(status: number) {
        const colors = status == 0 ? 'default' : status > 0 ? 'error' : 'info';
        return <Chip label={status > 0 ? `${status}%` : `${status}%`} color={colors}/>;
    }

    const onClick = () => navigate('/stock/index/list');
    void onClick;
    void isSmallScreen;

    const columns: GridColDef[] = [
        {field: 'rank', headerName: '순위', flex: 1, minWidth: 80, maxWidth: 80},
        {field: 'stkNm', headerName: '이름', flex: 1, minWidth: 150},
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

    const renderIndexRow = (
        label: string,
        investorData: number[],
        programData: number[],
        investorMsg: MessageProps,
        programMsg: MessageProps,
    ) => (
        <>
            <Grid size={{xs: 12}}>
                <Typography component="h2" variant="h6">
                    {label}
                </Typography>
            </Grid>
            <Grid size={{xs: 12, sm: 6, lg: 4}}>
                <Card variant="outlined" sx={{width: '100%'}}>
                    <CardContent>
                        <Typography component="h2" variant="subtitle2" gutterBottom>
                            투자자별 순매수(억)
                        </Typography>
                        {loading ? (
                            <Skeleton variant="rectangular" height={200} sx={{borderRadius: 1}}/>
                        ) : (
                            <InvestorBarChart data={investorData}/>
                        )}
                    </CardContent>
                </Card>
            </Grid>
            <Grid size={{xs: 12, sm: 6, lg: 4}}>
                <Card variant="outlined" sx={{width: '100%'}}>
                    <CardContent>
                        <Typography component="h2" variant="subtitle2" gutterBottom>
                            프로그램 순매수(억)
                        </Typography>
                        {loading ? (
                            <Skeleton variant="rectangular" height={200} sx={{borderRadius: 1}}/>
                        ) : (
                            <ProgramBarChart data={programData}/>
                        )}
                    </CardContent>
                </Card>
            </Grid>
            <Grid size={{xs: 12, sm: 12, lg: 4}}>
                <Stack spacing={1}>
                    {([investorMsg, programMsg]).map((msg, i) => (
                        <Card key={i} variant="outlined" sx={{width: '100%'}}>
                            {!loading && msg.icon}
                            <CardContent>
                                <Typography gutterBottom variant="h5" component="div">
                                    {loading ? <Skeleton width="60%"/> : msg.title}
                                </Typography>
                                <Typography variant="body2" sx={{color: 'text.secondary'}}>
                                    {loading ? <Skeleton width="90%"/> : msg.message}
                                </Typography>
                            </CardContent>
                        </Card>
                    ))}
                </Stack>
            </Grid>
        </>
    );

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 2}}>
                <Typography component="h2" variant="h6">
                    주요 지수
                </Typography>
                {!loading && <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>}
            </Box>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{mb: (theme) => theme.spacing(2)}}
            >
                {loading ? (
                    Array.from({length: 4}).map((_, index) => (
                        <Grid key={index} size={{xs: 12, sm: 6, lg: 3}}>
                            <Card variant="outlined" sx={{height: '100%'}}>
                                <CardContent>
                                    <Skeleton width={80} height={24}/>
                                    <Stack direction="row" sx={{justifyContent: 'space-between', alignItems: 'center', mt: 1}}>
                                        <Skeleton width={120} height={40}/>
                                        <Skeleton variant="rounded" width={60} height={24}/>
                                    </Stack>
                                    <Skeleton width={100}/>
                                    <Skeleton variant="rectangular" height={50} sx={{mt: 1, borderRadius: 1}}/>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))
                ) : indexDataList.map((card, index) => (
                    <Grid key={index} size={{xs: 12, sm: 6, lg: 3}}>
                        <StatCard {...card} />
                    </Grid>
                ))}
            </Grid>

            <Grid container spacing={2} columns={12} sx={{mb: 2}}>
                {renderIndexRow('종합(KOSPI)', kospiBarData, kospiProgramData, message[0], programMessage[0])}
                {renderIndexRow('종합(KOSDAQ)', kosdacBarData, kosdacProgramData, message[1], programMessage[1])}
            </Grid>

            <Typography component="h2" variant="h6" sx={{mb: 2}}>
                월간 종합(KOSPI) 기관/외국인 매수 상위 순위
            </Typography>
            <CustomDataTable rows={row} columns={columns} pageSize={20} loading={loading}/>
        </Box>
    );
}

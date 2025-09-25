import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import IndexLineChart from "../../components/IndexLineChart.tsx";
import type { CustomLineChartProps } from '../../components/IndexLineChart.tsx';
import OptionTable from "../../components/OptionTable.tsx";
import {GridColDef, GridRowsProp} from "@mui/x-data-grid";
import {fetchIndexList, fetchIndexListStream} from "../../api/index/IndexApi.ts";
import {useEffect, useRef, useState} from "react";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";

const IndexList = () => {
    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);
    const [kospiChartData, setKospiChartData] = useState<CustomLineChartProps>({
        id: '-',
        title: '-',
        value: '-',
        fluRt: '0',
        openPric: 0,
        interval: '-',
        trend: 'neutral',
        seriesData: [
            {
                id: 'KOSPI',
                showMark: false,
                curve: 'linear',
                area: true,
                stackOrder: 'ascending',
                color: 'grey',
                data: []
            }
        ],
        dateList: []
    });

    const [kosdacChartData, setKosdacChartData] = useState<CustomLineChartProps>({
        id: '-',
        title: '-',
        value: '-',
        fluRt: '0',
        openPric: 0,
        interval: '-',
        trend: 'neutral',
        seriesData: [
            {
                id: 'KOSDAC',
                showMark: false,
                curve: 'linear',
                area: true,
                stackOrder: 'ascending',
                color: 'grey',
                data: []
            }
        ],
        dateList: []
    });

    const [kospi200ChartData, setKospi200ChartData] = useState<CustomLineChartProps>({
        id: '-',
        title: '-',
        value: '-',
        fluRt: '0',
        openPric: 0,
        interval: '-',
        trend: 'neutral',
        seriesData: [
            {
                id: 'KOSPI 200',
                showMark: false,
                curve: 'linear',
                area: true,
                stackOrder: 'ascending',
                color: 'grey',
                data: []
            }
        ],
        dateList: []
    });

    const [goldChartData, setGoldChartData] = useState<CustomLineChartProps>({
        id: '-',
        title: '-',
        value: '-',
        fluRt: '0',
        openPric: 0,
        interval: '-',
        trend: 'neutral',
        seriesData: [
            {
                id: 'Gold',
                showMark: false,
                curve: 'linear',
                area: true,
                stackOrder: 'ascending',
                color: 'grey',
                data: []
            }
        ],
        dateList: []
    });

    useEffect(() => {
        indexList();

        let chartTimeout: ReturnType<typeof setTimeout>;
        let socketTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        (async () => {
            const marketInfo = await timeNow();

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            if(marketInfo.isMarketOpen) {
                await indexListStream();
                socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();

                    const again = await timeNow();
                    if (again.isMarketOpen) {
                        await indexListStream();
                        socket = openSocket();
                    }
                }, marketTimer.current + 200);
            }

            chartTimeout = setTimeout(() => {
                indexList();
                interval = setInterval(() => {
                    indexList();
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

    const indexListStream = async () => {
        try {
            const data = await fetchIndexListStream();

            console.log(data);

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }
        }catch (error) {
            console.error(error);
        }
    }

    const indexList = async () => {
        try {
            const data = await fetchIndexList();

            if(data.code !== "0000") {
                throw new Error(data.msg);
            }

            console.log(data);

            const {
                kospiPriceRes, kospiChartMinuteListRes,
                kosdacPriceRes, kosdacChartMinuteListRes,
                kospi200PriceRes, kospi200ChartMinuteListRes,
                goldPriceRes, goldChartMinuteListRes
            } = data.result;

            const year = kospiChartMinuteListRes.inds_min_pole_qry[0].cntr_tm.substring(0, 4);
            const month = kospiChartMinuteListRes.inds_min_pole_qry[0].cntr_tm.substring(4, 6);
            const day = kospiChartMinuteListRes.inds_min_pole_qry[0].cntr_tm.substring(6, 8);
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

            const kospiDateList = kospiChartMinuteListRes.inds_min_pole_qry.map(item => {
                return `${item.cntr_tm.slice(0, 4)}.${item.cntr_tm.slice(4, 6)}.${item.cntr_tm.slice(6, 8)} ${item.cntr_tm.slice(8, 10)}:${item.cntr_tm.slice(10, 12)}`
            }).reverse();

            const kospi200DateList = kospi200ChartMinuteListRes.inds_min_pole_qry.map(item => {
                return `${item.cntr_tm.slice(0, 4)}.${item.cntr_tm.slice(4, 6)}.${item.cntr_tm.slice(6, 8)} ${item.cntr_tm.slice(8, 10)}:${item.cntr_tm.slice(10, 12)}`
            }).reverse();

            const kosdacDateList = kosdacChartMinuteListRes.inds_min_pole_qry.map(item => {
                return `${item.cntr_tm.slice(0, 4)}.${item.cntr_tm.slice(4, 6)}.${item.cntr_tm.slice(6, 8)} ${item.cntr_tm.slice(8, 10)}:${item.cntr_tm.slice(10, 12)}`
            }).reverse();

            const goldDateList = goldChartMinuteListRes.gds_min_chart_qry.map(item => {
                return `${item.cntr_tm.slice(0, 4)}.${item.cntr_tm.slice(4, 6)}.${item.cntr_tm.slice(6, 8)} ${item.cntr_tm.slice(8, 10)}:${item.cntr_tm.slice(10, 12)}`
            }).reverse();

            setKospiChartData({
                id: kospiChartMinuteListRes.inds_cd,
                title: '종합(KOSPI)',
                value: kospiPriceRes.cur_prc.replace(/^[+-]/, ''),
                fluRt: kospiPriceRes.flu_rt,
                openPric: parseFloat(kospiPriceRes.open_pric.replace(/^[+-]/, '')),
                interval: today,
                trend: kospiPriceRes.pred_pre_sig === '5' ? 'down' : kospiPriceRes.pred_pre_sig === '2' ? 'up' : 'neutral',
                seriesData: [
                    {
                        id: kospiChartMinuteListRes.inds_cd,
                        showMark: false,
                        curve: 'linear',
                        area: true,
                        stackOrder: 'ascending',
                        color: kospiPriceRes.pred_pre_sig === '2' ? 'red' : 'blue',
                        data: kospiChartMinuteListRes.inds_min_pole_qry.map(item => parsePrice(item.cur_prc.replace(/^[+-]/, ''))).reverse(),
                    }
                ],
                dateList: kospiDateList
            });

            setKosdacChartData({
                id: kosdacChartMinuteListRes.inds_cd,
                title: '종합(KOSDAQ)',
                value: kosdacPriceRes.cur_prc.replace(/^[+-]/, ''),
                fluRt: kosdacPriceRes.flu_rt,
                openPric: parseFloat(kosdacPriceRes.open_pric.replace(/^[+-]/, '')),
                interval: today,
                trend: kosdacPriceRes.pred_pre_sig === '5' ? 'down' : kosdacPriceRes.pred_pre_sig === '2' ? 'up' : 'neutral',
                seriesData: [
                    {
                        id: kosdacChartMinuteListRes.inds_cd,
                        showMark: false,
                        curve: 'linear',
                        area: true,
                        stackOrder: 'ascending',
                        color: kosdacPriceRes.pred_pre_sig === '2' ? 'red' : 'blue',
                        data: kosdacChartMinuteListRes.inds_min_pole_qry.map(item => parsePrice(item.cur_prc.replace(/^[+-]/, ''))).reverse(),
                    }
                ],
                dateList: kosdacDateList
            });

            setKospi200ChartData({
                id: kospi200ChartMinuteListRes.inds_cd,
                title: 'KOSPI 200',
                value: kospi200PriceRes.cur_prc.replace(/^[+-]/, ''),
                fluRt: kospi200PriceRes.flu_rt,
                openPric: parseFloat(kospi200PriceRes.open_pric.replace(/^[+-]/, '')),
                interval: today,
                trend: kospi200PriceRes.pred_pre_sig === '5' ? 'down' : kospi200PriceRes.pred_pre_sig === '2' ? 'up' : 'neutral',
                seriesData: [
                    {
                        id: kospi200ChartMinuteListRes.inds_cd,
                        showMark: false,
                        curve: 'linear',
                        area: true,
                        stackOrder: 'ascending',
                        color: kospi200PriceRes.pred_pre_sig === '2' ? 'red' : 'blue',
                        data: kospi200ChartMinuteListRes.inds_min_pole_qry.map(item => parsePrice(item.cur_prc.replace(/^[+-]/, ''))).reverse(),
                    }
                ],
                dateList: kospi200DateList
            });

            const goldPrice = Number(goldPriceRes.pred_close_pric) + Number(goldPriceRes.pred_pre)

            setGoldChartData({
                id: 'M04020000',
                title: '금현물',
                value: goldPrice.toLocaleString().replace(/^[+-]/, ''),
                fluRt: goldPriceRes.flu_rt,
                openPric: parseFloat(goldPriceRes.open_pric.replace(/^[+-]/, '')),
                interval: today,
                trend: goldPriceRes.pred_pre_sig === '5' ? 'down' : goldPriceRes.pred_pre_sig === '2' ? 'up' : 'neutral',
                seriesData: [
                    {
                        id: 'M04020000',
                        showMark: false,
                        curve: 'linear',
                        area: true,
                        stackOrder: 'ascending',
                        color: goldPriceRes.pred_pre_sig === '2' ? 'red' : 'blue',
                        data: goldChartMinuteListRes.gds_min_chart_qry.map(item => Number(item.cur_prc.toLocaleString().replace(/^[+-]/, ''))).reverse(),
                    }
                ],
                dateList: goldDateList
            });
        }catch (error) {
            console.error(error);
        }
    }

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.trnm === "REAL" && Array.isArray(data.data)) {
                const indexList = data.data.map((entry) => {
                    const values = entry.values;
                    return {
                        code: entry.item, // ex: "001"
                        value: values["10"], // 현재가
                        change: values["11"], // 전일 대비
                        fluRt: values["12"],   // 등락률
                        trend: values["25"],   // 등락기호
                    };
                });

                indexList.forEach((data) => {
                    switch(data.code) {
                        case "001": {
                            setKospiChartData((prev) => ({
                                ...prev,
                                value: data.value.replace(/^[+-]/, ''),
                                fluRt: data.fluRt,
                                trend: data.trend === '5' ? 'down' : data.trend === '2' ? 'up' : 'neutral',
                            }));

                            break;
                        }
                        case "101":
                            setKosdacChartData((prev) => ({
                                ...prev,
                                value: data.value.replace(/^[+-]/, ''),
                                fluRt: data.fluRt,
                                trend: data.trend === '5' ? 'down' : data.trend === '2' ? 'up' : 'neutral',
                            }));

                            break;
                        case "201":
                            setKospi200ChartData((prev) => ({
                                ...prev,
                                value: data.value.replace(/^[+-]/, ''),
                                fluRt: data.fluRt,
                                trend: data.trend === '5' ? 'down' : data.trend === '2' ? 'up' : 'neutral',
                            }));

                            break;
                        case "M04020000":
                            setGoldChartData((prev) => ({
                                ...prev,
                                value: data.value.replace(/^[+-]/, ''),
                                fluRt: data.fluRt,
                                trend: data.trend === '5' ? 'down' : data.trend === '2' ? 'up' : 'neutral',
                            }));
                    }
                });
            }
        };

        return socket;
    }

    const parsePrice = (raw: string)  => {
        if (!raw) return null;
        return (parseInt(raw, 10) / 100).toFixed(2);
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
                    <IndexLineChart {...kospiChartData} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <IndexLineChart {...kosdacChartData} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <IndexLineChart {...kospi200ChartData} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <IndexLineChart {...goldChartData} />
                </Grid>
                {/*<Grid size={{ xs: 12, md: 6 }}>*/}
                {/*    <Card variant="outlined" sx={{ width: '100%', mb: 1}}>*/}
                {/*        <CardContent>*/}
                {/*            <Typography component="h2" variant="subtitle2" gutterBottom>*/}
                {/*                코스피200 옵션*/}
                {/*            </Typography>*/}
                {/*            <Stack sx={{ justifyContent: 'space-between' }}>*/}
                {/*                <OptionTable rows={rows} columns={columns} />*/}
                {/*            </Stack>*/}
                {/*        </CardContent>*/}
                {/*    </Card>*/}
                {/*    <Stack*/}
                {/*        direction="row"*/}
                {/*        sx={{*/}
                {/*            alignContent: { xs: 'center', sm: 'flex-start' },*/}
                {/*            alignItems: 'center',*/}
                {/*            gap: 1,*/}
                {/*        }}*/}
                {/*    >*/}
                {/*        <Card variant="outlined" sx={{ width: '100%' }}>*/}
                {/*            <CardContent>*/}
                {/*                <Typography component="h2" variant="subtitle2" gutterBottom>*/}
                {/*                    코스피200 위클리 옵션(월)*/}
                {/*                </Typography>*/}
                {/*                <Stack sx={{ justifyContent: 'space-between' }}>*/}
                {/*                    <OptionTable rows={rows} columns={columns} />*/}
                {/*                </Stack>*/}
                {/*            </CardContent>*/}
                {/*        </Card>*/}
                {/*        <Card variant="outlined" sx={{ width: '100%' }}>*/}
                {/*            <CardContent>*/}
                {/*                <Typography component="h2" variant="subtitle2" gutterBottom>*/}
                {/*                    코스피200 위클리 콜옵션(목)*/}
                {/*                </Typography>*/}
                {/*                <Stack sx={{ justifyContent: 'space-between' }}>*/}
                {/*                    <OptionTable rows={rows} columns={columns} />*/}
                {/*                </Stack>*/}
                {/*            </CardContent>*/}
                {/*        </Card>*/}
                {/*    </Stack>*/}
                {/*</Grid>*/}
                {/*<Grid size={{ xs: 12, md: 6 }}>*/}
                {/*    <IndexLineChart {...kospiChartData} />*/}
                {/*</Grid>*/}
                {/*<Grid size={{ xs: 12, md: 6 }}>*/}
                {/*    <IndexLineChart {...kospiChartData} />*/}
                {/*</Grid>*/}
            </Grid>
        </Box>
    )
}

export default IndexList
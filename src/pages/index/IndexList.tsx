import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import IndexLineChart, {IndexLineChartProps} from "../../components/IndexLineChart.tsx";
import {fetchIndexList, fetchIndexStream} from "../../api/index/IndexApi.ts";
import {useEffect, useMemo, useRef, useState} from "react";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {ChartMinute, IndexListItem, IndexListRes, IndexStream, IndexStreamRes} from "../../type/IndexType.ts";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {usePollingQuery} from "../../lib/pollingQuery.ts";

interface LiveIndexUpdate {
    value: string;
    fluRt: string;
    predPre: string;
    trend: 'up' | 'down' | 'neutral';
}

const trendColor = (value: string): 'up' | 'down' | 'neutral' =>
    ["1", "2"].includes(value) ? 'up' : ["4", "5"].includes(value) ? 'down' : 'neutral';

const chartColor = (value: string): 'red' | 'blue' | 'grey' =>
    ["1", "2"].includes(value) ? 'red' : ["4", "5"].includes(value) ? 'blue' : 'grey';

const indexDateFormat = (cntrTm: string) =>
    `${cntrTm.slice(0, 4)}.${cntrTm.slice(4, 6)}.${cntrTm.slice(6, 8)} ${cntrTm.slice(8, 10)}:${cntrTm.slice(10, 12)}`;

const parsePrice = (raw: string) => {
    if (!raw) return null;
    return (parseInt(raw, 10) / 100).toFixed(2);
};

const IndexList = () => {
    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    // 실시간 stream으로 들어오는 부분 갱신값. polling 결과(query.data)에 덮어쓰기 형태로 합쳐 렌더.
    const [liveOverlay, setLiveOverlay] = useState<Map<string, LiveIndexUpdate>>(new Map());

    const {data: result, isLoading, lastUpdated, pollError} = usePollingQuery<IndexListRes>(
        ['indexList'],
        (config) => fetchIndexList(config),
    );

    // 폴링 결과 + 실시간 overlay 합산하여 차트 데이터 도출
    const indexDataList: IndexLineChartProps[] = useMemo(() => {
        if (!result) return [];
        const list: IndexListItem[] = result.indexList ?? [];
        if (list.length === 0) return [];

        const year = list[0].chartMinuteList[0]?.cntrTm?.substring(0, 4) ?? '';
        const month = list[0].chartMinuteList[0]?.cntrTm?.substring(4, 6) ?? '';
        const day = list[0].chartMinuteList[0]?.cntrTm?.substring(6, 8) ?? '';
        const minute = list[0].tm.substring(0, 2);
        const second = list[0].tm.substring(2, 4);

        let today: string;
        if ((minute === '88' && second === '88') || (minute === '99' && second === '99')) {
            today = `${year}.${month}.${day} 장마감`;
        } else if (minute === '' || second === '') {
            today = `${year}.${month}.${day}`;
        } else {
            today = `${year}.${month}.${day} ${minute}:${second}`;
        }

        return list.map((indexItem: IndexListItem) => {
            const newDateList = indexItem.chartMinuteList.map((chart: ChartMinute) => indexDateFormat(chart.cntrTm)).reverse();
            const live = liveOverlay.get(indexItem.indsCd);

            return {
                id: indexItem.indsCd,
                title: indexItem.indsNm,
                value: live?.value ?? indexItem.curPrc.replace(/^[+-]/, ''),
                fluRt: live?.fluRt ?? indexItem.fluRt,
                predPre: live?.predPre ?? (indexItem.predPre || '0'),
                openPric: parseFloat(indexItem.openPric.replace(/^[+-]/, '')),
                interval: today,
                trend: live?.trend ?? trendColor(indexItem.predPreSig),
                seriesData: [
                    {
                        id: indexItem.indsCd,
                        showMark: false,
                        curve: 'linear',
                        area: true,
                        stackOrder: 'ascending',
                        color: chartColor(indexItem.predPreSig),
                        data: indexItem.chartMinuteList.map(item => parsePrice(item.curPrc.replace(/^[+-]/, ''))).reverse(),
                    }
                ],
                dateList: newDateList
            };
        });
    }, [result, liveOverlay]);

    const loading = isLoading;

    const timeNow = async () => {
        try {
            const startTime = Date.now();
            const data = await fetchTimeNow({marketType: MarketType.INDEX});

            if (data.code !== "0000") {
                throw new Error(data.message);
            }

            const {time, isMarketOpen, startMarketTime, marketType} = data.result;

            if (marketType !== MarketType.INDEX) {
                throw new Error(data.message);
            }

            const endTime = Date.now();
            const delayTime = endTime - startTime;
            const revisionServerTime = time + delayTime / 2;

            chartTimer.current = revisionServerTime - endTime;

            if (!isMarketOpen) {
                marketTimer.current = startMarketTime - revisionServerTime;
            }

            return {...data.result};
        } catch (error) {
            console.error(error);
        }
    };

    const indexListStream = async () => {
        try {
            const data = await fetchIndexStream(["001", "101", "201", "150"]);
            if (data.code !== "0000") {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.trnm === "REAL" && Array.isArray(data.data)) {
                const updates = data.data.map((entry: IndexStreamRes): IndexStream => {
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
                    updates.forEach((u: IndexStream) => {
                        next.set(u.code, {
                            value: u.value.replace(/^[+-]/, ''),
                            fluRt: u.fluRt,
                            predPre: u.change || '0',
                            trend: trendColor(u.trend),
                        });
                    });
                    return next;
                });
            }
        };

        return socket;
    };

    // WebSocket 라이프사이클 — 폴링과 독립. 시장 개장 여부 체크 후 socket 연결.
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

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', mb: 2, gap: 2}}>
                <Typography component="h2" variant="h6">
                    주요 지수
                </Typography>
                <Box sx={{flex: 1}}/>
                <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>
            </Box>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{mb: (theme) => theme.spacing(2)}}
            >
                {loading ? (
                    Array.from({length: 4}).map((_, index) => (
                        <Grid key={index} size={{xs: 12, md: 6}}>
                            <Card variant="outlined" sx={{width: '100%'}}>
                                <CardContent>
                                    <Skeleton width={120} height={28}/>
                                    <Stack direction="row" sx={{justifyContent: 'space-between', alignItems: 'center', mt: 1, mb: 1}}>
                                        <Skeleton width={140} height={40}/>
                                        <Stack direction="row" spacing={1}>
                                            <Skeleton variant="rounded" width={60} height={24}/>
                                            <Skeleton variant="rounded" width={80} height={24}/>
                                        </Stack>
                                    </Stack>
                                    <Skeleton width={180}/>
                                    <Skeleton variant="rectangular" height={220} sx={{mt: 1.5, borderRadius: 1}}/>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))
                ) : (
                    indexDataList.map((value, index) => (
                        <Grid key={index} size={{xs: 12, md: 6}}>
                            <IndexLineChart {...value} />
                        </Grid>
                    ))
                )}
            </Grid>
        </Box>
    );
};

export default IndexList;

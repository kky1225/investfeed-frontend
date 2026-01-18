import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import IndexLineChart, {IndexLineChartProps} from "../../components/IndexLineChart.tsx";
import {fetchIndexList, fetchIndexListStream} from "../../api/index/IndexApi.ts";
import {useEffect, useRef, useState} from "react";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {ChartMinute, IndexListItem, IndexStream, IndexStreamRes} from "../../type/IndexType.ts";

const IndexList = () => {
    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    const [indexDataList, setIndexDataList] = useState<IndexLineChartProps[]>([]);

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
                indexList
            } = data.result;

            const year = indexList[0].chartMinuteList[0].cntrTm.substring(0, 4);
            const month = indexList[0].chartMinuteList[0].cntrTm.substring(4, 6);
            const day = indexList[0].chartMinuteList[0].cntrTm.substring(6, 8);
            const minute = indexList[0].tm.substring(0, 2);
            const second = indexList[0].tm.substring(2, 4);

            let today;

            if(minute === '88' && second === '88' || minute === '99' && second === '99') {
                today = `${year}.${month}.${day} 장마감`;
            } else if(minute === '' || second === '') {
                today = `${year}.${month}.${day}`;
            } else {
                today = `${year}.${month}.${day} ${minute}:${second}`;
            }

            const newIndexDataList: IndexLineChartProps[] = indexList.map((indexItem: IndexListItem) => {
                const newDateList = indexItem.chartMinuteList.map((chart: ChartMinute) => indexDateFormat(chart.cntrTm)).reverse();

                return {
                    id: indexItem.indsCd,
                    title: indexItem.indsNm,
                    value: indexItem.curPrc.replace(/^[+-]/, ''),
                    fluRt: indexItem.fluRt,
                    openPric: parseFloat(indexItem.openPric.replace(/^[+-]/, '')),
                    interval: today,
                    trend: indexItem.predPreSig === '5' ? 'down' : indexItem.predPreSig === '2' ? 'up' : 'neutral',
                    seriesData: [
                        {
                            id: indexItem.indsCd,
                            showMark: false,
                            curve: 'linear',
                            area: true,
                            stackOrder: 'ascending',
                            color: indexItem.predPreSig === '2' ? 'red' : 'blue',
                            data: indexItem.chartMinuteList.map(item => parsePrice(item.curPrc.replace(/^[+-]/, ''))).reverse(),
                        }
                    ],
                    dateList: newDateList
                };
            });

            setIndexDataList(newIndexDataList);
        }catch (error) {
            console.error(error);
        }
    }

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.trnm === "REAL" && Array.isArray(data.data)) {
                const indexList = data.data.map((entry: IndexStreamRes) => {
                    const values = entry.values;
                    return {
                        code: entry.item, // ex: "001"
                        value: values["10"], // 현재가
                        change: values["11"], // 전일 대비
                        fluRt: values["12"],   // 등락률
                        trend: values["25"],   // 등락기호
                    };
                });

                setIndexDataList((prevList) => {
                    return prevList.map((item) => {
                        const newData = indexList.find((data: IndexStream) => data.code === item.id);

                        if (newData) {
                            return {
                                ...item,
                                value: newData.value.replace(/^[+-]/, ''),
                                fluRt: newData.fluRt,
                                trend: newData.trend === '5' ? 'down' : newData.trend === '2' ? 'up' : 'neutral',
                            };
                        }

                        return item;
                    });
                });
            }
        };

        return socket;
    }

    const indexDateFormat = (cntrTm: string) => {
        return `${cntrTm.slice(0, 4)}.${cntrTm.slice(4, 6)}.${cntrTm.slice(6, 8)} ${cntrTm.slice(8, 10)}:${cntrTm.slice(10, 12)}`;
    }

    const parsePrice = (raw: string)  => {
        if (!raw) return null;
        return (parseInt(raw, 10) / 100).toFixed(2);
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
                {
                    indexDataList.map((value, index) => (
                        <Grid key={index} size={{ xs: 12, md: 6 }}>
                            <IndexLineChart {...value} />
                        </Grid>
                    ))
                }
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
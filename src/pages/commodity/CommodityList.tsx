import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import {useEffect, useRef, useState} from "react";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import CommodityLineChart, {CommodityLineChartProps} from "../../components/CommodityLineChart.tsx";
import {fetchCommodityList, fetchCommodityListStream} from "../../api/commodity/CommodityApi.ts";
import {ChartMinute, CommodityListItem, CommodityStream, CommodityStreamRes} from "../../type/CommodityType.ts";

const CommodityList = () => {
    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    const DEFAULT_COMMODITY_DATA: CommodityLineChartProps = {
        id: '-',
        title: '-',
        value: '-',
        fluRt: '0',
        openPric: 0,
        interval: '-',
        trend: 'neutral',
        seriesData: [
            {
                id: '',
                showMark: false,
                curve: 'linear',
                area: true,
                stackOrder: 'ascending',
                color: 'grey',
                data: []
            }
        ],
        dateList: []
    }

    const [commodityDataList, setCommodityDataList] = useState<CommodityLineChartProps[]>(
        Array.from({ length: 2}, () => ({
            ...DEFAULT_COMMODITY_DATA,
            seriesData: DEFAULT_COMMODITY_DATA.seriesData.map(s => ({...s})),
            dateList: [...DEFAULT_COMMODITY_DATA.dateList]
        }))
    );

    useEffect(() => {
        commodityList();

        let chartTimeout: ReturnType<typeof setTimeout>;
        let socketTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        (async () => {
            const marketInfo = await timeNow();

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            if(marketInfo.isMarketOpen) {
                await commodityListStream();
                socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();

                    const again = await timeNow();
                    if (again.isMarketOpen) {
                        await commodityListStream();
                        socket = openSocket();
                    }
                }, marketTimer.current + 200);
            }

            chartTimeout = setTimeout(() => {
                commodityList();
                interval = setInterval(() => {
                    commodityList();
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
                marketType: MarketType.COMMODITY
            });

            if(data.code !== "0000") {
                throw new Error(data.msg);
            }

            const { time, isMarketOpen, startMarketTime, marketType } = data.result

            if(marketType !== MarketType.COMMODITY) {
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

    const commodityListStream = async () => {
        try {
            const data = await fetchCommodityListStream();

            console.log(data);

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }
        }catch (error) {
            console.error(error);
        }
    }

    const commodityList = async () => {
        try {
            const data = await fetchCommodityList();

            if(data.code !== "0000") {
                throw new Error(data.msg);
            }

            console.log(data);

            const {
                commodityList
            } = data.result;

            const year = commodityList[0].chartMinuteList[0].cntrTm.substring(0, 4);
            const month = commodityList[0].chartMinuteList[0].cntrTm.substring(4, 6);
            const day = commodityList[0].chartMinuteList[0].cntrTm.substring(6, 8);
            const hour = commodityList[0].tm.substring(0, 2);
            const minute = commodityList[0].tm.substring(2, 4);

            let today;
            if(Number(hour) >= 20 || Number(hour) < 8) {
                today = `${year}.${month}.${day} 장마감`;
            } else {
                today = `${year}.${month}.${day} ${hour}:${minute}`;
            }

            const newCommodityDataList: CommodityLineChartProps[] = commodityList.map((commodityItem: CommodityListItem) => {
                const newDateList = commodityItem.chartMinuteList.map((chart: ChartMinute) => commodityDateFormat(chart.cntrTm)).reverse();

                return {
                    id: commodityItem.stkCd,
                    title: commodityItem.stkNm,
                    value: Number(commodityItem.curPrc.replace(/^[+-]/, '')).toLocaleString(),
                    fluRt: commodityItem.fluRt,
                    openPric: parseFloat(commodityItem.openPric.replace(/^[+-]/, '')),
                    interval: today,
                    trend: commodityItem.predPreSig === '5' ? 'down' : commodityItem.predPreSig === '2' ? 'up' : 'neutral',
                    seriesData: [
                        {
                            id: commodityItem.stkCd,
                            showMark: false,
                            curve: 'linear',
                            area: true,
                            stackOrder: 'ascending',
                            color: commodityItem.predPreSig === '2' ? 'red' : 'blue',
                            data: commodityItem.chartMinuteList.map(item => parsePrice(item.curPrc.replace(/^[+-]/, ''))).reverse(),
                        }
                    ],
                    dateList: newDateList
                };
            });

            setCommodityDataList(newCommodityDataList);
        }catch (error) {
            console.error(error);
        }
    }

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.trnm === "REAL" && Array.isArray(data.data)) {
                const commodityList = data.data.map((entry: CommodityStreamRes) => {
                    const values = entry.values;
                    return {
                        code: entry.item, // ex: "001"
                        value: values["10"], // 현재가
                        change: values["11"], // 전일 대비
                        fluRt: values["12"],   // 등락률
                        trend: values["25"],   // 등락기호
                    };
                });

                setCommodityDataList((prevList) => {
                    return prevList.map((item) => {
                        const newData = commodityList.find((data: CommodityStream) => data.code === item.id);

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

    const commodityDateFormat = (cntrTm: string) => {
        return `${cntrTm.slice(0, 4)}.${cntrTm.slice(4, 6)}.${cntrTm.slice(6, 8)} ${cntrTm.slice(8, 10)}:${cntrTm.slice(10, 12)}`;
    }

    const parsePrice = (raw: string)  => {
        if (!raw) return null;
        return parseInt(raw);
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
                    commodityDataList.map((value, index) => (
                        <Grid key={index} size={{ xs: 12, md: 6 }}>
                            <CommodityLineChart {...value} />
                        </Grid>
                    ))
                }
            </Grid>
        </Box>
    )
}

export default CommodityList
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import {useEffect, useMemo, useRef, useState} from "react";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import CommodityLineChart, {CommodityLineChartProps} from "../../components/CommodityLineChart.tsx";
import {fetchCommodityList, fetchCommodityStream} from "../../api/commodity/CommodityApi.ts";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {ChartMinute, CommodityListItem, CommodityListRes, CommodityStream, CommodityStreamRes} from "../../type/CommodityType.ts";
import {usePollingQuery} from "../../lib/pollingQuery.ts";
import {parseKiwoomStamp} from "../../lib/tradeStamp.ts";

interface LiveCommodityUpdate {
    value: string;
    fluRt: string;
    predPre: string;
    trend: 'up' | 'down' | 'neutral';
    stamp: number;
}

const trendColor = (value: string): 'up' | 'down' | 'neutral' =>
    ["1", "2"].includes(value) ? 'up' : ["4", "5"].includes(value) ? 'down' : 'neutral';

const chartColor = (value: string): 'red' | 'blue' | 'grey' =>
    ["1", "2"].includes(value) ? 'red' : ["4", "5"].includes(value) ? 'blue' : 'grey';

const commodityDateFormat = (cntrTm: string) =>
    `${cntrTm.slice(0, 4)}.${cntrTm.slice(4, 6)}.${cntrTm.slice(6, 8)} ${cntrTm.slice(8, 10)}:${cntrTm.slice(10, 12)}`;

const parsePrice = (raw: string) => {
    if (!raw) return null;
    return parseInt(raw);
};

const CommodityList = () => {
    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);
    const [liveOverlay, setLiveOverlay] = useState<Map<string, LiveCommodityUpdate>>(new Map());
    const updateIfNewer = (code: string, incoming: LiveCommodityUpdate) => {
        setLiveOverlay(prev => {
            const cur = prev.get(code);
            if (cur && cur.stamp >= incoming.stamp) return prev;
            const next = new Map(prev);
            next.set(code, incoming);
            return next;
        });
    };

    const {data: result, isLoading, lastUpdated, pollError} = usePollingQuery<CommodityListRes>(
        ['commodityList'],
        (config) => fetchCommodityList(config),
    );

    const commodityDataList: CommodityLineChartProps[] = useMemo(() => {
        if (!result) return [];
        const list: CommodityListItem[] = result.commodityList ?? [];
        if (list.length === 0) return [];

        const year = list[0].chartMinuteList[0]?.cntrTm?.substring(0, 4) ?? '';
        const month = list[0].chartMinuteList[0]?.cntrTm?.substring(4, 6) ?? '';
        const day = list[0].chartMinuteList[0]?.cntrTm?.substring(6, 8) ?? '';
        const hour = list[0].tmN.substring(0, 2);
        const minute = list[0].tmN.substring(2, 4);

        const today = (Number(hour) >= 20 || Number(hour) < 8)
            ? `${year}.${month}.${day} 장마감`
            : `${year}.${month}.${day} ${hour}:${minute}`;

        return list.map((commodityItem: CommodityListItem) => {
            const newDateList = commodityItem.chartMinuteList.map((chart: ChartMinute) => commodityDateFormat(chart.cntrTm)).reverse();
            const live = liveOverlay.get(commodityItem.stkCd);

            return {
                id: commodityItem.stkCd,
                title: commodityItem.stkNm,
                value: live?.value ?? Number(commodityItem.curPrc.replace(/^[+-]/, '')).toLocaleString(),
                fluRt: live?.fluRt ?? commodityItem.fluRt,
                predPre: live?.predPre ?? (commodityItem.predPre || '0'),
                openPric: parseFloat(commodityItem.openPric.replace(/^[+-]/, '')),
                interval: today,
                trend: live?.trend ?? trendColor(commodityItem.predPreSig),
                seriesData: [
                    {
                        id: commodityItem.stkCd,
                        showMark: false,
                        curve: 'linear',
                        area: true,
                        stackOrder: 'ascending',
                        color: chartColor(commodityItem.predPreSig),
                        data: commodityItem.chartMinuteList.map(item => parsePrice(item.curPrc.replace(/^[+-]/, ''))).reverse(),
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
            const data = await fetchTimeNow({marketType: MarketType.COMMODITY});

            if (data.code !== "0000") {
                throw new Error(data.message);
            }

            const {time, isMarketOpen, startMarketTime, marketType} = data.result;

            if (marketType !== MarketType.COMMODITY) {
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

    const commodityListStream = async () => {
        try {
            const data = await fetchCommodityStream(["M04020000", "M04020100"]);
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
                const updates = data.data.map((entry: CommodityStreamRes) => {
                    const values = entry.values;
                    return {
                        code: entry.item,
                        value: values["10"],
                        change: values["11"],
                        fluRt: values["12"],
                        trend: values["25"],
                        tradeTime: values["20"],
                    };
                });

                updates.forEach((u: CommodityStream & {tradeTime?: string}) => {
                    updateIfNewer(u.code, {
                        value: Number(u.value.replace(/^[+-]/, '')).toLocaleString(),
                        fluRt: u.fluRt,
                        predPre: u.change || '0',
                        trend: trendColor(u.trend),
                        stamp: parseKiwoomStamp(u.tradeTime),
                    });
                });
            }
        };

        return socket;
    };

    // 폴링 결과 → 각 자산별 updateIfNewer (stamp 비교)
    useEffect(() => {
        if (!result?.commodityList) return;
        (result.commodityList as CommodityListItem[]).forEach((item) => {
            updateIfNewer(item.stkCd, {
                value: Number(item.curPrc.replace(/^[+-]/, '')).toLocaleString(),
                fluRt: item.fluRt,
                predPre: item.predPre || '0',
                trend: trendColor(item.predPreSig),
                stamp: parseKiwoomStamp(item.tmN),
            });
        });
    }, [result]);

    useEffect(() => {
        let socketTimeout: ReturnType<typeof setTimeout>;
        let socket: WebSocket | undefined;

        (async () => {
            const marketInfo = await timeNow();

            if (marketInfo?.isMarketOpen) {
                await commodityListStream();
                socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();
                    const again = await timeNow();
                    if (again?.isMarketOpen) {
                        await commodityListStream();
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
                    원자재 목록
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
                    Array.from({length: 2}).map((_, index) => (
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
                    commodityDataList.map((value, index) => (
                        <Grid key={index} size={{xs: 12, md: 6}}>
                            <CommodityLineChart {...value} />
                        </Grid>
                    ))
                )}
            </Grid>
        </Box>
    );
};

export default CommodityList;

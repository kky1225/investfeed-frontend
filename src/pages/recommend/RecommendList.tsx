import {Box} from "@mui/material";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import {useEffect, useMemo, useRef, useState} from "react";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {fetchRecommendList, fetchRecommendListStream} from "../../api/recommend/RecommendApi.ts";
import {
    RecommendListItem,
    RecommendListRes,
    RecommendListStream,
    RecommendListStreamReq,
    RecommendListStreamRes
} from "../../type/RecommendType.ts";
import RecommendCard, {RecommendCardProps} from "../../components/RecommendCard.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {usePollingQuery} from "../../lib/pollingQuery.ts";

interface LiveRecommendUpdate {
    value: string;
    changeAmount: string;
    fluRt: string;
    trend: 'up' | 'down' | 'neutral';
}

const trendColor = (value: string): 'up' | 'down' | 'neutral' =>
    ["1", "2"].includes(value) ? 'up' : ["4", "5"].includes(value) ? 'down' : 'neutral';

const RecommendList = () => {
    const [liveOverlay, setLiveOverlay] = useState<Map<string, LiveRecommendUpdate>>(new Map());
    const subscribedKeyRef = useRef<string>('');

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    const {data: result, isLoading, lastUpdated, pollError} = usePollingQuery<RecommendListRes>(
        ['recommendList'],
        (config) => fetchRecommendList(config),
    );

    const recommendDataList: RecommendCardProps[] = useMemo(() => {
        if (!result) return [];
        const list: RecommendListItem[] = result.recommendList ?? [];
        return list.map((item) => {
            const live = liveOverlay.get(item.stkCd);
            return {
                id: item.stkCd,
                title: item.stkNm,
                value: live?.value ?? Number(item.curPrc.replace(/^[+-]/, '')).toLocaleString(),
                changeAmount: live?.changeAmount ?? (item.predPre ?? '0'),
                fluRt: live?.fluRt ?? item.fluRt,
                trend: live?.trend ?? trendColor(item.preSig),
            };
        });
    }, [result, liveOverlay]);

    const avoidDataList: RecommendCardProps[] = useMemo(() => {
        if (!result) return [];
        const list: RecommendListItem[] = result.avoidList ?? [];
        return list.map((item) => {
            const live = liveOverlay.get(item.stkCd);
            return {
                id: item.stkCd,
                title: item.stkNm,
                value: live?.value ?? Number(item.curPrc.replace(/^[+-]/, '')).toLocaleString(),
                changeAmount: live?.changeAmount ?? (item.predPre ?? '0'),
                fluRt: live?.fluRt ?? item.fluRt,
                trend: live?.trend ?? trendColor(item.preSig),
            };
        });
    }, [result, liveOverlay]);

    const loading = isLoading;

    const timeNow = async () => {
        try {
            const startTime = Date.now();
            const data = await fetchTimeNow({marketType: MarketType.STOCK});

            if (data.code !== "0000") throw new Error(data.message);

            const {time, isMarketOpen, startMarketTime, marketType} = data.result;
            if (marketType !== MarketType.STOCK) throw new Error(data.message);

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

    const recommendListStream = async (req: RecommendListStreamReq) => {
        try {
            const data = await fetchRecommendListStream(req);
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
                const updates: RecommendListStream[] = data.data.map((entry: RecommendListStreamRes) => {
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
                        next.set(u.code, {
                            value: Number(u.value.replace(/^[+-]/, '')).toLocaleString(),
                            changeAmount: u.change,
                            fluRt: u.fluRt,
                            trend: trendColor(u.trend),
                        });
                    });
                    return next;
                });
            }
        };
        return socket;
    };

    // WebSocket 라이프사이클 — recommend/avoid 종목 stkCd 들로 stream 등록.
    useEffect(() => {
        if (!result) return;
        const items = [
            ...(result.recommendList ?? []),
            ...(result.avoidList ?? []),
        ].map((r: RecommendListItem) => r.stkCd);
        if (items.length === 0) return;

        const key = items.join(',');
        if (subscribedKeyRef.current === key) return;
        subscribedKeyRef.current = key;

        let socketTimeout: ReturnType<typeof setTimeout>;
        let socket: WebSocket | undefined;

        (async () => {
            const marketInfo = await timeNow();

            if (marketInfo?.isMarketOpen) {
                await recommendListStream({items});
                socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();
                    const again = await timeNow();
                    if (again?.isMarketOpen) {
                        await recommendListStream({items});
                        socket = openSocket();
                    }
                }, marketTimer.current + 200);
            }
        })();

        return () => {
            socket?.close();
            clearTimeout(socketTimeout);
        };
    }, [result]);

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', mb: 2, gap: 2}}>
                <Typography component="h2" variant="h6">
                    추천 목록
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
                <Typography component="h2" variant="h6">
                    매수 리포트
                </Typography>
                <Box sx={{width: '100%'}}>
                    <Grid
                        container
                        spacing={2}
                        columns={12}
                        sx={{mt: 1, mb: (theme) => theme.spacing(2)}}
                    >
                        {loading ? (
                            Array.from({length: 4}).map((_, index) => (
                                <Grid key={index} size={{xs: 12, md: 6}}>
                                    <Card variant="outlined" sx={{width: '100%'}}>
                                        <CardContent>
                                            <Skeleton width={140} height={24}/>
                                            <Stack direction="row" spacing={1} sx={{alignItems: 'center', mt: 1}}>
                                                <Skeleton width={120} height={40}/>
                                                <Skeleton width={60}/>
                                                <Skeleton variant="rounded" width={60} height={24}/>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))
                        ) : recommendDataList.length > 0 ?
                            recommendDataList.map((data: RecommendCardProps, index: number) => (
                                <Grid key={index} size={{xs: 12, md: 6}}>
                                    <RecommendCard {...data} />
                                </Grid>
                            )) : <p>매수 추천 종목 없음</p>
                        }
                    </Grid>
                </Box>
                <Typography component="h2" variant="h6">
                    매도 리포트
                </Typography>
                <Box sx={{width: '100%'}}>
                    <Grid
                        container
                        spacing={2}
                        columns={12}
                        sx={{mt: 1, mb: (theme) => theme.spacing(2)}}
                    >
                        {loading ? (
                            Array.from({length: 4}).map((_, index) => (
                                <Grid key={index} size={{xs: 12, md: 6}}>
                                    <Card variant="outlined" sx={{width: '100%'}}>
                                        <CardContent>
                                            <Skeleton width={140} height={24}/>
                                            <Stack direction="row" spacing={1} sx={{alignItems: 'center', mt: 1}}>
                                                <Skeleton width={120} height={40}/>
                                                <Skeleton width={60}/>
                                                <Skeleton variant="rounded" width={60} height={24}/>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))
                        ) : avoidDataList.length > 0 ?
                            avoidDataList.map((data: RecommendCardProps, index: number) => (
                                <Grid key={index} size={{xs: 12, md: 6}}>
                                    <RecommendCard {...data} />
                                </Grid>
                            )) : <p>매도 추천 종목 없음</p>
                        }
                    </Grid>
                </Box>
            </Grid>
        </Box>
    );
};

export default RecommendList;

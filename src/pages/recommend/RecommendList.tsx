import {Box} from "@mui/material";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import {useEffect, useRef, useState} from "react";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {fetchRecommendList, fetchRecommendListStream} from "../../api/recommend/RecommendApi.ts";
import {
    RecommendListItem,
    RecommendListStream,
    RecommendListStreamReq,
    RecommendListStreamRes
} from "../../type/RecommendType.ts";
import RecommendCard, {RecommendCardProps} from "../../components/RecommendCard.tsx";

const RecommendList = () => {
    const [recommendDataList, setRecommendDataList] = useState<RecommendCardProps[]>([]);
    const [avoidDataList, setAvoidDataList] = useState<RecommendCardProps[]>([]);
    const [loading, setLoading] = useState(true);

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    useEffect(() => {
        let socketTimeout: ReturnType<typeof setTimeout>;
        let socket: WebSocket;

        (async () => {
            const items = await recommendList() || [];
            const recommendListStreamReq: RecommendListStreamReq = {
                items: items
            }

            const marketInfo = await timeNow();

            if(marketInfo.isMarketOpen) {
                await recommendListStream(recommendListStreamReq);
                socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();

                    const again = await timeNow();
                    if (again.isMarketOpen) {
                        await recommendListStream(recommendListStreamReq);
                        socket = openSocket();
                    }
                }, marketTimer.current + 200);
            }
        })();

        return () => {
            socket?.close();
            clearInterval(socketTimeout);
        }
    }, []);

    const timeNow = async () => {
        try {
            const startTime = Date.now();
            const data = await fetchTimeNow({
                marketType: MarketType.STOCK
            });

            if(data.code !== "0000") {
                throw new Error(data.msg);
            }

            const { time, isMarketOpen, startMarketTime, marketType } = data.result

            if(marketType !== MarketType.STOCK) {
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

    const recommendList = async () => {
        try {
            const data = await fetchRecommendList();

            const { recommendList, avoidList } = data.result;

            const newRecommendDataList: RecommendCardProps[] = recommendList.map((recommend: RecommendListItem) => {
                return {
                    id: recommend.stkCd,
                    title: recommend.stkNm,
                    value: Number(recommend.curPrc.replace(/^[+-]/, '')).toLocaleString(),
                    changeAmount: recommend.predPre ?? '0',
                    fluRt: recommend.fluRt,
                    trend: trendColor(recommend.preSig)
                }
            });

            const newAvoidDataList: RecommendCardProps[] = avoidList.map((avoid: RecommendListItem) => {
                return {
                    id: avoid.stkCd,
                    title: avoid.stkNm,
                    value: Number(avoid.curPrc.replace(/^[+-]/, '')).toLocaleString(),
                    changeAmount: avoid.predPre ?? '0',
                    fluRt: avoid.fluRt,
                    trend: trendColor(avoid.preSig)
                }
            });

            setAvoidDataList(newAvoidDataList);
            setRecommendDataList(newRecommendDataList);

            return [...recommendList, ...avoidList].map((row: RecommendListItem) => {
                return row.stkCd;
            });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const recommendListStream = async (req: RecommendListStreamReq) => {
        try {
            const data = await fetchRecommendListStream(req);

            console.log(data);

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }
        } catch (error) {
            console.error(error);
        }
    }

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.trnm === "REAL" && Array.isArray(data.data)) {
                const recommendList = data.data.map((entry: RecommendListStreamRes) => {
                    const values = entry.values;
                    return {
                        code: entry.item, // ex: "001"
                        value: values["10"], // 현재가
                        change: values["11"], // 전일 대비
                        fluRt: values["12"],   // 등락률
                        trend: values["25"],   // 등락기호
                    };
                });

                const updateList = (prevList: RecommendCardProps[]) => {
                    return prevList.map((item) => {
                        const newData = recommendList.find((data: RecommendListStream) => data.code === item.id);

                        if (newData) {
                            return {
                                ...item,
                                value: Number(newData.value.replace(/^[+-]/, '')).toLocaleString(),
                                changeAmount: newData.change,
                                fluRt: newData.fluRt,
                                trend: trendColor(newData.trend),
                            };
                        }

                        return item;
                    });
                };

                setRecommendDataList(updateList);
                setAvoidDataList(updateList);
            }
        };

        return socket;
    }

    const trendColor = (value: string) => {
        return ["1", "2"].includes(value) ? 'up' : ["4", "5"].includes(value) ? 'down' : 'neutral';
    }

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                추천 목록
            </Typography>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{ mb: (theme) => theme.spacing(2) }}
            >
                <Typography component="h2" variant="h6">
                    매수 리포트
                </Typography>
                <Box sx={{ width: '100%' }}>
                    <Grid
                        container
                        spacing={2}
                        columns={12}
                        sx={{ mt: 1, mb: (theme) => theme.spacing(2) }}
                    >
                        { loading ? (
                            Array.from({length: 4}).map((_, index) => (
                                <Grid key={index} size={{ xs: 12, md: 6 }}>
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
                                <Grid key={index} size={{ xs: 12, md: 6 }}>
                                    <RecommendCard {...data} />
                                </Grid>
                            )) : <p>매수 추천 종목 없음</p>
                        }
                    </Grid>
                </Box>
                <Typography component="h2" variant="h6">
                    매도 리포트
                </Typography>
                <Box sx={{ width: '100%' }}>
                    <Grid
                        container
                        spacing={2}
                        columns={12}
                        sx={{ mt: 1, mb: (theme) => theme.spacing(2) }}
                    >
                        { loading ? (
                            Array.from({length: 4}).map((_, index) => (
                                <Grid key={index} size={{ xs: 12, md: 6 }}>
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
                                <Grid key={index} size={{ xs: 12, md: 6 }}>
                                    <RecommendCard {...data} />
                                </Grid>
                            )) : <p>매도 추천 종목 없음</p>
                        }
                    </Grid>
                </Box>
            </Grid>
        </Box>
    )
}

export default RecommendList;
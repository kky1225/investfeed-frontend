import {Box} from "@mui/material";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import {useEffect, useRef, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import * as React from "react";
import {SectListItem, SectListReq, SectListStream, SectListStreamReq, SectListStreamRes} from "../../type/SectType.ts";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {fetchSectList, fetchSectListStream} from "../../api/sect/SectApi.ts";
import SectCard, {SectCardProps} from "../../components/SectCard.tsx";
import {fetchRecommendList} from "../../api/recommend/RecommendApi.ts";
import {RecommendListItem} from "../../type/RecommendType.ts";
import RecommendCard from "../../components/RecommendCard.tsx";

const RecommendList = () => {
    const [recommendDataList, setRecommendDataList] = useState<SectCardProps[]>([]);
    const [avoidDataList, setAvoidDataList] = useState<SectCardProps[]>([]);

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    useEffect(() => {
        let chartTimeout: ReturnType<typeof setTimeout>;
        let socketTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        (async () => {
            const items = await recommendList();
            const sectListStreamReq: SectListStreamReq = {
                items: items
            }

            const marketInfo = await timeNow();

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            if(marketInfo.isMarketOpen) {
                // await sectListStream(sectListStreamReq);
                // socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    // socket?.close();

                    const again = await timeNow();
                    if (again.isMarketOpen) {
                        // await sectListStream(sectListStreamReq);
                        // socket = openSocket();
                    }
                }, marketTimer.current + 200);
            }

            chartTimeout = setTimeout(() => {
                recommendList();
                interval = setInterval(() => {
                    recommendList();
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

    const recommendList = async () => {
        try {
            const data = await fetchRecommendList();

            console.log(data);

            const { recommendList, avoidList } = data.result;

            const newRecommendDataList: SectCardProps[] = recommendList.map((recommend: RecommendListItem) => {
                return {
                    id: recommend.stkCd,
                    title: recommend.stkNm,
                    value: recommend.curPrc.replace(/^[+-]/, ''),
                    fluRt: recommend.fluRt,
                    trend: trendColor(recommend.preSig)
                }
            });

            const newAvoidDataList: SectCardProps[] = avoidList.map((recommend: RecommendListItem) => {
                return {
                    id: recommend.stkCd,
                    title: recommend.stkNm,
                    value: recommend.curPrc.replace(/^[+-]/, ''),
                    fluRt: recommend.fluRt,
                    trend: trendColor(recommend.preSig)
                }
            });

            setAvoidDataList(newAvoidDataList);
            setRecommendDataList(newRecommendDataList);

            return recommendList.map((row: RecommendListItem) => {
                return row.stkCd;
            });
        } catch (error) {
            console.error(error);
        }
    }

    const sectListStream = async (req: SectListStreamReq) => {
        try {
            const data = await fetchSectListStream(req);

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

        // socket.onmessage = (event) => {
        //     const data = JSON.parse(event.data);
        //
        //     if (data.trnm === "REAL" && Array.isArray(data.data)) {
        //         const sectList = data.data.map((entry: SectListStreamRes) => {
        //             const values = entry.values;
        //             return {
        //                 code: entry.item, // ex: "001"
        //                 value: values["10"], // 현재가
        //                 change: values["11"], // 전일 대비
        //                 fluRt: values["12"],   // 등락률
        //                 trend: values["25"],   // 등락기호
        //             };
        //         });
        //
        //         setSectDataList((prevList) => {
        //             return prevList.map((item) => {
        //                 const newData = sectList.find((data: SectListStream) => data.code === item.id);
        //
        //                 if (newData) {
        //                     return {
        //                         ...item,
        //                         value: newData.value.replace(/^[+-]/, ''),
        //                         fluRt: newData.fluRt,
        //                         trend: trendColor(newData.trend),
        //                     };
        //                 }
        //
        //                 return item;
        //             });
        //         });
        //     }
        // };

        return socket;
    }

    const trendColor = (value: string) => {
        return ["1", "2"].includes(value) ? 'up' : ["4", "5"].includes(value) ? 'down' : 'neutral';
    }

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                업종 목록
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
                        {
                            recommendDataList.map((data: SectCardProps, index: number) => (
                                <Grid key={index} size={{ xs: 12, md: 6 }}>
                                    <RecommendCard {...data} />
                                </Grid>
                            ))
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
                        {
                            avoidDataList.map((data: SectCardProps, index: number) => (
                                <Grid key={index} size={{ xs: 12, md: 6 }}>
                                    <RecommendCard {...data} />
                                </Grid>
                            ))
                        }
                    </Grid>
                </Box>
            </Grid>
        </Box>
    )
}

export default RecommendList;
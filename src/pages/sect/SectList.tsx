import {Box, Tab, Tabs} from "@mui/material";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import {useEffect, useMemo, useRef, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import * as React from "react";
import {SectListItem, SectListReq, SectListRes, SectListStream, SectListStreamReq, SectListStreamRes} from "../../type/SectType.ts";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {fetchSectList, fetchSectListStream} from "../../api/sect/SectApi.ts";
import SectCard, {SectCardProps} from "../../components/SectCard.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {usePollingQuery} from "../../lib/pollingQuery.ts";

interface LiveSectUpdate {
    value: string;
    fluRt: string;
    trend: 'up' | 'down' | 'neutral';
}

const trendColor = (value: string): 'up' | 'down' | 'neutral' =>
    ["1", "2"].includes(value) ? 'up' : ["4", "5"].includes(value) ? 'down' : 'neutral';

const SectList = () => {
    const navigate = useNavigate();
    const {indsCd} = useParams();

    const req: SectListReq = useMemo(() => ({indsCd: indsCd || "001"}), [indsCd]);
    const [value, setValue] = useState(indsCd === "001" ? 0 : 1);
    const [liveOverlay, setLiveOverlay] = useState<Map<string, LiveSectUpdate>>(new Map());

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);
    const subscribedKeyRef = useRef<string>('');

    const {data: result, isLoading, lastUpdated, pollError} = usePollingQuery<SectListRes>(
        ['sectList', req.indsCd],
        (config) => fetchSectList(req, config),
    );

    // 키움 ka20003 응답에 시각 필드가 없어 stamp 비교 불가. 폴링 도착 시 WS overlay 를
    // 비워서 stale 가격이 새 폴링 결과를 덮어쓰지 못하게 한다.
    useEffect(() => {
        if (!result) return;
        setLiveOverlay(new Map());
    }, [result]);

    const sectDataList: SectCardProps[] = useMemo(() => {
        if (!result) return [];
        const list: SectListItem[] = result.sectList ?? [];
        return list.map((sect: SectListItem) => {
            const live = liveOverlay.get(sect.stkCd);
            return {
                id: sect.stkCd,
                title: sect.stkNm,
                value: live?.value ?? sect.curPrc.replace(/^[+-]/, ''),
                fluRt: live?.fluRt ?? sect.fluRt,
                trend: live?.trend ?? trendColor(sect.preSig),
            };
        });
    }, [result, liveOverlay]);

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

    const sectListStream = async (req: SectListStreamReq) => {
        try {
            const data = await fetchSectListStream(req);
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
                const updates = data.data.map((entry: SectListStreamRes): SectListStream => {
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
                    updates.forEach((u: SectListStream) => {
                        next.set(u.code, {
                            value: u.value.replace(/^[+-]/, ''),
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

    // WebSocket 라이프사이클 — sectList 결과의 stkCd 들로 stream 등록.
    useEffect(() => {
        if (!result) return;
        const items = (result.sectList ?? []).map((s: SectListItem) => s.stkCd);
        if (items.length === 0) return;

        const key = `${req.indsCd}|${items.join(',')}`;
        if (subscribedKeyRef.current === key) return;
        subscribedKeyRef.current = key;

        // indsCd 가 변하면 overlay reset (이전 인덱스 stream 데이터가 새 탭 데이터에 섞이지 않도록)
        setLiveOverlay(new Map());

        let socketTimeout: ReturnType<typeof setTimeout>;
        let socket: WebSocket | undefined;

        (async () => {
            const marketInfo = await timeNow();

            if (marketInfo?.isMarketOpen) {
                await sectListStream({items});
                socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();
                    const again = await timeNow();
                    if (again?.isMarketOpen) {
                        await sectListStream({items});
                        socket = openSocket();
                    }
                }, marketTimer.current + 200);
            }
        })();

        return () => {
            socket?.close();
            clearTimeout(socketTimeout);
        };
    }, [result, req.indsCd]);

    const handleChange = (_event: React.SyntheticEvent, index: number) => {
        const newValue = index === 1 ? "101" : "001";
        setValue(index);
        navigate(`/stock/sect/list/${newValue}`);
    };

    function a11yProps(indsCd: string) {
        return {
            id: `simple-tab-${indsCd}`,
            'aria-controls': `simple-tabpanel-${indsCd}`,
        };
    }

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', mb: 2, gap: 2}}>
                <Typography component="h2" variant="h6">
                    업종 목록
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
                <Box sx={{width: '100%'}}>
                    <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                        <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
                            <Tab label="종합(KOSPI)" {...a11yProps("001")} />
                            <Tab label="종합(KOSDAQ)" {...a11yProps("101")} />
                        </Tabs>
                    </Box>
                    <Grid
                        container
                        spacing={2}
                        columns={12}
                        sx={{mt: 1, mb: (theme) => theme.spacing(2)}}
                    >
                        {loading ? (
                            Array.from({length: 8}).map((_, index) => (
                                <Grid key={index} size={{xs: 12, md: 6, lg: 3}}>
                                    <Card variant="outlined" sx={{width: '100%'}}>
                                        <CardContent>
                                            <Skeleton width={120} height={24}/>
                                            <Stack direction="row" spacing={1} sx={{alignItems: 'center', mt: 1}}>
                                                <Skeleton width={100} height={40}/>
                                                <Skeleton variant="rounded" width={60} height={24}/>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            ))
                        ) : (
                            sectDataList.map((data: SectCardProps, index: number) => (
                                <Grid key={index} size={{xs: 12, md: 6, lg: 3}}>
                                    <SectCard {...data} />
                                </Grid>
                            ))
                        )}
                    </Grid>
                </Box>
            </Grid>
        </Box>
    );
};

export default SectList;

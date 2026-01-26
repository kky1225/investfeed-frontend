import {Box, Tab, Tabs} from "@mui/material";
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

const SectList = () => {
    const navigate = useNavigate();
    const { indsCd } = useParams();

    const [req, setReq] = useState<SectListReq>({
        indsCd: indsCd || "001",
    });
    const [value, setValue] = useState(indsCd === "001" ? 0 : 1);
    const [sectDataList, setSectDataList] = useState<SectCardProps[]>([]);

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    useEffect(() => {
        let chartTimeout: ReturnType<typeof setTimeout>;
        let socketTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        (async () => {
            const items = await sectList(req);
            const sectListStreamReq: SectListStreamReq = {
                items: items
            }

            const marketInfo = await timeNow();

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            if(marketInfo.isMarketOpen) {
                await sectListStream(sectListStreamReq);
                socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();

                    const again = await timeNow();
                    if (again.isMarketOpen) {
                        await sectListStream(sectListStreamReq);
                        socket = openSocket();
                    }
                }, marketTimer.current + 200);
            }

            chartTimeout = setTimeout(() => {
                sectList(req);
                interval = setInterval(() => {
                    sectList(req);
                }, (60 * 1000));
            }, waitTime + 200);
        })();

        return () => {
            socket?.close();
            clearInterval(socketTimeout);
            clearTimeout(chartTimeout);
            clearInterval(interval);
        }
    }, [req]);

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

    const sectList = async (req: SectListReq) => {
        try {
            const data = await fetchSectList(req);

            console.log(data);

            const { sectList } = data.result;

            const newIndexDataList: SectCardProps[] = sectList.map((sect: SectListItem) => {
                return {
                    id: sect.stkCd,
                    title: sect.stkNm,
                    value: sect.curPrc.replace(/^[+-]/, ''),
                    fluRt: sect.fluRt,
                    trend: trendColor(sect.preSig)
                }
            });

            setSectDataList(newIndexDataList);

            return sectList.map((row: SectListItem) => {
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

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.trnm === "REAL" && Array.isArray(data.data)) {
                const sectList = data.data.map((entry: SectListStreamRes) => {
                    const values = entry.values;
                    return {
                        code: entry.item, // ex: "001"
                        value: values["10"], // 현재가
                        change: values["11"], // 전일 대비
                        fluRt: values["12"],   // 등락률
                        trend: values["25"],   // 등락기호
                    };
                });

                setSectDataList((prevList) => {
                    return prevList.map((item) => {
                        const newData = sectList.find((data: SectListStream) => data.code === item.id);

                        if (newData) {
                            return {
                                ...item,
                                value: newData.value.replace(/^[+-]/, ''),
                                fluRt: newData.fluRt,
                                trend: trendColor(newData.trend),
                            };
                        }

                        return item;
                    });
                });
            }
        };

        return socket;
    }

    const trendColor = (value: string) => {
        return ["1", "2"].includes(value) ? 'up' : ["4", "5"].includes(value) ? 'down' : 'neutral';
    }

    const handleChange = (_event: React.SyntheticEvent, index: number) => {
        let newValue = "001";

        if (index === 1) {
            newValue = "101";
        }

        setValue(index);
        setReq({indsCd: newValue});
        navigate(`/sect/list/${newValue}`);
    };

    function a11yProps(indsCd: string) {
        return {
            id: `simple-tab-${indsCd}`,
            'aria-controls': `simple-tabpanel-${indsCd}`,
        };
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
                <Box sx={{ width: '100%' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
                            <Tab label="종합(KOSPI)" {...a11yProps("001")} />
                            <Tab label="종합(KOSDAQ)" {...a11yProps("101")} />
                        </Tabs>
                    </Box>
                    <Grid
                        container
                        spacing={2}
                        columns={12}
                        sx={{ mt: 1, mb: (theme) => theme.spacing(2) }}
                    >
                        {
                            sectDataList.map((data: SectCardProps, index: number) => (
                                <Grid key={index} size={{ xs: 12, md: 3 }}>
                                    <SectCard {...data} />
                                </Grid>
                            ))
                        }
                    </Grid>
                </Box>
            </Grid>
        </Box>
    )
}

export default SectList;
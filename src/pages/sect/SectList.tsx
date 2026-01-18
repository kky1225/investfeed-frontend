import {Box, Tab, Tabs} from "@mui/material";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import {useEffect, useRef, useState} from "react";
import {useNavigate, useParams} from "react-router-dom";
import * as React from "react";
import {SectListItem, SectListReq} from "../../type/SectType.ts";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {fetchSectList} from "../../api/sect/SectApi.ts";
import SectCard, {SectCardProps} from "../../components/SectCard.tsx";

const SectList = () => {
    const navigate = useNavigate();
    const { indsCd } = useParams();

    const [req, setReq] = useState<SectListReq>({
        indsCd: indsCd || "001",
    });
    const [value, setValue] = useState(0);
    const [sectDataList, setSectDataList] = useState<SectCardProps[]>([]);

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    useEffect(() => {
        sectList(req);

        let chartTimeout: ReturnType<typeof setTimeout>;
        let socketTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        (async () => {
            const marketInfo = await timeNow();

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            if(marketInfo.isMarketOpen) {
                // await indexListStream();
                // socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();

                    const again = await timeNow();
                    if (again.isMarketOpen) {
                        // await indexListStream();
                        // socket = openSocket();
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
                    trend: sect.preSig === '5' ? 'down' : sect.preSig === '2' ? 'up' : 'neutral'
                }
            });

            setSectDataList(newIndexDataList);
        } catch (error) {
            console.error(error);
        }
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
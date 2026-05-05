import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import StockTable from "../../components/StockTable.tsx";
import * as React from "react";
import {useEffect, useMemo, useRef, useState} from "react";
import {Tab, Tabs} from "@mui/material";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {StockGridRow, StockStream, StockStreamRes} from "../../type/StockType.ts";
import {useNavigate, useParams} from "react-router-dom";
import {InvestorListItem, InvestorListReq, InvestorListRes, InvestorStreamReq} from "../../type/InvestorType.ts";
import {fetchInvestorList, fetchInvestorStream} from "../../api/investor/InvestorApi.ts";
import {renderChip, renderTradePricaColor} from "../../components/CustomRender.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {usePollingQuery} from "../../lib/pollingQuery.ts";

interface LiveInvestorUpdate {
    curPrc: string;
    fluRt: string;
    trend: string;
}

const InvestorList = () => {
    const navigate = useNavigate();
    const {orgnTp, trdeTp} = useParams();

    const [req, setReq] = useState<InvestorListReq>({
        trdeTp: trdeTp || "1",
        orgnTp: orgnTp || "6",
    });

    const [value, setValue] = useState(orgnTp === "6" ? 0 : 1);
    const [tradeValue, setTradeValue] = useState(trdeTp === "1" ? 0 : 1);

    const [liveOverlay, setLiveOverlay] = useState<Map<string, LiveInvestorUpdate>>(new Map());
    const stockBufferMap = useRef<Map<string, StockStream>>(new Map());
    const subscribedKeyRef = useRef<string>('');

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    const {data: result, isLoading, lastUpdated, pollError} = usePollingQuery<InvestorListRes>(
        ['investorList', req.orgnTp, req.trdeTp],
        (config) => fetchInvestorList(req, config),
    );

    const row: StockGridRow[] = useMemo(() => {
        if (!result) return [];
        const list: InvestorListItem[] = result.investorList ?? [];
        return list.map((investor, index) => {
            const live = liveOverlay.get(investor.stkCd);
            return {
                id: investor.stkCd,
                rank: index + 1,
                stkNm: investor.stkNm,
                fluRt: live?.fluRt ?? investor.fluRt,
                curPrc: live?.curPrc ?? investor.curPrc,
                netprpsAmt: investor.netprpsAmt,
                trend: live?.trend,
            } as StockGridRow;
        });
    }, [result, liveOverlay]);

    const loading = isLoading;

    const columns = [
        {
            field: 'rank',
            headerName: '순위',
            flex: 1,
            minWidth: 80,
            maxWidth: 80
        },
        {
            field: 'stkNm',
            headerName: '주식 이름',
            flex: 1.5,
            minWidth: 180
        },
        {
            field: 'fluRt',
            headerName: '등락률',
            flex: 0.5,
            minWidth: 100,
            renderCell: (params: {value: number}) => renderChip(params.value as number),
        },
        {
            field: 'curPrc',
            headerName: '현재가',
            flex: 1,
            minWidth: 100,
            valueFormatter: (value: string) => Number(value).toLocaleString(),
        },
        {
            field: 'netprpsAmt',
            headerName: '거래대금',
            flex: 0.5,
            minWidth: 120,
            renderCell: (params: {value: string}) => renderTradePricaColor(params.value as string),
        }
    ];

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

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.trnm === "REAL" && Array.isArray(data.data)) {
                data.data.forEach((entry: StockStreamRes) => {
                    const values = entry.values;
                    stockBufferMap.current.set(entry.item, {
                        code: entry.item,
                        value: String(values["10"]).replace(/^[+-]/, ''),
                        fluRt: String(values["12"]),
                        predPre: String(values["11"]),
                        trend: String(values["25"]),
                    });
                });
            }
        };
        return socket;
    };

    // WebSocket 라이프사이클 — query 결과 stkCd 들로 stream 등록.
    useEffect(() => {
        if (!result) return;
        const items = (result.investorList ?? []).map((s: InvestorListItem) => s.stkCd);
        if (items.length === 0) return;

        const key = `${req.orgnTp}|${req.trdeTp}|${items.join(',')}`;
        if (subscribedKeyRef.current === key) return;
        subscribedKeyRef.current = key;

        // req 변경 시 overlay reset
        setLiveOverlay(new Map());

        let socketTimeout: ReturnType<typeof setTimeout>;
        let displayInterval: ReturnType<typeof setInterval>;
        let socket: WebSocket | undefined;

        const startDisplayLoop = () => {
            displayInterval = setInterval(() => {
                if (stockBufferMap.current.size === 0) return;
                setLiveOverlay((prev) => {
                    const next = new Map(prev);
                    stockBufferMap.current.forEach((v, k) => {
                        next.set(k, {
                            curPrc: v.value,
                            fluRt: v.fluRt,
                            trend: v.trend,
                        });
                    });
                    return next;
                });
                stockBufferMap.current.clear();
            }, 500);
        };

        const connectSocket = async (req: InvestorStreamReq) => {
            const data = await fetchInvestorStream(req);
            if (data.code !== "0000") throw new Error(data.message || `투자자 스트림 실패 (${data.code})`);
            socket = openSocket();
            startDisplayLoop();
        };

        (async () => {
            const marketInfo = await timeNow();
            if (marketInfo?.isMarketOpen) {
                await connectSocket({items});
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();
                    const again = await timeNow();
                    if (again?.isMarketOpen) {
                        await connectSocket({items});
                    }
                }, marketTimer.current + 200);
            }
        })();

        return () => {
            socket?.close();
            clearTimeout(socketTimeout);
            clearInterval(displayInterval);
        };
    }, [result, req.orgnTp, req.trdeTp]);

    const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
        const newOrgnTp = newValue === 0 ? "6" : "7";
        setReq({trdeTp: req.trdeTp, orgnTp: newOrgnTp});
        setValue(newValue);
        navigate(`/stock/investor/${newOrgnTp}/list/${req.trdeTp}`);
    };

    const handleChangeInvestor = (_event: React.SyntheticEvent, newValue: number) => {
        const newTrdeTp = newValue === 0 ? "1" : "2";
        setReq({trdeTp: newTrdeTp, orgnTp: req.orgnTp});
        setTradeValue(newValue);
        navigate(`/stock/investor/${req.orgnTp}/list/${newTrdeTp}`);
    };

    function a11yProps(index: number) {
        return {
            id: `simple-tab-${index}`,
            'aria-controls': `simple-tabpanel-${index}`,
        };
    }

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', mb: 2, gap: 2}}>
                <Typography component="h2" variant="h6">
                    투자자별 목록
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
                            <Tab label="외국인" {...a11yProps(0)} />
                            <Tab label="기관" {...a11yProps(1)} />
                        </Tabs>
                        <Tabs value={tradeValue} onChange={handleChangeInvestor} aria-label="basic tabs example">
                            <Tab label="순매수" {...a11yProps(0)} />
                            <Tab label="순매도" {...a11yProps(1)} />
                        </Tabs>
                    </Box>
                    <StockTable rows={row} columns={columns} pageSize={100} loading={loading}/>
                </Box>
            </Grid>
        </Box>
    );
};

export default InvestorList;

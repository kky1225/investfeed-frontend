import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import {GridColDef} from "@mui/x-data-grid";
import StockTable from "../../components/StockTable.tsx";
import * as React from "react";
import {useEffect, useMemo, useRef, useState} from "react";
import {fetchRankList, fetchRankStream} from "../../api/rank/RankApi.ts";
import {Tab, Tabs} from "@mui/material";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {
    StockGridRow,
    StockStream,
    StockStreamReq,
    StockStreamRes
} from "../../type/StockType.ts";
import {RankListItem, RankListReq, RankListRes} from "../../type/RankType.ts";
import {useNavigate, useParams} from "react-router-dom";
import {renderChip} from "../../components/CustomRender.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {usePollingQuery} from "../../lib/pollingQuery.ts";

interface LiveRankUpdate {
    curPrc: string;
    fluRt: string;
    trend: string;
}

const buildColumns = (type: string): GridColDef[] => {
    const base: GridColDef[] = [
        {field: 'rank', headerName: '순위', flex: 1, minWidth: 80, maxWidth: 80},
        {field: 'stkNm', headerName: '주식 이름', flex: 1.5, minWidth: 180},
        {
            field: 'fluRt',
            headerName: '등락률',
            flex: 0.5,
            minWidth: 100,
            renderCell: (params) => renderChip(params.value as number),
        },
        {
            field: 'curPrc',
            headerName: '현재가',
            flex: 1,
            minWidth: 100,
            valueFormatter: (param: number) => Number(param).toLocaleString().replace(/^[+-]/, ''),
        },
    ];

    switch (type) {
        case "0":
            return [
                ...base,
                {
                    field: 'trdePrica',
                    headerName: '거래대금 (백만)',
                    flex: 1,
                    minWidth: 150,
                    valueFormatter: (param: number) => Number(param).toLocaleString().replace(/^[+-]/, ''),
                },
            ];
        case "1":
            return [
                ...base,
                {
                    field: 'trdePrica',
                    headerName: '거래량',
                    flex: 1,
                    minWidth: 120,
                    valueFormatter: (param: number) => Number(param).toLocaleString().replace(/^[+-]/, ''),
                },
            ];
        default:
            return [
                ...base,
                {
                    field: 'trdePrica',
                    headerName: '거래량 급증률',
                    flex: 1,
                    minWidth: 140,
                    valueFormatter: (param: string) => `${Number(param.replace(/^[+-]/, '')).toLocaleString()}%`,
                },
            ];
    }
};

const RankList = () => {
    const navigate = useNavigate();
    const {type} = useParams();

    const [req, setReq] = useState<RankListReq>({type: type || "0"});
    const [value, setValue] = useState(Number(type) || 0);

    const [liveOverlay, setLiveOverlay] = useState<Map<string, LiveRankUpdate>>(new Map());
    const stockBufferMap = useRef<Map<string, StockStream>>(new Map());
    const subscribedKeyRef = useRef<string>('');

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    const {data: result, isLoading, lastUpdated, pollError} = usePollingQuery<RankListRes>(
        ['rankList', req.type],
        (config) => fetchRankList(req, config),
    );

    // 키움 응답에 시각 필드가 없어 stamp 비교 불가. 폴링 도착 시 WS overlay 를
    // 비워서 stale 가격이 새 폴링 결과를 덮어쓰지 못하게 한다.
    useEffect(() => {
        if (!result) return;
        setLiveOverlay(new Map());
    }, [result]);

    const row: StockGridRow[] = useMemo(() => {
        if (!result) return [];
        const list: RankListItem[] = result.rankList ?? [];
        return list.map((stock) => {
            const live = liveOverlay.get(stock.stkCd);
            return {
                id: stock.stkCd,
                rank: stock.rank,
                stkNm: stock.stkNm,
                fluRt: live?.fluRt ?? stock.fluRt,
                curPrc: live?.curPrc ?? stock.curPrc,
                trdePrica: stock.trdePrica,
                trend: live?.trend,
            } as StockGridRow;
        });
    }, [result, liveOverlay]);

    const columns: GridColDef[] = useMemo(() => buildColumns(req.type), [req.type]);
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
        const items = (result.rankList ?? []).map((s: RankListItem) => s.stkCd);
        if (items.length === 0) return;

        const key = `${req.type}|${items.join(',')}`;
        if (subscribedKeyRef.current === key) return;
        subscribedKeyRef.current = key;

        // type 변경 시 overlay reset
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

        const connectSocket = async (req: StockStreamReq) => {
            await fetchRankStream(req);
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
    }, [result, req.type]);

    const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
        setValue(newValue);
        setReq({type: String(newValue)});
        navigate(`/stock/rank/list/${newValue}`);
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
                    순위 목록
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
                            <Tab label="거래대금 상위" {...a11yProps(0)} />
                            <Tab label="거래량 상위" {...a11yProps(1)} />
                            <Tab label="거래량 급증률 상위" {...a11yProps(2)} />
                        </Tabs>
                    </Box>
                    <StockTable rows={row} columns={columns} pageSize={100} loading={loading}/>
                </Box>
            </Grid>
        </Box>
    );
};

export default RankList;

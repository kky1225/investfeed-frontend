import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import {GridColDef} from "@mui/x-data-grid";
import Chip from "@mui/material/Chip";
import {useEffect, useMemo, useRef, useState} from "react";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {useParams} from "react-router-dom";
import {
    ThemeStockGridRow,
    ThemeStockListItem,
    ThemeStockListReq,
    ThemeStockListStream,
    ThemeStockListStreamReq,
    ThemeStockListStreamRes
} from "../../type/ThemeType.ts";
import {fetchThemeStockList, fetchThemeStockListStream} from "../../api/theme/ThemeApi.ts";
import ThemeStockTableProps from "../../components/ThemeStockTable.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {usePollingQuery} from "../../lib/pollingQuery.ts";

interface LiveThemeStockUpdate {
    curPrc: string;
    fluRt: string;
    trend: 'up' | 'down' | 'neutral';
}

const trendColor = (value: string): 'up' | 'down' | 'neutral' =>
    ["1", "2"].includes(value) ? 'up' : ["4", "5"].includes(value) ? 'down' : 'neutral';

const DEFAULT_REQ: ThemeStockListReq = {dateTp: "1"};

const ThemeStockList = () => {
    const {themaGrpCd} = useParams();
    const themeGrpCdParam = themaGrpCd || "100";

    const [liveOverlay, setLiveOverlay] = useState<Map<string, LiveThemeStockUpdate>>(new Map());
    const stockBufferMap = useRef<Map<string, ThemeStockListStream>>(new Map());
    const subscribedKeyRef = useRef<string>('');

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    const {data: res, isLoading, lastUpdated, pollError} = usePollingQuery(
        ['themeStockList', themeGrpCdParam, DEFAULT_REQ.dateTp],
        (config) => fetchThemeStockList(themeGrpCdParam, DEFAULT_REQ, config),
    );

    const row: ThemeStockGridRow[] = useMemo(() => {
        if (res?.code !== "0000" || !res.result) return [];
        const list: ThemeStockListItem[] = res.result.themeStockList ?? [];
        return list.map((themeStock) => {
            const live = liveOverlay.get(themeStock.stkCd);
            return {
                id: themeStock.stkCd,
                stkNm: themeStock.stkNm,
                curPrc: live?.curPrc ?? themeStock.curPrc.replace(/^[+-]/, ''),
                fluRt: live?.fluRt ?? themeStock.fluRt,
                accTrdeQty: themeStock.accTrdeQty,
                dtPrftRtN: themeStock.dtPrftRtN,
            };
        });
    }, [res, liveOverlay]);

    const loading = isLoading;

    const columns: GridColDef[] = [
        {
            field: 'index',
            headerName: '번호',
            flex: 1,
            minWidth: 80,
            maxWidth: 80,
            renderCell: (params) => {
                return params.api.getAllRowIds().indexOf(params.id) + 1;
            }
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
            renderCell: (params) => renderStatus(params.value as number),
        },
        {
            field: 'curPrc',
            headerName: '현재가',
            flex: 1,
            minWidth: 100,
            valueFormatter: (param: number) => {
                return Number(param).toLocaleString().replace(/^[+-]/, '')
            }
        },
        {
            field: 'dtPrftRtN',
            headerName: '기간 수익률',
            flex: 1,
            minWidth: 120,
            renderCell: (params) => renderStatus(params.value as number),
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
                data.data.forEach((entry: ThemeStockListStreamRes) => {
                    const values = entry.values as unknown as Record<string, string>;
                    stockBufferMap.current.set(entry.item, {
                        code: entry.item,
                        value: String(values["10"]).replace(/^[+-]/, ''),
                        fluRt: String(values["12"]),
                        trend: String(values["25"]),
                    });
                });
            }
        };
        return socket;
    };

    // WebSocket 라이프사이클 — query 결과 stkCd 들로 stream 등록.
    useEffect(() => {
        if (res?.code !== "0000" || !res.result) return;
        const items = (res.result.themeStockList ?? []).map((s: ThemeStockListItem) => s.stkCd);
        if (items.length === 0) return;

        const key = `${themeGrpCdParam}|${items.join(',')}`;
        if (subscribedKeyRef.current === key) return;
        subscribedKeyRef.current = key;

        // themaGrpCd 가 변하면 overlay reset
        setLiveOverlay(new Map());

        let socketTimeout: ReturnType<typeof setTimeout>;
        let displayInterval: ReturnType<typeof setInterval>;
        let socket: WebSocket | undefined;

        const startDisplayLoop = () => {
            // 500ms 단위로 buffer flush → liveOverlay 갱신 (렌더 빈도 조절)
            displayInterval = setInterval(() => {
                if (stockBufferMap.current.size === 0) return;
                setLiveOverlay((prev) => {
                    const next = new Map(prev);
                    stockBufferMap.current.forEach((v, k) => {
                        next.set(k, {
                            curPrc: v.value,
                            fluRt: v.fluRt,
                            trend: trendColor(v.trend),
                        });
                    });
                    return next;
                });
                stockBufferMap.current.clear();
            }, 500);
        };

        const connectSocket = async (req: ThemeStockListStreamReq) => {
            const data = await fetchThemeStockListStream(req);
            if (data.code !== "0000") throw new Error(data.message || `테마 종목 스트림 실패 (${data.code})`);
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
    }, [res, themeGrpCdParam]);

    function renderStatus(status: number) {
        const colors = status == 0 ? 'default' : status > 0 ? 'error' : 'info';
        return <Chip label={status > 0 ? `${status}%` : `${status}%`} color={colors}/>;
    }

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', mb: 2, gap: 2}}>
                <Typography component="h2" variant="h6">
                    테마 주식 목록
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
                    <ThemeStockTableProps rows={row} columns={columns} pageSize={100} loading={loading}/>
                </Box>
            </Grid>
        </Box>
    );
};

export default ThemeStockList;

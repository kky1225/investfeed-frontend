import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import {GridColDef} from "@mui/x-data-grid";
import StockTable from "../../components/StockTable.tsx";
import * as React from "react";
import {useEffect, useRef, useState} from "react";
import {fetchStockStream} from "../../api/stock/StockApi.ts";
import {Tab, Tabs} from "@mui/material";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {
    StockGridRow,
    StockStream,
    StockStreamReq,
    StockStreamRes
} from "../../type/StockType.ts";
import {RankListReq, RankListItem} from "../../type/RankType.ts";
import {useNavigate, useParams} from "react-router-dom";
import {renderChip} from "../../components/CustomRender.tsx";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {fetchRankList} from "../../api/rank/RankApi.ts";

const RankList = () => {
    const navigate = useNavigate();
    const { type } = useParams();

    const [req, setReq] = useState<RankListReq>({
        type: type || "0",
    });

    const [value, setValue] = useState(Number(type) || 0);
    const [row, setRow] = useState<StockGridRow[]>([]);
    const [columns, setColumns] = useState<GridColDef[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [pollError, setPollError] = useState(false);

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    const stockBufferMap = useRef<Map<string, StockStream>>(new Map());

    useEffect(() => {
        let chartTimeout: ReturnType<typeof setTimeout>;
        let socketTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;
        let displayInterval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        setLoading(true);

        (async () => {
            const items = await stockList(req);
            const stockStreamReq: StockStreamReq = {
                items: items,
            }

            const updateDisplay = () => {
                if (displayInterval) {
                    return;
                }

                displayInterval = setInterval(() => {
                    if (stockBufferMap.current.size === 0) {
                        return;
                    }

                    setRow((oldRow) => {
                        const isUpdated = oldRow.some(item => stockBufferMap.current.has(item.id));
                        if (!isUpdated) {
                            return oldRow;
                        }

                        return oldRow.map((item) => {
                            const newRow = stockBufferMap.current.get(item.id);
                            if (newRow) {
                                return {
                                    ...item,
                                    curPrc: newRow.value,
                                    fluRt: newRow.fluRt,
                                    trend: newRow.trend,
                                };
                            }
                            return item;
                        });
                    });

                    stockBufferMap.current.clear();
                }, 500);
            }

            const connectSocket = async (req: StockStreamReq) => {
                await fetchStockStream(req);
                socket = openSocket();
                updateDisplay();
            };

            const marketInfo = await timeNow();

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            if (marketInfo.isMarketOpen) {
                await connectSocket(stockStreamReq);
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();

                    const again = await timeNow();
                    if (again.isMarketOpen) {
                        await connectSocket(stockStreamReq);
                    }
                }, marketTimer.current + 200);
            }

            chartTimeout = setTimeout(() => {
                stockList(req);
                interval = setInterval(() => {
                    stockList(req, true);
                }, (60 * 1000));
            }, waitTime + 200);
        })();

        return () => {
            socket?.close();
            clearInterval(socketTimeout);
            clearTimeout(chartTimeout);
            clearInterval(interval);
            clearInterval(displayInterval);
        }
    }, [req]);

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

    const stockList = async (req: RankListReq, silent: boolean = false) => {
        try {
            const data = await fetchRankList(req, silent ? { skipGlobalError: true } : undefined);

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }

            const { rankList } = data.result;

            const ranking = rankList.map((stock: RankListItem) => {
                return {
                    id: stock.stkCd,
                    rank: stock.rank,
                    stkNm: stock.stkNm,
                    fluRt: stock.fluRt,
                    curPrc: stock.curPrc,
                    trdePrica: stock.trdePrica,
                }
            });

            let col: GridColDef[];

            switch (req.type) {
                case "0": {
                    col = [
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
                            renderCell: (params) => renderChip(params.value as number),
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
                            field: 'trdePrica',
                            headerName: '거래대금 (백만)',
                            flex: 1,
                            minWidth: 150,
                            valueFormatter: (param: number) => {
                                return Number(param).toLocaleString().replace(/^[+-]/, '')
                            }
                        }
                    ];

                    break;
                }
                case "1": {
                    col = [
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
                            renderCell: (params) => renderChip(params.value as number),
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
                            field: 'trdePrica',
                            headerName: '거래량',
                            flex: 1,
                            minWidth: 120,
                            valueFormatter: (param: number) => {
                                return Number(param).toLocaleString().replace(/^[+-]/, '')
                            }
                        }
                    ];

                    break;
                }
                default: {
                    col = [
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
                            renderCell: (params) => renderChip(params.value as number),
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
                            field: 'trdePrica',
                            headerName: '거래량 급증률',
                            flex: 1,
                            minWidth: 140,
                            valueFormatter: (param: string) => {
                                return `${Number(param.replace(/^[+-]/, '')).toLocaleString()}%`
                            }
                        }
                    ];

                    break;
                }
            }

            setColumns(col);
            setRow(ranking);
            setLastUpdated(new Date());
            setPollError(false);

            return rankList.map((row: RankListItem) => {
                return row.stkCd
            });
        } catch (error) {
            console.error(error);
            if (silent) setPollError(true);
        } finally {
            setLoading(false);
        }
    }

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.trnm === "REAL" && Array.isArray(data.data)) {
                data.data.forEach((res: StockStreamRes) => {
                    const values = res.values;

                    stockBufferMap.current.set(res.item, {
                        code: res.item,
                        value: String(values["10"]).replace(/^[+-]/, ''),
                        fluRt: String(values["12"]),
                        predPre: String(values["11"]),
                        trend: String(values["25"])
                    });
                });
            }
        };

        return socket;
    }

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
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                <Typography component="h2" variant="h6">
                    순위 목록
                </Typography>
                <Box sx={{ flex: 1 }}/>
                <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>
            </Box>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{ mb: (theme) => theme.spacing(2) }}
            >
                <Box sx={{ width: '100%' }}>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
                            <Tab label="거래대금 상위" {...a11yProps(0)} />
                            <Tab label="거래량 상위" {...a11yProps(1)} />
                            <Tab label="거래량 급증률 상위" {...a11yProps(2)} />
                        </Tabs>
                    </Box>
                    <StockTable rows={row} columns={columns} pageSize={100} loading={loading} />
                </Box>
            </Grid>
        </Box>
    )
}

export default RankList
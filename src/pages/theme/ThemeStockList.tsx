import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import {GridColDef} from "@mui/x-data-grid";
import Chip from "@mui/material/Chip";
import {useEffect, useRef, useState} from "react";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {useParams} from "react-router-dom";
import {
    SectStockListStreamReq, SectStockListStreamRes
} from "../../type/SectType.ts";
import {
    ThemeStockGridRow,
    ThemeStockListItem,
    ThemeStockListReq,
    ThemeStockListStream,
    ThemeStockListStreamReq
} from "../../type/ThemeType.ts";
import {fetchThemeStockList, fetchThemeStockListStream} from "../../api/theme/ThemeApi.ts";
import ThemeStockTableProps from "../../components/ThemeStockTable.tsx";

const ThemeStockList = () => {
    const { themaGrpCd } = useParams();

    const [req] = useState<ThemeStockListReq>({
        dateTp: "1",
        themaGrpCd: themaGrpCd || "100"
    });

    const [row, setRow] = useState<ThemeStockGridRow[]>([]);
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
            minWidth: 100,
            renderCell: (params) => renderStatus(params.value as number),
        }
    ]

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    const stockBufferMap = useRef<Map<string, ThemeStockListStream>>(new Map());

    useEffect(() => {
        let chartTimeout: ReturnType<typeof setTimeout>;
        let socketTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;
        let displayInterval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        (async () => {
            const items = await themeStockList(req);
            const themeStockListStreamReq: ThemeStockListStreamReq = {
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
                                    trend: trendColor(newRow.trend),
                                };
                            }
                            return item;
                        });
                    });

                    stockBufferMap.current.clear();
                }, 500);
            }

            const connectSocket = async (req: SectStockListStreamReq) => {
                await fetchThemeStockListStream(req);
                socket = openSocket();
                updateDisplay();
            };

            const marketInfo = await timeNow();

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            if (marketInfo.isMarketOpen) {
                await connectSocket(themeStockListStreamReq);
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();

                    const again = await timeNow();
                    if (again.isMarketOpen) {
                        await connectSocket(themeStockListStreamReq);
                    }
                }, marketTimer.current + 200);
            }

            chartTimeout = setTimeout(() => {
                themeStockList(req);
                interval = setInterval(() => {
                    themeStockList(req);
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

    const themeStockList = async (req: ThemeStockListReq) => {
        try {
            const data = await fetchThemeStockList(req);

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }

            console.log(data);

            const { themeStockList } = data.result;

            const newThemeStockList: ThemeStockGridRow[] = themeStockList.map((themeStock: ThemeStockListItem) => {
                return {
                    id: themeStock.stkCd,
                    stkNm: themeStock.stkNm,
                    curPrc: themeStock.curPrc.replace(/^[+-]/, ''),
                    fluRt: themeStock.fluRt,
                    accTrdeQty: themeStock.accTrdeQty,
                    dtPrftRtN: themeStock.dtPrftRtN,
                }
            })

            setRow(newThemeStockList);

            return themeStockList.map((row: ThemeStockListItem) => {
                return row.stkCd
            });
        } catch (error) {
            console.log(error);
        }
    }

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.trnm === "REAL" && Array.isArray(data.data)) {
                data.data.forEach((res: SectStockListStreamRes) => {
                    const values = res.values;

                    stockBufferMap.current.set(res.item, {
                        code: res.item,
                        value: String(values["10"]).replace(/^[+-]/, ''),
                        fluRt: String(values["12"]),
                        trend: String(values["25"])
                    });
                });
            }
        };

        return socket;
    }

    const trendColor = (value: string) => {
        return ["1", "2"].includes(value) ? 'up' : ["4", "5"].includes(value) ? 'down' : 'neutral';
    }

    function renderStatus(status: number) {
        const colors = status == 0 ? 'default' : status > 0 ? 'error': 'info';

        return <Chip label={status > 0 ? `${status}%` : `${status}%`} color={colors} />;
    }

    return (
        <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
                주식 목록
            </Typography>
            <Grid
                container
                spacing={2}
                columns={12}
                sx={{ mb: (theme) => theme.spacing(2) }}
            >
                <Box sx={{ width: '100%' }}>
                    <ThemeStockTableProps rows={row} columns={columns} pageSize={100} />
                </Box>
            </Grid>
        </Box>
    )
}

export default ThemeStockList
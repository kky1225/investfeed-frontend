import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import {GridColDef, GridRowsProp} from "@mui/x-data-grid";
import StockTable from "../../components/StockTable.tsx";
import Chip from "@mui/material/Chip";
import {useEffect, useRef, useState} from "react";
import {fetchStockList} from "../../api/stock/StockApi.ts";
import {Tab, Tabs } from "@mui/material";
import * as React from "react";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {StockListReq} from "../../type/StockType.ts";

const StockList = () => {
    const [req, setReq] = useState<StockListReq>({
        type: "0",
    });

    const [value, setValue] = useState(0);
    const [row, setRow] = useState<GridRowsProp[]>([]);
    const [columns, setColumns] = useState<GridColDef[]>([]);

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    useEffect(() => {
        stockList(req);

        let chartTimeout: ReturnType<typeof setTimeout>;
        let socketTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        (async () => {
            const marketInfo = await timeNow();

            const now = Date.now() + chartTimer.current;
            const waitTime = 60_000 - (now % 60_000);

            if (marketInfo.isMarketOpen) {
                // await indexDetailStream(req);
                // socket = openSocket();
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();

                    const again = await timeNow();
                    if (again.isMarketOpen) {
                        // await indexDetailStream(req);
                        // socket = openSocket();
                    }
                }, marketTimer.current + 200);
            }

            chartTimeout = setTimeout(() => {
                stockList();
                interval = setInterval(() => {
                    stockList();
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

    const stockList = async (req: StockListReq) => {
        try {
            const data = await fetchStockList(req);

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }

            console.log(data);

            const { stockList } = data.result;

            const ranking = stockList.map(item => {
                return {
                    id: item.stk_cd,
                    rank: item.rank,
                    stk_nm: item.stk_nm,
                    flu_rt: item.flu_rt,
                    cur_prc: item.cur_prc,
                    trde_prica: item.trde_prica,
                }
            });

            let col;

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
                            field: 'stk_nm',
                            headerName: '주식 이름',
                            flex: 1.5,
                            minWidth: 180
                        },
                        {
                            field: 'flu_rt',
                            headerName: '등락률',
                            flex: 0.5,
                            minWidth: 100,
                            renderCell: (params) => renderStatus(params.value as any),
                        },
                        {
                            field: 'cur_prc',
                            headerName: '현재가',
                            flex: 1,
                            minWidth: 100,
                            valueFormatter: (param: number) => {
                                return Number(param).toLocaleString().replace(/^[+-]/, '')
                            }
                        },
                        {
                            field: 'trde_prica',
                            headerName: '거래대금 (백만)',
                            flex: 1,
                            minWidth: 100,
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
                            field: 'stk_nm',
                            headerName: '주식 이름',
                            flex: 1.5,
                            minWidth: 180
                        },
                        {
                            field: 'flu_rt',
                            headerName: '등락률',
                            flex: 0.5,
                            minWidth: 100,
                            renderCell: (params) => renderStatus(params.value as any),
                        },
                        {
                            field: 'cur_prc',
                            headerName: '현재가',
                            flex: 1,
                            minWidth: 100,
                            valueFormatter: (param: number) => {
                                return Number(param).toLocaleString().replace(/^[+-]/, '')
                            }
                        },
                        {
                            field: 'trde_prica',
                            headerName: '거래량',
                            flex: 1,
                            minWidth: 100,
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
                            field: 'stk_nm',
                            headerName: '주식 이름',
                            flex: 1.5,
                            minWidth: 180
                        },
                        {
                            field: 'flu_rt',
                            headerName: '등락률',
                            flex: 0.5,
                            minWidth: 100,
                            renderCell: (params: string) => renderStatus(params.value as any),
                        },
                        {
                            field: 'cur_prc',
                            headerName: '현재가',
                            flex: 1,
                            minWidth: 100,
                            valueFormatter: (param: number) => {
                                return Number(param).toLocaleString().replace(/^[+-]/, '')
                            }
                        },
                        {
                            field: 'trde_prica',
                            headerName: '거래량 급증률',
                            flex: 1,
                            minWidth: 100,
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
        } catch (error) {
            console.log(error);
        }
    }

    function renderStatus(status: number) {
        const colors = status > 0 ? 'error' : 'info';

        return <Chip label={status > 0 ? `${status}%` : `${status}%`} color={colors} />;
    }

    // function renderStatus2(status: number) {
    //     const text = status.toLocaleString()
    //
    //     return (
    //         <span style={{color: status > 0 ? 'red' : 'blue'}}>
    //             {status > 0 ? `+${text}` : `${text}`}
    //         </span>
    //     )
    // }

    // const columns: GridColDef[] = [
    //     {
    //         field: 'rank',
    //         headerName: '순위',
    //         flex: 1,
    //         minWidth: 80,
    //         maxWidth: 80
    //     },
    //     {
    //         field: 'stk_nm',
    //         headerName: '주식 이름',
    //         flex: 1.5,
    //         minWidth: 180
    //     },
    //     {
    //         field: 'flu_rt',
    //         headerName: '등락률',
    //         flex: 0.5,
    //         minWidth: 100,
    //         renderCell: (params) => renderStatus(params.value as any),
    //     },
    //     {
    //         field: 'cur_prc',
    //         headerName: '현재가',
    //         flex: 1,
    //         minWidth: 100,
    //         valueFormatter: (param: number) => {
    //             return Number(param).toLocaleString().replace(/^[+-]/, '')
    //         }
    //     },
    //     {
    //         field: 'trde_prica',
    //         headerName: '거래대금 (백만)',
    //         flex: 1,
    //         minWidth: 100,
    //         valueFormatter: (param: number) => {
    //             return Number(param).toLocaleString().replace(/^[+-]/, '')
    //         }
    //     }
    // ];

    function CustomTabPanel(props: TabPanelProps) {
        const { children, value, index, ...other } = props;

        return (
            <div
                role="tabpanel"
                hidden={value !== index}
                id={`simple-tabpanel-${index}`}
                aria-labelledby={`simple-tab-${index}`}
                {...other}
            >
                {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
            </div>
        );
    }

    const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
        setValue(newValue);
        setReq({type: `${newValue}`});
    };

    interface TabPanelProps {
        children?: React.ReactNode;
        index: number;
        value: number;
    }

    function a11yProps(index: number) {
        return {
            id: `simple-tab-${index}`,
            'aria-controls': `simple-tabpanel-${index}`,
        };
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
                    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
                            <Tab label="거래대금 상위" {...a11yProps(0)} />
                            <Tab label="거래량 상위" {...a11yProps(1)} />
                            <Tab label="거래량 급증률 상위" {...a11yProps(2)} />
                        </Tabs>
                    </Box>
                    <CustomTabPanel value={value} index={0}>
                        <StockTable rows={row} columns={columns} />
                    </CustomTabPanel>
                    <CustomTabPanel value={value} index={1}>
                        <StockTable rows={row} columns={columns} />
                    </CustomTabPanel>
                    <CustomTabPanel value={value} index={2}>
                        <StockTable rows={row} columns={columns} />
                    </CustomTabPanel>
                </Box>
            </Grid>
        </Box>
    )
}

export default StockList
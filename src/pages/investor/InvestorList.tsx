import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import {GridColDef} from "@mui/x-data-grid";
import StockTable from "../../components/StockTable.tsx";
import Chip from "@mui/material/Chip";
import * as React from "react";
import {useEffect, useRef, useState} from "react";
import {fetchStockStream} from "../../api/stock/StockApi.ts";
import {Tab, Tabs} from "@mui/material";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {StockGridRow, StockStream, StockStreamReq, StockStreamRes} from "../../type/StockType.ts";
import {useNavigate, useParams} from "react-router-dom";
import {InvestorListItem, InvestorListReq} from "../../type/InvestorType.ts";
import {fetchInvestorList} from "../../api/investor/InvestorApi.ts";
import CustomChip from "../../components/CustomChip.tsx";

const InvestorList = () => {
    const navigate = useNavigate();
    const { orgnTp, trdeTp } = useParams();

    const [req, setReq] = useState<InvestorListReq>({
        trdeTp: trdeTp || "1",
        orgnTp: orgnTp || "6",
    });

    const [value, setValue] = useState(orgnTp === "6" ? 0 : 1);
    const [tradeValue, setTradeValue] = useState(trdeTp === "1" ? 0 : 1);
    const [row, setRow] = useState<StockGridRow[]>([]);

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
            renderCell: (params: {value: number}) => CustomChip(params.value as number),
        },
        {
            field: 'curPrc',
            headerName: '현재가',
            flex: 1,
            minWidth: 100,
            valueFormatter: (param: string) => {
                return Number(param).toLocaleString().replace(/^[+-]/, '')
            }
        },
        {
            field: 'netprpsAmt',
            headerName: '거래대금',
            flex: 0.5,
            minWidth: 100,
            valueFormatter: (param: string) => {
                //return `${(Number(param) / 10).toFixed(1).toLocaleString().replace(/^[+-]/, '')}억`
                return `${(Number(param.slice(0, -1)) / 10).toFixed(1)}억`
            }
        }
    ];

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);

    const stockBufferMap = useRef<Map<string, StockStream>>(new Map());

    useEffect(() => {
        let chartTimeout: ReturnType<typeof setTimeout>;
        let socketTimeout: ReturnType<typeof setTimeout>;
        let interval: ReturnType<typeof setInterval>;
        let displayInterval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        (async () => {
            const items = await investorList(req);
            // const stockStreamReq: StockStreamReq = {
            //     items: items,
            // }

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
                // await connectSocket(stockStreamReq);
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();

                    const again = await timeNow();
                    if (again.isMarketOpen) {
                        // await connectSocket(stockStreamReq);
                    }
                }, marketTimer.current + 200);
            }

            chartTimeout = setTimeout(() => {
                investorList(req);
                interval = setInterval(() => {
                    investorList(req);
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

    const investorList = async (req: InvestorListReq) => {
        try {
            const data = await fetchInvestorList(req);

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }

            console.log(data);

            const { investorList } = data.result;

            const ranking = investorList.map((investor: InvestorListItem, index: number) => {
                return {
                    id: investor.stkCd,
                    rank: index + 1,
                    stkNm: investor.stkNm,
                    fluRt: investor.fluRt,
                    curPrc: investor.curPrc,
                    netprpsAmt: investor.netprpsAmt,
                }
            });

            setRow(ranking);

            // return stockList.map((row: StockListItem) => {
            //     return row.stkCd
            // });
        } catch (error) {
            console.log(error);
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
                        trend: String(values["25"])
                    });
                });
            }
        };

        return socket;
    }

    const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
        let orgnTp = "6";

        if (newValue === 0) {
            orgnTp = "6";
        } else if (newValue === 1) {
            orgnTp = "7";
        }

        const newReq: InvestorListReq = {
            trdeTp: req.trdeTp,
            orgnTp: orgnTp
        }

        setReq(newReq);
        setValue(newValue);
        navigate(`/investor/${orgnTp}/list/${req.trdeTp}`);
    };

    const handleChangeInvestor = (_event: React.SyntheticEvent, newValue: number) => {
        let trdeTp = "1";

        if (newValue === 0) {
            trdeTp = "1";
        } else if (newValue === 1) {
            trdeTp = "2";
        }

        const newReq: InvestorListReq = {
            trdeTp: trdeTp,
            orgnTp: req.orgnTp
        }

        setReq(newReq);
        setTradeValue(newValue);
        navigate(`/investor/${req.orgnTp}/list/${trdeTp}`);
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
                            <Tab label="외국인" {...a11yProps(0)} />
                            <Tab label="기관" {...a11yProps(1)} />
                        </Tabs>
                        <Tabs value={tradeValue} onChange={handleChangeInvestor} aria-label="basic tabs example">
                            <Tab label="순매수" {...a11yProps(0)} />
                            <Tab label="순매도" {...a11yProps(1)} />
                        </Tabs>
                    </Box>
                    <StockTable rows={row} columns={columns} pageSize={100} />
                </Box>
            </Grid>
        </Box>
    )
}

export default InvestorList
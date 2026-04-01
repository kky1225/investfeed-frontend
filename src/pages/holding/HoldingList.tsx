import {useEffect, useRef, useState} from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Collapse from "@mui/material/Collapse";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import {GridColDef} from "@mui/x-data-grid";
import PieChartRoundedIcon from "@mui/icons-material/PieChartRounded";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import StockTable from "../../components/StockTable.tsx";
import CustomPieChart from "../../components/CustomPieChart.tsx";
import {HoldingStock, HoldingStreamRes} from "../../type/HoldingType.ts";
import {fetchHoldingList, fetchHoldingStream} from "../../api/holding/HoldingApi.ts";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {renderChip, renderTradeColor} from "../../components/CustomRender.tsx";

interface HoldingBuffer {
    curPrc?: string,
    predPre?: string,
    rmndQty?: string,
    purPric?: string,
}

const calcDailyPl = (stocks: HoldingStock[]) =>
    stocks.reduce((sum, s) => sum + (Number(s.curPrc) - Number(s.predClosePric)) * Number(s.rmndQty), 0);

const HoldingList = () => {
    const [holdings, setHoldings] = useState<Array<HoldingStock>>([]);
    const [totPurAmt, setTotPurAmt] = useState<string>("0");
    const [totEvltAmt, setTotEvltAmt] = useState<string>("0");
    const [totEvltPl, setTotEvltPl] = useState<string>("0");
    const [totPrftRt, setTotPrftRt] = useState<string>("0");
    const [dailyPl, setDailyPl] = useState<string>("0");
    const [rows, setRows] = useState<Array<object>>([]);
    const [showChart, setShowChart] = useState(false);

    const chartTimer = useRef<number>(0);
    const marketTimer = useRef<number>(0);
    const holdingBufferMap = useRef<Map<string, HoldingBuffer>>(new Map());

    useEffect(() => {
        let socketTimeout: ReturnType<typeof setTimeout>;
        let displayInterval: ReturnType<typeof setInterval>;
        let socket: WebSocket;

        (async () => {
            const items = await holdingList();

            if (!items || items.length === 0) return;

            const updateDisplay = () => {
                if (displayInterval) return;

                displayInterval = setInterval(() => {
                    if (holdingBufferMap.current.size === 0) return;

                    setHoldings((prev) => {
                        const updated = prev.map((stock) => {
                            const buffer = holdingBufferMap.current.get(stock.stkCd);
                            if (!buffer) return stock;

                            const curPrc = buffer.curPrc ?? stock.curPrc;
                            const rmndQty = buffer.rmndQty ?? stock.rmndQty;
                            const evltAmt = String(Number(curPrc) * Number(rmndQty));
                            const evltvPrft = String(Number(evltAmt) - Number(stock.purAmt));
                            const prftRt = Number(stock.purAmt) !== 0
                                ? (Number(evltvPrft) / Number(stock.purAmt) * 100).toFixed(2) : "0";

                            return {...stock, curPrc, rmndQty, evltAmt, evltvPrft, prftRt};
                        });

                        const totalEvlt = updated.reduce((sum, s) => sum + Number(s.evltAmt), 0);
                        const totalPur = updated.reduce((sum, s) => sum + Number(s.purAmt), 0);
                        const totalPl = totalEvlt - totalPur;
                        const totalPlRt = totalPur !== 0 ? (totalPl / totalPur * 100).toFixed(2) : "0";

                        setTotEvltAmt(String(totalEvlt));
                        setTotEvltPl(String(totalPl));
                        setTotPrftRt(totalPlRt);
                        setDailyPl(String(calcDailyPl(updated)));
                        setRows(toRows(updated));

                        return updated;
                    });

                    holdingBufferMap.current.clear();
                }, 500);
            };

            const connectSocket = async (items: string[]) => {
                await fetchHoldingStream({items});
                socket = openSocket();
                updateDisplay();
            };

            const marketInfo = await timeNow();

            if (marketInfo?.isMarketOpen) {
                await connectSocket(items);
            } else {
                socketTimeout = setTimeout(async () => {
                    socket?.close();

                    const again = await timeNow();
                    if (again?.isMarketOpen) {
                        await connectSocket(items);
                    }
                }, marketTimer.current + 200);
            }
        })();

        return () => {
            socket?.close();
            clearTimeout(socketTimeout);
            clearInterval(displayInterval);
        };
    }, []);

    const timeNow = async () => {
        try {
            const startTime = Date.now();
            const data = await fetchTimeNow({marketType: MarketType.STOCK});

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }

            const {time, isMarketOpen, startMarketTime, marketType} = data.result;

            if (marketType !== MarketType.STOCK) {
                throw new Error(data.msg);
            }

            const endTime = Date.now();
            const delayTime = endTime - startTime;
            const revisionServerTime = time + delayTime / 2;

            chartTimer.current = revisionServerTime - endTime;

            if (!isMarketOpen) {
                marketTimer.current = startMarketTime - revisionServerTime;
            }

            return {...data.result};
        } catch (error) {
            console.error(error);
        }
    };

    const toRows = (stocks: HoldingStock[]) => {
        return stocks.map((stock, index) => ({
            id: stock.stkCd || index,
            stkNm: stock.stkNm,
            curPrc: stock.curPrc,
            rmndQty: stock.rmndQty,
            purPric: stock.purPric,
            purAmt: stock.purAmt,
            evltAmt: stock.evltAmt,
            evltvPrft: stock.evltvPrft,
            prftRt: stock.prftRt,
            possRt: stock.possRt,
        }));
    };

    const holdingList = async (): Promise<string[]> => {
        try {
            const data = await fetchHoldingList();

            if (data.code !== "0000") {
                throw new Error(data.msg);
            }

            const result = data.result;

            setTotPurAmt(result.totPurAmt);
            setTotEvltAmt(result.totEvltAmt);
            setTotEvltPl(result.totEvltPl);
            setTotPrftRt(result.totPrftRt);

            const stocks: HoldingStock[] = result.holdingList ?? [];

            if (stocks.length > 0) {
                setHoldings(stocks);
                setRows(toRows(stocks));
                setDailyPl(String(calcDailyPl(stocks)));
                return stocks.map((stock) => stock.stkCd);
            }

            return [];
        } catch (err) {
            console.error(err);
            return [];
        }
    };

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.trnm === "REAL" && Array.isArray(data.data)) {
                data.data.forEach((res: HoldingStreamRes) => {
                    const values = res.values;

                    if (res.type === "0B") {
                        const stkCd = res.item;
                        const prev = holdingBufferMap.current.get(stkCd) ?? {};
                        holdingBufferMap.current.set(stkCd, {
                            ...prev,
                            curPrc: String(values["10"]).replace(/^[+-]/, ''),
                        });
                    }

                    if (res.type === "04") {
                        const rawCd = values["9001"];
                        if (!rawCd) return;
                        const stkCd = rawCd.replace(/^A/, '') + "_AL";
                        const prev = holdingBufferMap.current.get(stkCd) ?? {};
                        holdingBufferMap.current.set(stkCd, {
                            ...prev,
                            curPrc: values["10"] ? String(values["10"]).replace(/^[+-]/, '') : prev.curPrc,
                            rmndQty: values["930"] ?? prev.rmndQty,
                            purPric: values["931"] ?? prev.purPric,
                        });
                    }
                });
            }
        };

        return socket;
    };

    const profitColor = Number(totEvltPl) > 0 ? 'error.main' : Number(totEvltPl) < 0 ? 'info.main' : 'text.primary';
    const dailyPlColor = Number(dailyPl) > 0 ? 'error.main' : Number(dailyPl) < 0 ? 'info.main' : 'text.primary';

    const columns: GridColDef[] = [
        {field: 'stkNm', headerName: '종목명', flex: 1.5, minWidth: 150},
        {field: 'prftRt', headerName: '수익률', flex: 0.8, minWidth: 100, renderCell: (params: {value: number}) => renderChip(params.value as number)},
        {field: 'curPrc', headerName: '현재가', flex: 1, minWidth: 100, valueFormatter: (value: string) => Number(value).toLocaleString()},
        {field: 'rmndQty', headerName: '보유수량', flex: 0.8, minWidth: 80, valueFormatter: (value: string) => Number(value).toLocaleString()},
        {field: 'purPric', headerName: '매입가', flex: 1, minWidth: 100, valueFormatter: (value: string) => Number(value).toLocaleString()},
        {field: 'evltAmt', headerName: '평가금액', flex: 1, minWidth: 120, valueFormatter: (value: string) => Number(value).toLocaleString()},
        {field: 'evltvPrft', headerName: '평가손익', flex: 1, minWidth: 120, renderCell: (params: {value: string}) => renderTradeColor(Number(params.value))},
        {field: 'purAmt', headerName: '매입금액', flex: 1, minWidth: 120, valueFormatter: (value: string) => Number(value).toLocaleString()},
        {field: 'possRt', headerName: '비중', flex: 0.6, minWidth: 80, valueFormatter: (value: string) => `${value}%`},
    ];

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Typography component="h2" variant="h6" sx={{mb: 2}}>
                보유 주식
            </Typography>

            <Card variant="outlined" sx={{mb: 3}}>
                <CardContent>
                    <Typography variant="body2" sx={{color: 'text.secondary', mb: 0.5}}>
                        총 평가금액
                    </Typography>
                    <Typography variant="h4" sx={{fontWeight: 700, mb: 2}}>
                        {Number(totEvltAmt).toLocaleString()}원
                    </Typography>

                    <Stack direction="row" spacing={4} divider={<Divider orientation="vertical" flexItem />}>
                        <Box>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>투자 원금</Typography>
                            <Typography variant="body1" sx={{fontWeight: 600}}>
                                {Number(totPurAmt).toLocaleString()}원
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>총 수익</Typography>
                            <Typography variant="body1" sx={{fontWeight: 600, color: profitColor}}>
                                {Number(totEvltPl) > 0 ? '+' : ''}{Number(totEvltPl).toLocaleString()}원
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>수익률</Typography>
                            <Typography variant="body1" sx={{fontWeight: 600, color: profitColor}}>
                                {Number(totPrftRt) > 0 ? '+' : ''}{totPrftRt}%
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>일간 수익</Typography>
                            <Typography variant="body1" sx={{fontWeight: 600, color: dailyPlColor}}>
                                {Number(dailyPl) > 0 ? '+' : ''}{Number(dailyPl).toLocaleString()}원
                            </Typography>
                        </Box>
                    </Stack>
                </CardContent>
            </Card>

            <Button
                variant="outlined"
                size="small"
                startIcon={<PieChartRoundedIcon />}
                endIcon={showChart ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                onClick={() => setShowChart(!showChart)}
                sx={{mb: 2}}
            >
                투자 비중 보기
            </Button>

            <Collapse in={showChart}>
                <Box sx={{mb: 3}}>
                    <CustomPieChart holdings={holdings} totalEvltAmt={totEvltAmt} />
                </Box>
            </Collapse>

            <StockTable rows={rows} columns={columns} loading={false} pageSize={20} />
        </Box>
    );
};

export default HoldingList;

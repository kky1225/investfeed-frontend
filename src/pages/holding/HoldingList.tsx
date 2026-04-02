import {useCallback, useEffect, useMemo, useState} from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import {GridColDef} from "@mui/x-data-grid";
import PieChartRoundedIcon from "@mui/icons-material/PieChartRounded";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import StockTable from "../../components/StockTable.tsx";
import CustomPieChart from "../../components/CustomPieChart.tsx";
import {HoldingStock} from "../../type/HoldingType.ts";
import {fetchHoldingList} from "../../api/holding/HoldingApi.ts";
import {renderChip, renderTradeColor} from "../../components/CustomRender.tsx";
import HoldingSummaryCard from "./HoldingSummaryCard.tsx";
import {useHoldingStream, HoldingBuffer} from "./useHoldingStream.ts";

const calcDailyPl = (stocks: HoldingStock[]) =>
    stocks.reduce((sum, s) => sum + (Number(s.curPrc) - Number(s.predClosePric)) * Number(s.rmndQty), 0);

const toRows = (stocks: HoldingStock[]) =>
    stocks.map((stock, index) => ({
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

const HoldingList = () => {
    const [holdings, setHoldings] = useState<HoldingStock[]>([]);
    const [totPurAmt, setTotPurAmt] = useState("0");
    const [totEvltAmt, setTotEvltAmt] = useState("0");
    const [totEvltPl, setTotEvltPl] = useState("0");
    const [totPrftRt, setTotPrftRt] = useState("0");
    const [dailyPl, setDailyPl] = useState("0");
    const [rows, setRows] = useState<object[]>([]);
    const [showChart, setShowChart] = useState(false);
    const [stkCds, setStkCds] = useState<string[]>([]);

    useEffect(() => {
        (async () => {
            try {
                const data = await fetchHoldingList();
                if (data.code !== "0000") return;

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
                    setStkCds(stocks.map(s => s.stkCd));
                }
            } catch (err) {
                console.error(err);
            }
        })();
    }, []);

    const handleStreamUpdate = useCallback((bufferMap: Map<string, HoldingBuffer>) => {
        setHoldings(prev => {
            const updated = prev.map(stock => {
                const buffer = bufferMap.get(stock.stkCd);
                if (!buffer) return stock;

                const curPrc = buffer.curPrc ?? stock.curPrc;
                const rmndQty = buffer.rmndQty ?? stock.rmndQty;
                const evltAmt = String(Number(curPrc) * Number(rmndQty));
                const evltvPrft = String(Number(evltAmt) - Number(stock.purAmt));
                const prftRtVal = Number(stock.purAmt) !== 0
                    ? Number(evltvPrft) / Number(stock.purAmt) * 100 : 0;
                const prftRt = prftRtVal > 0 ? `+${prftRtVal.toFixed(2)}` : prftRtVal.toFixed(2);

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
    }, []);

    const stableStkCds = useMemo(() => stkCds, [stkCds.join(',')]);
    useHoldingStream(stableStkCds, handleStreamUpdate);

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
            <HoldingSummaryCard
                totPurAmt={totPurAmt}
                totEvltAmt={totEvltAmt}
                totEvltPl={totEvltPl}
                totPrftRt={totPrftRt}
                dailyPl={dailyPl}
            />

            <Button
                variant="outlined"
                size="small"
                startIcon={<PieChartRoundedIcon/>}
                endIcon={showChart ? <KeyboardArrowUpIcon/> : <KeyboardArrowDownIcon/>}
                onClick={() => setShowChart(!showChart)}
                sx={{mb: 2}}
            >
                투자 비중 보기
            </Button>

            <Collapse in={showChart}>
                <Box sx={{mb: 3}}>
                    <CustomPieChart holdings={holdings} totalEvltAmt={totEvltAmt}/>
                </Box>
            </Collapse>

            <StockTable rows={rows} columns={columns} loading={false} pageSize={20}/>
        </Box>
    );
};

export default HoldingList;

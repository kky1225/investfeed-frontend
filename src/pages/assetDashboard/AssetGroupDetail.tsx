import {useCallback, useMemo, useState} from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Collapse from "@mui/material/Collapse";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {renderChip, renderTradeColor} from "../../components/CustomRender.tsx";
import CustomPieChart from "../../components/CustomPieChart.tsx";
import BlindText from "../../components/BlindText.tsx";
import {useBlindMode} from "../../context/BlindModeContext.tsx";
import type {AssetGroupSummary, UnifiedHoldingItem} from "../../type/AssetDashboardType.ts";
import type {HoldingBuffer, HoldingStock} from "../../type/HoldingType.ts";
import type {CryptoHoldingBuffer} from "../../type/CryptoType.ts";
import {useHoldingStream} from "../holding/useHoldingStream.ts";
import {useCryptoHoldingStream} from "../cryptoHolding/useCryptoHoldingStream.ts";
import {fetchAssetStockStream, fetchAssetCryptoStream} from "../../api/asset/AssetDashboardApi.ts";

interface AssetGroupDetailProps {
    group: 'stock' | 'crypto';
    summary: AssetGroupSummary;
}

const toHoldingStock = (item: UnifiedHoldingItem): HoldingStock => ({
    id: 0,
    stkCd: item.stkCd,
    stkNm: item.stkNm,
    curPrc: item.curPrc,
    purPric: "0",
    purAmt: String(item.purAmt),
    evltAmt: String(item.evltAmt),
    evltvPrft: String(item.evltPl),
    prftRt: item.prftRt,
    rmndQty: "0",
    possRt: item.possRt,
    predClosePric: "0",
});

export default function AssetGroupDetail({group, summary}: AssetGroupDetailProps) {
    const title = group === 'stock' ? '주식' : '코인';
    const [holdings, setHoldings] = useState<UnifiedHoldingItem[]>(summary.holdings);
    const [groupSummary, setGroupSummary] = useState(summary);
    const {isBlind} = useBlindMode();
    const [showList, setShowList] = useState(!isBlind);
    const [prevIsBlind, setPrevIsBlind] = useState(isBlind);
    if (isBlind !== prevIsBlind) {
        setPrevIsBlind(isBlind);
        setShowList(!isBlind);
    }

    const codes = useMemo(() => holdings.map(h => h.stkCd), [holdings.map(h => h.stkCd).join(',')]);

    const updateHoldings = useCallback((curPrcMap: Map<string, string>) => {
        setHoldings(prev => {
            const updated = prev.map(item => {
                const newCurPrc = curPrcMap.get(item.stkCd);
                if (!newCurPrc) return item;

                const curPrc = newCurPrc;
                // 수량 = 평가금액 / 현재가 (원래 수량 역산)
                const prevQty = item.evltAmt / (Number(item.curPrc) || 1);
                const evltAmt = Math.round(Number(curPrc) * prevQty);
                const evltPl = evltAmt - item.purAmt;
                const prftRt = item.purAmt > 0 ? (evltPl / item.purAmt * 100) : 0;

                return {...item, curPrc, evltAmt, evltPl, prftRt: prftRt.toFixed(2)};
            });

            // 비중 재계산
            const totalEvlt = updated.reduce((sum, h) => sum + h.evltAmt, 0);
            const withPossRt = updated.map(h => ({
                ...h,
                possRt: totalEvlt > 0 ? (h.evltAmt / totalEvlt * 100).toFixed(2) : "0",
            }));

            // 요약 업데이트
            const totalPur = withPossRt.reduce((sum, h) => sum + h.purAmt, 0);
            const totalPl = totalEvlt - totalPur;
            const totalPrftRt = totalPur > 0 ? (totalPl / totalPur * 100).toFixed(2) : "0";
            setGroupSummary(prev => ({
                ...prev,
                evltAmt: totalEvlt,
                evltPl: totalPl,
                prftRt: totalPrftRt,
            }));

            return withPossRt;
        });
    }, []);

    // 주식 스트림 핸들러
    const handleStockStreamUpdate = useCallback((bufferMap: Map<string, HoldingBuffer>) => {
        const curPrcMap = new Map<string, string>();
        bufferMap.forEach((buffer, stkCd) => {
            if (buffer.curPrc) curPrcMap.set(stkCd, buffer.curPrc);
        });
        if (curPrcMap.size > 0) updateHoldings(curPrcMap);
    }, [updateHoldings]);

    // 코인 스트림 핸들러
    const handleCryptoStreamUpdate = useCallback((bufferMap: Map<string, CryptoHoldingBuffer>) => {
        const curPrcMap = new Map<string, string>();
        bufferMap.forEach((buffer, market) => {
            if (buffer.curPrc) curPrcMap.set(market, buffer.curPrc);
        });
        if (curPrcMap.size > 0) updateHoldings(curPrcMap);
    }, [updateHoldings]);

    // 조건부 훅 호출은 불가하므로 빈 배열로 비활성화
    const stockCodes = group === 'stock' ? codes : [];
    const cryptoCodes = group === 'crypto' ? codes : [];

    useHoldingStream(stockCodes, handleStockStreamUpdate, fetchAssetStockStream);
    useCryptoHoldingStream(cryptoCodes, handleCryptoStreamUpdate, fetchAssetCryptoStream);

    const profitColor = groupSummary.evltPl > 0 ? 'error.main' : groupSummary.evltPl < 0 ? 'info.main' : 'text.primary';
    const holdingStocks = holdings.map(toHoldingStock);

    const columns: GridColDef[] = [
        {field: 'stkNm', headerName: group === 'stock' ? '종목명' : '코인명', flex: 1.5, minWidth: 150},
        {field: 'prftRt', headerName: '수익률', flex: 0.8, minWidth: 100, renderCell: (params: {value: number}) => renderChip(params.value as number)},
        {field: 'curPrc', headerName: '현재가', flex: 1, minWidth: 100, renderCell: (params) => <BlindText>{Number(params.value).toLocaleString()}</BlindText>},
        {field: 'evltAmt', headerName: '평가금액', flex: 1, minWidth: 120, renderCell: (params) => <BlindText>{params.value.toLocaleString()}</BlindText>},
        {field: 'evltPl', headerName: '평가손익', flex: 1, minWidth: 120, renderCell: (params) => <BlindText>{renderTradeColor(params.value)}</BlindText>},
        {field: 'purAmt', headerName: '매입금액', flex: 1, minWidth: 120, renderCell: (params) => <BlindText>{params.value.toLocaleString()}</BlindText>},
        {field: 'possRt', headerName: '비중', flex: 0.6, minWidth: 80, valueFormatter: (value: string) => `${value}%`},
        {field: 'brokerName', headerName: group === 'stock' ? '증권사' : '거래소', flex: 0.8, minWidth: 100},
    ];

    const rows = holdings.map((item, index) => ({
        id: index,
        stkCd: item.stkCd,
        stkNm: item.stkNm,
        curPrc: item.curPrc,
        evltAmt: item.evltAmt,
        evltPl: item.evltPl,
        purAmt: item.purAmt,
        prftRt: item.prftRt,
        possRt: item.possRt,
        brokerName: item.brokerName,
    }));

    return (
        <Collapse in={true}>
            <Card variant="outlined" sx={{mb: 3}}>
                <CardContent>
                    <Typography component="h2" variant="subtitle2" sx={{mb: 2}}>
                        {title} 상세
                    </Typography>

                    <Stack direction="row" spacing={4} divider={<Divider orientation="vertical" flexItem/>} sx={{mb: 3}}>
                        <Box>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>평가금액</Typography>
                            <Typography variant="body1" sx={{fontWeight: 600}}>
                                <BlindText>{groupSummary.evltAmt.toLocaleString()}원</BlindText>
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>투자원금</Typography>
                            <Typography variant="body1" sx={{fontWeight: 600}}>
                                <BlindText>{groupSummary.purAmt.toLocaleString()}원</BlindText>
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>수익</Typography>
                            <Typography variant="body1" sx={{fontWeight: 600, color: profitColor}}>
                                <BlindText>{groupSummary.evltPl > 0 ? '+' : ''}{groupSummary.evltPl.toLocaleString()}원 ({Number(groupSummary.prftRt) > 0 ? '+' : ''}{groupSummary.prftRt}%)</BlindText>
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>예수금</Typography>
                            <Typography variant="body1" sx={{fontWeight: 600}}>
                                <BlindText>{groupSummary.cash.toLocaleString()}원</BlindText>
                            </Typography>
                        </Box>
                    </Stack>

                    {holdingStocks.length > 0 && (
                        <Box sx={{mb: 3}}>
                            <CustomPieChart holdings={holdingStocks} totalEvltAmt={String(groupSummary.evltAmt)}/>
                        </Box>
                    )}

                    <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: 1}}>
                        <Button
                            size="small"
                            endIcon={showList ? <KeyboardArrowUpIcon/> : <KeyboardArrowDownIcon/>}
                            onClick={() => setShowList(!showList)}
                        >
                            {showList ? '종목 접기' : '종목 펼치기'}
                        </Button>
                    </Box>

                    <Collapse in={showList}>
                        <DataGrid
                            rows={rows}
                            columns={columns}
                            getRowClassName={(params) =>
                                params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd'
                            }
                            initialState={{
                                pagination: {paginationModel: {pageSize: 20}},
                            }}
                            pageSizeOptions={[10, 20, 50, 100]}
                            disableColumnResize
                            density="compact"
                            slotProps={{
                                loadingOverlay: {
                                    variant: 'skeleton',
                                    noRowsVariant: 'skeleton',
                                },
                            }}
                        />
                    </Collapse>
                </CardContent>
            </Card>
        </Collapse>
    );
}

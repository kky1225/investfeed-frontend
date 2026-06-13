import {useMemo, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Stack from "@mui/material/Stack";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Paper from "@mui/material/Paper";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Skeleton from "@mui/material/Skeleton";
import PieChartRoundedIcon from "@mui/icons-material/PieChartRounded";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import {DataGrid, type GridColDef, type GridRenderCellParams} from "@mui/x-data-grid";
import {requireOk} from "../../lib/apiResponse.ts";
import HoldingSummaryCard from "../holding/HoldingSummaryCard.tsx";
import CustomPieChart from "../../components/CustomPieChart.tsx";
import {renderChip, renderTradeColor} from "../../components/CustomRender.tsx";
import BlindText from "../../components/BlindText.tsx";
import Chip from "@mui/material/Chip";
import FreshnessIndicator from "../../components/FreshnessIndicator.tsx";
import {usePollingQuery} from "../../lib/pollingQuery.ts";
import {
    fetchPaperAccount,
    fetchPaperRealizedPnl,
    fetchPaperTradeHistory,
    fetchPaperReport,
    fetchPaperHoldingGrade,
} from "../../api/admin/PaperTradeApi.ts";
import type {
    AdminHoldingGradeRes,
    AdminPaperAccountRes,
    AdminPaperRealizedPnlRes,
    AdminPaperTradeHistoryRes,
    HoldingGradeItem,
    PaperTradeReportRes,
    PaperHoldingItem,
    PaperRealizedPnlMonthlyItem,
    PaperTradeHistoryItem,
} from "../../type/PaperTradeManagementType.ts";
import type {HoldingStock} from "../../type/HoldingType.ts";

export default function PaperTradeManagement() {
    const [mainTab, setMainTab] = useState(0);

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 2}}>
                <Typography component="h2" variant="h6">
                    모의투자 매매
                </Typography>
            </Box>

            <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)} sx={{mb: 2}}>
                <Tab label="주식 계좌"/>
                <Tab label="실현손익"/>
                <Tab label="거래내역"/>
                <Tab label="보유 평가"/>
                <Tab label="성과 리포트"/>
            </Tabs>

            {mainTab === 0 && <PaperAccountPanel/>}
            {mainTab === 1 && <PaperRealizedPnlPanel/>}
            {mainTab === 2 && <PaperTradeHistoryPanel/>}
            {mainTab === 3 && <PaperHoldingGradePanel/>}
            {mainTab === 4 && <ReportSection/>}
        </Box>
    );
}

function PaperAccountPanel() {
    const [showChart, setShowChart] = useState(false);
    const [showList, setShowList] = useState(true);

    const {data, isLoading: loading, lastUpdated, pollError} = usePollingQuery<AdminPaperAccountRes>(
        ['admin-paper-account'],
        async (config) => fetchPaperAccount(config),
        {intervalMs: 60_000, refetchOnWindowFocus: false},
    );

    const holdings: HoldingStock[] = useMemo(() => {
        const list = data?.holdings ?? [];
        return list.map((h, idx) => paperToHoldingStock(h, idx));
    }, [data]);

    const s = data?.summary;
    const totPurAmt = String(s?.totalPurAmt ?? 0);
    const totEvltAmt = String(s?.totalEvltAmt ?? 0);
    const totEvltPl = String(s?.totalEvltPl ?? 0);
    const totPrftRt = s?.totalPrftRt != null ? s.totalPrftRt.toFixed(2) : "0";
    const balance = String(s?.orderableAmt ?? 0);

    const columns: GridColDef[] = [
        {field: 'stkNm', headerName: '종목명', flex: 1.5, minWidth: 150},
        {field: 'prftRt', headerName: '수익률', flex: 0.8, minWidth: 100,
            renderCell: (params: {value: number}) => renderChip(params.value as number)},
        {field: 'curPrc', headerName: '현재가', flex: 1, minWidth: 100,
            renderCell: (params) => <BlindText>{Number(params.value).toLocaleString()}</BlindText>},
        {field: 'rmndQty', headerName: '보유수량', flex: 0.8, minWidth: 80,
            renderCell: (params) => <BlindText>{Number(params.value).toLocaleString()}</BlindText>},
        {field: 'purPric', headerName: '매입가', flex: 1, minWidth: 100,
            valueFormatter: (value: string) => Number(value).toLocaleString()},
        {field: 'evltAmt', headerName: '평가금액', flex: 1, minWidth: 120,
            renderCell: (params) => <BlindText>{Number(params.value).toLocaleString()}</BlindText>},
        {field: 'evltvPrft', headerName: '평가손익', flex: 1, minWidth: 120,
            renderCell: (params) => <BlindText>{renderTradeColor(Number(params.value))}</BlindText>},
        {field: 'purAmt', headerName: '매입금액', flex: 1, minWidth: 120,
            renderCell: (params) => <BlindText>{Number(params.value).toLocaleString()}</BlindText>},
        {field: 'possRt', headerName: '비중', flex: 0.6, minWidth: 80,
            valueFormatter: (value: string) => `${value}%`},
    ];

    const rows = holdings.map(stock => ({
        id: stock.id,
        stkCd: stock.stkCd,
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

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <HoldingSummaryCard
                totPurAmt={totPurAmt}
                totEvltAmt={totEvltAmt}
                totEvltPl={totEvltPl}
                totPrftRt={totPrftRt}
                balance={balance}
                loading={loading}
            />

            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PieChartRoundedIcon/>}
                    endIcon={showChart ? <KeyboardArrowUpIcon/> : <KeyboardArrowDownIcon/>}
                    onClick={() => setShowChart(!showChart)}
                >
                    투자 비중 보기
                </Button>
                {!loading && <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>}
            </Box>

            <Collapse in={showChart}>
                <Box sx={{mb: 3}}>
                    <CustomPieChart holdings={holdings} totalEvltAmt={totEvltAmt}/>
                </Box>
            </Collapse>

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
                    autoHeight
                    rows={rows}
                    columns={columns}
                    getRowClassName={(params) =>
                        params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd'
                    }
                    initialState={{pagination: {paginationModel: {pageSize: 20}}}}
                    pageSizeOptions={[10, 20, 50, 100]}
                    disableColumnResize
                    density="compact"
                    loading={loading}
                    slotProps={{
                        loadingOverlay: {variant: 'skeleton', noRowsVariant: 'skeleton'},
                    }}
                    localeText={{noRowsLabel: '데이터가 없습니다.'}}
                />
            </Collapse>
        </Box>
    );
}

function paperToHoldingStock(p: PaperHoldingItem, idx: number): HoldingStock {
    const prftRtStr = p.prftRt != null
        ? (p.prftRt > 0 ? `+${p.prftRt.toFixed(2)}` : p.prftRt.toFixed(2))
        : "0";
    const possRtStr = p.possRt != null ? p.possRt.toFixed(2) : "0";
    return {
        id: idx + 1,
        stkCd: p.stkCd,
        stkNm: p.stkNm,
        curPrc: String(p.curPrc),
        purPric: String(p.purPric),
        purAmt: String(p.purAmt),
        evltAmt: String(p.evltAmt),
        evltvPrft: String(p.evltvPrft),
        prftRt: prftRtStr,
        rmndQty: String(p.rmndQty),
        possRt: possRtStr,
        predClosePric: String(p.curPrc),  // 모의 미보유 — 일간수익 계산 안 함
    };
}

type ViewMode = 'monthly' | 'yearly' | 'all';

function PaperRealizedPnlPanel() {
    const currentDate = new Date();
    const [viewMode, setViewMode] = useState<ViewMode>('monthly');
    const [year, setYear] = useState(currentDate.getFullYear());
    const [month, setMonth] = useState(currentDate.getMonth() + 1);
    const [showList, setShowList] = useState(true);

    const {data, isLoading: loading} = useQuery<AdminPaperRealizedPnlRes>({
        queryKey: ['admin-paper-realized', viewMode, year, month],
        queryFn: async () => requireOk(
            await fetchPaperRealizedPnl(
                viewMode,
                viewMode !== 'all' ? year : undefined,
                viewMode === 'monthly' ? month : undefined,
            ),
            '실현손익 조회',
        ),
        refetchOnWindowFocus: false,
    });

    const items = data?.items ?? [];
    const totalPnl = useMemo(() => items.reduce((sum, x) => sum + x.realizedPnl, 0), [items]);
    const pnlColor = totalPnl > 0 ? 'error.main' : totalPnl < 0 ? 'info.main' : 'text.primary';
    const years = Array.from({length: 10}, (_, i) => currentDate.getFullYear() - i);
    const months = Array.from({length: 12}, (_, i) => i + 1);

    const columns: GridColDef<PaperRealizedPnlMonthlyItem & {id: number}>[] = [
        {field: 'period', headerName: '기간', flex: 1, minWidth: 120,
            valueGetter: (_v, row) => `${row.year}년 ${row.month}월`},
        {field: 'realizedPnl', headerName: '실현손익', flex: 1, minWidth: 150, align: 'right', headerAlign: 'right',
            renderCell: (params: GridRenderCellParams) => {
                const val = params.value as number;
                const color = val > 0 ? 'error.main' : val < 0 ? 'info.main' : 'text.primary';
                return <BlindText><Typography variant="body2" sx={{color, fontWeight: 600}}>{val > 0 ? '+' : ''}{val.toLocaleString()}원</Typography></BlindText>;
            }},
        {field: 'totalBuyAmt', headerName: '총매수', flex: 1, minWidth: 120, align: 'right', headerAlign: 'right',
            renderCell: (params: GridRenderCellParams) => <BlindText><Typography variant="body2">{(params.value as number)?.toLocaleString() ?? '-'}원</Typography></BlindText>},
        {field: 'totalSellAmt', headerName: '총매도', flex: 1, minWidth: 120, align: 'right', headerAlign: 'right',
            renderCell: (params: GridRenderCellParams) => <BlindText><Typography variant="body2">{(params.value as number)?.toLocaleString() ?? '-'}원</Typography></BlindText>},
        {field: 'tradeFee', headerName: '수수료', width: 100, align: 'right', headerAlign: 'right',
            renderCell: (params: GridRenderCellParams) => <Typography variant="body2">{(params.value as number)?.toLocaleString() ?? '-'}원</Typography>},
        {field: 'tradeTax', headerName: '세금', width: 100, align: 'right', headerAlign: 'right',
            renderCell: (params: GridRenderCellParams) => <Typography variant="body2">{(params.value as number)?.toLocaleString() ?? '-'}원</Typography>},
    ];

    const rows = items.map((x, i) => ({id: i + 1, ...x}));

    return (
        <Box>
            <Stack direction="row" spacing={1} sx={{mb: 2}} alignItems="center">
                <TextField select size="small" value={viewMode}
                           onChange={(e) => setViewMode(e.target.value as ViewMode)}
                           sx={{minWidth: 100}}>
                    <MenuItem value="monthly">월별</MenuItem>
                    <MenuItem value="yearly">연별</MenuItem>
                    <MenuItem value="all">전체</MenuItem>
                </TextField>
                {viewMode !== 'all' && (
                    <TextField select size="small" value={year}
                               onChange={(e) => setYear(Number(e.target.value))}
                               sx={{minWidth: 100}}>
                        {years.map(y => <MenuItem key={y} value={y}>{y}년</MenuItem>)}
                    </TextField>
                )}
                {viewMode === 'monthly' && (
                    <TextField select size="small" value={month}
                               onChange={(e) => setMonth(Number(e.target.value))}
                               sx={{minWidth: 80}}>
                        {months.map(m => <MenuItem key={m} value={m}>{m}월</MenuItem>)}
                    </TextField>
                )}
            </Stack>

            <Card variant="outlined" sx={{mb: 3}}>
                <CardContent>
                    <Typography variant="body2" sx={{color: 'text.secondary', mb: 0.5}}>
                        {viewMode === 'monthly' ? `${year}년 ${month}월`
                            : viewMode === 'yearly' ? `${year}년` : '전체'} 실현손익
                    </Typography>
                    <Typography variant="h4" sx={{fontWeight: 700, color: loading ? undefined : pnlColor}}>
                        {loading ? <Skeleton width="40%"/> :
                            <BlindText>{totalPnl > 0 ? '+' : ''}{totalPnl.toLocaleString()}원</BlindText>}
                    </Typography>
                </CardContent>
            </Card>

            <Box sx={{display: 'flex', justifyContent: 'flex-end', mb: 1}}>
                <Button
                    size="small"
                    endIcon={showList ? <KeyboardArrowUpIcon/> : <KeyboardArrowDownIcon/>}
                    onClick={() => setShowList(!showList)}
                >
                    {showList ? '내역 접기' : '내역 펼치기'}
                </Button>
            </Box>

            <Collapse in={showList}>
                <DataGrid
                    autoHeight
                    rows={rows}
                    columns={columns}
                    disableRowSelectionOnClick
                    pageSizeOptions={[10, 20, 50, 100]}
                    initialState={{pagination: {paginationModel: {pageSize: 10}}}}
                    loading={loading}
                    slotProps={{
                        loadingOverlay: {variant: 'skeleton', noRowsVariant: 'skeleton'},
                    }}
                    localeText={{noRowsLabel: '데이터가 없습니다.'}}
                    sx={{
                        '& .MuiDataGrid-cell': {cursor: 'default', display: 'flex', alignItems: 'center'},
                        border: 'none',
                    }}
                />
            </Collapse>
        </Box>
    );
}

function PaperTradeHistoryPanel() {
    const today = ((): string => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const [ordDt, setOrdDt] = useState<string>(today);

    const {data, isLoading} = useQuery<AdminPaperTradeHistoryRes>({
        queryKey: ['admin-paper-trade-history', ordDt],
        queryFn: async () => requireOk(await fetchPaperTradeHistory(ordDt), '거래내역 조회'),
        refetchOnWindowFocus: false,
    });

    const columns: GridColDef<PaperTradeHistoryItem & {id: number}>[] = [
        {field: 'ordTm', headerName: '체결시각', width: 100, align: 'center', headerAlign: 'center'},
        {field: 'stkCd', headerName: '종목코드', width: 100},
        {field: 'stkNm', headerName: '종목명', flex: 1, minWidth: 150},
        {field: 'ioTpNm', headerName: '구분', width: 110,
            renderCell: (p) => {
                const v = (p.value as string | null) ?? '-';
                const buy = v.includes('매수');
                const sell = v.includes('매도');
                const color = buy ? 'error.main' : sell ? 'info.main' : 'text.primary';
                return <Typography variant="body2" sx={{color, fontWeight: 600}}>{v}</Typography>;
            }},
        {field: 'trdeTp', headerName: '매매구분', width: 90},
        {field: 'cntrQty', headerName: '체결수량', width: 100, align: 'right', headerAlign: 'right',
            renderCell: (p) => <BlindText>{Number(p.value).toLocaleString()}</BlindText>},
        {field: 'cntrUv', headerName: '체결단가', width: 110, align: 'right', headerAlign: 'right',
            renderCell: (p) => <BlindText>{Number(p.value).toLocaleString()}</BlindText>},
        {field: 'ordQty', headerName: '주문수량', width: 100, align: 'right', headerAlign: 'right',
            renderCell: (p) => <Typography variant="body2">{Number(p.value).toLocaleString()}</Typography>},
        {field: 'ordUv', headerName: '주문단가', width: 100, align: 'right', headerAlign: 'right',
            renderCell: (p) => <Typography variant="body2">{Number(p.value).toLocaleString()}</Typography>},
        {field: 'ordNo', headerName: '주문번호', width: 100},
    ];

    return (
        <Box>
            <Stack direction="row" spacing={1} sx={{mb: 2}} alignItems="center">
                <TextField
                    type="date"
                    size="small"
                    label="일자"
                    value={ordDt}
                    onChange={(e) => setOrdDt(e.target.value)}
                    slotProps={{inputLabel: {shrink: true}}}
                    sx={{minWidth: 160}}
                />
            </Stack>

            <DataGrid
                autoHeight
                rows={(data?.items ?? []).map((t, i) => ({id: i + 1, ...t}))}
                columns={columns}
                density="compact"
                disableRowSelectionOnClick
                loading={isLoading}
                pageSizeOptions={[20, 50, 100]}
                initialState={{pagination: {paginationModel: {pageSize: 20}}}}
                slotProps={{
                    loadingOverlay: {variant: 'skeleton', noRowsVariant: 'skeleton'},
                }}
                localeText={{noRowsLabel: '해당 일자 체결내역이 없습니다.'}}
                sx={{
                    '& .MuiDataGrid-cell': {display: 'flex', alignItems: 'center'},
                }}
            />
        </Box>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// 보유 평가 — 22:10 HoldingGradeScheduler 산출 결과 (evalDate 단위)
// 계좌(현 시점 보유) 와 시점이 달라 별도 탭. 다음 거래일 09:00 매매 결정용 등급.
// ════════════════════════════════════════════════════════════════════════════
type GradeType = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

function PaperHoldingGradePanel() {
    // 다른 탭과 동일하게 오늘(로컬 날짜) 기본값. toISOString() 은 UTC 라 자정 직후 하루 어긋남.
    const today = ((): string => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const [evalDate, setEvalDate] = useState<string>(today);

    const {data, isLoading} = useQuery<AdminHoldingGradeRes>({
        queryKey: ['admin-paper-holding-grade', evalDate],
        queryFn: async () => requireOk(
            await fetchPaperHoldingGrade(evalDate || undefined),
            '보유 평가 조회',
        ),
        refetchOnWindowFocus: false,
    });

    // 첫 로드(빈 evalDate)로 받아온 응답의 evalDate 를 picker 초기값으로 반영.
    const effectiveEvalDate = data?.evalDate ?? "";
    const displayEvalDate = evalDate || effectiveEvalDate;

    const items = data?.items ?? [];

    const columns: GridColDef<HoldingGradeItem & {id: number}>[] = [
        {field: 'stkCd', headerName: '종목코드', width: 110},
        {field: 'stkNm', headerName: '종목명', flex: 1.2, minWidth: 150},
        {field: 'type', headerName: '등급', width: 130, align: 'center', headerAlign: 'center',
            renderCell: (p) => renderGradeChip(p.value as string)},
        {field: 'originSide', headerName: '원래 방향', width: 100, align: 'center', headerAlign: 'center',
            renderCell: (p) => {
                const v = p.value as string | null;
                if (!v) return <Typography variant="body2" color="text.secondary">-</Typography>;
                const color = v === 'BUY' ? 'error.main' : 'info.main';
                return <Typography variant="body2" sx={{color, fontWeight: 600}}>{v}</Typography>;
            }},
        {field: 'evaluationReason', headerName: '평가 사유', width: 160, align: 'center', headerAlign: 'center',
            renderCell: (p) => {
                const v = p.value as string | null;
                if (!v) return <Typography variant="body2" color="text.secondary">-</Typography>;
                // 티어 라벨(복수면 '|' 결합) → 한글. 왜 이 등급/비중인지.
                const KR: Record<string, string> = {
                    HARD_SELL: '하드스톱(즉시전량)', BLOCK_FREEZE: '외인강반대(동결)',
                    BLOCK_PARTIAL: '외인중간반대(부분)', CONFLICT: '충돌',
                };
                const label = v.split('|').map((t) => KR[t] ?? t).join(' · ');
                return <Typography variant="body2" sx={{color: 'warning.main', fontWeight: 600}}>{label}</Typography>;
            }},
        {field: 'marketType', headerName: '시장', width: 90, align: 'center', headerAlign: 'center',
            renderCell: (p) => <Typography variant="body2">{(p.value as string | null) ?? '-'}</Typography>},
        {field: 'penfndK', headerName: 'penfndK', width: 100, align: 'right', headerAlign: 'right',
            renderCell: (p) => {
                const v = p.value as number | null;
                return <Typography variant="body2">{v != null ? v.toFixed(2) : '-'}</Typography>;
            }},
        {field: 'frgnrMcapRatio', headerName: '외인 시총비(%)', width: 140, align: 'right', headerAlign: 'right',
            renderCell: (p) => {
                const v = p.value as number | null;
                return <Typography variant="body2">{v != null ? `${(v * 100).toFixed(4)}%` : '-'}</Typography>;
            }},
        {field: 'frgnrOppositeK', headerName: '외인 반대K', width: 100, align: 'right', headerAlign: 'right',
            renderCell: (p) => {
                const v = p.value as number | null;
                return <Typography variant="body2">{v != null ? v.toFixed(2) : '-'}</Typography>;
            }},
        {field: 'frgnrSameDirK', headerName: '외인 동조K', width: 100, align: 'right', headerAlign: 'right',
            renderCell: (p) => {
                const v = p.value as number | null;
                return <Typography variant="body2">{v != null ? v.toFixed(2) : '-'}</Typography>;
            }},
        {field: 'priorTrendRatio', headerName: "B′(추세명확)", width: 110, align: 'right', headerAlign: 'right',
            renderCell: (p) => {
                const v = p.value as number | null;
                return <Typography variant="body2">{v != null ? v.toFixed(2) : '-'}</Typography>;
            }},
        {field: 'foreignerAligned', headerName: '옵션B', width: 70, align: 'center', headerAlign: 'center',
            renderCell: (p) => {
                const v = p.value as boolean | null;
                return <Typography variant="body2">{v == null ? '-' : (v ? 'Y' : 'N')}</Typography>;
            }},
        {field: 'targetWeightRatio', headerName: '목표비중', width: 90, align: 'right', headerAlign: 'right',
            renderCell: (p) => {
                const v = p.value as number | null;
                return <Typography variant="body2">{v != null ? `${(v * 100).toFixed(0)}%` : '기본'}</Typography>;
            }},
    ];

    const rows = items.map((x, i) => ({id: i + 1, ...x}));

    // 등급별 카운트 (요약 표시용)
    const gradeCounts = useMemo(() => {
        const c: Record<string, number> = {};
        for (const it of items) c[it.type] = (c[it.type] ?? 0) + 1;
        return c;
    }, [items]);

    return (
        <Box>
            <Stack direction="row" spacing={1} sx={{mb: 2}} alignItems="center">
                <TextField
                    type="date"
                    size="small"
                    label="평가일자"
                    value={displayEvalDate}
                    onChange={(e) => setEvalDate(e.target.value)}
                    slotProps={{inputLabel: {shrink: true}}}
                    sx={{minWidth: 180}}
                />
                <Typography variant="caption" color="text.secondary">
                    ※ 22:10 보유종목 평가 결과 — 다음 거래일 09:00 매매 결정용
                </Typography>
            </Stack>

            <Card variant="outlined" sx={{mb: 2}}>
                <CardContent>
                    <Stack direction="row" spacing={3} sx={{alignItems: 'center', flexWrap: 'wrap'}}>
                        <Box>
                            <Typography variant="caption" color="text.secondary">평가일자</Typography>
                            <Typography variant="body1" sx={{fontWeight: 600}}>
                                {isLoading ? <Skeleton width={100}/> : (effectiveEvalDate || '-')}
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="caption" color="text.secondary">평가 종목 수</Typography>
                            <Typography variant="body1" sx={{fontWeight: 600}}>
                                {isLoading ? <Skeleton width={60}/> : `${items.length}건`}
                            </Typography>
                        </Box>
                        <Divider orientation="vertical" flexItem/>
                        {(['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'] as GradeType[]).map(g => (
                            <Box key={g}>
                                <Typography variant="caption" color="text.secondary">{g}</Typography>
                                <Box>{renderGradeChip(g, gradeCounts[g] ?? 0)}</Box>
                            </Box>
                        ))}
                    </Stack>
                </CardContent>
            </Card>

            <DataGrid
                autoHeight
                rows={rows}
                columns={columns}
                density="compact"
                disableRowSelectionOnClick
                loading={isLoading}
                pageSizeOptions={[20, 50, 100]}
                initialState={{pagination: {paginationModel: {pageSize: 20}}}}
                slotProps={{
                    loadingOverlay: {variant: 'skeleton', noRowsVariant: 'skeleton'},
                }}
                localeText={{noRowsLabel: '해당 평가일자의 보유 평가 결과가 없습니다.'}}
                sx={{
                    '& .MuiDataGrid-cell': {display: 'flex', alignItems: 'center'},
                }}
            />
        </Box>
    );
}

function renderGradeChip(type: string, count?: number) {
    const color: 'error' | 'default' | 'info' = (() => {
        switch (type) {
            case 'STRONG_BUY':
            case 'BUY':
                return 'error';
            case 'SELL':
            case 'STRONG_SELL':
                return 'info';
            default:
                return 'default';
        }
    })();
    const label = count != null ? `${count}건` : type;
    return <Chip size="small" color={color} label={label} variant={count != null && count === 0 ? 'outlined' : 'filled'}/>;
}

function ReportSection() {
    const {data, isLoading, isError, lastUpdated, pollError} = usePollingQuery<PaperTradeReportRes>(
        ['admin-paper-report'],
        async (config) => fetchPaperReport(config),
        {intervalMs: 60_000, refetchOnWindowFocus: false},
    );

    if (isError) return <Paper sx={{p: 2, bgcolor: 'error.light'}}>성과 리포트 조회 실패</Paper>;

    return (
        <Stack spacing={2}>
            <Box sx={{display: 'flex', justifyContent: 'flex-end'}}>
                {!isLoading && <FreshnessIndicator lastUpdated={lastUpdated} error={pollError}/>}
            </Box>
            <Card variant="outlined">
                <CardContent>
                    <Stack direction="row" spacing={3} sx={{alignItems: 'center', flexWrap: 'wrap'}}>
                        <Item label="시작일" value={data?.startDate ?? '미시작'} loading={isLoading}/>
                        <Item label="시작 NAV" value={data ? fmtLong(data.startNav) : null} loading={isLoading}/>
                        <Item label="현재 NAV" value={data ? fmtLong(data.currentNav) : null} bold loading={isLoading}/>
                        <Item label="총수익률" value={data ? <PctValue value={data.totalReturnPct}/> : null} loading={isLoading}/>
                        <Divider orientation="vertical" flexItem/>
                        <Item label="KOSPI %" value={data ? <PctValue value={data.kospiReturnPct}/> : null} loading={isLoading}/>
                        <Item label="KOSDAQ %" value={data ? <PctValue value={data.kosdaqReturnPct}/> : null} loading={isLoading}/>
                        <Item label="블렌디드 벤치마크 %" value={data ? <PctValue value={data.blendedBenchmarkPct}/> : null} loading={isLoading}/>
                    </Stack>
                </CardContent>
            </Card>
        </Stack>
    );
}

function Item({label, value, bold, loading}: {label: string; value: React.ReactNode; bold?: boolean; loading?: boolean}) {
    return (
        <Box sx={{minWidth: 110}}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant={bold ? 'h6' : 'body1'} sx={{fontWeight: bold ? 700 : 500}}>
                {loading ? <Skeleton width={bold ? 120 : 90}/> : value}
            </Typography>
        </Box>
    );
}

function fmtLong(v: number | null): string {
    if (v == null) return '-';
    return v.toLocaleString();
}

function PctValue({value}: {value: number | null}) {
    if (value == null) return <>-</>;
    const color = value > 0 ? 'error.main' : value < 0 ? 'info.main' : 'text.primary';
    const sign = value > 0 ? '+' : '';
    return (
        <Typography component="span" sx={{color, fontWeight: 600}}>
            {sign}{value.toFixed(2)}%
        </Typography>
    );
}

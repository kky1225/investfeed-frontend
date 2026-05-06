import React, {createContext, useCallback, useContext, useMemo, useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {requireOk} from "../../lib/apiResponse.ts";
import {useNavigate} from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import {DataGrid, GridColDef, GridRenderCellParams, GridRow, GridRowProps} from "@mui/x-data-grid";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PieChartRoundedIcon from "@mui/icons-material/PieChartRounded";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import SaveIcon from "@mui/icons-material/Save";
import {DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors} from "@dnd-kit/core";
import {arrayMove, SortableContext, useSortable, verticalListSortingStrategy} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import CustomPieChart from "../../components/CustomPieChart.tsx";
import {renderChip, renderTradeColor} from "../../components/CustomRender.tsx";
import BlindText from "../../components/BlindText.tsx";
import {fetchCryptoManualHoldingList, deleteCryptoManualHolding, reorderCryptoHoldings, updateCryptoBrokerBalance} from "../../api/cryptoBroker/CryptoBrokerApi.ts";
import type {HoldingReorderReq, ManualHolding, MemberBroker, UpdateBalanceReq} from "../../type/BrokerType.ts";
import type {HoldingStock} from "../../type/HoldingType.ts";
import HoldingSummaryCard from "../holding/HoldingSummaryCard.tsx";
import AddCryptoManualHoldingDialog from "./AddCryptoManualHoldingDialog.tsx";
import EditCryptoManualHoldingDialog from "./EditCryptoManualHoldingDialog.tsx";
import {useCryptoHoldingStream} from "./useCryptoHoldingStream.ts";
import type {CryptoHoldingBuffer} from "../../type/CryptoType.ts";
import {fetchCryptoHoldingStream} from "../../api/cryptoHolding/CryptoHoldingApi.ts";
import {useBlindMode} from "../../context/BlindModeContext.tsx";

// ─── DataGrid 행 드래그 (Context 패턴) ───────────────────────────────────────

type DragListeners = ReturnType<typeof useSortable>["listeners"];
type DragAttributes = ReturnType<typeof useSortable>["attributes"];

interface RowDragContextValue {
    listeners: DragListeners;
    attributes: DragAttributes;
}

const RowDragContext = createContext<RowDragContextValue>({
    listeners: undefined,
    attributes: {} as DragAttributes,
});

const DragHandleCell = () => {
    const {listeners, attributes} = useContext(RowDragContext);
    return (
        <Box
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()}
            sx={{
                display: "flex",
                alignItems: "center",
                cursor: "grab",
                color: "text.disabled",
                height: "100%",
                px: 0.5,
                "&:active": {cursor: "grabbing"},
            }}
        >
            <DragIndicatorIcon sx={{fontSize: 16}}/>
        </Box>
    );
};

const DraggableRow = React.forwardRef<HTMLDivElement, GridRowProps>((props, _ref) => {
    const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({
        id: props.rowId as number,
    });

    return (
        <RowDragContext.Provider value={{listeners, attributes}}>
            <GridRow
                ref={setNodeRef}
                {...props}
                style={{
                    ...props.style,
                    transform: CSS.Transform.toString(transform),
                    transition,
                    opacity: isDragging ? 0.5 : 1,
                    zIndex: isDragging ? 1 : undefined,
                    position: isDragging ? "relative" : undefined,
                }}
            />
        </RowDragContext.Provider>
    );
});

// ─── CryptoManualHoldingTab ─────────────────────────────────────────────────

interface CryptoManualHoldingTabProps {
    broker: MemberBroker;
}

const stripSign = (v: string) => v.replace(/^[+-]/, '');

const calcDailyPl = (stocks: HoldingStock[]) =>
    stocks.reduce((sum, s) => {
        if (Number(s.predClosePric) <= 0) return sum;
        return sum + (Number(s.curPrc) - Number(s.predClosePric)) * Number(s.rmndQty);
    }, 0);

const toHoldingStocks = (items: ManualHolding[], priceMap?: Map<string, string>): HoldingStock[] => {
    const stocks: HoldingStock[] = items.map(item => {
        const rawCurPrc = priceMap?.get(item.stkCd) ?? item.curPrc ?? "0";
        const curPrc = stripSign(rawCurPrc);
        const predClosePric = stripSign(item.basePric || "0");
        const purAmt = String(item.purAmt);
        const evltAmt = String(Number(curPrc) * item.quantity);
        const evltvPrft = String(Number(evltAmt) - item.purAmt);
        const prftRtVal = item.purAmt !== 0
            ? (Number(evltAmt) - item.purAmt) / item.purAmt * 100 : 0;
        const prftRt = prftRtVal > 0 ? `+${prftRtVal.toFixed(2)}` : prftRtVal.toFixed(2);

        return {
            id: item.id,
            stkCd: item.stkCd,
            stkNm: item.stkNm,
            curPrc,
            purPric: String(item.purPrice),
            purAmt,
            evltAmt,
            evltvPrft,
            prftRt,
            rmndQty: String(item.quantity),
            possRt: "0",
            predClosePric,
        };
    });

    const totalEvlt = stocks.reduce((sum, s) => sum + Number(s.evltAmt), 0);
    return stocks.map(s => ({
        ...s,
        possRt: totalEvlt !== 0 ? (Number(s.evltAmt) / totalEvlt * 100).toFixed(2) : "0",
    }));
};

export default function CryptoManualHoldingTab({broker}: CryptoManualHoldingTabProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [showChart, setShowChart] = useState(false);
    const {isBlind} = useBlindMode();

    const [showList, setShowList] = useState(!isBlind);
    const [prevIsBlind, setPrevIsBlind] = useState(isBlind);
    if (isBlind !== prevIsBlind) {
        setPrevIsBlind(isBlind);
        setShowList(!isBlind);
    }

    const [addOpen, setAddOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<ManualHolding | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ManualHolding | null>(null);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [menuTarget, setMenuTarget] = useState<ManualHolding | null>(null);
    const [orderOverride, setOrderOverride] = useState<number[] | null>(null);
    const [orderDirty, setOrderDirty] = useState(false);
    const [balanceOverride, setBalanceOverride] = useState<string | null>(null);

    const [liveOverlay, setLiveOverlay] = useState<Map<string, CryptoHoldingBuffer>>(new Map());

    // broker 변경 시 로컬 override 들 초기화 (다른 broker 데이터로 잔존 방지)
    const [prevBrokerId, setPrevBrokerId] = useState(broker.id);
    if (broker.id !== prevBrokerId) {
        setPrevBrokerId(broker.id);
        setOrderOverride(null);
        setOrderDirty(false);
        setBalanceOverride(null);
        setLiveOverlay(new Map());
    }

    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
        useSensor(TouchSensor, {activationConstraint: {delay: 200, tolerance: 5}})
    );

    type ManualHoldingData = {
        holdings?: ManualHolding[];
        balance?: number | string;
    } | null;
    const {data: holdingData, isLoading: loading} = useQuery<ManualHoldingData>({
        queryKey: ['cryptoManualHoldingList', broker.id],
        queryFn: async ({signal}) => requireOk<ManualHoldingData>(await fetchCryptoManualHoldingList(broker.id, {signal, skipGlobalError: true}), null),
        refetchOnWindowFocus: false,
    });

    const manualHoldings: ManualHolding[] = holdingData?.holdings ?? [];
    const baseHoldings = useMemo<HoldingStock[]>(() => toHoldingStocks(manualHoldings), [manualHoldings]);

    const holdings = useMemo<HoldingStock[]>(() => {
        let ordered = baseHoldings;
        if (orderOverride) {
            const byId = new Map(baseHoldings.map(h => [h.id, h]));
            const sorted: HoldingStock[] = [];
            const seen = new Set<number>();
            for (const id of orderOverride) {
                const h = byId.get(id);
                if (h) { sorted.push(h); seen.add(id); }
            }
            baseHoldings.forEach(h => { if (!seen.has(h.id)) sorted.push(h); });
            ordered = sorted;
        }

        const updated = ordered.map(stock => {
            const buffer = liveOverlay.get(stock.stkCd);
            if (!buffer || !buffer.curPrc) return stock;
            const curPrc = buffer.curPrc;
            const evltAmt = String(Number(curPrc) * Number(stock.rmndQty));
            const evltvPrft = String(Number(evltAmt) - Number(stock.purAmt));
            const prftRtVal = Number(stock.purAmt) !== 0
                ? Number(evltvPrft) / Number(stock.purAmt) * 100 : 0;
            const prftRt = prftRtVal > 0 ? `+${prftRtVal.toFixed(2)}` : prftRtVal.toFixed(2);
            return {...stock, curPrc, evltAmt, evltvPrft, prftRt};
        });

        const totalEvlt = updated.reduce((sum, s) => sum + Number(s.evltAmt), 0);
        return updated.map(s => ({
            ...s,
            possRt: totalEvlt !== 0 ? (Number(s.evltAmt) / totalEvlt * 100).toFixed(2) : "0",
        }));
    }, [baseHoldings, orderOverride, liveOverlay]);

    const balance: string = balanceOverride ?? String(holdingData?.balance ?? 0);
    const totPurAmt = useMemo(() => String(holdings.reduce((sum, s) => sum + Number(s.purAmt), 0)), [holdings]);
    const totEvltAmt = useMemo(() => String(holdings.reduce((sum, s) => sum + Number(s.evltAmt), 0)), [holdings]);
    const totEvltPl = useMemo(() => String(Number(totEvltAmt) - Number(totPurAmt)), [totEvltAmt, totPurAmt]);
    const totPrftRt = useMemo(() => {
        const pur = Number(totPurAmt);
        return pur !== 0 ? (Number(totEvltPl) / pur * 100).toFixed(2) : "0";
    }, [totEvltPl, totPurAmt]);
    const dailyPl = useMemo(() => String(calcDailyPl(holdings)), [holdings]);

    const markets = useMemo(() => manualHoldings.map(i => i.stkCd), [manualHoldings]);
    const stableMarkets = useMemo(() => markets, [markets.join(',')]);

    const handleStreamUpdate = useCallback((bufferMap: Map<string, CryptoHoldingBuffer>) => {
        setLiveOverlay(prev => {
            const next = new Map(prev);
            bufferMap.forEach((v, k) => next.set(k, {...next.get(k), ...v}));
            return next;
        });
    }, []);

    useCryptoHoldingStream(stableMarkets, handleStreamUpdate, fetchCryptoHoldingStream);

    const loadData = async () => {
        setOrderOverride(null);
        setOrderDirty(false);
        await queryClient.invalidateQueries({queryKey: ['cryptoManualHoldingList', broker.id]});
    };

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            requireOk(await deleteCryptoManualHolding(id), '수동 보유코인 삭제');
        },
        onSuccess: () => {
            loadData();
            setDeleteTarget(null);
        },
        onError: (err) => {
            console.error(err);
            setDeleteTarget(null);
        },
    });

    const reorderMutation = useMutation({
        mutationFn: async (req: HoldingReorderReq) => {
            requireOk(await reorderCryptoHoldings(req), '보유코인 순서 변경');
        },
        onSuccess: () => {
            setOrderDirty(false);
            queryClient.invalidateQueries({queryKey: ['cryptoManualHoldingList', broker.id]});
        },
        onError: (err) => console.error(err),
    });

    const balanceMutation = useMutation({
        mutationFn: async (req: UpdateBalanceReq) => {
            requireOk(await updateCryptoBrokerBalance(broker.id, req), '거래소 잔액 수정');
            return req.balance;
        },
        onSuccess: (newBalance) => {
            setBalanceOverride(String(newBalance));
            queryClient.invalidateQueries({queryKey: ['cryptoManualHoldingList', broker.id]});
        },
        onError: (err) => console.error(err),
    });

    const handleDelete = () => {
        if (!deleteTarget) return;
        deleteMutation.mutate(deleteTarget.id);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const {active, over} = event;
        if (!over || active.id === over.id) return;
        const oldIndex = holdings.findIndex(h => h.id === active.id);
        const newIndex = holdings.findIndex(h => h.id === over.id);
        const newOrder = arrayMove(holdings.map(h => h.id), oldIndex, newIndex);
        setOrderOverride(newOrder);
        setOrderDirty(true);
    };

    const handleSaveOrder = () => {
        const req: HoldingReorderReq = {orderedIds: holdings.map(h => h.id)};
        reorderMutation.mutate(req);
    };

    const handleBalanceUpdate = (newBalance: number) => {
        const req: UpdateBalanceReq = {balance: newBalance};
        balanceMutation.mutate(req);
    };

    const findManualHolding = (stkCd: string) => manualHoldings.find(h => h.stkCd === stkCd) ?? null;

    const columns: GridColDef[] = [
        {
            field: '__drag__', headerName: '', width: 40, sortable: false, disableColumnMenu: true,
            renderCell: () => <DragHandleCell/>,
        },
        {field: 'stkNm', headerName: '코인명', flex: 1.5, minWidth: 150},
        {field: 'prftRt', headerName: '수익률', flex: 0.8, minWidth: 100, renderCell: (params: {value: number}) => renderChip(params.value as number)},
        {field: 'curPrc', headerName: '현재가', flex: 1, minWidth: 100, renderCell: (params) => <BlindText>{Number(params.value).toLocaleString()}</BlindText>},
        {field: 'rmndQty', headerName: '보유수량', flex: 0.8, minWidth: 80, renderCell: (params) => <BlindText>{params.value}</BlindText>},
        {field: 'purPric', headerName: '매입가', flex: 1, minWidth: 100, valueFormatter: (value: string) => Number(value).toLocaleString()},
        {field: 'evltAmt', headerName: '평가금액', flex: 1, minWidth: 120, renderCell: (params) => <BlindText>{Number(params.value).toLocaleString()}</BlindText>},
        {field: 'evltvPrft', headerName: '평가손익', flex: 1, minWidth: 120, renderCell: (params) => <BlindText>{renderTradeColor(Number(params.value))}</BlindText>},
        {field: 'purAmt', headerName: '매입금액', flex: 1, minWidth: 120, renderCell: (params) => <BlindText>{Number(params.value).toLocaleString()}</BlindText>},
        {field: 'possRt', headerName: '비중', flex: 0.6, minWidth: 80, valueFormatter: (value: string) => `${value}%`},
        {
            field: 'actions', headerName: '', width: 70, sortable: false, filterable: false, disableColumnMenu: true, align: 'center', headerAlign: 'center',
            renderCell: (params: GridRenderCellParams) => (
                <IconButton size="small" onClick={(e) => {
                    e.stopPropagation();
                    setAnchorEl(e.currentTarget);
                    setMenuTarget(findManualHolding(params.row.stkCd));
                }}>
                    <MoreVertIcon fontSize="small"/>
                </IconButton>
            ),
        },
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
                editable={true}
                onBalanceUpdate={handleBalanceUpdate}
                dailyPl={dailyPl}
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
                <Box sx={{display: 'flex', gap: 1, alignItems: 'center'}}>
                    {orderDirty && (
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={reorderMutation.isPending ? <CircularProgress size={12} color="inherit"/> : <SaveIcon/>}
                            onClick={handleSaveOrder}
                            disabled={reorderMutation.isPending}
                        >
                            순서 저장
                        </Button>
                    )}
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon/>}
                        onClick={() => setAddOpen(true)}
                    >
                        매수
                    </Button>
                </Box>
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
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                <SortableContext items={holdings.map(h => h.id)} strategy={verticalListSortingStrategy}>
                    <DataGrid
                        rows={rows}
                        columns={columns}
                        onCellClick={(params) => {
                            if (params.field !== 'actions' && params.field !== '__drag__') {
                                navigate(`/crypto/detail/${params.row.stkCd}`);
                            }
                        }}
                        getRowClassName={(params) =>
                            params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd'
                        }
                        initialState={{
                            pagination: {paginationModel: {pageSize: 20}},
                        }}
                        pageSizeOptions={[10, 20, 50, 100]}
                        disableColumnResize
                        density="compact"
                        loading={loading}
                        slots={{row: DraggableRow}}
                        slotProps={{
                            loadingOverlay: {
                                variant: 'skeleton',
                                noRowsVariant: 'skeleton',
                            },
                        }}
                        localeText={{noRowsLabel: '데이터가 없습니다.'}}
                        sx={{
                            "& .MuiDataGrid-cell[data-field='__drag__']": {padding: 0},
                            "& .MuiDataGrid-cell[data-field='actions']": {padding: 0},
                        }}
                    />
                </SortableContext>
            </DndContext>
            </Collapse>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
            >
                <MenuItem onClick={() => {
                    setEditTarget(menuTarget);
                    setAnchorEl(null);
                }}>
                    <ListItemIcon><EditIcon fontSize="small"/></ListItemIcon>
                    <ListItemText>수정</ListItemText>
                </MenuItem>
                <MenuItem sx={{color: 'error.main'}} onClick={() => {
                    setDeleteTarget(menuTarget);
                    setAnchorEl(null);
                }}>
                    <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error"/></ListItemIcon>
                    <ListItemText>매도</ListItemText>
                </MenuItem>
            </Menu>

            <AddCryptoManualHoldingDialog
                open={addOpen}
                onClose={() => setAddOpen(false)}
                brokerId={broker.id}
                onCreated={loadData}
            />

            <EditCryptoManualHoldingDialog
                open={Boolean(editTarget)}
                onClose={() => setEditTarget(null)}
                holding={editTarget}
                onUpdated={loadData}
            />

            <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle>매도 확인</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        <b>{deleteTarget?.stkNm}</b>을(를) 매도(삭제)하시겠습니까?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteTarget(null)}>취소</Button>
                    <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteMutation.isPending}>매도</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

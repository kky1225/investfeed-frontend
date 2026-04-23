import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";
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
import {fetchManualHoldingList, deleteManualHolding, reorderHoldings, updateBrokerBalance} from "../../api/broker/BrokerApi.ts";
import type {MemberBroker, ManualHolding} from "../../type/BrokerType.ts";
import type {HoldingStock} from "../../type/HoldingType.ts";
import HoldingSummaryCard from "./HoldingSummaryCard.tsx";
import AddManualHoldingDialog from "./AddManualHoldingDialog.tsx";
import EditManualHoldingDialog from "./EditManualHoldingDialog.tsx";
import {useHoldingStream, HoldingBuffer} from "./useHoldingStream.ts";
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

// ─── ManualHoldingTab ────────────────────────────────────────────────────────

interface ManualHoldingTabProps {
    broker: MemberBroker;
}

export default function ManualHoldingTab({broker}: ManualHoldingTabProps) {
    const navigate = useNavigate();
    const [manualHoldings, setManualHoldings] = useState<ManualHolding[]>([]);
    const [holdings, setHoldings] = useState<HoldingStock[]>([]);
    const [totPurAmt, setTotPurAmt] = useState("0");
    const [totEvltAmt, setTotEvltAmt] = useState("0");
    const [totEvltPl, setTotEvltPl] = useState("0");
    const [totPrftRt, setTotPrftRt] = useState("0");
    const [balance, setBalance] = useState("0");
    const [dailyPl, setDailyPl] = useState("0");
    const [showChart, setShowChart] = useState(false);
    const {isBlind} = useBlindMode();
    const [showList, setShowList] = useState(!isBlind);
    const [addOpen, setAddOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<ManualHolding | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ManualHolding | null>(null);
    const [stkCds, setStkCds] = useState<string[]>([]);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [menuTarget, setMenuTarget] = useState<ManualHolding | null>(null);
    const [orderDirty, setOrderDirty] = useState(false);
    const [savingOrder, setSavingOrder] = useState(false);
    const [loading, setLoading] = useState(true);

    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
        useSensor(TouchSensor, {activationConstraint: {delay: 200, tolerance: 5}})
    );

    const stripSign = (v: string) => v.replace(/^[+-]/, '');

    const toHoldingStocks = useCallback((items: ManualHolding[], priceMap?: Map<string, string>): HoldingStock[] => {
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
    }, []);

    const calcDailyPl = (stocks: HoldingStock[]) =>
        stocks.reduce((sum, s) => {
            if (Number(s.predClosePric) <= 0) return sum;
            return sum + (Number(s.curPrc) - Number(s.predClosePric)) * Number(s.rmndQty);
        }, 0);

    const updateSummary = useCallback((stocks: HoldingStock[]) => {
        const totalPur = stocks.reduce((sum, s) => sum + Number(s.purAmt), 0);
        const totalEvlt = stocks.reduce((sum, s) => sum + Number(s.evltAmt), 0);
        const totalPl = totalEvlt - totalPur;
        const totalPlRt = totalPur !== 0 ? (totalPl / totalPur * 100).toFixed(2) : "0";

        setTotPurAmt(String(totalPur));
        setTotEvltAmt(String(totalEvlt));
        setTotEvltPl(String(totalPl));
        setTotPrftRt(totalPlRt);
    }, []);

    const loadData = useCallback(async () => {
        try {
            const data = await fetchManualHoldingList(broker.id);
            const items: ManualHolding[] = data.result?.holdings ?? [];
            setBalance(String(data.result?.balance ?? 0));
            setManualHoldings(items);

            const stocks = toHoldingStocks(items);
            setHoldings(stocks);
            updateSummary(stocks);
            setDailyPl(String(calcDailyPl(stocks)));
            setStkCds(items.map(i => i.stkCd));
            setOrderDirty(false);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [broker.id, toHoldingStocks, updateSummary]);

    useEffect(() => {
        setShowList(!isBlind);
    }, [isBlind]);

    useEffect(() => {
        setLoading(true);
        loadData();
    }, [loadData]);

    const handleStreamUpdate = useCallback((bufferMap: Map<string, HoldingBuffer>) => {
        setHoldings(prev => {
            const priceMap = new Map<string, string>();
            prev.forEach(s => priceMap.set(s.stkCd, s.curPrc));
            bufferMap.forEach((buffer, stkCd) => {
                if (buffer.curPrc) priceMap.set(stkCd, buffer.curPrc);
            });

            const updated = prev.map(stock => {
                const curPrc = priceMap.get(stock.stkCd) ?? stock.curPrc;
                const evltAmt = String(Number(curPrc) * Number(stock.rmndQty));
                const evltvPrft = String(Number(evltAmt) - Number(stock.purAmt));
                const prftRtVal = Number(stock.purAmt) !== 0
                    ? Number(evltvPrft) / Number(stock.purAmt) * 100 : 0;
                const prftRt = prftRtVal > 0 ? `+${prftRtVal.toFixed(2)}` : prftRtVal.toFixed(2);
                return {...stock, curPrc, evltAmt, evltvPrft, prftRt};
            });

            const totalEvlt = updated.reduce((sum, s) => sum + Number(s.evltAmt), 0);
            const withPossRt = updated.map(s => ({
                ...s,
                possRt: totalEvlt !== 0 ? (Number(s.evltAmt) / totalEvlt * 100).toFixed(2) : "0",
            }));

            updateSummary(withPossRt);
            setDailyPl(String(calcDailyPl(withPossRt)));
            return withPossRt;
        });
    }, [updateSummary]);

    const stableStkCds = useMemo(() => stkCds, [stkCds.join(',')]);
    useHoldingStream(stableStkCds, handleStreamUpdate);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteManualHolding(deleteTarget.id);
            await loadData();
        } catch (err) {
            console.error(err);
        }
        setDeleteTarget(null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const {active, over} = event;
        if (!over || active.id === over.id) return;
        const oldIndex = holdings.findIndex(h => h.id === active.id);
        const newIndex = holdings.findIndex(h => h.id === over.id);
        setHoldings(prev => arrayMove(prev, oldIndex, newIndex));
        setManualHoldings(prev => arrayMove(prev, oldIndex, newIndex));
        setOrderDirty(true);
    };

    const handleSaveOrder = async () => {
        setSavingOrder(true);
        try {
            await reorderHoldings({orderedIds: holdings.map(h => h.id)});
            setOrderDirty(false);
        } finally {
            setSavingOrder(false);
        }
    };

    const handleBalanceUpdate = async (newBalance: number) => {
        try {
            await updateBrokerBalance(broker.id, {balance: newBalance});
            setBalance(String(newBalance));
        } catch (err) {
            console.error(err);
        }
    };

    const findManualHolding = (stkCd: string) => manualHoldings.find(h => h.stkCd === stkCd) ?? null;

    const columns: GridColDef[] = [
        {
            field: '__drag__', headerName: '', width: 40, sortable: false, disableColumnMenu: true,
            renderCell: () => <DragHandleCell/>,
        },
        {field: 'stkNm', headerName: '종목명', flex: 1.5, minWidth: 150},
        {field: 'prftRt', headerName: '수익률', flex: 0.8, minWidth: 100, renderCell: (params: {value: number}) => renderChip(params.value as number)},
        {field: 'curPrc', headerName: '현재가', flex: 1, minWidth: 100, valueFormatter: (value: string) => Number(value).toLocaleString()},
        {field: 'rmndQty', headerName: '보유수량', flex: 0.8, minWidth: 80, valueFormatter: (value: string) => Number(value).toLocaleString()},
        {field: 'purPric', headerName: '매입가', flex: 1, minWidth: 100, valueFormatter: (value: string) => Number(value).toLocaleString()},
        {field: 'evltAmt', headerName: '평가금액', flex: 1, minWidth: 120, valueFormatter: (value: string) => Number(value).toLocaleString()},
        {field: 'evltvPrft', headerName: '평가손익', flex: 1, minWidth: 120, renderCell: (params: {value: string}) => renderTradeColor(Number(params.value))},
        {field: 'purAmt', headerName: '매입금액', flex: 1, minWidth: 120, valueFormatter: (value: string) => Number(value).toLocaleString()},
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
                            startIcon={savingOrder ? <CircularProgress size={12} color="inherit"/> : <SaveIcon/>}
                            onClick={handleSaveOrder}
                            disabled={savingOrder}
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
                                navigate(`/stock/detail/${params.row.stkCd}`);
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

            <AddManualHoldingDialog
                open={addOpen}
                onClose={() => setAddOpen(false)}
                brokerId={broker.id}
                onCreated={loadData}
            />

            <EditManualHoldingDialog
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
                    <Button variant="contained" color="error" onClick={handleDelete}>매도</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

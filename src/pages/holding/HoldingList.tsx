import React, {createContext, useCallback, useContext, useMemo, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {unwrapResponse} from "../../lib/apiResponse.ts";
import {useNavigate} from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import CircularProgress from "@mui/material/CircularProgress";
import {DataGrid, GridColDef, GridRow, GridRowProps} from "@mui/x-data-grid";
import PieChartRoundedIcon from "@mui/icons-material/PieChartRounded";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import SaveIcon from "@mui/icons-material/Save";
import {DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors} from "@dnd-kit/core";
import {arrayMove, SortableContext, useSortable, verticalListSortingStrategy} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import CustomPieChart from "../../components/CustomPieChart.tsx";
import {HoldingStock} from "../../type/HoldingType.ts";
import {fetchHoldingList, reorderApiHoldings} from "../../api/holding/HoldingApi.ts";
import {renderChip, renderTradeColor} from "../../components/CustomRender.tsx";
import BlindText from "../../components/BlindText.tsx";
import HoldingSummaryCard from "./HoldingSummaryCard.tsx";
import {useHoldingStream} from "./useHoldingStream.ts";
import type {HoldingBuffer} from "../../type/HoldingType.ts";
import {fetchHoldingStream} from "../../api/holding/HoldingApi.ts";
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

// ─── HoldingList ─────────────────────────────────────────────────────────────

const calcDailyPl = (stocks: HoldingStock[]) =>
    stocks.reduce((sum, s) => sum + (Number(s.curPrc) - Number(s.predClosePric)) * Number(s.rmndQty), 0);

const HoldingList = () => {
    const navigate = useNavigate();
    const [showChart, setShowChart] = useState(false);
    const {isBlind} = useBlindMode();

    // showList 는 isBlind 변경 시 리셋되지만 사용자가 토글로도 변경 가능. "reset state during render" 패턴.
    const [showList, setShowList] = useState(!isBlind);
    const [prevIsBlind, setPrevIsBlind] = useState(isBlind);
    if (isBlind !== prevIsBlind) {
        setPrevIsBlind(isBlind);
        setShowList(!isBlind);
    }

    const [orderOverride, setOrderOverride] = useState<number[] | null>(null);
    const [orderDirty, setOrderDirty] = useState(false);
    const [savingOrder, setSavingOrder] = useState(false);

    // WebSocket 으로 들어오는 실시간 부분 갱신 overlay (curPrc/rmndQty/purPric 등)
    const [liveOverlay, setLiveOverlay] = useState<Map<string, HoldingBuffer>>(new Map());

    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
        useSensor(TouchSensor, {activationConstraint: {delay: 200, tolerance: 5}})
    );

    // 한 번만 fetch (폴링 X). useQuery 가 mount 시 자동 호출 + cancel 처리.
    type HoldingListData = {
        holdingList?: HoldingStock[];
        totPurAmt?: string;
        totEvltAmt?: string;
        totEvltPl?: string;
        totPrftRt?: string;
        balance?: string;
    } | null;
    const {data: holdingData, isLoading: loading} = useQuery<HoldingListData>({
        queryKey: ['holdingList'],
        queryFn: async ({signal}) => unwrapResponse<HoldingListData>(await fetchHoldingList({signal, skipGlobalError: true}), null),
        refetchOnWindowFocus: false,
    });

    const fetchedHoldings: HoldingStock[] = holdingData?.holdingList ?? [];

    // 사용자 드래그 order + WebSocket overlay 적용한 최종 holdings
    const holdings = useMemo<HoldingStock[]>(() => {
        // 1. order override 적용 (드래그 결과)
        let ordered = fetchedHoldings;
        if (orderOverride) {
            const byId = new Map(fetchedHoldings.map(h => [h.id, h]));
            const sorted: HoldingStock[] = [];
            const seen = new Set<number>();
            for (const id of orderOverride) {
                const h = byId.get(id);
                if (h) {
                    sorted.push(h);
                    seen.add(id);
                }
            }
            // override 에 없는 새 종목은 뒤에 append
            fetchedHoldings.forEach(h => { if (!seen.has(h.id)) sorted.push(h); });
            ordered = sorted;
        }

        // 2. WebSocket overlay 적용 (curPrc/rmndQty/purPric 갱신 + 파생 필드 재계산)
        return ordered.map(stock => {
            const buffer = liveOverlay.get(stock.stkCd);
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
    }, [fetchedHoldings, orderOverride, liveOverlay]);

    // 요약 카드 totals (holdings 에서 derive)
    const totPurAmt = holdingData?.totPurAmt ?? "0";
    const balance = holdingData?.balance ?? "0";
    const totEvltAmt = useMemo(() => String(holdings.reduce((sum, s) => sum + Number(s.evltAmt), 0)), [holdings]);
    const totEvltPl = useMemo(() => String(Number(totEvltAmt) - Number(totPurAmt)), [totEvltAmt, totPurAmt]);
    const totPrftRt = useMemo(() => {
        const pur = Number(totPurAmt);
        return pur !== 0 ? (Number(totEvltPl) / pur * 100).toFixed(2) : "0";
    }, [totEvltPl, totPurAmt]);
    const dailyPl = useMemo(() => String(calcDailyPl(holdings)), [holdings]);

    // WebSocket 구독 종목 코드 — fetchedHoldings 기준 (overlay 와 무관)
    const stkCds = useMemo(() => fetchedHoldings.map(s => s.stkCd), [fetchedHoldings]);
    const stableStkCds = useMemo(() => stkCds, [stkCds.join(',')]);

    const handleStreamUpdate = useCallback((bufferMap: Map<string, HoldingBuffer>) => {
        // overlay 만 갱신. holdings/totals 는 useMemo 가 자동 재계산.
        setLiveOverlay(prev => {
            const next = new Map(prev);
            bufferMap.forEach((v, k) => next.set(k, {...next.get(k), ...v}));
            return next;
        });
    }, []);

    useHoldingStream(stableStkCds, handleStreamUpdate, fetchHoldingStream);

    const handleDragEnd = (event: DragEndEvent) => {
        const {active, over} = event;
        if (!over || active.id === over.id) return;
        const oldIndex = holdings.findIndex(h => h.id === active.id);
        const newIndex = holdings.findIndex(h => h.id === over.id);
        const newOrder = arrayMove(holdings.map(h => h.id), oldIndex, newIndex);
        setOrderOverride(newOrder);
        setOrderDirty(true);
    };

    const handleSaveOrder = async () => {
        setSavingOrder(true);
        try {
            const res = await reorderApiHoldings({orderedIds: holdings.map(h => h.id)});
            if (res.code !== "0000") throw new Error(res.message || `보유주식 순서 변경 실패 (${res.code})`);
            setOrderDirty(false);
        } finally {
            setSavingOrder(false);
        }
    };

    const columns: GridColDef[] = [
        {
            field: '__drag__', headerName: '', width: 40, sortable: false, disableColumnMenu: true,
            renderCell: () => <DragHandleCell/>,
        },
        {field: 'stkNm', headerName: '종목명', flex: 1.5, minWidth: 150},
        {field: 'prftRt', headerName: '수익률', flex: 0.8, minWidth: 100, renderCell: (params: {value: number}) => renderChip(params.value as number)},
        {field: 'curPrc', headerName: '현재가', flex: 1, minWidth: 100, renderCell: (params) => <BlindText>{Number(params.value).toLocaleString()}</BlindText>},
        {field: 'rmndQty', headerName: '보유수량', flex: 0.8, minWidth: 80, renderCell: (params) => <BlindText>{Number(params.value).toLocaleString()}</BlindText>},
        {field: 'purPric', headerName: '매입가', flex: 1, minWidth: 100, valueFormatter: (value: string) => Number(value).toLocaleString()},
        {field: 'evltAmt', headerName: '평가금액', flex: 1, minWidth: 120, renderCell: (params) => <BlindText>{Number(params.value).toLocaleString()}</BlindText>},
        {field: 'evltvPrft', headerName: '평가손익', flex: 1, minWidth: 120, renderCell: (params) => <BlindText>{renderTradeColor(Number(params.value))}</BlindText>},
        {field: 'purAmt', headerName: '매입금액', flex: 1, minWidth: 120, renderCell: (params) => <BlindText>{Number(params.value).toLocaleString()}</BlindText>},
        {field: 'possRt', headerName: '비중', flex: 0.6, minWidth: 80, valueFormatter: (value: string) => `${value}%`},
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
                            if (params.field !== '__drag__') {
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
                        }}
                    />
                </SortableContext>
            </DndContext>
            </Collapse>
        </Box>
    );
};

export default HoldingList;

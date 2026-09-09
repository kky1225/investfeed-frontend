import {mergeLive} from "../../lib/streamOverlay.ts";
import React, {createContext, useCallback, useContext, useMemo, useState} from "react";
import {useMutation, useQuery, useQueryClient} from "@tanstack/react-query";
import {requireOk} from "../../lib/apiResponse.ts";
import {useNavigate} from "react-router-dom";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
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
import type {HoldingReorderReq} from "../../type/BrokerType.ts";
import {HoldingStock, HoldingListData} from "../../type/HoldingType.ts";
import {fetchHoldingList, fetchTossHoldingList, reorderApiHoldings} from "../../api/holding/HoldingApi.ts";
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

export type HoldingSource = 'KIWOOM' | 'TOSS';

const calcDailyPl = (stocks: HoldingStock[], source: HoldingSource) =>
    source === 'TOSS'
        ? stocks.reduce((sum, s) => sum + Number(s.dayPl ?? 0), 0)
        : stocks.reduce((sum, s) => {
            const predClose = Number(s.predClosePric);
            if (!predClose) return sum;
            return sum + (Number(s.curPrc) - predClose) * Number(s.rmndQty);
        }, 0);

const HoldingList = ({source = 'KIWOOM'}: {source?: HoldingSource}) => {
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

    // WebSocket 으로 들어오는 실시간 부분 갱신 overlay (curPrc/rmndQty/purPric 등)
    const [liveOverlay, setLiveOverlay] = useState<Map<string, HoldingBuffer>>(new Map());

    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
        useSensor(TouchSensor, {activationConstraint: {delay: 200, tolerance: 5}})
    );

    // 한 번만 fetch (폴링 X). useQuery 가 mount 시 자동 호출 + cancel 처리.
    const {data: holdingData, isLoading: loading, isError} = useQuery<HoldingListData>({
        queryKey: ['holdingList', source],
        queryFn: async ({signal}) => requireOk<HoldingListData>(
            await (source === 'TOSS' ? fetchTossHoldingList : fetchHoldingList)({signal, skipGlobalError: true}), null),
        refetchOnWindowFocus: false,
    });

    // 국내·해외는 한 응답에 함께 온다. 서버가 두 시장을 모두 조회해 합계까지 계산하고,
    // 한쪽이라도 실패하면 응답 자체가 실패한다(부분 합계가 나가지 않는다).
    const usLoading = loading;

    const fetchedHoldings: HoldingStock[] = useMemo(
        () => holdingData?.holdingList ?? [],
        [holdingData],
    );

    // 사용자 드래그 order + WebSocket overlay 적용한 최종 holdings
    const holdings = useMemo<HoldingStock[]>(() => {
        // 1. order override 적용 (드래그 결과)
        let ordered = fetchedHoldings;
        if (orderOverride) {
            // 키움 해외는 member_holding 에 없어 id 가 0 이다. 정렬 대상에서 빼지 않으면
            // id 기반 Map 에서 서로 덮어써 종목이 사라진다.
            const sortable = fetchedHoldings.filter(h => h.id > 0);
            const unsortable = fetchedHoldings.filter(h => h.id <= 0);

            const byId = new Map(sortable.map(h => [h.id, h]));
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
            sortable.forEach(h => { if (!seen.has(h.id)) sorted.push(h); });
            ordered = [...sorted, ...unsortable];
        }

        // 2. WebSocket overlay 적용 (curPrc/rmndQty/purPric 갱신 + 파생 필드 재계산)
        return ordered.map(stock => {
            const buffer = liveOverlay.get(stock.stkCd);
            if (!buffer) return stock;

            if (buffer.curPrcUsd != null && Number(stock.curPrcUsd) > 0) {
                const krwPerUsd = Number(stock.curPrc) / Number(stock.curPrcUsd);
                const qty = Number(stock.rmndQty);
                const curPrcUsd = buffer.curPrcUsd;
                const evltAmtUsd = String(Number(curPrcUsd) * qty);
                const purAmtUsd = Number(stock.purPricUsd) * qty;
                const evltvPrftUsd = String(Number(evltAmtUsd) - purAmtUsd);
                const prftRtVal = purAmtUsd !== 0 ? (Number(evltvPrftUsd) / purAmtUsd) * 100 : 0;

                const evltAmt = String(Math.round(Number(evltAmtUsd) * krwPerUsd));
                return {
                    ...stock,
                    curPrcUsd,
                    evltAmtUsd,
                    evltvPrftUsd,
                    curPrc: String(Math.round(Number(curPrcUsd) * krwPerUsd)),
                    evltAmt,
                    evltvPrft: String(Number(evltAmt) - Number(stock.purAmt)),
                    prftRt: prftRtVal > 0 ? `+${prftRtVal.toFixed(2)}` : prftRtVal.toFixed(2),
                };
            }

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

    // 합계는 서버가 계산해 내려준다(국내+해외).
    const totPurAmt = String(holdingData?.totPurAmt ?? "0");
    // 토스 예수금은 Open API 미제공 → 수동 입력값(MemberBroker.balance) 사용. 수정 직후 즉시 반영용 override.
    const balance = String(holdingData?.balance ?? "0");
    // 달러 현금 — 키움은 해외 조회(ust21110), 토스는 국내와 같은 응답에 실려 온다.
    const balanceUsd = holdingData?.balanceUsd;
    // 총자산 합산용 원화 환산액. 미국 주식 평가금액도 원화로 환산해 합치므로 현금도 같은 기준으로 더한다.
    const balanceUsdKrw = holdingData?.balanceUsdKrw;
    // 실시간 시세가 들어오기 전에는 증권사가 계산한 응답값을 그대로 쓴다(증권사 화면 숫자와 일치).
    // 실시간이 붙은 뒤에는 행별 평가금액이 갱신되므로 행 합계로 전환해 요약과 표가 어긋나지 않게 한다.
    const hasLive = liveOverlay.size > 0;
    const totEvltAmt = useMemo(
        () => hasLive
            ? String(holdings.reduce((sum, s) => sum + Number(s.evltAmt), 0))
            : String(holdingData?.totEvltAmt ?? 0),
        [hasLive, holdings, holdingData],
    );
    const totEvltPl = useMemo(
        () => hasLive
            ? String(Number(totEvltAmt) - Number(totPurAmt))
            : String(holdingData?.totEvltPl ?? 0),
        [hasLive, totEvltAmt, totPurAmt, holdingData],
    );
    const totPrftRt = useMemo(() => {
        const pur = Number(totPurAmt);
        return pur !== 0 ? (Number(totEvltPl) / pur * 100).toFixed(2) : "0";
    }, [totEvltPl, totPurAmt]);
    const dailyPl = useMemo(() => String(calcDailyPl(holdings, source)), [holdings, source]);

    // WebSocket 구독 종목 코드 — fetchedHoldings 기준 (overlay 와 무관)
    const stkCds = useMemo(() => fetchedHoldings.map(s => s.stkCd), [fetchedHoldings]);
    const stableStkCds = useMemo(() => stkCds, [stkCds.join(',')]);

    const handleStreamUpdate = useCallback((bufferMap: Map<string, HoldingBuffer>) => {
        // overlay 만 갱신. holdings/totals 는 useMemo 가 자동 재계산.
        setLiveOverlay(prev => mergeLive(prev, bufferMap, (v, prevValue) => ({...prevValue, ...v})));
    }, []);

    const streamStkCds = stableStkCds;
    useHoldingStream(streamStkCds, handleStreamUpdate, fetchHoldingStream, source === 'TOSS');

    const handleDragEnd = (event: DragEndEvent) => {
        const {active, over} = event;
        if (!over || active.id === over.id) return;
        const oldIndex = holdings.findIndex(h => h.id === active.id);
        const newIndex = holdings.findIndex(h => h.id === over.id);
        const newOrder = arrayMove(holdings.map(h => h.id), oldIndex, newIndex);
        setOrderOverride(newOrder);
        setOrderDirty(true);
    };

    const queryClient = useQueryClient();
    const reorderMutation = useMutation({
        mutationFn: async (req: HoldingReorderReq) => {
            requireOk(await reorderApiHoldings(req), '보유주식 순서 변경');
        },
        onSuccess: () => {
            setOrderDirty(false);
            queryClient.invalidateQueries({queryKey: ['holdingList', source]});
        },
        onError: (err) => console.error(err),
    });

    const handleSaveOrder = () => {
        // member_holding 에 없는 종목(키움 해외, id=0)은 정렬 대상이 아니다.
        const req: HoldingReorderReq = {orderedIds: holdings.filter(h => h.id > 0).map(h => h.id)};
        reorderMutation.mutate(req);
    };

    // 해외 표는 거래 통화(USD) 기준으로 보여준다 — 미국 실시간(FE)도 달러로 오므로 값이 그대로 이어진다.
    // 원화 필드는 요약·비중 계산에만 쓰고 표에는 노출하지 않는다.
    const buildColumns = (currency: 'KRW' | 'USD'): GridColDef[] => {
        const usd = currency === 'USD';
        const money = (v: unknown) => {
            const n = Number(v);
            if (!Number.isFinite(n)) return '-';
            return usd
                ? `$${n.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                : n.toLocaleString();
        };
        const f = (base: string) => usd ? `${base}Usd` : base;

        return [
            {
                // member_holding 에 없는 종목(키움 해외)은 정렬 대상이 아니라 핸들을 감춘다.
                field: '__drag__', headerName: '', width: 40, sortable: false, disableColumnMenu: true,
                renderCell: (params) => typeof params.row.id === 'number' ? <DragHandleCell/> : null,
            },
            {field: 'stkNm', headerName: '종목명', flex: 1.5, minWidth: 150},
            {field: 'prftRt', headerName: '수익률', flex: 0.8, minWidth: 100, renderCell: (params: {value: number}) => renderChip(params.value as number)},
            {field: f('curPrc'), headerName: '현재가', flex: 1, minWidth: 100, renderCell: (params) => <BlindText>{money(params.value)}</BlindText>},
            {field: 'rmndQty', headerName: '보유수량', flex: 0.8, minWidth: 80, renderCell: (params) => <BlindText>{Number(params.value).toLocaleString()}</BlindText>},
            {field: f('purPric'), headerName: '매입가', flex: 1, minWidth: 100, valueFormatter: (value: string) => money(value)},
            {field: f('evltAmt'), headerName: '평가금액', flex: 1, minWidth: 120, renderCell: (params) => <BlindText>{money(params.value)}</BlindText>},
            {field: f('evltvPrft'), headerName: '평가손익', flex: 1, minWidth: 120, renderCell: (params) => <BlindText>{renderTradeColor(Number(params.value), currency)}</BlindText>},
            {field: f('purAmt'), headerName: '매입금액', flex: 1, minWidth: 120, renderCell: (params) => <BlindText>{money(params.value)}</BlindText>},
            {field: 'possRt', headerName: '비중', flex: 0.6, minWidth: 80, valueFormatter: (value: string) => `${value}%`},
        ];
    };

    const krColumns = buildColumns('KRW');
    const usColumns = buildColumns('USD');

    // 키움 해외는 member_holding 미참여로 id 가 전부 0 이라 DataGrid 고유 키 제약을 어긴다 → 종목코드를 키로 쓴다.
    // 국내·토스는 기존대로 member_holding id 를 유지해 드래그 정렬이 그대로 동작한다.
    // 비중(possRt)은 서버가 계좌 전체(국내+해외) 기준으로 계산해 내려준다.
    // 실시간으로 평가금액이 바뀐 뒤에만 화면에서 다시 계산한다.
    const totalEvltAmtNum = Number(totEvltAmt);
    const needPossRtRecalc = hasLive;

    const rows = holdings.map(stock => ({
        id: stock.id > 0 ? stock.id : stock.stkCd,
        stkCd: stock.stkCd,
        stkNm: stock.stkNm,
        curPrc: stock.curPrc,
        rmndQty: stock.rmndQty,
        purPric: stock.purPric,
        purAmt: stock.purAmt,
        evltAmt: stock.evltAmt,
        evltvPrft: stock.evltvPrft,
        prftRt: stock.prftRt,
        possRt: needPossRtRecalc && totalEvltAmtNum > 0
            ? (Number(stock.evltAmt) / totalEvltAmtNum * 100).toFixed(2)
            : stock.possRt,
        curPrcUsd: stock.curPrcUsd,
        purPricUsd: stock.purPricUsd,
        evltAmtUsd: stock.evltAmtUsd,
        evltvPrftUsd: stock.evltvPrftUsd,
        purAmtUsd: stock.purPricUsd ? String(Number(stock.purPricUsd) * Number(stock.rmndQty)) : undefined,
        stexTp: stock.stexTp,
        usStkCd: stock.usStkCd,
    }));

    const krRows = rows.filter(r => !r.stexTp);
    const usRows = rows.filter(r => !!r.stexTp);
    const showKrSection = loading || krRows.length > 0;
    const showUsSection = usLoading || usRows.length > 0;

    const renderEmpty = (message: string) => (
        <Typography variant="body2" color="text.secondary" sx={{py: 1.5, px: 1}}>
            {message}
        </Typography>
    );

    const renderGrid = (gridRows: typeof rows, sectionLoading: boolean, columns: GridColDef[] = krColumns) => (
        <SortableContext items={gridRows.map(r => r.id)} strategy={verticalListSortingStrategy}>
            <DataGrid
                rows={gridRows}
                columns={columns}
                onCellClick={(params) => {
                    if (params.field === '__drag__') return;

                    if (params.row.stexTp) {
                        navigate(`/us-stock/detail/${params.row.stexTp}/${params.row.usStkCd}`);
                        return;
                    }
                    navigate(`/stock/detail/${params.row.stkCd}`);
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
                loading={sectionLoading}
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
    );

    if (isError) {
        return (
            <Alert severity="warning" sx={{mb: 2}}>
                보유종목을 불러오지 못했습니다.
            </Alert>
        );
    }

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <HoldingSummaryCard
                totPurAmt={totPurAmt}
                totEvltAmt={totEvltAmt}
                totEvltPl={totEvltPl}
                totPrftRt={totPrftRt}
                balance={balance}
                balanceLabel="원화"
                balanceUsd={balanceUsd}
                balanceUsdKrw={balanceUsdKrw}
                balanceUsdLabel="달러"
                dailyPl={dailyPl}
                loading={loading}
                editable={false}
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
                        startIcon={reorderMutation.isPending ? <CircularProgress size={12} color="inherit"/> : <SaveIcon/>}
                        onClick={handleSaveOrder}
                        disabled={reorderMutation.isPending}
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
                <Stack spacing={3}>
                    {showKrSection && (
                        <Box>
                            <Typography variant="subtitle2" sx={{fontWeight: 600, mb: 1}}>국내</Typography>
                            {renderGrid(krRows, loading)}
                        </Box>
                    )}
                    {showUsSection && (
                        <Box>
                            <Typography variant="subtitle2" sx={{fontWeight: 600, mb: 1}}>해외</Typography>
                            {renderGrid(usRows, usLoading, usColumns)}
                        </Box>
                    )}
                    {!showKrSection && !showUsSection && renderEmpty('보유 종목이 없습니다.')}
                </Stack>
            </DndContext>
            </Collapse>
        </Box>
    );
};

export default HoldingList;

import React, {createContext, useContext, useEffect, useRef, useState} from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Skeleton from "@mui/material/Skeleton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SaveIcon from "@mui/icons-material/Save";
import {DataGrid, GridActionsCellItem, GridColDef, GridRow, GridRowProps} from "@mui/x-data-grid";
import {DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors} from "@dnd-kit/core";
import {arrayMove, SortableContext, useSortable, verticalListSortingStrategy} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {useNavigate, useParams} from "react-router-dom";
import {
    addInterestItem,
    createInterestGroup,
    deleteInterestGroup,
    deleteInterestItem,
    fetchInterestGroups,
    fetchInterestItems,
    fetchInterestItemsStream,
    reorderInterestGroups,
    reorderInterestItems,
    updateInterestGroup,
} from "../../api/interest/InterestApi.ts";
import {InterestGroup, InterestItem} from "../../type/InterestType.ts";
import {renderChip} from "../../components/CustomRender.tsx";
import {fetchTimeNow} from "../../api/time/TimeApi.ts";
import {MarketType} from "../../type/timeType.ts";
import {fetchStockSearch} from "../../api/stock/StockApi.ts";

interface StockSearchItem {
    stkCd: string;
    stkNm: string;
    marketName: string;
}

interface GroupMenuState {
    anchorEl: HTMLElement;
    group: InterestGroup;
}

interface SortableGroupItemProps {
    group: InterestGroup;
    selected: boolean;
    onSelect: () => void;
    onMenuOpen: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

// ─── 그룹 드래그 아이템 ───────────────────────────────────────────────────────

const SortableGroupItem = ({group, selected, onSelect, onMenuOpen}: SortableGroupItemProps) => {
    const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: group.id});

    return (
        <Box
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
                opacity: isDragging ? 0.5 : 1,
            }}
        >
            <ListItem
                disablePadding
                secondaryAction={
                    <IconButton
                        size="small"
                        edge="end"
                        sx={{width: 26, height: 26}}
                        onClick={(e) => {
                            e.stopPropagation();
                            onMenuOpen(e);
                        }}
                    >
                        <MoreVertIcon sx={{fontSize: 16}}/>
                    </IconButton>
                }
            >
                <Box
                    {...attributes}
                    {...listeners}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        pl: 0.5,
                        cursor: "grab",
                        color: "text.disabled",
                        "&:active": {cursor: "grabbing"},
                    }}
                >
                    <DragIndicatorIcon sx={{fontSize: 16}}/>
                </Box>
                <ListItemButton selected={selected} onClick={onSelect} sx={{pr: 5, pl: 0.5}}>
                    <ListItemText
                        primary={group.groupNm}
                        slotProps={{primary: {variant: "body2", noWrap: true}}}
                    />
                </ListItemButton>
            </ListItem>
        </Box>
    );
};

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

const Interest = () => {
    const navigate = useNavigate();
    const {groupId} = useParams<{ groupId: string }>();

    const [groups, setGroups] = useState<InterestGroup[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<InterestGroup | null>(null);
    const [items, setItems] = useState<InterestItem[]>([]);
    const [groupsLoading, setGroupsLoading] = useState(false);
    const [itemsLoading, setItemsLoading] = useState(false);

    const [groupOrderDirty, setGroupOrderDirty] = useState(false);
    const [savingGroupOrder, setSavingGroupOrder] = useState(false);
    const [itemOrderDirty, setItemOrderDirty] = useState(false);
    const [savingItemOrder, setSavingItemOrder] = useState(false);

    const [addGroupOpen, setAddGroupOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");

    const [editGroupOpen, setEditGroupOpen] = useState(false);
    const [editGroupName, setEditGroupName] = useState("");
    const [editGroupId, setEditGroupId] = useState<number | null>(null);

    const [deleteGroupTarget, setDeleteGroupTarget] = useState<InterestGroup | null>(null);

    const [groupMenu, setGroupMenu] = useState<GroupMenuState | null>(null);

    const [addItemOpen, setAddItemOpen] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState("");
    const [searchResults, setSearchResults] = useState<StockSearchItem[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedStock, setSelectedStock] = useState<StockSearchItem | null>(null);
    const [addItemError, setAddItemError] = useState("");
    const [newGroupError, setNewGroupError] = useState("");
    const [editGroupError, setEditGroupError] = useState("");
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadingGroupRef = useRef<number | null>(null);
    const socketRef = useRef<WebSocket | null>(null);

    // 클릭과 드래그를 구분하기 위해 distance: 5 적용, 모바일 터치 지원
    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 5}}),
        useSensor(TouchSensor, {activationConstraint: {delay: 200, tolerance: 5}})
    );

    useEffect(() => {
        loadGroups();
        return () => {
            socketRef.current?.close();
        };
    }, []);

    const loadGroups = async () => {
        setGroupsLoading(true);
        setGroupOrderDirty(false);
        try {
            const data = await fetchInterestGroups();
            if (data.code !== "0000") throw new Error(data.message || `관심 그룹 조회 실패 (${data.code})`);
            const groupList: InterestGroup[] = data.result ?? [];
            setGroups(groupList);
            if (groupList.length > 0) {
                const target = groupId
                    ? groupList.find(g => g.id === Number(groupId)) ?? groupList[0]
                    : groupList[0];
                setSelectedGroup(target);
                loadItems(target.id);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setGroupsLoading(false);
        }
    };

    const loadItems = async (groupId: number) => {
        if (loadingGroupRef.current === groupId) return;
        loadingGroupRef.current = groupId;
        setItemsLoading(true);
        setItemOrderDirty(false);
        try {
            const data = await fetchInterestItems(groupId);
            if (data.code !== "0000") throw new Error(data.message || `관심 종목 조회 실패 (${data.code})`);
            setItems(data.result ?? []);

            socketRef.current?.close();
            const marketInfo = await fetchTimeNow({marketType: MarketType.STOCK});
            if (marketInfo.code !== "0000") throw new Error(marketInfo.message || `시장 시간 조회 실패 (${marketInfo.code})`);
            if (marketInfo.result.isMarketOpen) {
                const streamRes = await fetchInterestItemsStream(groupId);
                if (streamRes.code !== "0000") throw new Error(streamRes.message || `관심 종목 스트림 실패 (${streamRes.code})`);
                socketRef.current = openSocket();
            }
        } catch (err) {
            console.error(err);
        } finally {
            setItemsLoading(false);
            loadingGroupRef.current = null;
        }
    };

    const openSocket = () => {
        const socket = new WebSocket("ws://localhost:8080/ws");
        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.trnm === "REAL" && Array.isArray(data.data)) {
                setItems(prev => prev.map(item => {
                    const newData = data.data.find((entry: { item: string; values: Record<string, string> }) => entry.item === item.stkCd);
                    if (newData) {
                        return {...item, curPrc: newData.values["10"], fluRt: newData.values["12"]};
                    }
                    return item;
                }));
            }
        };
        return socket;
    };

    const handleSelectGroup = (group: InterestGroup) => {
        setSelectedGroup(group);
        navigate(`/stock/interest/list/${group.id}`, {replace: true});
        setItems([]);
        socketRef.current?.close();
        socketRef.current = null;
        loadItems(group.id);
    };

    const handleAddGroup = async () => {
        if (!newGroupName.trim()) {
            setNewGroupError("그룹명을 입력해주세요.");
            return;
        }
        setNewGroupError("");
        try {
            const res = await createInterestGroup({groupNm: newGroupName.trim()});
            if (res.code !== "0000" || !res.result) throw new Error(res.message || `관심 그룹 생성 실패 (${res.code})`);
            const created: InterestGroup = res.result;
            setGroups(prev => [...prev, created]);
            setAddGroupOpen(false);
            setNewGroupName("");
            setSelectedGroup(created);
            setItems([]);
        } catch (err) {
            console.error(err);
            const axiosErr = err as {response?: {status?: number; data?: {code?: string; result?: Record<string, string>}}};
            if (axiosErr.response?.status === 400 && axiosErr.response?.data?.code === 'VALIDATION_4001') {
                setNewGroupError(axiosErr.response.data.result?.groupNm ?? "그룹명을 확인해주세요.");
            }
        }
    };

    const handleEditGroup = async () => {
        if (!editGroupName.trim()) {
            setEditGroupError("그룹명을 입력해주세요.");
            return;
        }
        if (!editGroupId) return;
        setEditGroupError("");
        try {
            const res = await updateInterestGroup(editGroupId, {groupNm: editGroupName.trim()});
            if (res.code !== "0000") throw new Error(res.message || `관심 그룹 수정 실패 (${res.code})`);
            setGroups(prev =>
                prev.map(g => g.id === editGroupId ? {...g, groupNm: editGroupName.trim()} : g)
            );
            if (selectedGroup?.id === editGroupId) {
                setSelectedGroup(prev => prev ? {...prev, groupNm: editGroupName.trim()} : prev);
            }
            setEditGroupOpen(false);
            setEditGroupId(null);
        } catch (err) {
            console.error(err);
            const axiosErr = err as {response?: {status?: number; data?: {code?: string; result?: Record<string, string>}}};
            if (axiosErr.response?.status === 400 && axiosErr.response?.data?.code === 'VALIDATION_4001') {
                setEditGroupError(axiosErr.response.data.result?.groupNm ?? "그룹명을 확인해주세요.");
            }
        }
    };

    const handleDeleteGroup = async () => {
        if (!deleteGroupTarget) return;
        const res = await deleteInterestGroup(deleteGroupTarget.id);
        if (res.code !== "0000") throw new Error(res.message || `관심 그룹 삭제 실패 (${res.code})`);
        const newGroups = groups.filter(g => g.id !== deleteGroupTarget.id);
        setGroups(newGroups);
        if (selectedGroup?.id === deleteGroupTarget.id) {
            if (newGroups.length > 0) {
                setSelectedGroup(newGroups[0]);
                loadItems(newGroups[0].id);
            } else {
                setSelectedGroup(null);
                setItems([]);
            }
        }
        setGroupOrderDirty(false);
        setDeleteGroupTarget(null);
    };

    const handleGroupDragEnd = (event: DragEndEvent) => {
        const {active, over} = event;
        if (!over || active.id === over.id) return;
        const oldIndex = groups.findIndex(g => g.id === active.id);
        const newIndex = groups.findIndex(g => g.id === over.id);
        setGroups(prev => arrayMove(prev, oldIndex, newIndex));
        setGroupOrderDirty(true);
    };

    const handleItemDragEnd = (event: DragEndEvent) => {
        const {active, over} = event;
        if (!over || active.id === over.id) return;
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        setItems(prev => arrayMove(prev, oldIndex, newIndex));
        setItemOrderDirty(true);
    };

    const handleSaveGroupOrder = async () => {
        setSavingGroupOrder(true);
        try {
            const res = await reorderInterestGroups({orderedIds: groups.map(g => g.id)});
            if (res.code !== "0000") throw new Error(res.message || `관심 그룹 순서 변경 실패 (${res.code})`);
            setGroupOrderDirty(false);
        } finally {
            setSavingGroupOrder(false);
        }
    };

    const handleSaveItemOrder = async () => {
        if (!selectedGroup) return;
        setSavingItemOrder(true);
        try {
            const res = await reorderInterestItems(selectedGroup.id, {orderedIds: items.map(i => i.id)});
            if (res.code !== "0000") throw new Error(res.message || `관심 종목 순서 변경 실패 (${res.code})`);
            setItemOrderDirty(false);
        } finally {
            setSavingItemOrder(false);
        }
    };

    const handleSearchKeywordChange = (keyword: string) => {
        setSearchKeyword(keyword);
        setAddItemError("");
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        if (!keyword.trim()) {
            setSearchResults([]);
            return;
        }
        searchTimerRef.current = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const data = await fetchStockSearch(keyword.trim());
                if (data.code !== "0000") throw new Error(data.message || `주식 검색 실패 (${data.code})`);
                setSearchResults(data.result ?? []);
            } catch (error) {
                console.error(error);
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
    };

    const handleAddItem = async () => {
        if (!selectedGroup) return;
        if (!selectedStock) {
            setAddItemError("종목을 선택해주세요.");
            return;
        }
        try {
            const res = await addInterestItem(selectedGroup.id, {
                stkCd: selectedStock.stkCd,
                stkNm: selectedStock.stkNm,
            });
            if (res.code !== "0000") throw new Error(res.message || `관심 종목 추가 실패 (${res.code})`);
            await loadItems(selectedGroup.id);
            setAddItemOpen(false);
            setSearchKeyword("");
            setSearchResults([]);
            setSelectedStock(null);
            setAddItemError("");
        } catch (error) {
            console.error(error);
            setAddItemError("이미 추가된 종목이거나 오류가 발생했습니다.");
        }
    };

    const handleDeleteItem = async (itemId: number) => {
        if (!selectedGroup) return;
        const res = await deleteInterestItem(selectedGroup.id, itemId);
        if (res.code !== "0000") throw new Error(res.message || `관심 종목 삭제 실패 (${res.code})`);
        setItems(prev => prev.filter(i => i.id !== itemId));
    };

    const columns: GridColDef[] = [
        {
            field: "__drag__",
            headerName: "",
            width: 40,
            sortable: false,
            disableColumnMenu: true,
            renderCell: () => <DragHandleCell/>,
        },
        {field: "stkNm", headerName: "주식명", flex: 1.5, minWidth: 140},
        {
            field: "fluRt",
            headerName: "등락률",
            flex: 0.5,
            minWidth: 100,
            renderCell: (params) => renderChip(params.value as string),
        },
        {
            field: "curPrc",
            headerName: "현재가",
            flex: 1,
            minWidth: 100,
            valueFormatter: (param: string) =>
                param ? Number(param).toLocaleString().replace(/^[+-]/, "") : "-",
        },
        {
            field: "actions",
            type: "actions",
            headerName: "",
            width: 48,
            getActions: (params) => [
                <GridActionsCellItem
                    icon={<DeleteOutlineIcon fontSize="small"/>}
                    label="삭제"
                    color="error"
                    sx={{width: 26, height: 26}}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteItem(params.row.id);
                    }}
                />,
            ],
        },
    ];

    const rows = items.map(item => ({
        id: item.id,
        stkNm: item.stkNm,
        stkCd: item.stkCd,
        curPrc: item.curPrc,
        fluRt: item.fluRt,
    }));

    return (
        <Box sx={{width: "100%", maxWidth: {sm: "100%", md: "1700px"}}}>
            <Typography component="h2" variant="h6" sx={{mb: 2}}>
                관심 종목
            </Typography>

            <Stack direction={{xs: "column", md: "row"}} sx={{gap: 2, alignItems: "flex-start"}}>
                {/* 그룹 패널 */}
                <Box
                    sx={{
                        width: {xs: "100%", md: 220},
                        flexShrink: 0,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        overflow: "hidden",
                    }}
                >
                    <Stack
                        direction="row"
                        sx={{
                            px: 2,
                            py: 1,
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderBottom: "1px solid",
                            borderColor: "divider",
                            bgcolor: "action.hover",
                        }}
                    >
                        <Typography variant="body2" fontWeight={600}>그룹</Typography>
                        <Stack direction="row" sx={{gap: 0.5, alignItems: "center"}}>
                            {groupOrderDirty && (
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="primary"
                                    startIcon={savingGroupOrder ? <CircularProgress size={12} color="inherit"/> : <SaveIcon sx={{fontSize: 14}}/>}
                                    onClick={handleSaveGroupOrder}
                                    disabled={savingGroupOrder}
                                    sx={{fontSize: 11, px: 1, py: 0.25, minWidth: 0}}
                                >
                                    저장
                                </Button>
                            )}
                            <IconButton
                                size="small"
                                color="primary"
                                onClick={() => {
                                    setNewGroupName("");
                                    setAddGroupOpen(true);
                                }}
                            >
                                <AddIcon fontSize="small"/>
                            </IconButton>
                        </Stack>
                    </Stack>

                    {groupsLoading ? (
                        <Stack sx={{p: 1}} spacing={0.5}>
                            {Array.from({length: 5}).map((_, i) => (
                                <Box key={i} sx={{display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.75}}>
                                    <Skeleton variant="circular" width={16} height={16}/>
                                    <Skeleton width="70%" height={20}/>
                                </Box>
                            ))}
                        </Stack>
                    ) : groups.length === 0 ? (
                        <Box sx={{p: 2, textAlign: "center"}}>
                            <FolderOpenIcon sx={{color: "text.disabled", fontSize: 32, mb: 0.5}}/>
                            <Typography variant="caption" color="text.secondary" display="block">
                                그룹을 추가해주세요
                            </Typography>
                        </Box>
                    ) : (
                        <DndContext sensors={sensors} onDragEnd={handleGroupDragEnd}>
                            <SortableContext items={groups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                                <List dense disablePadding>
                                    {groups.map((group, idx) => (
                                        <Box key={group.id}>
                                            {idx > 0 && <Divider/>}
                                            <SortableGroupItem
                                                group={group}
                                                selected={selectedGroup?.id === group.id}
                                                onSelect={() => handleSelectGroup(group)}
                                                onMenuOpen={(e) => setGroupMenu({anchorEl: e.currentTarget, group})}
                                            />
                                        </Box>
                                    ))}
                                </List>
                            </SortableContext>
                        </DndContext>
                    )}
                </Box>

                {/* 종목 패널 */}
                <Box sx={{flex: 1, minWidth: 0, width: '100%'}}>
                    <Stack
                        direction="row"
                        sx={{mb: 1.5, alignItems: "center", justifyContent: "space-between"}}
                    >
                        <Stack direction="row" sx={{alignItems: "center", gap: 1}}>
                            <Typography variant="body1" fontWeight={500}>
                                {selectedGroup ? selectedGroup.groupNm : "그룹을 선택하세요"}
                            </Typography>
                            {selectedGroup && (
                                <Chip label={`${items.length}종목`} size="small" variant="outlined"/>
                            )}
                        </Stack>
                        <Stack direction="row" sx={{gap: 1, alignItems: "center"}}>
                            {itemOrderDirty && (
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={savingItemOrder ? <CircularProgress size={12} color="inherit"/> : <SaveIcon/>}
                                    onClick={handleSaveItemOrder}
                                    disabled={savingItemOrder}
                                >
                                    순서 저장
                                </Button>
                            )}
                            {selectedGroup && (
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<AddIcon/>}
                                    onClick={() => {
                                        setSearchKeyword("");
                                        setSearchResults([]);
                                        setSelectedStock(null);
                                        setAddItemError("");
                                        setAddItemOpen(true);
                                    }}
                                >
                                    종목 추가
                                </Button>
                            )}
                        </Stack>
                    </Stack>

                    {!selectedGroup ? (
                        <Box
                            sx={{
                                height: 300,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 1,
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                왼쪽에서 그룹을 선택하거나 새 그룹을 만들어주세요.
                            </Typography>
                        </Box>
                    ) : (
                        <Box sx={{overflowX: 'auto', WebkitOverflowScrolling: 'touch'}}>
                        <DndContext sensors={sensors} onDragEnd={handleItemDragEnd}>
                            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                <DataGrid
                                    rows={rows}
                                    columns={columns}
                                    getRowClassName={(params) =>
                                        params.indexRelativeToCurrentPage % 2 === 0 ? "even" : "odd"
                                    }
                                    initialState={{
                                        pagination: {paginationModel: {pageSize: 20}},
                                    }}
                                    pageSizeOptions={[10, 20, 50, 100]}
                                    disableColumnResize
                                    density="compact"
                                    loading={itemsLoading}
                                    onRowClick={(params) => navigate(`/stock/detail/${params.row.stkCd}`)}
                                    slots={{row: DraggableRow}}
                                    sx={{
                                        cursor: "pointer",
                                        "& .MuiDataGrid-cell[data-field='actions']": {padding: 0},
                                        "& .MuiDataGrid-cell[data-field='__drag__']": {padding: 0},
                                    }}
                                    slotProps={{
                                        loadingOverlay: {
                                            variant: "skeleton",
                                            noRowsVariant: "skeleton",
                                        },
                                        filterPanel: {
                                            filterFormProps: {
                                                logicOperatorInputProps: {variant: "outlined", size: "small"},
                                                columnInputProps: {variant: "outlined", size: "small", sx: {mt: "auto"}},
                                                operatorInputProps: {variant: "outlined", size: "small", sx: {mt: "auto"}},
                                                valueInputProps: {InputComponentProps: {variant: "outlined", size: "small"}},
                                            },
                                        },
                                    }}
                                />
                            </SortableContext>
                        </DndContext>
                        </Box>
                    )}
                </Box>
            </Stack>

            {/* 그룹 컨텍스트 메뉴 */}
            <Menu
                anchorEl={groupMenu?.anchorEl ?? null}
                open={Boolean(groupMenu)}
                onClose={() => setGroupMenu(null)}
            >
                <MenuItem onClick={() => {
                    setEditGroupName(groupMenu!.group.groupNm);
                    setEditGroupId(groupMenu!.group.id);
                    setEditGroupOpen(true);
                    setGroupMenu(null);
                }}>
                    이름 변경
                </MenuItem>
                <MenuItem sx={{color: "error.main"}} onClick={() => {
                    setDeleteGroupTarget(groupMenu!.group);
                    setGroupMenu(null);
                }}>
                    그룹 삭제
                </MenuItem>
            </Menu>

            {/* 그룹 추가 다이얼로그 */}
            <Dialog open={addGroupOpen} onClose={() => { setAddGroupOpen(false); setNewGroupError(""); }} maxWidth="xs" fullWidth>
                <DialogTitle>그룹 추가</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus fullWidth required size="small" label="그룹명"
                        value={newGroupName}
                        onChange={e => { setNewGroupName(e.target.value); if (newGroupError) setNewGroupError(""); }}
                        onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && handleAddGroup()}
                        error={!!newGroupError} helperText={newGroupError}
                        sx={{mt: 1}}
                        slotProps={{htmlInput: {maxLength: 20}}}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setAddGroupOpen(false); setNewGroupError(""); }}>취소</Button>
                    <Button onClick={handleAddGroup}>추가</Button>
                </DialogActions>
            </Dialog>

            {/* 그룹 수정 다이얼로그 */}
            <Dialog open={editGroupOpen} onClose={() => { setEditGroupOpen(false); setEditGroupError(""); }} maxWidth="xs" fullWidth>
                <DialogTitle>그룹 이름 변경</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus fullWidth required size="small" label="그룹명"
                        value={editGroupName}
                        onChange={e => { setEditGroupName(e.target.value); if (editGroupError) setEditGroupError(""); }}
                        onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && handleEditGroup()}
                        error={!!editGroupError} helperText={editGroupError}
                        sx={{mt: 1}}
                        slotProps={{htmlInput: {maxLength: 20}}}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setEditGroupOpen(false); setEditGroupError(""); }}>취소</Button>
                    <Button onClick={handleEditGroup}>저장</Button>
                </DialogActions>
            </Dialog>

            {/* 그룹 삭제 확인 다이얼로그 */}
            <Dialog open={Boolean(deleteGroupTarget)} onClose={() => setDeleteGroupTarget(null)} maxWidth="xs" fullWidth>
                <DialogTitle>그룹 삭제</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        <b>{deleteGroupTarget?.groupNm}</b> 그룹을 삭제하시겠습니까?
                        <br/>
                        그룹 내 모든 관심종목도 함께 삭제됩니다.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteGroupTarget(null)}>취소</Button>
                    <Button variant="contained" color="error" onClick={handleDeleteGroup}>삭제</Button>
                </DialogActions>
            </Dialog>

            {/* 종목 추가 다이얼로그 */}
            <Dialog open={addItemOpen} onClose={() => setAddItemOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>종목 추가</DialogTitle>
                <DialogContent>
                    <Box sx={{mt: 1}}>
                        <Autocomplete
                            size="small"
                            options={searchResults}
                            getOptionLabel={(option) => `${option.stkNm} (${option.stkCd})`}
                            filterOptions={(x) => x}
                            loading={searchLoading}
                            value={selectedStock}
                            inputValue={searchKeyword}
                            onInputChange={(_, value) => handleSearchKeywordChange(value)}
                            onChange={(_, value) => {
                                setSelectedStock(value);
                                setAddItemError("");
                            }}
                            noOptionsText={searchKeyword ? "검색 결과 없음" : "종목명을 입력하세요"}
                            forcePopupIcon={false}
                            slotProps={{
                                clearIndicator: {size: "small", sx: {padding: "1px", "& svg": {fontSize: "16px"}}},
                            }}
                            renderOption={(props, option) => (
                                <Box component="li" {...props} key={`${option.stkCd}-${option.marketName}`}>
                                    <Stack direction="row" sx={{width: "100%", justifyContent: "space-between", alignItems: "center", gap: 1}}>
                                        <Box>
                                            <Typography variant="body2">{option.stkNm}</Typography>
                                            <Typography variant="caption" color="text.secondary">{option.stkCd}</Typography>
                                        </Box>
                                        <Typography variant="caption" color="text.secondary" sx={{flexShrink: 0}}>
                                            {option.marketName}
                                        </Typography>
                                    </Stack>
                                </Box>
                            )}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    autoFocus
                                    label="종목 검색"
                                    placeholder="종목명을 입력하세요"
                                    error={Boolean(addItemError)}
                                    helperText={addItemError}
                                    slotProps={{
                                        input: {
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {searchLoading ? <CircularProgress size={16}/> : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }
                                    }}
                                />
                            )}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddItemOpen(false)}>취소</Button>
                    <Button onClick={handleAddItem} disabled={!selectedStock}>추가</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Interest;

import {useEffect, useRef, useState} from "react";
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
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import SaveIcon from "@mui/icons-material/Save";
import {GridActionsCell, GridActionsCellItem, GridColDef, GridRenderCellParams} from "@mui/x-data-grid";
import {DataGridPro} from "@mui/x-data-grid-pro";
import {DndContext, DragEndEvent, PointerSensor, useSensor, useSensors} from "@dnd-kit/core";
import {arrayMove, SortableContext, useSortable, verticalListSortingStrategy} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {
    addInterestItem,
    createInterestGroup,
    deleteInterestGroup,
    deleteInterestItem,
    fetchInterestGroups,
    fetchInterestItems,
    reorderInterestGroups,
    reorderInterestItems,
    updateInterestGroup,
} from "../../api/interest/InterestApi.ts";
import {InterestGroup, InterestItem} from "../../type/InterestType.ts";
import {renderChip} from "../../components/CustomRender.tsx";

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
                <ListItemButton
                    selected={selected}
                    onClick={onSelect}
                    sx={{pr: 5, pl: 0.5}}
                >
                    <ListItemText
                        primary={group.groupNm}
                        slotProps={{
                            primary: {
                                variant: "body2",
                                noWrap: true,
                            }
                        }}
                    />
                </ListItemButton>
            </ListItem>
        </Box>
    );
};

const Interest = () => {
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

    const [deleteGroupOpen, setDeleteGroupOpen] = useState(false);

    const [groupMenu, setGroupMenu] = useState<GroupMenuState | null>(null);

    const [addItemOpen, setAddItemOpen] = useState(false);
    const [newItemStkCd, setNewItemStkCd] = useState("");
    const [newItemStkNm, setNewItemStkNm] = useState("");
    const [addItemError, setAddItemError] = useState("");

    const loadingGroupRef = useRef<number | null>(null);

    const sensors = useSensors(useSensor(PointerSensor));

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        setGroupsLoading(true);
        setGroupOrderDirty(false);
        try {
            const data = await fetchInterestGroups();
            const groupList: InterestGroup[] = data.result ?? [];
            setGroups(groupList);
            if (groupList.length > 0) {
                setSelectedGroup(groupList[0]);
                loadItems(groupList[0].id);
            }
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

            console.log(data)

            setItems(data.result ?? []);
        } finally {
            setItemsLoading(false);
            loadingGroupRef.current = null;
        }
    };

    const handleSelectGroup = (group: InterestGroup) => {
        setSelectedGroup(group);
        loadItems(group.id);
    };

    const handleAddGroup = async () => {
        if (!newGroupName.trim()) return;
        const res = await createInterestGroup({groupNm: newGroupName.trim()});
        const created: InterestGroup = res.result;
        setGroups(prev => [...prev, created]);
        setAddGroupOpen(false);
        setNewGroupName("");
        setSelectedGroup(created);
        setItems([]);
    };

    const handleEditGroup = async () => {
        if (!editGroupName.trim() || !groupMenu) return;
        await updateInterestGroup(groupMenu.group.id, {groupNm: editGroupName.trim()});
        setGroups(prev =>
            prev.map(g => g.id === groupMenu.group.id ? {...g, groupNm: editGroupName.trim()} : g)
        );
        if (selectedGroup?.id === groupMenu.group.id) {
            setSelectedGroup(prev => prev ? {...prev, groupNm: editGroupName.trim()} : prev);
        }
        setEditGroupOpen(false);
        setGroupMenu(null);
    };

    const handleDeleteGroup = async () => {
        if (!groupMenu) return;
        await deleteInterestGroup(groupMenu.group.id);
        const newGroups = groups.filter(g => g.id !== groupMenu.group.id);
        setGroups(newGroups);
        if (selectedGroup?.id === groupMenu.group.id) {
            if (newGroups.length > 0) {
                setSelectedGroup(newGroups[0]);
                loadItems(newGroups[0].id);
            } else {
                setSelectedGroup(null);
                setItems([]);
            }
        }
        setGroupOrderDirty(false);
        setDeleteGroupOpen(false);
        setGroupMenu(null);
    };

    const handleGroupDragEnd = (event: DragEndEvent) => {
        const {active, over} = event;
        if (!over || active.id === over.id) return;
        const oldIndex = groups.findIndex(g => g.id === active.id);
        const newIndex = groups.findIndex(g => g.id === over.id);
        setGroups(prev => arrayMove(prev, oldIndex, newIndex));
        setGroupOrderDirty(true);
    };

    const handleSaveGroupOrder = async () => {
        setSavingGroupOrder(true);
        try {
            await reorderInterestGroups({orderedIds: groups.map(g => g.id)});
            setGroupOrderDirty(false);
        } finally {
            setSavingGroupOrder(false);
        }
    };

    const handleSaveItemOrder = async () => {
        if (!selectedGroup) return;
        setSavingItemOrder(true);
        try {
            await reorderInterestItems(selectedGroup.id, {orderedIds: items.map(i => i.id)});
            setItemOrderDirty(false);
        } finally {
            setSavingItemOrder(false);
        }
    };

    const handleAddItem = async () => {
        if (!selectedGroup) return;
        if (!newItemStkCd.trim() || !newItemStkNm.trim()) {
            setAddItemError("종목코드와 종목명을 모두 입력해주세요.");
            return;
        }
        try {
            const res = await addInterestItem(selectedGroup.id, {
                stkCd: newItemStkCd.trim(),
                stkNm: newItemStkNm.trim(),
            });
            setItems(prev => [...prev, res.result]);
            setAddItemOpen(false);
            setNewItemStkCd("");
            setNewItemStkNm("");
            setAddItemError("");
        } catch {
            setAddItemError("이미 추가된 종목이거나 오류가 발생했습니다.");
        }
    };

    const handleDeleteItem = async (itemId: number) => {
        if (!selectedGroup) return;
        await deleteInterestItem(selectedGroup.id, itemId);
        setItems(prev => prev.filter(i => i.id !== itemId));
    };

    const columns: GridColDef[] = [
        {field: "stkNm", headerName: "주식명", flex: 1.5, minWidth: 140},
        {
            field: 'fluRt',
            headerName: '등락률',
            flex: 0.5,
            minWidth: 100,
            renderCell: (params) => renderChip(params.value as number),
        },
        {
            field: 'curPrc',
            headerName: '현재가',
            flex: 1,
            minWidth: 100,
            valueFormatter: (param: number) => {
                return Number(param).toLocaleString().replace(/^[+-]/, '')
            }
        },
        {
            field: "actions",
            type: "actions",
            headerName: "",
            width: 48,
            renderCell: (params: GridRenderCellParams) => (
                <GridActionsCell {...params}>
                    <GridActionsCellItem
                        icon={<DeleteOutlineIcon fontSize="small"/>}
                        label="삭제"
                        color="error"
                        sx={{width: 26, height: 26}}
                        onClick={() => handleDeleteItem(params.row.id)}
                    />
                </GridActionsCell>
            ),
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

            <Stack direction="row" sx={{gap: 2, alignItems: "flex-start"}}>
                {/* 그룹 패널 */}
                <Box
                    sx={{
                        width: 220,
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
                        <Typography variant="body2" fontWeight={600}>
                            그룹
                        </Typography>
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
                        <Box sx={{display: "flex", justifyContent: "center", p: 2}}>
                            <CircularProgress size={20}/>
                        </Box>
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
                <Box sx={{flex: 1, minWidth: 0}}>
                    <Stack
                        direction="row"
                        sx={{mb: 1.5, alignItems: "center", justifyContent: "space-between"}}
                    >
                        <Stack direction="row" sx={{alignItems: "center", gap: 1}}>
                            <Typography variant="body1" fontWeight={500}>
                                {selectedGroup ? selectedGroup.groupNm : "그룹을 선택하세요"}
                            </Typography>
                            {selectedGroup && (
                                <Chip
                                    label={`${items.length}종목`}
                                    size="small"
                                    variant="outlined"
                                />
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
                                        setNewItemStkCd("");
                                        setNewItemStkNm("");
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
                        <DataGridPro
                            rowReordering
                            onRowOrderChange={(params) => {
                                setItems(prev => arrayMove(prev, params.oldIndex, params.targetIndex));
                                setItemOrderDirty(true);
                            }}
                            rows={rows}
                            columns={columns}
                            getRowClassName={(params) =>
                                params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd'
                            }
                            initialState={{
                                pagination: {paginationModel: {pageSize: 20}},
                            }}
                            pageSizeOptions={[10, 20, 50]}
                            disableColumnResize
                            density="compact"
                            loading={itemsLoading}
                            sx={{"& .MuiDataGrid-cell[data-field='actions']": {padding: 0}}}
                            slotProps={{
                                filterPanel: {
                                    filterFormProps: {
                                        logicOperatorInputProps: {
                                            variant: 'outlined',
                                            size: 'small',
                                        },
                                        columnInputProps: {
                                            variant: 'outlined',
                                            size: 'small',
                                            sx: {mt: 'auto'},
                                        },
                                        operatorInputProps: {
                                            variant: 'outlined',
                                            size: 'small',
                                            sx: {mt: 'auto'},
                                        },
                                        valueInputProps: {
                                            InputComponentProps: {
                                                variant: 'outlined',
                                                size: 'small',
                                            },
                                        },
                                    },
                                },
                            }}
                        />
                    )}
                </Box>
            </Stack>

            {/* 그룹 컨텍스트 메뉴 */}
            <Menu
                anchorEl={groupMenu?.anchorEl ?? null}
                open={Boolean(groupMenu)}
                onClose={() => setGroupMenu(null)}
            >
                <MenuItem
                    onClick={() => {
                        setEditGroupName(groupMenu!.group.groupNm);
                        setEditGroupOpen(true);
                    }}
                >
                    이름 변경
                </MenuItem>
                <MenuItem
                    sx={{color: "error.main"}}
                    onClick={() => setDeleteGroupOpen(true)}
                >
                    그룹 삭제
                </MenuItem>
            </Menu>

            {/* 그룹 추가 다이얼로그 */}
            <Dialog open={addGroupOpen} onClose={() => setAddGroupOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>그룹 추가</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="그룹명"
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && handleAddGroup()}
                        sx={{mt: 1}}
                        slotProps={{htmlInput: {maxLength: 20}}}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddGroupOpen(false)}>취소</Button>
                    <Button variant="contained" onClick={handleAddGroup} disabled={!newGroupName.trim()}>
                        추가
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 그룹 수정 다이얼로그 */}
            <Dialog open={editGroupOpen} onClose={() => setEditGroupOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>그룹 이름 변경</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="그룹명"
                        value={editGroupName}
                        onChange={e => setEditGroupName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && handleEditGroup()}
                        sx={{mt: 1}}
                        slotProps={{htmlInput: {maxLength: 20}}}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditGroupOpen(false)}>취소</Button>
                    <Button variant="contained" onClick={handleEditGroup} disabled={!editGroupName.trim()}>
                        저장
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 그룹 삭제 확인 다이얼로그 */}
            <Dialog open={deleteGroupOpen} onClose={() => setDeleteGroupOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>그룹 삭제</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        <b>{groupMenu?.group.groupNm}</b> 그룹을 삭제하시겠습니까?
                        <br/>
                        그룹 내 모든 관심종목도 함께 삭제됩니다.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteGroupOpen(false)}>취소</Button>
                    <Button variant="contained" color="error" onClick={handleDeleteGroup}>
                        삭제
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 종목 추가 다이얼로그 */}
            <Dialog open={addItemOpen} onClose={() => setAddItemOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>종목 추가</DialogTitle>
                <DialogContent>
                    <Stack sx={{gap: 2, mt: 1}}>
                        <TextField
                            autoFocus
                            fullWidth
                            label="종목코드"
                            placeholder="예) 005930"
                            value={newItemStkCd}
                            onChange={e => {
                                setNewItemStkCd(e.target.value);
                                setAddItemError("");
                            }}
                            slotProps={{htmlInput: {maxLength: 20}}}
                        />
                        <TextField
                            fullWidth
                            label="종목명"
                            placeholder="예) 삼성전자"
                            value={newItemStkNm}
                            onChange={e => {
                                setNewItemStkNm(e.target.value);
                                setAddItemError("");
                            }}
                            onKeyDown={e => e.key === "Enter" && !e.nativeEvent.isComposing && handleAddItem()}
                            slotProps={{htmlInput: {maxLength: 50}}}
                            error={Boolean(addItemError)}
                            helperText={addItemError}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddItemOpen(false)}>취소</Button>
                    <Button
                        variant="contained"
                        onClick={handleAddItem}
                        disabled={!newItemStkCd.trim() || !newItemStkNm.trim()}
                    >
                        추가
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Interest;

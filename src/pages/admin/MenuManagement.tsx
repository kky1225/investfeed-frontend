import {useCallback, useEffect, useRef, useState} from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SecurityIcon from '@mui/icons-material/Security';
import SaveIcon from '@mui/icons-material/Save';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import Menu from '@mui/material/Menu';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import {
    DndContext,
    type DragEndEvent,
    DragOverlay,
    type DragStartEvent,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    createMenu,
    deleteMenu,
    fetchAllMenus,
    updateMenu,
    updateMenuPermissions,
    updateMenuStructure
} from '../../api/menu/MenuApi';
import type {FlatMenuItem, MenuRes} from '../../type/MenuType';
import {getMenuIcon, iconOptions} from '../../components/MenuIconMap';

type DropPosition = 'before' | 'inside' | 'after';

const flattenTree = (menus: MenuRes[], depth = 0): FlatMenuItem[] =>
    menus.flatMap(menu => [
        {
            id: menu.id, name: menu.name, url: menu.url, icon: menu.icon,
            parentId: menu.parentId, orderIndex: menu.orderIndex,
            visible: menu.visible, depth, permissions: menu.permissions,
        },
        ...flattenTree(menu.children, depth + 1),
    ]);

const getDescendantIds = (items: FlatMenuItem[], id: number): Set<number> => {
    const ids = new Set<number>([id]);
    let changed = true;
    while (changed) {
        changed = false;
        items.forEach(item => {
            if (item.parentId !== null && ids.has(item.parentId) && !ids.has(item.id)) {
                ids.add(item.id);
                changed = true;
            }
        });
    }
    return ids;
};

const getParentIds = (items: FlatMenuItem[]): Set<number> => {
    const parentIds = new Set<number>();
    items.forEach(item => {
        if (item.parentId !== null) parentIds.add(item.parentId);
    });
    return parentIds;
};

// 드래그 + 드롭 가능한 트리 아이템
function TreeMenuItem({
    item, hasChildren, isCollapsed, dropIndicator, isDragActive,
    onToggle, onMenuClick,
}: {
    item: FlatMenuItem;
    hasChildren: boolean;
    isCollapsed: boolean;
    dropIndicator: DropPosition | null;
    isDragActive: boolean;
    onToggle: (id: number) => void;
    onMenuClick: (event: React.MouseEvent<HTMLElement>, item: FlatMenuItem) => void;
}) {
    const {attributes, listeners, setNodeRef: setDragRef, isDragging} = useDraggable({id: item.id});
    const {setNodeRef: setDropRef} = useDroppable({id: item.id});

    // 두 ref를 합치기
    const setRef = useCallback((node: HTMLElement | null) => {
        setDragRef(node);
        setDropRef(node);
    }, [setDragRef, setDropRef]);

    return (
        <Box
            ref={setRef}
            data-menu-id={item.id}
            sx={{position: 'relative', paddingLeft: `${item.depth * 32}px`, pointerEvents: isDragging ? 'none' : 'auto'}}
        >
            {/* 상단 드롭 라인 */}
            {dropIndicator === 'before' && (
                <Box sx={{position: 'absolute', top: -3, left: 0, right: 0, height: 4, bgcolor: 'primary.main', borderRadius: 1, zIndex: 10}} />
            )}
            {/* 하단 드롭 라인 */}
            {dropIndicator === 'after' && (
                <Box sx={{position: 'absolute', bottom: -3, left: 0, right: 0, height: 4, bgcolor: 'primary.main', borderRadius: 1, zIndex: 10}} />
            )}
            <Paper
                elevation={isDragging ? 0 : 1}
                sx={{
                    p: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    opacity: isDragging ? 0.2 : 1,
                    borderLeft: item.depth > 0 ? '3px solid' : 'none',
                    borderLeftColor: 'primary.main',
                    bgcolor: dropIndicator === 'inside' ? 'action.selected' : 'background.paper',
                    outline: dropIndicator === 'inside' ? '2px dashed' : 'none',
                    outlineColor: 'primary.main',
                }}
            >
                <IconButton
                    size="small"
                    {...attributes}
                    {...listeners}
                    sx={{cursor: 'grab', '&:active': {cursor: 'grabbing'}}}
                >
                    <DragIndicatorIcon fontSize="small" />
                </IconButton>
                <Box sx={{display: 'flex', alignItems: 'center', minWidth: 32}}>
                    {getMenuIcon(item.icon)}
                </Box>
                <Box sx={{flex: 1}}>
                    <Box sx={{display: 'flex', alignItems: 'center'}}>
                        <Typography variant="body2" fontWeight={600}>
                            {item.name}
                        </Typography>
                        {hasChildren && (
                            <IconButton size="small" onClick={() => onToggle(item.id)} sx={{p: 0.25, ml: 1}}>
                                {isCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
                            </IconButton>
                        )}
                        {!item.visible && <Chip label="숨김" size="small" color="default" sx={{ml: 1}} />}
                    </Box>
                    {item.url && (
                        <Typography variant="caption" color="text.secondary">
                            {item.url}
                        </Typography>
                    )}
                </Box>
                {!isDragActive && (
                    <IconButton size="small" onClick={(e) => onMenuClick(e, item)}>
                        <MoreVertIcon fontSize="small"/>
                    </IconButton>
                )}
            </Paper>
        </Box>
    );
}

function DragPreview({item}: {item: FlatMenuItem}) {
    return (
        <Paper elevation={8} sx={{p: 1.5, display: 'flex', alignItems: 'center', gap: 1, width: 400, opacity: 0.9}}>
            <DragIndicatorIcon fontSize="small" color="disabled" />
            <Box sx={{display: 'flex', alignItems: 'center', minWidth: 32}}>{getMenuIcon(item.icon)}</Box>
            <Typography variant="body2" fontWeight={600}>{item.name}</Typography>
        </Paper>
    );
}

export default function MenuManagement() {
    const [menus, setMenus] = useState<MenuRes[]>([]);
    const [flatItems, setFlatItems] = useState<FlatMenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [structureChanged, setStructureChanged] = useState(false);
    const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
    const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity: 'success' | 'error'}>({
        open: false, message: '', severity: 'success'
    });

    const [activeItem, setActiveItem] = useState<FlatMenuItem | null>(null);
    const [dropTarget, setDropTarget] = useState<{id: number; position: DropPosition} | null>(null);
    const pointerY = useRef(0);

    const [editDialog, setEditDialog] = useState<{open: boolean; mode: 'create' | 'edit'; menuId?: number}>({open: false, mode: 'create'});
    const [editForm, setEditForm] = useState<{name: string; url: string; icon: string; parentId: string; visible: boolean}>({
        name: '', url: '', icon: '', parentId: '', visible: true
    });
    const [editErrors, setEditErrors] = useState<{name?: string}>({});
    const [deleteDialog, setDeleteDialog] = useState<{open: boolean; item: FlatMenuItem | null}>({open: false, item: null});
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
    const [menuTargetItem, setMenuTargetItem] = useState<FlatMenuItem | null>(null);
    const [permDialog, setPermDialog] = useState<{open: boolean; item: FlatMenuItem | null}>({open: false, item: null});
    const [permForm, setPermForm] = useState<{USER: boolean; ADMIN: boolean; GUEST: boolean}>({USER: true, ADMIN: true, GUEST: true});

    const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 8}}));

    const loadMenus = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchAllMenus();
            if (res.result) {
                setMenus(res.result);
                const flat = flattenTree(res.result);
                setFlatItems(flat);
                setCollapsedIds(getParentIds(flat));
            }
        } catch {
            setSnackbar({open: true, message: '메뉴 목록을 불러오는데 실패했습니다.', severity: 'error'});
        } finally {
            setLoading(false);
            setStructureChanged(false);
        }
    }, []);

    // 메뉴 저장 후 좌측 메뉴도 갱신
    const reloadMenus = useCallback(async () => {
        await loadMenus();
        window.dispatchEvent(new Event('menu-updated'));
    }, [loadMenus]);

    useEffect(() => { loadMenus(); }, [loadMenus]);

    // 포인터 실시간 추적 + 드래그 중 drop position 계산
    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
            pointerY.current = e.clientY;

            if (!activeItem) return;

            // 현재 포인터 위치에 있는 droppable 요소 찾기
            const elements = document.elementsFromPoint(e.clientX, e.clientY);
            // 드래그 중인 아이템 자체를 제외하고, 실제 드롭 대상 메뉴 요소 찾기
            const menuEl = elements.find(el => {
                const menuId = el.getAttribute('data-menu-id');
                return menuId !== null && parseInt(menuId) !== activeItem.id;
            });

            if (!menuEl) {
                setDropTarget(null);
                return;
            }

            const overId = parseInt(menuEl.getAttribute('data-menu-id')!);

            // 자손 드롭 불가
            const descendantIds = getDescendantIds(flatItems, activeItem.id);
            if (descendantIds.has(overId)) {
                setDropTarget(null);
                return;
            }

            const rect = menuEl.getBoundingClientRect();
            const relativeY = e.clientY - rect.top;
            const height = rect.height;

            let position: DropPosition;
            if (relativeY < height * 0.25) {
                position = 'before';
            } else if (relativeY > height * 0.75) {
                position = 'after';
            } else {
                position = 'inside';
            }

            setDropTarget(prev => {
                if (prev?.id === overId && prev?.position === position) return prev;
                return {id: overId, position};
            });
        };

        window.addEventListener('pointermove', handlePointerMove);
        return () => window.removeEventListener('pointermove', handlePointerMove);
    }, [activeItem, flatItems]);

    // 접기/펼치기
    const handleToggleCollapse = (id: number) => {
        setCollapsedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    const isAllCollapsed = collapsedIds.size > 0 && collapsedIds.size >= getParentIds(flatItems).size;
    const handleToggleAll = () => isAllCollapsed ? setCollapsedIds(new Set()) : setCollapsedIds(getParentIds(flatItems));

    const visibleItems = flatItems.filter(item => {
        let pid = item.parentId;
        while (pid !== null) {
            if (collapsedIds.has(pid)) return false;
            const parent = flatItems.find(i => i.id === pid);
            pid = parent?.parentId ?? null;
        }
        return true;
    });

    const parentIds = getParentIds(flatItems);

    const handleDragStart = (event: DragStartEvent) => {
        const item = flatItems.find(i => i.id === event.active.id);
        if (item) setActiveItem(item);
    };

    const handleDragEnd = (_event: DragEndEvent) => {
        if (!activeItem || !dropTarget) {
            setActiveItem(null);
            setDropTarget(null);
            return;
        }

        const draggedId = activeItem.id;
        const targetId = dropTarget.id;
        const position = dropTarget.position;

        setFlatItems(prev => {
            const descendantIds = getDescendantIds(prev, draggedId);
            const draggedItems = prev.filter(i => descendantIds.has(i.id));
            const remaining = prev.filter(i => !descendantIds.has(i.id));
            const targetIndex = remaining.findIndex(i => i.id === targetId);
            if (targetIndex === -1) return prev;

            const target = remaining[targetIndex];
            const draggedRoot = draggedItems.find(i => i.id === draggedId)!;
            const oldDepth = draggedRoot.depth;

            let newParentId: number | null;
            let newDepth: number;
            let insertIndex: number;

            if (position === 'inside') {
                newParentId = targetId;
                newDepth = target.depth + 1;
                let idx = targetIndex + 1;
                while (idx < remaining.length && remaining[idx].depth > target.depth) idx++;
                insertIndex = idx;
            } else if (position === 'before') {
                newParentId = target.parentId;
                newDepth = target.depth;
                insertIndex = targetIndex;
            } else {
                newParentId = target.parentId;
                newDepth = target.depth;
                let idx = targetIndex + 1;
                while (idx < remaining.length && remaining[idx].depth > target.depth) idx++;
                insertIndex = idx;
            }

            const depthDiff = newDepth - oldDepth;
            const updatedDraggedItems = draggedItems.map(item => ({
                ...item,
                depth: item.depth + depthDiff,
                parentId: item.id === draggedId ? newParentId : item.parentId,
            }));

            const result = [...remaining];
            result.splice(insertIndex, 0, ...updatedDraggedItems);
            return result;
        });

        setStructureChanged(true);
        setActiveItem(null);
        setDropTarget(null);
    };

    const handleDragCancel = () => {
        setActiveItem(null);
        setDropTarget(null);
    };

    const handleSaveStructure = async () => {
        try {
            const orderByParent = new Map<number | null, number>();
            const structures = flatItems.map(item => {
                const key = item.parentId;
                const order = orderByParent.get(key) ?? 0;
                orderByParent.set(key, order + 1);
                return {id: item.id, parentId: item.parentId, orderIndex: order};
            });
            await updateMenuStructure({structures});
            setSnackbar({open: true, message: '메뉴 구조가 저장되었습니다.', severity: 'success'});
            await reloadMenus();
        } catch {
            setSnackbar({open: true, message: '메뉴 구조 저장에 실패했습니다.', severity: 'error'});
        }
    };

    const handleOpenCreate = () => {
        setEditForm({name: '', url: '', icon: '', parentId: '', visible: true});
        setEditDialog({open: true, mode: 'create'});
    };

    const handleOpenEdit = (item: FlatMenuItem) => {
        setEditForm({
            name: item.name, url: item.url || '', icon: item.icon || '',
            parentId: item.parentId?.toString() || '', visible: item.visible,
        });
        setEditDialog({open: true, mode: 'edit', menuId: item.id});
    };

    const handleSaveMenu = async () => {
        const errors: {name?: string} = {};
        if (!editForm.name.trim()) errors.name = '메뉴명을 입력해주세요.';
        if (Object.keys(errors).length > 0) {
            setEditErrors(errors);
            return;
        }
        setEditErrors({});
        try {
            if (editDialog.mode === 'create') {
                await createMenu({
                    name: editForm.name, url: editForm.url || null, icon: editForm.icon || null,
                    parentId: editForm.parentId ? parseInt(editForm.parentId) : null,
                    orderIndex: flatItems.length, visible: editForm.visible,
                });
                setSnackbar({open: true, message: '메뉴가 생성되었습니다.', severity: 'success'});
            } else {
                await updateMenu(editDialog.menuId!, {
                    name: editForm.name, url: editForm.url || null, icon: editForm.icon || null,
                    parentId: editForm.parentId ? parseInt(editForm.parentId) : null, visible: editForm.visible,
                });
                setSnackbar({open: true, message: '메뉴가 수정되었습니다.', severity: 'success'});
            }
            setEditDialog({open: false, mode: 'create'});
            await reloadMenus();
        } catch (err) {
            const axiosErr = err as {response?: {status?: number; data?: {code?: string; message?: string; result?: Record<string, string>}}};
            if (axiosErr.response?.status === 400 && axiosErr.response?.data?.code === 'VALIDATION_4001') {
                setEditErrors((axiosErr.response.data.result ?? {}) as {name?: string});
                return;
            }
            setSnackbar({open: true, message: axiosErr.response?.data?.message || '메뉴 저장에 실패했습니다.', severity: 'error'});
        }
    };

    const handleDeleteMenu = async () => {
        if (!deleteDialog.item) return;
        try {
            await deleteMenu(deleteDialog.item.id);
            setSnackbar({open: true, message: '메뉴가 삭제되었습니다.', severity: 'success'});
            setDeleteDialog({open: false, item: null});
            await reloadMenus();
        } catch (error: any) {
            setSnackbar({open: true, message: error?.response?.data?.message || '메뉴 삭제에 실패했습니다.', severity: 'error'});
        }
    };

    const handleOpenPermission = (item: FlatMenuItem) => {
        const permMap = {USER: true, ADMIN: true, GUEST: true};
        item.permissions.forEach(p => {
            if (p.role in permMap) permMap[p.role as keyof typeof permMap] = p.readable;
        });
        setPermForm(permMap);
        setPermDialog({open: true, item});
    };

    const handleSavePermission = async () => {
        if (!permDialog.item) return;
        try {
            await updateMenuPermissions(permDialog.item.id, {
                permissions: Object.entries(permForm).map(([role, readable]) => ({role, readable})),
            });
            setSnackbar({open: true, message: '권한이 변경되었습니다.', severity: 'success'});
            setPermDialog({open: false, item: null});
            await reloadMenus();
        } catch {
            setSnackbar({open: true, message: '권한 변경에 실패했습니다.', severity: 'error'});
        }
    };

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Typography component="h2" variant="h6">메뉴 관리</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title={isAllCollapsed ? '전체 펼치기' : '전체 접기'}>
                        <IconButton onClick={handleToggleAll} size="small">
                            {isAllCollapsed ? <UnfoldMoreIcon /> : <UnfoldLessIcon />}
                        </IconButton>
                    </Tooltip>
                    {structureChanged && (
                        <Button variant="contained" color="warning" startIcon={<SaveIcon />} onClick={handleSaveStructure}>구조 저장</Button>
                    )}
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>메뉴 추가</Button>
                </Stack>
            </Box>

            <Alert severity="info" sx={{mb: 2}}>
                메뉴의 상/하단에 놓으면 순서 이동, 중앙에 놓으면 하위 메뉴로 이동합니다.
            </Alert>

            {loading ? (
                <Typography color="text.secondary" sx={{py: 4, textAlign: 'center'}}>로딩 중...</Typography>
            ) : (
                <DndContext
                    sensors={sensors}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragCancel={handleDragCancel}
                >
                    <Stack spacing={1}>
                        {visibleItems.map(item => (
                            <TreeMenuItem
                                key={item.id}
                                item={item}
                                hasChildren={parentIds.has(item.id)}
                                isCollapsed={collapsedIds.has(item.id)}
                                dropIndicator={dropTarget?.id === item.id ? dropTarget.position : null}
                                isDragActive={!!activeItem}
                                onToggle={handleToggleCollapse}
                                onMenuClick={(e, item) => { setMenuAnchorEl(e.currentTarget); setMenuTargetItem(item); }}
                            />
                        ))}
                    </Stack>
                    <DragOverlay dropAnimation={null} style={{pointerEvents: 'none'}}>
                        {activeItem && <DragPreview item={activeItem} />}
                    </DragOverlay>
                </DndContext>
            )}

            {/* 메뉴 생성/수정 다이얼로그 */}
            <Dialog open={editDialog.open} onClose={() => { setEditDialog({open: false, mode: 'create'}); setEditErrors({}); }} maxWidth="sm" fullWidth>
                <DialogTitle>{editDialog.mode === 'create' ? '메뉴 추가' : '메뉴 수정'}</DialogTitle>
                <DialogContent>
                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, mt: 1}}>
                        <TextField label="메뉴명" required fullWidth size="small" value={editForm.name}
                            onChange={e => { setEditForm({...editForm, name: e.target.value}); if (editErrors.name) setEditErrors(prev => ({...prev, name: undefined})); }}
                            error={!!editErrors.name} helperText={editErrors.name}/>
                        <TextField label="URL" fullWidth size="small" placeholder="예: /dashboard" value={editForm.url}
                            onChange={e => setEditForm({...editForm, url: e.target.value})}
                            helperText="하위 메뉴가 있는 대메뉴는 비워두세요" />
                        <FormControl fullWidth size="small">
                            <InputLabel>아이콘</InputLabel>
                            <Select value={editForm.icon} label="아이콘" onChange={e => setEditForm({...editForm, icon: e.target.value})}>
                                <MenuItem value="">없음</MenuItem>
                                {iconOptions.map(name => (
                                    <MenuItem key={name} value={name}>
                                        <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>{getMenuIcon(name)}<span>{name}</span></Box>
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl fullWidth size="small">
                            <InputLabel>상위 메뉴</InputLabel>
                            <Select value={editForm.parentId} label="상위 메뉴" onChange={e => setEditForm({...editForm, parentId: e.target.value})}>
                                <MenuItem value="">없음 (대메뉴)</MenuItem>
                                {flatItems.filter(m => m.id !== editDialog.menuId).map(m => (
                                    <MenuItem key={m.id} value={m.id.toString()}>{'─'.repeat(m.depth)} {m.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControlLabel
                            control={<Switch checked={editForm.visible} onChange={e => setEditForm({...editForm, visible: e.target.checked})} />}
                            label="메뉴 표시" />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setEditDialog({open: false, mode: 'create'}); setEditErrors({}); }}>취소</Button>
                    <Button onClick={handleSaveMenu} variant="contained">{editDialog.mode === 'create' ? '생성' : '수정'}</Button>
                </DialogActions>
            </Dialog>

            {/* 메뉴 아이템 관리 팝오버 */}
            <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={() => setMenuAnchorEl(null)}>
                <MenuItem onClick={() => { if (menuTargetItem) handleOpenPermission(menuTargetItem); setMenuAnchorEl(null); }}>
                    <ListItemIcon><SecurityIcon fontSize="small"/></ListItemIcon>
                    <ListItemText>권한 설정</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { if (menuTargetItem) handleOpenEdit(menuTargetItem); setMenuAnchorEl(null); }}>
                    <ListItemIcon><EditIcon fontSize="small"/></ListItemIcon>
                    <ListItemText>수정</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => { if (menuTargetItem) setDeleteDialog({open: true, item: menuTargetItem}); setMenuAnchorEl(null); }}>
                    <ListItemIcon><DeleteIcon fontSize="small" color="error"/></ListItemIcon>
                    <ListItemText>삭제</ListItemText>
                </MenuItem>
            </Menu>

            {/* 삭제 확인 다이얼로그 */}
            <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({open: false, item: null})}>
                <DialogTitle>메뉴 삭제</DialogTitle>
                <DialogContent>
                    <DialogContentText><strong>{deleteDialog.item?.name}</strong> 메뉴를 삭제하시겠습니까?</DialogContentText>
                    <Alert severity="warning" sx={{mt: 1}}>하위 메뉴가 있는 경우 하위 메뉴를 먼저 삭제해야 합니다.</Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialog({open: false, item: null})}>취소</Button>
                    <Button onClick={handleDeleteMenu} variant="contained" color="error">삭제</Button>
                </DialogActions>
            </Dialog>

            {/* 권한 설정 다이얼로그 */}
            <Dialog open={permDialog.open} onClose={() => setPermDialog({open: false, item: null})} maxWidth="xs" fullWidth>
                <DialogTitle>권한 설정 - {permDialog.item?.name}</DialogTitle>
                <DialogContent>
                    <Alert severity="info" sx={{mb: 2}}>대메뉴의 권한을 해제하면 하위 메뉴도 함께 미노출됩니다.</Alert>
                    <Stack spacing={1}>
                        {(['ADMIN', 'USER', 'GUEST'] as const).map(role => (
                            <FormControlLabel key={role}
                                control={<Switch checked={permForm[role]} onChange={e => setPermForm({...permForm, [role]: e.target.checked})} />}
                                label={<Chip label={role === 'ADMIN' ? '관리자' : role === 'USER' ? '사용자' : '게스트'} size="small" color={role === 'ADMIN' ? 'warning' : 'default'} />}
                            />
                        ))}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPermDialog({open: false, item: null})}>취소</Button>
                    <Button onClick={handleSavePermission} variant="contained">저장</Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(prev => ({...prev, open: false}))} anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}>
                <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({...prev, open: false}))}>{snackbar.message}</Alert>
            </Snackbar>
        </Box>
    );
}

import {useState} from 'react';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {requireOk} from '../../lib/apiResponse';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter} from '@dnd-kit/core';
import {SortableContext, verticalListSortingStrategy, arrayMove, useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import {createRole, deleteRole, fetchRoles, updateRole, updateRoleOrder} from '../../api/admin/AdminApi';
import type {CreateRoleReq, RoleOrderItem, RoleRes, UpdateRoleMutationVars} from '../../type/RoleType';
import {useAlert} from '../../context/AlertContext';
import {useAuth} from '../../context/AuthContext';

interface FormState {
    code: string;
    name: string;
    defaultLandingPath: string;
}

const initialForm: FormState = {code: '', name: '', defaultLandingPath: ''};

type FormErrors = Partial<Record<keyof FormState, string>>;

interface SortableRowProps {
    role: RoleRes;
    onMenuClick: (event: React.MouseEvent<HTMLElement>, role: RoleRes) => void;
}

function SortableRoleRow({role, onMenuClick}: SortableRowProps) {
    const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: role.id});

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <Paper
            ref={setNodeRef}
            elevation={isDragging ? 0 : 1}
            sx={{p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, ...style}}
        >
            <IconButton size="small" {...attributes} {...listeners} sx={{cursor: 'grab', '&:active': {cursor: 'grabbing'}}}>
                <DragIndicatorIcon fontSize="small" />
            </IconButton>
            <Box sx={{minWidth: 100}}>
                <Chip label={role.code} size="small" variant="outlined" />
            </Box>
            <Box sx={{flex: 1, minWidth: 0}}>
                <Typography variant="body2" fontWeight={600} noWrap>
                    {role.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                    {role.defaultLandingPath || '/'}
                </Typography>
            </Box>
            {role.isSystem && <Chip label="시스템" size="small" color="warning" />}
            <IconButton size="small" onClick={(e) => onMenuClick(e, role)}>
                <MoreVertIcon fontSize="small" />
            </IconButton>
        </Paper>
    );
}

export default function RoleManagement() {
    const showAlert = useAlert();
    const queryClient = useQueryClient();
    const {user} = useAuth();
    const [orderChanged, setOrderChanged] = useState(false);
    const [pendingAfterRoleId, setPendingAfterRoleId] = useState<number | null>(null);
    // 드래그로 인한 로컬 순서 override (서버 데이터에 우선 적용)
    const [orderOverride, setOrderOverride] = useState<RoleRes[] | null>(null);

    const {data: rolesData, isLoading: loading, isError: rolesError} = useQuery<RoleRes[]>({
        queryKey: ['admin', 'roles'],
        queryFn: async ({signal}) => requireOk(await fetchRoles({signal, skipGlobalError: true}), [] as RoleRes[]),
    });
    const fetchedRoles = rolesData ?? [];
    const roles = orderOverride ?? fetchedRoles;
    const currentUserPriority = fetchedRoles.find(r => r.code === user?.role)?.priority ?? 0;

    const [prevError, setPrevError] = useState(false);
    if (rolesError !== prevError) {
        setPrevError(rolesError);
        if (rolesError) showAlert('권한 목록을 불러오는데 실패했습니다.', 'error');
    }

    // 새 fetch 데이터 도착 시 override 초기화 — rolesData 직접 비교 (?? [] 의 새 배열 트랩 회피)
    const [prevRolesData, setPrevRolesData] = useState(rolesData);
    if (rolesData !== prevRolesData) {
        setPrevRolesData(rolesData);
        setOrderOverride(null);
        setOrderChanged(false);
    }

    const setRoles = (next: RoleRes[]) => setOrderOverride(next);
    const [editDialog, setEditDialog] = useState<{open: boolean; mode: 'create' | 'edit'; id?: number}>({open: false, mode: 'create'});
    const [form, setForm] = useState<FormState>(initialForm);
    const [errors, setErrors] = useState<FormErrors>({});
    const [deleteDialog, setDeleteDialog] = useState<{open: boolean; role: RoleRes | null}>({open: false, role: null});
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
    const [menuTargetRole, setMenuTargetRole] = useState<RoleRes | null>(null);

    const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 8}}));

    const loadRoles = async () => {
        await queryClient.invalidateQueries({queryKey: ['admin', 'roles']});
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const {active, over} = event;
        if (!over || active.id === over.id) return;

        const oldIndex = roles.findIndex(r => r.id === active.id);
        const newIndex = roles.findIndex(r => r.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        setRoles(arrayMove(roles, oldIndex, newIndex));
        setOrderChanged(true);
    };

    const updateOrderMutation = useMutation({
        mutationFn: async (orders: RoleOrderItem[]) => {
            requireOk(await updateRoleOrder(orders), '역할 순서 변경');
        },
        onSuccess: () => {
            showAlert('순서가 저장되었습니다.', 'success');
            loadRoles();
        },
        onError: (err) => {
            console.error(err);
            showAlert('순서 저장에 실패했습니다.', 'error');
        },
    });

    const handleSaveOrder = () => {
        const sortedPriorities = [...fetchedRoles].sort((a, b) => a.priority - b.priority).map(r => r.priority);
        const orders: RoleOrderItem[] = roles.map((r, idx) => ({id: r.id, priority: sortedPriorities[idx]}));
        updateOrderMutation.mutate(orders);
    };

    const handleOpenCreate = (afterRoleId: number | null = null) => {
        setForm(initialForm);
        setErrors({});
        setPendingAfterRoleId(afterRoleId);
        setEditDialog({open: true, mode: 'create'});
    };

    const handleOpenEdit = (role: RoleRes) => {
        setForm({code: role.code, name: role.name, defaultLandingPath: role.defaultLandingPath ?? ''});
        setErrors({});
        setEditDialog({open: true, mode: 'edit', id: role.id});
    };

    const onSubmitError = (err: unknown) => {
        console.error(err);
        const axiosErr = err as {response?: {data?: {message?: string; result?: FormErrors}; status?: number}};
        if (axiosErr.response?.status === 400 && axiosErr.response?.data?.result) {
            setErrors(axiosErr.response.data.result);
        } else {
            showAlert(axiosErr.response?.data?.message || '권한 저장에 실패했습니다.', 'error');
        }
    };

    const createMutation = useMutation({
        mutationFn: async (req: CreateRoleReq) =>
            requireOk(await createRole(req), '역할 생성'),
        onSuccess: () => {
            showAlert('권한이 생성되었습니다.', 'success');
            setEditDialog({open: false, mode: 'create'});
            loadRoles();
        },
        onError: onSubmitError,
    });

    const updateMutation = useMutation({
        mutationFn: async (vars: UpdateRoleMutationVars) =>
            requireOk(await updateRole(vars.id, vars.req), '역할 수정'),
        onSuccess: () => {
            showAlert('권한이 수정되었습니다.', 'success');
            setEditDialog({open: false, mode: 'create'});
            loadRoles();
        },
        onError: onSubmitError,
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            requireOk(await deleteRole(id), '역할 삭제');
        },
        onSuccess: () => {
            showAlert('권한이 삭제되었습니다.', 'success');
            setDeleteDialog(prev => ({...prev, open: false}));
            loadRoles();
        },
        onError: (err) => {
            console.error(err);
            const axiosErr = err as {response?: {data?: {message?: string}}};
            showAlert(axiosErr.response?.data?.message || '권한 삭제에 실패했습니다.', 'error');
        },
    });

    const handleSubmit = () => {
        const errs: FormErrors = {};
        if (editDialog.mode === 'create' && !form.code.trim()) errs.code = '권한 코드를 입력해주세요.';
        if (!form.name.trim()) errs.name = '권한 이름을 입력해주세요.';
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }
        if (editDialog.mode === 'create') {
            const req: CreateRoleReq = {
                code: form.code.trim().toUpperCase(),
                name: form.name.trim(),
                defaultLandingPath: form.defaultLandingPath.trim() || null,
                afterRoleId: pendingAfterRoleId,
            };
            createMutation.mutate(req);
        } else if (editDialog.id !== undefined) {
            const vars: UpdateRoleMutationVars = {
                id: editDialog.id,
                req: {
                    name: form.name.trim(),
                    defaultLandingPath: form.defaultLandingPath.trim() || null,
                },
            };
            updateMutation.mutate(vars);
        }
    };

    const handleDelete = () => {
        if (!deleteDialog.role) return;
        deleteMutation.mutate(deleteDialog.role.id);
    };

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Typography variant="h5">역할 관리</Typography>
                <Box sx={{display: 'flex', gap: 1}}>
                    {orderChanged && (
                        <Button variant="outlined" startIcon={<SaveIcon />} onClick={handleSaveOrder} disabled={updateOrderMutation.isPending}>
                            순서 저장
                        </Button>
                    )}
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenCreate()}>
                        권한 추가
                    </Button>
                </Box>
            </Box>

            <Alert severity="info" sx={{mb: 2}}>
                새 역할은 권한이 없는 상태로 추가되니, 권한 부여 메뉴에서 부여해 주세요. 순서를 변경하면 우선순위도 함께 바뀝니다.
            </Alert>

            {loading ? (
                <Stack spacing={1}>
                    {[1, 2, 3].map(i => <Skeleton key={i} height={56} variant="rectangular" />)}
                </Stack>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={roles.map(r => r.id)} strategy={verticalListSortingStrategy}>
                        <Stack spacing={0}>
                            {roles.map((role) => {
                                const canInsertAfter = role.priority >= currentUserPriority;
                                const insertEnabled = canInsertAfter && !orderChanged;
                                return (
                                    <Box key={role.id}>
                                        <Box sx={{mb: canInsertAfter ? 0 : 1}}>
                                            <SortableRoleRow
                                                role={role}
                                                onMenuClick={(e, r) => { setMenuAnchorEl(e.currentTarget); setMenuTargetRole(r); }}
                                            />
                                        </Box>
                                        {canInsertAfter && (
                                            <Tooltip title={orderChanged ? '순서를 먼저 저장해주세요' : ''} placement="top">
                                                <Box
                                                    sx={{
                                                        height: 24,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        position: 'relative',
                                                        cursor: insertEnabled ? 'pointer' : 'not-allowed',
                                                        opacity: 0,
                                                        transition: 'opacity 0.15s',
                                                        '&:hover': {opacity: insertEnabled ? 1 : 0.4},
                                                    }}
                                                    onClick={() => { if (insertEnabled) handleOpenCreate(role.id); }}
                                                >
                                                    <Box sx={{position: 'absolute', left: 0, right: 0, top: '50%', height: '2px', bgcolor: insertEnabled ? 'primary.main' : 'action.disabled', borderRadius: 1}} />
                                                    <IconButton
                                                        size="small"
                                                        disabled={!insertEnabled}
                                                        sx={{
                                                            bgcolor: insertEnabled ? 'primary.main' : 'action.disabledBackground',
                                                            color: insertEnabled ? 'primary.contrastText' : 'action.disabled',
                                                            zIndex: 1,
                                                            width: 20,
                                                            height: 20,
                                                            '&:hover': {bgcolor: insertEnabled ? 'primary.dark' : 'action.disabledBackground'},
                                                        }}
                                                    >
                                                        <AddIcon sx={{fontSize: 14}} />
                                                    </IconButton>
                                                </Box>
                                            </Tooltip>
                                        )}
                                    </Box>
                                );
                            })}
                        </Stack>
                    </SortableContext>
                </DndContext>
            )}

            <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={() => setMenuAnchorEl(null)}>
                <MenuItem onClick={() => { if (menuTargetRole) handleOpenEdit(menuTargetRole); setMenuAnchorEl(null); }}>
                    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>수정</ListItemText>
                </MenuItem>
                <MenuItem
                    disabled={menuTargetRole?.isSystem}
                    onClick={() => { if (menuTargetRole) setDeleteDialog({open: true, role: menuTargetRole}); setMenuAnchorEl(null); }}
                >
                    <ListItemIcon><DeleteIcon fontSize="small" color={menuTargetRole?.isSystem ? 'disabled' : 'error'} /></ListItemIcon>
                    <ListItemText>삭제</ListItemText>
                </MenuItem>
            </Menu>

            <Dialog open={editDialog.open} onClose={() => setEditDialog({open: false, mode: 'create'})} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editDialog.mode === 'create' ? '권한 추가' : '권한 수정'}
                    {editDialog.mode === 'create' && (
                        <Typography variant="body2" color="error" fontWeight={600} sx={{display: 'block', mt: 0.5}}>
                            {pendingAfterRoleId !== null
                                ? `'${fetchedRoles.find(r => r.id === pendingAfterRoleId)?.name ?? ''}' 아래에 추가됩니다`
                                : '본인 권한 바로 아래에 추가됩니다'}
                        </Typography>
                    )}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, mt: 1}}>
                        <TextField
                            label="코드" required size="small" fullWidth
                            value={form.code}
                            disabled={editDialog.mode === 'edit'}
                            placeholder="예: MANAGER"
                            helperText={errors.code || '대문자/숫자/언더스코어 2~50자. 생성 후 변경 불가.'}
                            error={!!errors.code}
                            onChange={(e) => { setForm({...form, code: e.target.value}); if (errors.code) setErrors(prev => ({...prev, code: undefined})); }}
                        />
                        <TextField
                            label="이름" required size="small" fullWidth
                            value={form.name}
                            placeholder="예: 매니저"
                            helperText={errors.name}
                            error={!!errors.name}
                            onChange={(e) => { setForm({...form, name: e.target.value}); if (errors.name) setErrors(prev => ({...prev, name: undefined})); }}
                        />
                        <TextField
                            label="기본 진입 경로" size="small" fullWidth
                            value={form.defaultLandingPath}
                            placeholder="예: /admin/monitoring"
                            helperText="로그인 직후 이동할 경로 (비워두면 / 사용)"
                            onChange={(e) => setForm({...form, defaultLandingPath: e.target.value})}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialog({open: false, mode: 'create'})}>취소</Button>
                    <Button onClick={handleSubmit} variant="contained" disabled={createMutation.isPending || updateMutation.isPending}>
                        {(createMutation.isPending || updateMutation.isPending) ? '저장 중...' : (editDialog.mode === 'create' ? '생성' : '수정')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={deleteDialog.open}
                onClose={() => setDeleteDialog(prev => ({...prev, open: false}))}
                slotProps={{transition: {onExited: () => setDeleteDialog({open: false, role: null})}}}
            >
                <DialogTitle>권한 삭제</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        <strong>{deleteDialog.role?.name}</strong>({deleteDialog.role?.code}) 권한을 삭제하시겠습니까?
                    </DialogContentText>
                    <DialogContentText sx={{mt: 1, color: 'error.main'}}>
                        해당 권한을 사용 중인 회원이 있으면 삭제되지 않습니다.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialog(prev => ({...prev, open: false}))}>취소</Button>
                    <Button onClick={handleDelete} variant="contained" color="error" disabled={deleteMutation.isPending}>삭제</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

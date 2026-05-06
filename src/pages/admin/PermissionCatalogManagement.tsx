import {useMemo, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {requireOk} from '../../lib/apiResponse';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
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
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
    addApiPattern,
    addPermissionAction,
    createPermission,
    deleteApiPattern,
    deletePermission,
    deletePermissionAction,
    fetchPermissionCatalog,
    updatePermission,
} from '../../api/admin/PermissionCatalogApi';
import type {PermissionRes} from '../../type/PermissionType';
import {useAlert} from '../../context/AlertContext';

interface CreateForm {
    code: string;
    name: string;
    description: string;
    apiPatterns: string;
}

const initialCreateForm: CreateForm = {code: '', name: '', description: '', apiPatterns: ''};

interface EditForm {
    name: string;
    description: string;
}

/**
 * 권한 카탈로그 관리 (개발자 / SUPER_ADMIN 전용).
 *
 * 책임:
 *  - 권한 CRUD
 *  - 권한별 api_pattern 추가/삭제
 *  - 권한별 지원 action 추가/삭제 (READ/CREATE/UPDATE/DELETE + 도메인 액션)
 *
 * 역할별 부여 매트릭스는 권한 부여 화면 (PermissionGrantManagement) 책임.
 */
export default function PermissionCatalogManagement() {
    const showAlert = useAlert();
    const queryClient = useQueryClient();
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const {data: permissionsData, isLoading: loading, isError: permError} = useQuery<PermissionRes[]>({
        queryKey: ['admin', 'permissionCatalog'],
        queryFn: async ({signal}) => requireOk(await fetchPermissionCatalog({signal, skipGlobalError: true}), [] as PermissionRes[]),
    });
    const permissions = permissionsData ?? [];

    const [prevPermError, setPrevPermError] = useState(false);
    if (permError !== prevPermError) {
        setPrevPermError(permError);
        if (permError) showAlert('권한 목록을 불러오는데 실패했습니다.', 'error');
    }

    // permissions 로드 후 selectedId 자동 선택 — permissionsData 직접 비교 (?? [] 트랩 회피)
    const [prevPermissionsData, setPrevPermissionsData] = useState(permissionsData);
    if (permissionsData !== prevPermissionsData) {
        setPrevPermissionsData(permissionsData);
        if (permissions.length > 0) {
            if (selectedId === null || !permissions.some(p => p.id === selectedId)) {
                setSelectedId(permissions[0].id);
            }
        } else {
            setSelectedId(null);
        }
    }

    // 권한 생성
    const [createDialog, setCreateDialog] = useState(false);
    const [createForm, setCreateForm] = useState<CreateForm>(initialCreateForm);
    const [createErrors, setCreateErrors] = useState<Partial<Record<keyof CreateForm, string>>>({});
    const [submitting, setSubmitting] = useState(false);

    // 이름/설명 수정
    const [editDialog, setEditDialog] = useState(false);
    const [editForm, setEditForm] = useState<EditForm>({name: '', description: ''});
    const [editErrors, setEditErrors] = useState<Partial<Record<keyof EditForm, string>>>({});

    // api 패턴 추가
    const [patternDialog, setPatternDialog] = useState(false);
    const [patternInput, setPatternInput] = useState('');
    const [patternError, setPatternError] = useState<string | undefined>();

    // action 추가
    const [actionDialog, setActionDialog] = useState(false);
    const [actionInput, setActionInput] = useState('');
    const [actionDescInput, setActionDescInput] = useState('');
    const [actionError, setActionError] = useState<string | undefined>();

    // 권한 삭제 확인
    const [deleteDialog, setDeleteDialog] = useState(false);

    const loadPermissions = async () => {
        await queryClient.invalidateQueries({queryKey: ['admin', 'permissionCatalog']});
    };

    const selected = useMemo(
        () => permissions.find(p => p.id === selectedId) ?? null,
        [permissions, selectedId],
    );

    const showAxiosError = (err: unknown, fallback: string) => {
        const axiosErr = err as {response?: {data?: {message?: string}}};
        showAlert(axiosErr.response?.data?.message || fallback, 'error');
    };

    // ──────────────────────── 권한 생성/수정/삭제 ────────────────────────

    const handleOpenCreate = () => {
        setCreateForm(initialCreateForm);
        setCreateErrors({});
        setCreateDialog(true);
    };

    const handleCreate = async () => {
        const errs: Partial<Record<keyof CreateForm, string>> = {};
        if (!createForm.code.trim()) errs.code = '코드를 입력해주세요.';
        if (!createForm.name.trim()) errs.name = '이름을 입력해주세요.';
        if (Object.keys(errs).length > 0) {
            setCreateErrors(errs);
            return;
        }
        const patterns = createForm.apiPatterns
            .split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        setSubmitting(true);
        try {
            const res = await createPermission({
                code: createForm.code.trim().toUpperCase(),
                name: createForm.name.trim(),
                description: createForm.description.trim() || null,
                apiPatterns: patterns,
            });
            if (res.code !== "0000") throw new Error(res.message || `권한 생성 실패 (${res.code})`);
            setCreateDialog(false);
            showAlert('권한이 생성되었습니다.', 'success');
            await loadPermissions();
            if (res.result) setSelectedId(res.result.id);
        } catch (err) {
            const axiosErr = err as {response?: {data?: {message?: string; result?: Partial<Record<keyof CreateForm, string>>}; status?: number}};
            if (axiosErr.response?.status === 400 && axiosErr.response?.data?.result) {
                setCreateErrors(axiosErr.response.data.result);
            } else {
                showAxiosError(err, '권한 생성에 실패했습니다.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenEdit = () => {
        if (!selected) return;
        setEditForm({name: selected.name, description: selected.description ?? ''});
        setEditErrors({});
        setEditDialog(true);
    };

    const handleSaveEdit = async () => {
        if (!selected) return;
        if (!editForm.name.trim()) {
            setEditErrors({name: '이름을 입력해주세요.'});
            return;
        }
        try {
            const res = await updatePermission(selected.id, {
                name: editForm.name.trim(),
                description: editForm.description.trim() || null,
            });
            if (res.code !== "0000") throw new Error(res.message || `권한 수정 실패 (${res.code})`);
            setEditDialog(false);
            showAlert('권한이 수정되었습니다.', 'success');
            await loadPermissions();
        } catch (err) {
            showAxiosError(err, '수정에 실패했습니다.');
        }
    };

    const handleDelete = async () => {
        if (!selected) return;
        try {
            const res = await deletePermission(selected.id);
            if (res.code !== "0000") throw new Error(res.message || `권한 삭제 실패 (${res.code})`);
            setDeleteDialog(false);
            showAlert('권한이 삭제되었습니다.', 'success');
            setSelectedId(null);
            await loadPermissions();
        } catch (err) {
            showAxiosError(err, '삭제에 실패했습니다.');
        }
    };

    // ──────────────────────── api 패턴 ────────────────────────

    const handleOpenPattern = () => {
        setPatternInput('');
        setPatternError(undefined);
        setPatternDialog(true);
    };

    const handleAddPattern = async () => {
        if (!selected) return;
        const value = patternInput.trim();
        if (!value) {
            setPatternError('API 패턴을 입력해주세요.');
            return;
        }
        try {
            const res = await addApiPattern(selected.id, {apiPattern: value});
            if (res.code !== "0000") throw new Error(res.message || `API 패턴 추가 실패 (${res.code})`);
            setPatternDialog(false);
            showAlert('API 패턴이 추가되었습니다.', 'success');
            await loadPermissions();
        } catch (err) {
            const axiosErr = err as {response?: {data?: {message?: string}}};
            setPatternError(axiosErr.response?.data?.message || '패턴 추가에 실패했습니다.');
        }
    };

    const handleDeletePattern = async (patternId: number) => {
        if (!selected) return;
        try {
            const res = await deleteApiPattern(selected.id, patternId);
            if (res.code !== "0000") throw new Error(res.message || `API 패턴 삭제 실패 (${res.code})`);
            showAlert('API 패턴이 삭제되었습니다.', 'success');
            await loadPermissions();
        } catch (err) {
            showAxiosError(err, '패턴 삭제에 실패했습니다.');
        }
    };

    // ──────────────────────── 지원 action ────────────────────────

    const handleOpenAction = () => {
        setActionInput('');
        setActionDescInput('');
        setActionError(undefined);
        setActionDialog(true);
    };

    const handleAddAction = async () => {
        if (!selected) return;
        const value = actionInput.trim().toUpperCase();
        if (!value) {
            setActionError('action 코드를 입력해주세요.');
            return;
        }
        try {
            const res = await addPermissionAction(selected.id, {
                action: value,
                description: actionDescInput.trim() || null,
            });
            if (res.code !== "0000") throw new Error(res.message || `action 추가 실패 (${res.code})`);
            setActionDialog(false);
            showAlert('action 이 추가되었습니다.', 'success');
            await loadPermissions();
        } catch (err) {
            const axiosErr = err as {response?: {data?: {message?: string}}};
            setActionError(axiosErr.response?.data?.message || 'action 추가에 실패했습니다.');
        }
    };

    const handleDeleteAction = async (action: string) => {
        if (!selected) return;
        try {
            const res = await deletePermissionAction(selected.id, action);
            if (res.code !== "0000") throw new Error(res.message || `action 삭제 실패 (${res.code})`);
            showAlert('action 이 삭제되었습니다.', 'success');
            await loadPermissions();
        } catch (err) {
            showAxiosError(err, 'action 삭제에 실패했습니다.');
        }
    };

    const systemPermissions = permissions.filter(p => p.isSystem);
    const customPermissions = permissions.filter(p => !p.isSystem);

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Typography variant="h5">권한 카탈로그</Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
                    권한 추가
                </Button>
            </Box>

            {loading ? (
                <Stack spacing={1}>
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} height={64} variant="rectangular" />)}
                </Stack>
            ) : (
                <Box sx={{display: 'grid', gridTemplateColumns: {xs: '1fr', md: '320px 1fr'}, gap: 2}}>
                    {/* 좌측: 권한 목록 */}
                    <Paper sx={{p: 1, maxHeight: '75vh', overflow: 'auto'}}>
                        <Typography variant="overline" sx={{px: 1, color: 'text.secondary'}}>
                            시스템 ({systemPermissions.length})
                        </Typography>
                        <List dense disablePadding>
                            {systemPermissions.map(p => (
                                <ListItemButton
                                    key={p.id}
                                    selected={selectedId === p.id}
                                    onClick={() => setSelectedId(p.id)}
                                    sx={{borderRadius: 1, mb: 0.25}}
                                >
                                    <Box sx={{flex: 1, minWidth: 0}}>
                                        <Typography variant="body2" fontWeight={600} noWrap>{p.name}</Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap>{p.code}</Typography>
                                    </Box>
                                </ListItemButton>
                            ))}
                        </List>
                        <Divider sx={{my: 1}} />
                        <Typography variant="overline" sx={{px: 1, color: 'text.secondary'}}>
                            사용자 정의 ({customPermissions.length})
                        </Typography>
                        {customPermissions.length === 0 ? (
                            <Typography variant="caption" color="text.secondary" sx={{px: 1, display: 'block'}}>
                                추가된 사용자 정의 권한이 없습니다.
                            </Typography>
                        ) : (
                            <List dense disablePadding>
                                {customPermissions.map(p => (
                                    <ListItemButton
                                        key={p.id}
                                        selected={selectedId === p.id}
                                        onClick={() => setSelectedId(p.id)}
                                        sx={{borderRadius: 1, mb: 0.25}}
                                    >
                                        <Box sx={{flex: 1, minWidth: 0}}>
                                            <Typography variant="body2" fontWeight={600} noWrap>{p.name}</Typography>
                                            <Typography variant="caption" color="text.secondary" noWrap>{p.code}</Typography>
                                        </Box>
                                    </ListItemButton>
                                ))}
                            </List>
                        )}
                    </Paper>

                    {/* 우측: 선택 권한 상세 */}
                    {!selected ? (
                        <Paper sx={{p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                            <Typography variant="body2" color="text.secondary">권한을 선택하세요.</Typography>
                        </Paper>
                    ) : (
                        <Paper sx={{p: 2}}>
                            {/* 헤더 */}
                            <Box sx={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1}}>
                                <Box sx={{minWidth: 0}}>
                                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}>
                                        <Typography variant="h6">{selected.name}</Typography>
                                        <Chip label={selected.code} size="small" variant="outlined" />
                                        {selected.isSystem && <Chip label="시스템" size="small" color="warning" />}
                                    </Box>
                                    {selected.description && (
                                        <Typography variant="body2" color="text.secondary" sx={{mt: 0.5}}>
                                            {selected.description}
                                        </Typography>
                                    )}
                                </Box>
                                <Stack direction="row" spacing={1}>
                                    <Button size="small" startIcon={<EditIcon />} onClick={handleOpenEdit}>수정</Button>
                                    <Button
                                        size="small"
                                        color="error"
                                        startIcon={<DeleteIcon />}
                                        disabled={selected.isSystem}
                                        onClick={() => setDeleteDialog(true)}
                                    >
                                        삭제
                                    </Button>
                                </Stack>
                            </Box>

                            <Divider sx={{my: 2}} />

                            {/* api 패턴 */}
                            <Box sx={{mb: 2}}>
                                <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1}}>
                                    <Typography variant="subtitle2">API 패턴</Typography>
                                    <Button size="small" startIcon={<AddIcon />} onClick={handleOpenPattern}>패턴 추가</Button>
                                </Box>
                                {selected.apiPatterns.length === 0 ? (
                                    <Alert severity="warning" sx={{py: 0.5}}>
                                        등록된 API 패턴이 없습니다. 권한이 어떤 endpoint 도 보호하지 않습니다.
                                    </Alert>
                                ) : (
                                    <Stack spacing={0.5}>
                                        {selected.apiPatterns.map(ap => (
                                            <Box
                                                key={ap.id}
                                                sx={{
                                                    display: 'flex', alignItems: 'center', gap: 1,
                                                    px: 1, py: 0.5, borderRadius: 1, bgcolor: 'action.hover',
                                                }}
                                            >
                                                <Typography variant="body2" sx={{flex: 1, fontFamily: 'monospace'}}>
                                                    {ap.apiPattern}
                                                </Typography>
                                                <IconButton size="small" color="error" onClick={() => handleDeletePattern(ap.id)}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        ))}
                                    </Stack>
                                )}
                            </Box>

                            <Divider sx={{my: 2}} />

                            {/* 지원 action */}
                            <Box>
                                <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1}}>
                                    <Typography variant="subtitle2">지원 Action</Typography>
                                    <Button size="small" startIcon={<AddIcon />} onClick={handleOpenAction}>action 추가</Button>
                                </Box>
                                {selected.supportedActions.length === 0 ? (
                                    <Alert severity="warning" sx={{py: 0.5}}>
                                        등록된 action 이 없습니다. 최소 READ 등록을 권장합니다.
                                    </Alert>
                                ) : (
                                    <Stack spacing={0.5}>
                                        {selected.supportedActions.map(a => (
                                            <Box
                                                key={a.action}
                                                sx={{
                                                    display: 'flex', alignItems: 'center', gap: 1,
                                                    px: 1, py: 0.5, borderRadius: 1, bgcolor: 'action.hover',
                                                }}
                                            >
                                                <Chip label={a.action} size="small" />
                                                <Typography variant="body2" color="text.secondary" sx={{flex: 1}}>
                                                    {a.description ?? '-'}
                                                </Typography>
                                                <IconButton size="small" color="error" onClick={() => handleDeleteAction(a.action)}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        ))}
                                    </Stack>
                                )}
                            </Box>
                        </Paper>
                    )}
                </Box>
            )}

            {/* 권한 생성 다이얼로그 */}
            <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>권한 추가</DialogTitle>
                <DialogContent>
                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, mt: 1}}>
                        <TextField
                            label="코드" required size="small" fullWidth
                            value={createForm.code}
                            placeholder="예: MANAGER_CALENDAR"
                            helperText={createErrors.code || '대문자/숫자/언더스코어, 생성 후 변경 불가.'}
                            error={!!createErrors.code}
                            onChange={e => { setCreateForm({...createForm, code: e.target.value}); if (createErrors.code) setCreateErrors(prev => ({...prev, code: undefined})); }}
                        />
                        <TextField
                            label="이름" required size="small" fullWidth
                            value={createForm.name}
                            helperText={createErrors.name}
                            error={!!createErrors.name}
                            onChange={e => { setCreateForm({...createForm, name: e.target.value}); if (createErrors.name) setCreateErrors(prev => ({...prev, name: undefined})); }}
                        />
                        <TextField
                            label="설명" required size="small" fullWidth
                            value={createForm.description}
                            onChange={e => setCreateForm({...createForm, description: e.target.value})}
                        />
                        <TextField
                            label="API 패턴" required size="small" fullWidth
                            value={createForm.apiPatterns}
                            placeholder="예: /api/admin/calendar/events/**"
                            helperText="다른 권한과 겹치는 패턴은 거부됩니다."
                            onChange={e => setCreateForm({...createForm, apiPatterns: e.target.value})}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialog(false)}>취소</Button>
                    <Button onClick={handleCreate} variant="contained" disabled={submitting}>
                        {submitting ? '저장 중...' : '생성'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 권한 수정 다이얼로그 */}
            <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>권한 수정 - {selected?.code}</DialogTitle>
                <DialogContent>
                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, mt: 1}}>
                        <TextField
                            label="이름" required size="small" fullWidth
                            value={editForm.name}
                            error={!!editErrors.name}
                            helperText={editErrors.name}
                            onChange={e => { setEditForm({...editForm, name: e.target.value}); if (editErrors.name) setEditErrors(prev => ({...prev, name: undefined})); }}
                        />
                        <TextField
                            label="설명" size="small" fullWidth
                            value={editForm.description}
                            onChange={e => setEditForm({...editForm, description: e.target.value})}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialog(false)}>취소</Button>
                    <Button onClick={handleSaveEdit} variant="contained">저장</Button>
                </DialogActions>
            </Dialog>

            {/* api 패턴 추가 다이얼로그 */}
            <Dialog open={patternDialog} onClose={() => setPatternDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>API 패턴 추가</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus fullWidth size="small" sx={{mt: 1}}
                        label="API 패턴"
                        value={patternInput}
                        placeholder="예: /api/admin/calendar/events/**"
                        error={!!patternError}
                        helperText={patternError || 'Ant 패턴 (* / **). 다른 권한과 겹치면 거부됩니다.'}
                        onChange={e => { setPatternInput(e.target.value); if (patternError) setPatternError(undefined); }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPatternDialog(false)}>취소</Button>
                    <Button onClick={handleAddPattern} variant="contained">추가</Button>
                </DialogActions>
            </Dialog>

            {/* action 추가 다이얼로그 */}
            <Dialog open={actionDialog} onClose={() => setActionDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>지원 Action 추가</DialogTitle>
                <DialogContent>
                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, mt: 1}}>
                        <TextField
                            autoFocus fullWidth size="small"
                            label="Action 코드"
                            value={actionInput}
                            placeholder="예: SUBSCRIBE, APPROVE, CANCEL"
                            error={!!actionError}
                            helperText={actionError || '대문자 권장. 기본 CRUD 외 도메인 액션을 자유롭게 추가.'}
                            onChange={e => { setActionInput(e.target.value); if (actionError) setActionError(undefined); }}
                        />
                        <TextField
                            label="설명" size="small" fullWidth
                            value={actionDescInput}
                            onChange={e => setActionDescInput(e.target.value)}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setActionDialog(false)}>취소</Button>
                    <Button onClick={handleAddAction} variant="contained">추가</Button>
                </DialogActions>
            </Dialog>

            {/* 권한 삭제 확인 */}
            <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
                <DialogTitle>권한 삭제</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        <strong>{selected?.name}</strong>({selected?.code}) 권한을 삭제하시겠습니까?
                    </DialogContentText>
                    <Alert severity="warning" sx={{mt: 1}}>
                        해당 권한을 참조 중인 메뉴는 가시성 권한이 NULL 로 변경됩니다. 역할별 부여도 함께 제거됩니다.
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialog(false)}>취소</Button>
                    <Button onClick={handleDelete} variant="contained" color="error">삭제</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

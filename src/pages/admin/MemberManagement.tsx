import {useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {unwrapResponse} from '../../lib/apiResponse';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import {DataGrid, type GridColDef} from '@mui/x-data-grid';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import KeyOffIcon from '@mui/icons-material/KeyOff';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import {createMember, fetchMembers, fetchRoles, lockAccount, unlockAccount, changeRole, resetTotp, unlockApiKey} from '../../api/admin/AdminApi';
import type {CreateMemberReq, MemberRes} from '../../type/AuthType';
import type {RoleRes} from '../../type/RoleType';
import {getRoleChipColor, type RoleChipColor} from '../../utils/roleColor';
import {useAlert} from '../../context/AlertContext';

function formatDateTime(dateStr: string | null) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function isAccountLocked(member: MemberRes): boolean {
    if (!member.lockedAt) return false;
    if (member.permanentLock) return true;
    if (member.lockExpiresAt && new Date(member.lockExpiresAt) <= new Date()) return false;
    return true;
}

function getLockStatus(member: MemberRes): { label: string; color: 'default' | 'success' | 'warning' | 'error' } {
    if (!isAccountLocked(member)) return {label: '정상', color: 'success'};
    if (member.permanentLock) return {label: '정지', color: 'error'};
    return {label: '잠금', color: 'warning'};
}

function getRoleLabel(role: string, roles: RoleRes[]): { label: string; color: RoleChipColor } {
    const found = roles.find(r => r.code === role);
    const label = found?.name ?? role;
    return {label, color: getRoleChipColor(role)};
}

const initialCreateForm: CreateMemberReq = {
    loginId: '', email: '', nickname: '', name: '', phone: '', role: 'GUEST'
};

export default function MemberManagement() {
    const showAlert = useAlert();
    const queryClient = useQueryClient();
    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; loginId: string; action: 'lock' | 'unlock' | 'api-key-unlock' }>({
        open: false, loginId: '', action: 'unlock'
    });
    const [createDialog, setCreateDialog] = useState(false);
    const [createForm, setCreateForm] = useState<CreateMemberReq>(initialCreateForm);
    const [createLoading, setCreateLoading] = useState(false);
    const [createErrors, setCreateErrors] = useState<Partial<Record<keyof CreateMemberReq, string>>>({});
    const [roleDialog, setRoleDialog] = useState<{open: boolean; loginId: string; currentRole: string; newRole: string}>({
        open: false, loginId: '', currentRole: '', newRole: ''
    });
    const [totpResetDialog, setTotpResetDialog] = useState<{ open: boolean; loginId: string }>({
        open: false, loginId: ''
    });
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [menuTarget, setMenuTarget] = useState<MemberRes | null>(null);

    const {data: membersData, isLoading: loading, isError: membersError} = useQuery<MemberRes[]>({
        queryKey: ['admin', 'members'],
        queryFn: async ({signal}) => unwrapResponse(await fetchMembers({signal, skipGlobalError: true}), [] as MemberRes[]),
    });
    const members = membersData ?? [];

    const {data: rolesData} = useQuery<RoleRes[]>({
        queryKey: ['admin', 'roles'],
        queryFn: async ({signal}) => unwrapResponse(await fetchRoles({signal, skipGlobalError: true}), [] as RoleRes[]),
    });
    const roles = rolesData ?? [];

    // 에러 알림 — render 중 비교 패턴
    const [prevMembersError, setPrevMembersError] = useState(false);
    if (membersError !== prevMembersError) {
        setPrevMembersError(membersError);
        if (membersError) showAlert('회원 목록을 불러오는데 실패했습니다.', 'error');
    }

    const loadMembers = async () => {
        await queryClient.invalidateQueries({queryKey: ['admin', 'members']});
    };

    const handleConfirm = async () => {
        const {loginId, action} = confirmDialog;
        setConfirmDialog({open: false, loginId: '', action: 'unlock'});
        try {
            if (action === 'lock') {
                const res = await lockAccount(loginId);
                if (res.code !== "0000") throw new Error(res.message || `계정 잠금 실패 (${res.code})`);
                showAlert(`${loginId} 계정이 잠금되었습니다.`, 'success');
            } else if (action === 'api-key-unlock') {
                const res = await unlockApiKey(loginId);
                if (res.code !== "0000") throw new Error(res.message || `API Key 잠금 해제 실패 (${res.code})`);
                showAlert(`${loginId} 계정의 API Key 등록 잠금이 해제되었습니다.`, 'success');
            } else {
                const res = await unlockAccount(loginId);
                if (res.code !== "0000") throw new Error(res.message || `계정 잠금 해제 실패 (${res.code})`);
                showAlert(`${loginId} 계정 잠금이 해제되었습니다.`, 'success');
            }
            await loadMembers();
        } catch (error) {
            console.error(error);
        }
    };

    const handleResetTotp = async () => {
        const {loginId} = totpResetDialog;
        setTotpResetDialog({open: false, loginId: ''});
        try {
            const res = await resetTotp(loginId);
            if (res.code !== "0000") throw new Error(res.message || `TOTP 초기화 실패 (${res.code})`);
            showAlert(`${loginId} 계정의 TOTP가 초기화되었습니다.`, 'success');
            await loadMembers();
        } catch (error) {
            console.error(error);
            showAlert('TOTP 초기화에 실패했습니다.', 'error');
        }
    };

    const handleChangeRole = async () => {
        const {loginId, newRole} = roleDialog;
        setRoleDialog({open: false, loginId: '', currentRole: '', newRole: ''});
        try {
            const res = await changeRole(loginId, newRole);
            if (res.code !== "0000") throw new Error(res.message || `역할 변경 실패 (${res.code})`);
            showAlert(`${loginId} 계정의 역할이 변경되었습니다.`, 'success');
            await loadMembers();
        } catch (error) {
            console.error(error);
            showAlert('권한 변경에 실패했습니다.', 'error');
        }
    };

    const handleCreateMember = async () => {
        const errors: Partial<Record<keyof CreateMemberReq, string>> = {};
        if (!createForm.loginId.trim()) errors.loginId = '아이디를 입력해주세요.';
        if (!createForm.email.trim()) errors.email = '이메일을 입력해주세요.';
        if (!createForm.nickname.trim()) errors.nickname = '닉네임을 입력해주세요.';
        if (!createForm.name.trim()) errors.name = '이름을 입력해주세요.';
        if (!createForm.phone.trim()) errors.phone = '전화번호를 입력해주세요.';
        if (!createForm.role) errors.role = '역할을 선택해주세요.';
        if (Object.keys(errors).length > 0) {
            setCreateErrors(errors);
            return;
        }
        setCreateErrors({});
        setCreateLoading(true);
        try {
            const res = await createMember(createForm);
            if (res.code !== "0000") throw new Error(res.message || `회원 생성 실패 (${res.code})`);
            showAlert(`${createForm.loginId} 계정이 생성되었습니다.`, 'success');
            setCreateDialog(false);
            setCreateForm(initialCreateForm);
            await loadMembers();
        } catch (err) {
            console.error(err);
            const axiosErr = err as {response?: {status?: number; data?: {code?: string; message?: string; result?: Record<string, string>}}};
            if (axiosErr.response?.status === 400 && axiosErr.response?.data?.code === 'VALIDATION_4001') {
                setCreateErrors((axiosErr.response.data.result ?? {}) as Partial<Record<keyof CreateMemberReq, string>>);
                return;
            }
            const message = axiosErr.response?.data?.message || '회원 생성에 실패했습니다.';
            showAlert(message, 'error');
        } finally {
            setCreateLoading(false);
        }
    };

    const columns: GridColDef[] = [
        {
            field: 'no', headerName: 'No', minWidth: 80,
            renderCell: (params) => {
                const index = members.findIndex((m: any) => m.id === params.row.id);
                return index + 1;
            }
        },
        {field: 'loginId', headerName: '아이디', flex: 1, minWidth: 120},
        {
            field: 'role', headerName: '역할', width: 130,
            renderCell: (params) => {
                const role = getRoleLabel(params.value, roles);
                return <Chip label={role.label} size="small" color={role.color}/>;
            }
        },
        {
            field: 'status', headerName: '상태', width: 80,
            renderCell: (params) => {
                const status = getLockStatus(params.row);
                return <Chip label={status.label} size="small" color={status.color}/>;
            }
        },
        {
            field: 'failedLoginAttempts', headerName: '실패 횟수', minWidth: 110, align: 'center', headerAlign: 'center',
        },
        {
            field: 'lockedAt', headerName: '잠금 시각', flex: 1, minWidth: 140,
            valueFormatter: (value: string | null) => formatDateTime(value),
        },
        {
            field: 'lockExpiresAt', headerName: '해제 시각', flex: 1, minWidth: 140,
            renderCell: (params) => {
                if (params.row.permanentLock) return '영구';
                return formatDateTime(params.row.lockExpiresAt);
            },
        },
        {
            field: 'createdAt', headerName: '가입일', flex: 1, minWidth: 140,
            valueFormatter: (value: string) => formatDateTime(value),
        },
        {
            field: 'actions', headerName: '관리', width: 70, sortable: false, align: 'center', headerAlign: 'center',
            renderCell: (params) => {
                if (params.row.role === 'ADMIN') return null;
                return (
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            setAnchorEl(e.currentTarget);
                            setMenuTarget(params.row);
                        }}
                    >
                        <MoreVertIcon/>
                    </IconButton>
                );
            }
        },
    ];

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2}}>
                <Typography component="h2" variant="h6">
                    회원 관리
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<PersonAddIcon/>}
                    onClick={() => setCreateDialog(true)}
                >
                    회원 추가
                </Button>
            </Box>

            <DataGrid
                rows={members}
                columns={columns}
                loading={loading}
                autoHeight
                pageSizeOptions={[10, 20, 50, 100]}
                initialState={{
                    pagination: {paginationModel: {pageSize: 10}},
                }}
                disableRowSelectionOnClick
                slotProps={{
                    loadingOverlay: {
                        variant: 'skeleton',
                        noRowsVariant: 'skeleton',
                    },
                }}
                sx={{
                    '& .MuiDataGrid-cell': {
                        display: 'flex',
                        alignItems: 'center',
                    },
                }}
            />

            {/* 더보기 메뉴 */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
            >
                {menuTarget && (
                    isAccountLocked(menuTarget) ? (
                        <MenuItem onClick={() => {
                            setConfirmDialog({open: true, loginId: menuTarget.loginId, action: 'unlock'});
                            setAnchorEl(null);
                        }}>
                            <ListItemIcon><LockOpenIcon fontSize="small"/></ListItemIcon>
                            <ListItemText>잠금 해제</ListItemText>
                        </MenuItem>
                    ) : (
                        <MenuItem onClick={() => {
                            setConfirmDialog({open: true, loginId: menuTarget.loginId, action: 'lock'});
                            setAnchorEl(null);
                        }}>
                            <ListItemIcon><LockIcon fontSize="small"/></ListItemIcon>
                            <ListItemText>잠금</ListItemText>
                        </MenuItem>
                    )
                )}
                {menuTarget && (
                    <MenuItem onClick={() => {
                        setRoleDialog({
                            open: true,
                            loginId: menuTarget.loginId,
                            currentRole: menuTarget.role,
                            newRole: menuTarget.role === 'USER' ? 'GUEST' : 'USER'
                        });
                        setAnchorEl(null);
                    }}>
                        <ListItemIcon><PersonAddIcon fontSize="small"/></ListItemIcon>
                        <ListItemText>권한 변경</ListItemText>
                    </MenuItem>
                )}
                {menuTarget && menuTarget.totpEnabled && (
                    <MenuItem onClick={() => {
                        setTotpResetDialog({ open: true, loginId: menuTarget.loginId });
                        setAnchorEl(null);
                    }}>
                        <ListItemIcon><KeyOffIcon fontSize="small"/></ListItemIcon>
                        <ListItemText>TOTP 초기화</ListItemText>
                    </MenuItem>
                )}
                {menuTarget && menuTarget.apiKeyLocked && (
                    <MenuItem onClick={() => {
                        setConfirmDialog({open: true, loginId: menuTarget.loginId, action: 'api-key-unlock'});
                        setAnchorEl(null);
                    }}>
                        <ListItemIcon><VpnKeyIcon fontSize="small"/></ListItemIcon>
                        <ListItemText>API Key 잠금 해제</ListItemText>
                    </MenuItem>
                )}
            </Menu>

            {/* 잠금/해제 확인 다이얼로그 */}
            <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({open: false, loginId: '', action: 'unlock'})} disableRestoreFocus>
                <DialogTitle>
                    {confirmDialog.action === 'lock' && '계정 잠금'}
                    {confirmDialog.action === 'unlock' && '계정 잠금 해제'}
                    {confirmDialog.action === 'api-key-unlock' && 'API Key 등록 잠금 해제'}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {confirmDialog.action === 'lock' && (
                            <><strong>{confirmDialog.loginId}</strong> 계정을 잠금하시겠습니까? 해당 계정은 로그인할 수 없게 됩니다.</>
                        )}
                        {confirmDialog.action === 'unlock' && (
                            <><strong>{confirmDialog.loginId}</strong> 계정의 잠금을 해제하고 실패 횟수를 초기화하시겠습니까?</>
                        )}
                        {confirmDialog.action === 'api-key-unlock' && (
                            <><strong>{confirmDialog.loginId}</strong> 계정의 API Key 등록 잠금을 해제하시겠습니까? 검증 실패 횟수도 초기화됩니다.</>
                        )}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDialog({open: false, loginId: '', action: 'unlock'})}>취소</Button>
                    <Button
                        onClick={handleConfirm}
                        variant="contained"
                        color={confirmDialog.action === 'lock' ? 'error' : 'primary'}
                    >
                        {confirmDialog.action === 'lock' ? '잠금' : '해제'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 권한 변경 다이얼로그 */}
            <Dialog open={roleDialog.open} onClose={() => setRoleDialog({open: false, loginId: '', currentRole: '', newRole: ''})} disableRestoreFocus>
                <DialogTitle>권한 변경</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        <strong>{roleDialog.loginId}</strong> 계정의 역할을 변경하시겠습니까?
                    </DialogContentText>
                    <FormControl fullWidth size="small" sx={{mt: 2}}>
                        <InputLabel>역할</InputLabel>
                        <Select
                            value={roleDialog.newRole}
                            label="역할"
                            onChange={(e) => setRoleDialog({...roleDialog, newRole: e.target.value})}
                        >
                            {roles.map(r => (
                                <MenuItem key={r.code} value={r.code}>{r.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRoleDialog({open: false, loginId: '', currentRole: '', newRole: ''})}>취소</Button>
                    {roleDialog.newRole !== roleDialog.currentRole && (
                        <Button
                            onClick={handleChangeRole}
                            variant="contained"
                        >
                            변경
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            {/* TOTP 초기화 확인 다이얼로그 */}
            <Dialog open={totpResetDialog.open} onClose={() => setTotpResetDialog({open: false, loginId: ''})} disableRestoreFocus>
                <DialogTitle>TOTP 초기화</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        <strong>{totpResetDialog.loginId}</strong> 계정의 TOTP를 초기화하시겠습니까? 다음 로그인 시 TOTP를 다시 등록해야 합니다.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTotpResetDialog({open: false, loginId: ''})}>취소</Button>
                    <Button onClick={handleResetTotp} variant="contained" color="error">
                        초기화
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 회원 생성 다이얼로그 */}
            <Dialog open={createDialog} onClose={() => { setCreateDialog(false); setCreateForm(initialCreateForm); setCreateErrors({}); }} maxWidth="sm" fullWidth>
                <DialogTitle>회원 추가</DialogTitle>
                <DialogContent>
                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, mt: 1}}>
                        <TextField
                            label="아이디" required fullWidth size="small"
                            value={createForm.loginId}
                            onChange={(e) => { setCreateForm({...createForm, loginId: e.target.value}); if (createErrors.loginId) setCreateErrors(prev => ({...prev, loginId: undefined})); }}
                            error={!!createErrors.loginId} helperText={createErrors.loginId}
                        />
                        <TextField
                            label="이름" required fullWidth size="small"
                            value={createForm.name}
                            onChange={(e) => { setCreateForm({...createForm, name: e.target.value}); if (createErrors.name) setCreateErrors(prev => ({...prev, name: undefined})); }}
                            error={!!createErrors.name} helperText={createErrors.name}
                        />
                        <TextField
                            label="닉네임" required fullWidth size="small"
                            value={createForm.nickname}
                            onChange={(e) => { setCreateForm({...createForm, nickname: e.target.value}); if (createErrors.nickname) setCreateErrors(prev => ({...prev, nickname: undefined})); }}
                            error={!!createErrors.nickname} helperText={createErrors.nickname}
                        />
                        <TextField
                            label="이메일" required fullWidth size="small" type="email"
                            value={createForm.email}
                            onChange={(e) => { setCreateForm({...createForm, email: e.target.value}); if (createErrors.email) setCreateErrors(prev => ({...prev, email: undefined})); }}
                            error={!!createErrors.email} helperText={createErrors.email}
                        />
                        <TextField
                            label="전화번호" required fullWidth size="small"
                            value={createForm.phone}
                            onChange={(e) => { setCreateForm({...createForm, phone: e.target.value}); if (createErrors.phone) setCreateErrors(prev => ({...prev, phone: undefined})); }}
                            error={!!createErrors.phone} helperText={createErrors.phone}
                        />
                        <FormControl fullWidth size="small" required error={!!createErrors.role}>
                            <InputLabel>역할</InputLabel>
                            <Select
                                value={createForm.role}
                                label="역할"
                                onChange={(e) => { setCreateForm({...createForm, role: e.target.value}); if (createErrors.role) setCreateErrors(prev => ({...prev, role: undefined})); }}
                            >
                                {roles.map(r => (
                                    <MenuItem key={r.code} value={r.code}>{r.name}</MenuItem>
                                ))}
                            </Select>
                            {createErrors.role && <FormHelperText>{createErrors.role}</FormHelperText>}
                        </FormControl>
                        <Alert severity="info" sx={{mt: 1}}>
                            기본 비밀번호가 설정되며, 첫 로그인 시 비밀번호 변경이 필요합니다.
                        </Alert>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setCreateDialog(false); setCreateForm(initialCreateForm); }}>취소</Button>
                    <Button onClick={handleCreateMember} variant="contained" disabled={createLoading}>
                        {createLoading ? '생성 중...' : '생성'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

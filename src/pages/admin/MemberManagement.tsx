import {useEffect, useState} from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
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
import {DataGrid, type GridColDef} from '@mui/x-data-grid';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import {createMember, fetchMembers, lockAccount, unlockAccount, changeRole} from '../../api/admin/AdminApi';
import type {CreateMemberReq, MemberRes} from '../../type/AuthType';

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

function getRoleLabel(role: string): { label: string; color: 'primary' | 'default' | 'warning' } {
    switch (role) {
        case 'ADMIN': return {label: '관리자', color: 'warning'};
        case 'USER': return {label: '사용자', color: 'default'};
        case 'GUEST': return {label: '게스트', color: 'default'};
        default: return {label: role, color: 'default'};
    }
}

const initialCreateForm: CreateMemberReq = {
    loginId: '', email: '', nickname: '', name: '', phone: '', role: 'GUEST'
};

export default function MemberManagement() {
    const [members, setMembers] = useState<MemberRes[]>([]);
    const [loading, setLoading] = useState(true);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false, message: '', severity: 'success'
    });
    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; loginId: string; action: 'lock' | 'unlock' }>({
        open: false, loginId: '', action: 'unlock'
    });
    const [createDialog, setCreateDialog] = useState(false);
    const [createForm, setCreateForm] = useState<CreateMemberReq>(initialCreateForm);
    const [createLoading, setCreateLoading] = useState(false);
    const [roleDialog, setRoleDialog] = useState<{open: boolean; loginId: string; currentRole: string; newRole: string}>({
        open: false, loginId: '', currentRole: '', newRole: ''
    });
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [menuTarget, setMenuTarget] = useState<MemberRes | null>(null);

    const loadMembers = async () => {
        setLoading(true);
        try {
            const res = await fetchMembers();
            if (res.result) {
                setMembers(res.result);
            }
        } catch {
            setSnackbar({open: true, message: '회원 목록을 불러오는데 실패했습니다.', severity: 'error'});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMembers();
    }, []);

    const handleConfirm = async () => {
        const {loginId, action} = confirmDialog;
        setConfirmDialog({open: false, loginId: '', action: 'unlock'});
        try {
            if (action === 'lock') {
                await lockAccount(loginId);
                setSnackbar({open: true, message: `${loginId} 계정이 잠금되었습니다.`, severity: 'success'});
            } else {
                await unlockAccount(loginId);
                setSnackbar({open: true, message: `${loginId} 계정 잠금이 해제되었습니다.`, severity: 'success'});
            }
            await loadMembers();
        } catch {
            setSnackbar({
                open: true,
                message: action === 'lock' ? '계정 잠금에 실패했습니다.' : '잠금 해제에 실패했습니다.',
                severity: 'error'
            });
        }
    };

    const handleChangeRole = async () => {
        const {loginId, newRole} = roleDialog;
        setRoleDialog({open: false, loginId: '', currentRole: '', newRole: ''});
        try {
            await changeRole(loginId, newRole);
            setSnackbar({open: true, message: `${loginId} 계정의 역할이 변경되었습니다.`, severity: 'success'});
            await loadMembers();
        } catch {
            setSnackbar({open: true, message: '권한 변경에 실패했습니다.', severity: 'error'});
        }
    };

    const handleCreateMember = async () => {
        if (!createForm.loginId || !createForm.email || !createForm.nickname || !createForm.name || !createForm.phone) {
            setSnackbar({open: true, message: '모든 필드를 입력해주세요.', severity: 'error'});
            return;
        }

        setCreateLoading(true);
        try {
            await createMember(createForm);
            setSnackbar({open: true, message: `${createForm.loginId} 계정이 생성되었습니다.`, severity: 'success'});
            setCreateDialog(false);
            setCreateForm(initialCreateForm);
            await loadMembers();
        } catch (error: any) {
            const message = error?.response?.data?.message || '회원 생성에 실패했습니다.';
            setSnackbar({open: true, message, severity: 'error'});
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
            field: 'role', headerName: '역할', width: 80,
            renderCell: (params) => {
                const role = getRoleLabel(params.value);
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
                pageSizeOptions={[10, 25, 50]}
                initialState={{
                    pagination: {paginationModel: {pageSize: 10}},
                }}
                disableRowSelectionOnClick
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
            </Menu>

            {/* 잠금/해제 확인 다이얼로그 */}
            <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({open: false, loginId: '', action: 'unlock'})}>
                <DialogTitle>
                    {confirmDialog.action === 'lock' ? '계정 잠금' : '계정 잠금 해제'}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {confirmDialog.action === 'lock'
                            ? <><strong>{confirmDialog.loginId}</strong> 계정을 잠금하시겠습니까? 해당 계정은 로그인할 수 없게 됩니다.</>
                            : <><strong>{confirmDialog.loginId}</strong> 계정의 잠금을 해제하고 실패 횟수를 초기화하시겠습니까?</>
                        }
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
            <Dialog open={roleDialog.open} onClose={() => setRoleDialog({open: false, loginId: '', currentRole: '', newRole: ''})}>
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
                            <MenuItem value="USER">사용자</MenuItem>
                            <MenuItem value="GUEST">게스트</MenuItem>
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRoleDialog({open: false, loginId: '', currentRole: '', newRole: ''})}>취소</Button>
                    <Button
                        onClick={handleChangeRole}
                        variant="contained"
                        disabled={roleDialog.newRole === roleDialog.currentRole}
                    >
                        변경
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 회원 생성 다이얼로그 */}
            <Dialog open={createDialog} onClose={() => { setCreateDialog(false); setCreateForm(initialCreateForm); }} maxWidth="sm" fullWidth>
                <DialogTitle>회원 추가</DialogTitle>
                <DialogContent>
                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, mt: 1}}>
                        <TextField
                            label="아이디" required fullWidth size="small"
                            value={createForm.loginId}
                            onChange={(e) => setCreateForm({...createForm, loginId: e.target.value})}
                        />
                        <TextField
                            label="이름" required fullWidth size="small"
                            value={createForm.name}
                            onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                        />
                        <TextField
                            label="닉네임" required fullWidth size="small"
                            value={createForm.nickname}
                            onChange={(e) => setCreateForm({...createForm, nickname: e.target.value})}
                        />
                        <TextField
                            label="이메일" required fullWidth size="small" type="email"
                            value={createForm.email}
                            onChange={(e) => setCreateForm({...createForm, email: e.target.value})}
                        />
                        <TextField
                            label="전화번호" required fullWidth size="small"
                            value={createForm.phone}
                            onChange={(e) => setCreateForm({...createForm, phone: e.target.value})}
                        />
                        <FormControl fullWidth size="small">
                            <InputLabel>역할</InputLabel>
                            <Select
                                value={createForm.role}
                                label="역할"
                                onChange={(e) => setCreateForm({...createForm, role: e.target.value})}
                            >
                                <MenuItem value="USER">사용자</MenuItem>
                                <MenuItem value="GUEST">게스트</MenuItem>
                            </Select>
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

            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar(prev => ({...prev, open: false}))}
                anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
            >
                <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({...prev, open: false}))}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}

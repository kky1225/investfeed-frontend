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
import {DataGrid, type GridColDef} from '@mui/x-data-grid';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import LockIcon from '@mui/icons-material/Lock';
import {fetchMembers, lockAccount, unlockAccount} from '../../api/admin/AdminApi';
import type {MemberRes} from '../../type/AuthType';

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

export default function MemberManagement() {
    const [members, setMembers] = useState<MemberRes[]>([]);
    const [loading, setLoading] = useState(true);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false, message: '', severity: 'success'
    });
    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; loginId: string; action: 'lock' | 'unlock' }>({
        open: false, loginId: '', action: 'unlock'
    });

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

    const columns: GridColDef[] = [
        {field: 'loginId', headerName: '아이디', flex: 1, minWidth: 120},
        {
            field: 'role', headerName: '역할', width: 80,
            renderCell: (params) => (
                <Chip
                    label={params.value === 'ADMIN' ? '관리자' : '사용자'}
                    size="small"
                    color={params.value === 'ADMIN' ? 'primary' : 'default'}
                />
            )
        },
        {
            field: 'status', headerName: '상태', width: 120,
            renderCell: (params) => {
                const status = getLockStatus(params.row);
                return <Chip label={status.label} size="small" color={status.color}/>;
            }
        },
        {
            field: 'failedLoginAttempts', headerName: '실패 횟수', width: 90, align: 'center', headerAlign: 'center',
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
            field: 'actions', headerName: '관리', width: 120, sortable: false,
            renderCell: (params) => {
                if (isAccountLocked(params.row)) {
                    return (
                        <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            startIcon={<LockOpenIcon/>}
                            onClick={() => setConfirmDialog({open: true, loginId: params.row.loginId, action: 'unlock'})}
                        >
                            해제
                        </Button>
                    );
                }
                return (
                    <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<LockIcon/>}
                        disabled={params.row.role === 'ADMIN'}
                        onClick={() => setConfirmDialog({open: true, loginId: params.row.loginId, action: 'lock'})}
                    >
                        잠금
                    </Button>
                );
            }
        },
    ];

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '1700px'}}}>
            <Typography component="h2" variant="h6" sx={{mb: 2}}>
                회원 관리
            </Typography>

            <DataGrid
                rows={members}
                columns={columns}
                loading={loading}
                autoHeight
                pageSizeOptions={[10, 25, 50]}
                initialState={{
                    pagination: {paginationModel: {pageSize: 10}},
                    sorting: {sortModel: [{field: 'createdAt', sort: 'desc'}]},
                }}
                disableRowSelectionOnClick
                sx={{
                    '& .MuiDataGrid-cell': {
                        display: 'flex',
                        alignItems: 'center',
                    },
                }}
            />

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

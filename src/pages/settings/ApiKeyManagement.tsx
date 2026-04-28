import {useState} from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
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
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CssBaseline from '@mui/material/CssBaseline';
import {useNavigate} from 'react-router-dom';
import ColorModeSelect from '../../components/ColorModeSelect';
import AppTheme from '../../components/AppTheme';
import {createApiKey, deleteApiKey} from '../../api/auth/AuthApi';
import {useApiKeyStatus} from '../../context/ApiKeyStatusContext';
import type {ApiKeyReq} from '../../type/AuthType';

function formatDateTime(dateStr: string) {
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function defaultExpiresAt(): string {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function getDaysLeft(dateStr: string): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expires = new Date(dateStr);
    expires.setHours(0, 0, 0, 0);
    return Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const initialForm: ApiKeyReq = {brokerId: 0, appKey: '', secretKey: '', expiresAt: defaultExpiresAt()};

export default function ApiKeyManagement() {
    const navigate = useNavigate();
    const {apiKeys, apiBrokers, isLoaded: apiKeyLoaded, invalidateApiKeys} = useApiKeyStatus();
    const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity: 'success' | 'error'}>({
        open: false, message: '', severity: 'success'
    });
    const [formDialog, setFormDialog] = useState(false);
    const [form, setForm] = useState<ApiKeyReq>(initialForm);
    const [formLoading, setFormLoading] = useState(false);
    const [formErrors, setFormErrors] = useState<{brokerId?: string; appKey?: string; secretKey?: string}>({});
    const [deleteDialog, setDeleteDialog] = useState<{open: boolean; id: number; brokerName: string}>({
        open: false, id: 0, brokerName: ''
    });

    const loading = !apiKeyLoaded;

    const openFormDialog = () => {
        const defaultBrokerId = apiBrokers.length > 0 ? apiBrokers[0].id : 0;
        setForm({...initialForm, brokerId: defaultBrokerId, expiresAt: defaultExpiresAt()});
        setFormDialog(true);
    };

    const handleSubmit = async () => {
        const errors: {brokerId?: string; appKey?: string; secretKey?: string; expiresAt?: string} = {};
        if (!form.brokerId) errors.brokerId = '제공자를 선택해주세요.';
        if (!form.appKey.trim()) errors.appKey = 'App Key를 입력해주세요.';
        if (!form.secretKey.trim()) errors.secretKey = 'Secret Key를 입력해주세요.';
        if (!form.expiresAt) errors.expiresAt = '유효기간을 입력해주세요.';
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});
        setFormLoading(true);
        try {
            await createApiKey(form);
            setSnackbar({open: true, message: 'API Key가 등록되었습니다.', severity: 'success'});
            setFormDialog(false);
            setForm(initialForm);
            await invalidateApiKeys();
        } catch (err) {
            console.error(err);
            const axiosErr = err as {response?: {status?: number; data?: {code?: string; message?: string; result?: Record<string, string>}}};
            if (axiosErr.response?.status === 400 && axiosErr.response?.data?.code === 'VALIDATION_4001') {
                setFormErrors((axiosErr.response.data.result ?? {}) as typeof formErrors);
                return;
            }
            // 그 외 오류(AUTH_4022 잘못된 키 / AUTH_4023 등록 잠금 등)는 axios 전역 인터셉터가 에러 다이얼로그로 표시
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteApiKey(deleteDialog.id);
            setSnackbar({open: true, message: 'API Key가 삭제되었습니다.', severity: 'success'});
            setDeleteDialog({open: false, id: 0, brokerName: ''});
            await invalidateApiKeys();
        } catch (error) {
            console.error(error);
            setSnackbar({open: true, message: 'API Key 삭제에 실패했습니다.', severity: 'error'});
        }
    };

    return (
        <AppTheme>
            <CssBaseline enableColorScheme/>
            <ColorModeSelect sx={{position: 'fixed', top: '1rem', right: '1rem'}}/>
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '800px'}, mx: 'auto', p: 2, mt: {xs: 7, sm: 5}}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 3}}>
                <IconButton onClick={() => navigate(-1)}>
                    <ArrowBackIcon/>
                </IconButton>
                <Typography component="h2" variant="h6" sx={{flex: 1}}>
                    API Key 관리
                </Typography>
                <Button
                    variant="contained"
                    sx={{bgcolor: 'text.primary', '&:hover': {bgcolor: 'text.secondary'}}}
                    startIcon={<AddIcon/>}
                    onClick={openFormDialog}
                >
                    등록
                </Button>
            </Box>

            {loading ? (
                <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                    {Array.from({length: 2}).map((_, i) => (
                        <Card key={i} variant="outlined">
                            <CardContent>
                                <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1}}>
                                    <Skeleton variant="rounded" width={80} height={24}/>
                                    <Skeleton width={130}/>
                                </Box>
                                <Skeleton width="70%" sx={{mb: 0.5}}/>
                                <Skeleton width="40%"/>
                            </CardContent>
                            <CardActions sx={{justifyContent: 'flex-end'}}>
                                <Skeleton variant="rounded" width={60} height={28}/>
                            </CardActions>
                        </Card>
                    ))}
                </Box>
            ) : apiKeys.length === 0 ? (
                <Alert severity="info">등록된 API Key가 없습니다.</Alert>
            ) : (
                <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                    {apiKeys.map((apiKey) => (
                        <Card key={apiKey.id} variant="outlined">
                            <CardContent>
                                <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1}}>
                                    <Chip label={apiKey.brokerName} size="small" variant="outlined"/>
                                    <Typography variant="caption" color="text.secondary">
                                        {formatDateTime(apiKey.createdAt)}
                                    </Typography>
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                    App Key: {apiKey.appKey}
                                </Typography>
                                {(() => {
                                    const daysLeft = getDaysLeft(apiKey.expiresAt);
                                    const isExpired = daysLeft <= 0;
                                    const isWarning = daysLeft > 0 && daysLeft <= 30;
                                    return (
                                        <Typography variant="body2" sx={{mt: 0.5, color: isExpired ? 'error.main' : isWarning ? 'warning.main' : 'text.secondary'}}>
                                            만료일: {formatDate(apiKey.expiresAt)}
                                            {isExpired && ' (만료됨)'}
                                            {isWarning && ` (${daysLeft}일 남음)`}
                                        </Typography>
                                    );
                                })()}
                            </CardContent>
                            <CardActions sx={{justifyContent: 'flex-end'}}>
                                <Button size="small" color="error" startIcon={<DeleteIcon/>}
                                    onClick={() => setDeleteDialog({open: true, id: apiKey.id, brokerName: apiKey.brokerName})}>
                                    삭제
                                </Button>
                            </CardActions>
                        </Card>
                    ))}
                </Box>
            )}

            {/* 등록 다이얼로그 */}
            <Dialog open={formDialog} onClose={() => { setFormDialog(false); setFormErrors({}); }} maxWidth="sm" fullWidth disableScrollLock>
                <DialogTitle>API Key 등록</DialogTitle>
                <DialogContent>
                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, mt: 1}}>
                        <FormControl fullWidth size="small" required error={!!formErrors.brokerId}>
                            <InputLabel>제공자</InputLabel>
                            <Select
                                value={form.brokerId}
                                label="제공자"
                                onChange={(e) => { setForm({...form, brokerId: Number(e.target.value)}); if (formErrors.brokerId) setFormErrors(prev => ({...prev, brokerId: undefined})); }}
                            >
                                {apiBrokers.map(b => (
                                    <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                                ))}
                            </Select>
                            {formErrors.brokerId && <FormHelperText>{formErrors.brokerId}</FormHelperText>}
                        </FormControl>
                        <TextField
                            label="App Key" required fullWidth size="small"
                            value={form.appKey}
                            onChange={(e) => { setForm({...form, appKey: e.target.value}); if (formErrors.appKey) setFormErrors(prev => ({...prev, appKey: undefined})); }}
                            error={!!formErrors.appKey} helperText={formErrors.appKey}
                        />
                        <TextField
                            label="Secret Key" required fullWidth size="small"
                            type="password"
                            value={form.secretKey}
                            onChange={(e) => { setForm({...form, secretKey: e.target.value}); if (formErrors.secretKey) setFormErrors(prev => ({...prev, secretKey: undefined})); }}
                            error={!!formErrors.secretKey} helperText={formErrors.secretKey}
                        />
                        <TextField
                            label="유효기간" required fullWidth size="small"
                            type="date"
                            value={form.expiresAt}
                            onChange={(e) => { setForm({...form, expiresAt: e.target.value}); if (formErrors.expiresAt) setFormErrors(prev => ({...prev, expiresAt: undefined})); }}
                            error={!!formErrors.expiresAt} helperText={formErrors.expiresAt || '기본값: 1년'}
                            slotProps={{inputLabel: {shrink: true}}}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setFormDialog(false); setFormErrors({}); }}>취소</Button>
                    <Button onClick={handleSubmit} variant="contained"
                        sx={{bgcolor: 'text.primary', '&:hover': {bgcolor: 'text.secondary'}}}
                        disabled={formLoading}>
                        {formLoading ? '처리 중...' : '등록'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 삭제 확인 다이얼로그 */}
            <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({open: false, id: 0, brokerName: ''})} disableScrollLock>
                <DialogTitle>API Key 삭제</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        <strong>{deleteDialog.brokerName}</strong> API Key를 삭제하시겠습니까?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialog({open: false, id: 0, brokerName: ''})}>취소</Button>
                    <Button onClick={handleDelete} variant="contained"
                        sx={{bgcolor: '#d32f2f', '&:hover': {bgcolor: '#b71c1c'}}}>삭제</Button>
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
        </AppTheme>
    );
}

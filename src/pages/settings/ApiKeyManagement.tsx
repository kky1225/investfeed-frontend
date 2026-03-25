import {useEffect, useState} from 'react';
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
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {useNavigate} from 'react-router-dom';
import {fetchApiKeys, createApiKey, deleteApiKey} from '../../api/auth/AuthApi';
import type {ApiKeyReq, ApiKeyRes} from '../../type/AuthType';

function formatDateTime(dateStr: string) {
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const providers = [
    {value: 'KIWOOM', label: '키움증권'},
    {value: 'UPBIT', label: '업비트'},
];

const initialForm: ApiKeyReq = {provider: 'KIWOOM', appKey: '', secretKey: ''};

export default function ApiKeyManagement() {
    const navigate = useNavigate();
    const [apiKeys, setApiKeys] = useState<ApiKeyRes[]>([]);
    const [loading, setLoading] = useState(true);
    const [snackbar, setSnackbar] = useState<{open: boolean; message: string; severity: 'success' | 'error'}>({
        open: false, message: '', severity: 'success'
    });
    const [formDialog, setFormDialog] = useState(false);
    const [form, setForm] = useState<ApiKeyReq>(initialForm);
    const [formLoading, setFormLoading] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState<{open: boolean; id: number; provider: string}>({
        open: false, id: 0, provider: ''
    });

    const loadApiKeys = async () => {
        setLoading(true);
        try {
            const res = await fetchApiKeys();
            if (res.result) {
                setApiKeys(res.result);
            }
        } catch {
            setSnackbar({open: true, message: 'API Key 목록을 불러오는데 실패했습니다.', severity: 'error'});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadApiKeys();
    }, []);

    const handleSubmit = async () => {
        if (!form.appKey || !form.secretKey) {
            setSnackbar({open: true, message: '모든 필드를 입력해주세요.', severity: 'error'});
            return;
        }

        setFormLoading(true);
        try {
            await createApiKey(form);
            setSnackbar({open: true, message: 'API Key가 등록되었습니다.', severity: 'success'});
            setFormDialog(false);
            setForm(initialForm);
            await loadApiKeys();
        } catch (error: any) {
            const message = error?.response?.data?.message || 'API Key 등록에 실패했습니다.';
            setSnackbar({open: true, message, severity: 'error'});
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteApiKey(deleteDialog.id);
            setSnackbar({open: true, message: 'API Key가 삭제되었습니다.', severity: 'success'});
            setDeleteDialog({open: false, id: 0, provider: ''});
            await loadApiKeys();
        } catch {
            setSnackbar({open: true, message: 'API Key 삭제에 실패했습니다.', severity: 'error'});
        }
    };

    const getProviderLabel = (value: string) => {
        return providers.find(p => p.value === value)?.label || value;
    };

    return (
        <Box sx={{width: '100%', maxWidth: {sm: '100%', md: '800px'}, mx: 'auto', p: 2}}>
            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 3}}>
                <IconButton onClick={() => navigate(-1)}>
                    <ArrowBackIcon/>
                </IconButton>
                <Typography component="h2" variant="h6" sx={{flex: 1}}>
                    API Key 관리
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon/>}
                    onClick={() => {
                        setForm(initialForm);
                        setFormDialog(true);
                    }}
                >
                    등록
                </Button>
            </Box>

            {loading ? (
                <Typography color="text.secondary">불러오는 중...</Typography>
            ) : apiKeys.length === 0 ? (
                <Alert severity="info">등록된 API Key가 없습니다.</Alert>
            ) : (
                <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                    {apiKeys.map((apiKey) => (
                        <Card key={apiKey.id} variant="outlined">
                            <CardContent>
                                <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1}}>
                                    <Chip label={getProviderLabel(apiKey.provider)} color="primary" size="small"/>
                                    <Typography variant="caption" color="text.secondary">
                                        {formatDateTime(apiKey.createdAt)}
                                    </Typography>
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                    App Key: {apiKey.appKey}
                                </Typography>
                            </CardContent>
                            <CardActions sx={{justifyContent: 'flex-end'}}>
                                <Button size="small" color="error" startIcon={<DeleteIcon/>}
                                    onClick={() => setDeleteDialog({open: true, id: apiKey.id, provider: apiKey.provider})}>
                                    삭제
                                </Button>
                            </CardActions>
                        </Card>
                    ))}
                </Box>
            )}

            {/* 등록/수정 다이얼로그 */}
            <Dialog open={formDialog} onClose={() => setFormDialog(false)} maxWidth="sm" fullWidth disableScrollLock>
                <DialogTitle>API Key 등록</DialogTitle>
                <DialogContent>
                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, mt: 1}}>
                        <FormControl fullWidth size="small">
                            <InputLabel>제공자</InputLabel>
                            <Select
                                value={form.provider}
                                label="제공자"
                                onChange={(e) => setForm({...form, provider: e.target.value})}
                            >
                                {providers.map(p => (
                                    <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            label="App Key" required fullWidth size="small"
                            value={form.appKey}
                            onChange={(e) => setForm({...form, appKey: e.target.value})}
                        />
                        <TextField
                            label="Secret Key" required fullWidth size="small"
                            type="password"
                            value={form.secretKey}
                            onChange={(e) => setForm({...form, secretKey: e.target.value})}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setFormDialog(false)}>취소</Button>
                    <Button onClick={handleSubmit} variant="contained" disabled={formLoading}>
                        {formLoading ? '처리 중...' : '등록'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* 삭제 확인 다이얼로그 */}
            <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({open: false, id: 0, provider: ''})} disableScrollLock>
                <DialogTitle>API Key 삭제</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        <strong>{getProviderLabel(deleteDialog.provider)}</strong> API Key를 삭제하시겠습니까?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialog({open: false, id: 0, provider: ''})}>취소</Button>
                    <Button onClick={handleDelete} variant="contained" color="error">삭제</Button>
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

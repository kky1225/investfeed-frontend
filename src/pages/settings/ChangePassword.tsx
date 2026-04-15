import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import FormLabel from '@mui/material/FormLabel';
import FormControl from '@mui/material/FormControl';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import MuiCard from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import { styled } from '@mui/material/styles';

import ColorModeSelect from '../../components/ColorModeSelect.tsx';
import AppTheme from '../../components/AppTheme.tsx';
import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { changePassword, logout } from '../../api/auth/AuthApi';
import { useAuth } from '../../context/AuthContext';

const ERROR_MESSAGES: Record<string, string> = {
    AUTH_4010: '인증 정보가 유효하지 않습니다. 다시 로그인해 주세요.',
    AUTH_4011: '현재 비밀번호가 올바르지 않습니다.',
    AUTH_4012: '현재 비밀번호와 같은 비밀번호로 변경할 수 없습니다.',
};
const DEFAULT_ERROR = '비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.';

const Card = styled(MuiCard)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    alignSelf: 'center',
    width: '100%',
    padding: theme.spacing(4),
    gap: theme.spacing(2),
    margin: 'auto',
    [theme.breakpoints.up('sm')]: {
        maxWidth: '450px',
    },
    boxShadow:
        'hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px',
    ...theme.applyStyles('dark', {
        boxShadow:
            'hsla(220, 30%, 5%, 0.5) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.08) 0px 15px 35px -5px',
    }),
}));

const Container = styled(Stack)(({ theme }) => ({
    height: 'calc((1 - var(--template-frame-height, 0)) * 100dvh)',
    minHeight: '100%',
    padding: theme.spacing(2),
    [theme.breakpoints.up('sm')]: {
        padding: theme.spacing(4),
    },
    '&::before': {
        content: '""',
        display: 'block',
        position: 'absolute',
        zIndex: -1,
        inset: 0,
        backgroundImage:
            'radial-gradient(ellipse at 50% 50%, hsl(210, 100%, 97%), hsl(0, 0%, 100%))',
        backgroundRepeat: 'no-repeat',
        ...theme.applyStyles('dark', {
            backgroundImage:
                'radial-gradient(at 50% 50%, hsla(210, 100%, 16%, 0.5), hsl(220, 30%, 5%))',
        }),
    },
}));

export default function ChangePassword(props: { disableCustomTheme?: boolean }) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [currentPasswordError, setCurrentPasswordError] = useState('');
    const [newPasswordError, setNewPasswordError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [dialog, setDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    const navigate = useNavigate();
    const { clearAuth, passwordChangeRequired, clearPasswordChangeRequired } = useAuth();

    const forceLogout = async () => {
        try { await logout(); } catch { /* ignore */ }
        clearPasswordChangeRequired();
        clearAuth();
        navigate('/login');
    };

    const validate = () => {
        let valid = true;

        if (!currentPassword) {
            setCurrentPasswordError('현재 비밀번호를 입력해주세요.');
            valid = false;
        } else {
            setCurrentPasswordError('');
        }

        if (!newPassword || newPassword.length < 6) {
            setNewPasswordError('새 비밀번호를 6자 이상 입력해주세요.');
            valid = false;
        } else if (newPassword === currentPassword) {
            setNewPasswordError('현재 비밀번호와 같은 비밀번호로 변경할 수 없습니다.');
            valid = false;
        } else {
            setNewPasswordError('');
        }

        if (newPassword !== confirmPassword) {
            setConfirmPasswordError('새 비밀번호가 일치하지 않습니다.');
            valid = false;
        } else {
            setConfirmPasswordError('');
        }

        return valid;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setLoading(true);
        setErrorMessage('');
        try {
            await changePassword({ currentPassword, newPassword });
            setDialog({
                title: '비밀번호 변경 완료',
                message: '비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요.',
                onConfirm: forceLogout,
            });
        } catch (err: unknown) {
            const axiosErr = err as { response?: { status?: number; data?: { code?: string; result?: Record<string, string> } } };
            const code = axiosErr.response?.data?.code ?? '';
            if (axiosErr.response?.status === 400 && code === 'VALIDATION_4001') {
                const result = axiosErr.response?.data?.result ?? {};
                if (result.currentPassword) setCurrentPasswordError(result.currentPassword);
                if (result.newPassword) setNewPasswordError(result.newPassword);
                return;
            }
            if (code === 'AUTH_4010') {
                setDialog({
                    title: '인증 오류',
                    message: ERROR_MESSAGES[code],
                    onConfirm: forceLogout,
                });
                return;
            } else if (code === 'AUTH_4011') {
                setCurrentPasswordError(ERROR_MESSAGES[code]);
            } else if (code === 'AUTH_4012') {
                setNewPasswordError(ERROR_MESSAGES[code]);
            } else {
                setErrorMessage(DEFAULT_ERROR);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppTheme {...props}>
            <CssBaseline enableColorScheme />
            <Container direction="column" justifyContent="space-between">
                <ColorModeSelect sx={{ position: 'fixed', top: '1rem', right: '1rem' }} />
                <Card variant="outlined">
                    <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: 1 }}>
                        InvestFeed
                    </Typography>
                    <Typography
                        component="h1"
                        variant="h4"
                        sx={{ width: '100%', fontSize: 'clamp(2rem, 10vw, 2.15rem)' }}
                    >
                        비밀번호 변경
                    </Typography>
                    {errorMessage && <Alert severity="error">{errorMessage}</Alert>}
                    <Box
                        component="form"
                        onSubmit={handleSubmit}
                        noValidate
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            width: '100%',
                            gap: 2,
                        }}
                    >
                        <FormControl>
                            <FormLabel htmlFor="currentPassword">현재 비밀번호</FormLabel>
                            <TextField
                                error={!!currentPasswordError}
                                helperText={currentPasswordError}
                                type="password"
                                id="currentPassword"
                                placeholder="현재 비밀번호"
                                autoComplete="current-password"
                                autoFocus
                                required
                                fullWidth
                                variant="outlined"
                                value={currentPassword}
                                onChange={(e) => { setCurrentPassword(e.target.value); if (currentPasswordError) setCurrentPasswordError(''); }}
                            />
                        </FormControl>
                        <FormControl>
                            <FormLabel htmlFor="newPassword">새 비밀번호</FormLabel>
                            <TextField
                                error={!!newPasswordError}
                                helperText={newPasswordError}
                                type="password"
                                id="newPassword"
                                placeholder="새 비밀번호 (6자 이상)"
                                autoComplete="new-password"
                                required
                                fullWidth
                                variant="outlined"
                                value={newPassword}
                                onChange={(e) => { setNewPassword(e.target.value); if (newPasswordError) setNewPasswordError(''); }}
                            />
                        </FormControl>
                        <FormControl>
                            <FormLabel htmlFor="confirmPassword">새 비밀번호 확인</FormLabel>
                            <TextField
                                error={!!confirmPasswordError}
                                helperText={confirmPasswordError}
                                type="password"
                                id="confirmPassword"
                                placeholder="새 비밀번호 확인"
                                autoComplete="new-password"
                                required
                                fullWidth
                                variant="outlined"
                                value={confirmPassword}
                                onChange={(e) => { setConfirmPassword(e.target.value); if (confirmPasswordError) setConfirmPasswordError(''); }}
                            />
                        </FormControl>
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={loading}
                        >
                            {loading ? '변경 중...' : '비밀번호 변경'}
                        </Button>
                    </Box>
                    {!passwordChangeRequired && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Typography sx={{ textAlign: 'center' }}>
                                <Link component={RouterLink} to="/" variant="body2">
                                    돌아가기
                                </Link>
                            </Typography>
                        </Box>
                    )}
                </Card>
                <Dialog open={!!dialog} onClose={() => {}}>
                    <DialogTitle>{dialog?.title}</DialogTitle>
                    <DialogContent>
                        <DialogContentText>{dialog?.message}</DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={dialog?.onConfirm} variant="contained" autoFocus>
                            확인
                        </Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </AppTheme>
    );
}

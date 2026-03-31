import {useState, useEffect, useRef, useCallback} from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SecurityKeypad from './SecurityKeypad';
import {changeSecondaryPassword, verifySecondaryPassword, fetchSecondaryPasswordLockStatus} from '../api/auth/AuthApi';

type Step = 'current' | 'new' | 'confirm';

const ERROR_MESSAGES: Record<string, string> = {
    AUTH_4041: '2차 비밀번호가 설정되지 않았습니다.',
    AUTH_4042: '현재 2차 비밀번호가 올바르지 않습니다.',
    AUTH_4043: '현재 2차 비밀번호와 동일한 비밀번호로 변경할 수 없습니다.',
};

interface ChangeSecondaryPasswordDialogProps {
    open: boolean;
    onSuccess: () => void;
    onClose: () => void;
}

export default function ChangeSecondaryPasswordDialog({open, onSuccess, onClose}: ChangeSecondaryPasswordDialogProps) {
    const [step, setStep] = useState<Step>('current');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [remainingSeconds, setRemainingSeconds] = useState(0);
    const [key, setKey] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const locked = remainingSeconds > 0;

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const startCountdown = useCallback((seconds: number) => {
        clearTimer();
        setRemainingSeconds(seconds);
        timerRef.current = setInterval(() => {
            setRemainingSeconds(prev => {
                if (prev <= 1) {
                    clearTimer();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, [clearTimer]);

    useEffect(() => {
        if (open) {
            (async () => {
                try {
                    const res = await fetchSecondaryPasswordLockStatus();
                    const seconds = res.result?.remainingSeconds ?? 0;
                    if (seconds > 0) startCountdown(seconds);
                } catch { /* ignore */ }
            })();
        }
    }, [open, startCountdown]);

    useEffect(() => () => clearTimer(), [clearTimer]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    const resetState = () => {
        setStep('current');
        setCurrentPassword('');
        setNewPassword('');
        setError('');
        setLoading(false);
        setRemainingSeconds(0);
        clearTimer();
        setKey(prev => prev + 1);
    };

    const handleLockError = (err: unknown): boolean => {
        const axiosErr = err as { response?: { data?: { code?: string; result?: { remainingSeconds?: number } } } };
        if (axiosErr.response?.data?.code === 'AUTH_4044') {
            const seconds = axiosErr.response?.data?.result?.remainingSeconds ?? 0;
            if (seconds > 0) startCountdown(seconds);
            return true;
        }
        return false;
    };

    const handleCurrentInput = async (code: string) => {
        setLoading(true);
        setError('');
        try {
            await verifySecondaryPassword({password: code});
            setCurrentPassword(code);
            setStep('new');
            setKey(prev => prev + 1);
        } catch (err: unknown) {
            if (!handleLockError(err)) {
                const axiosErr = err as { response?: { data?: { code?: string } } };
                const errCode = axiosErr.response?.data?.code ?? '';
                setError(ERROR_MESSAGES[errCode] ?? '현재 2차 비밀번호가 올바르지 않습니다.');
            }
            setKey(prev => prev + 1);
        } finally {
            setLoading(false);
        }
    };

    const handleNewInput = (code: string) => {
        setNewPassword(code);
        setStep('confirm');
        setError('');
        setKey(prev => prev + 1);
    };

    const handleConfirmInput = async (code: string) => {
        if (code !== newPassword) {
            setError('새 비밀번호가 일치하지 않습니다. 다시 입력해주세요.');
            setStep('new');
            setNewPassword('');
            setKey(prev => prev + 1);
            return;
        }

        setLoading(true);
        try {
            await changeSecondaryPassword({currentPassword, newPassword});
            resetState();
            onSuccess();
        } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { code?: string } } };
            const errCode = axiosErr.response?.data?.code ?? '';
            setError(ERROR_MESSAGES[errCode] ?? '2차 비밀번호 변경에 실패했습니다.');
            setStep('current');
            setCurrentPassword('');
            setNewPassword('');
            setKey(prev => prev + 1);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const getTitle = () => {
        if (step === 'current') return '현재 2차 비밀번호';
        if (step === 'new') return '새 2차 비밀번호';
        return '새 2차 비밀번호 확인';
    };

    const getDescription = () => {
        if (step === 'current') return '현재 2차 비밀번호를 입력해주세요.';
        if (step === 'new') return '새로운 2차 비밀번호를 입력해주세요.';
        return '확인을 위해 한 번 더 입력해주세요.';
    };

    const handleComplete = () => {
        if (step === 'current') return handleCurrentInput;
        if (step === 'new') return handleNewInput;
        return handleConfirmInput;
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
            <Box sx={{display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 3}}>
                <Box sx={{
                    width: 48, height: 48, borderRadius: '50%',
                    bgcolor: 'primary.light', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1
                }}>
                    <LockOutlinedIcon sx={{color: 'primary.contrastText'}}/>
                </Box>
            </Box>
            <DialogTitle sx={{textAlign: 'center', pb: 0.5}}>{getTitle()}</DialogTitle>
            <DialogContent>
                <DialogContentText sx={{textAlign: 'center', mb: 2}}>{getDescription()}</DialogContentText>
                {locked && (
                    <Alert severity="warning" sx={{mb: 2}}>
                        2차 비밀번호 입력이 잠금되었습니다. {formatTime(remainingSeconds)} 후에 다시 시도하세요.
                    </Alert>
                )}
                {!locked && error && <Alert severity="error" sx={{mb: 2}}>{error}</Alert>}
                <SecurityKeypad
                    key={key}
                    onComplete={handleComplete()}
                    disabled={loading || locked}
                />
            </DialogContent>
        </Dialog>
    );
}
